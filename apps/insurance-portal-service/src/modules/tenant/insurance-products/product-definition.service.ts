import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  ProductDefinitionSnapshot,
  ProductLifecycleStatus,
  ProductReviewStatus,
  ProductVersionStatus,
} from '@insurance-max/contracts';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import { AuditService } from '../../shared/audit/audit.service';
import { PricingRuntimeCacheService } from '../pricing/application/pricing-runtime-cache.service';
import { InsuranceProduct } from './entities/insurance-product.entity';
import { InsuranceProductVersion } from './entities/insurance-product-version.entity';
import { ProductDefinitionItem } from './entities/product-definition-item.entity';
import { ProductAddonDefinition } from './entities/product-addon-definition.entity';
import { ProductDocumentRequirement } from './entities/product-document-requirement.entity';
import { ProductVersionSubClass } from './entities/product-version-sub-class.entity';
import { InsuranceSubClass } from '../insurance-sub-classes/entities/insurance-sub-class.entity';
import { UpsertProductVersionDto } from './dto/upsert-product-version.dto';

const VERSION_RELATIONS = {
  product: { category: true },
  definition_items: true,
  addons: true,
  document_requirements: true,
  sub_classes: true,
} as const;

@Injectable()
export class ProductDefinitionService {
  constructor(
    @InjectRepository(InsuranceProduct)
    private readonly productRepository: Repository<InsuranceProduct>,

    @InjectRepository(InsuranceProductVersion)
    private readonly versionRepository: Repository<InsuranceProductVersion>,

    private readonly dataSource: DataSource,
    private readonly hashService: ProductDefinitionHashService,
    private readonly auditService: AuditService,
    private readonly pricingCache: PricingRuntimeCacheService,
  ) {}

  async listVersions(companyId: string, productId: string) {
    await this.requireProduct(companyId, productId);

    return this.versionRepository.find({
      where: { company_id: companyId, product_id: productId },
      order: { version_number: 'DESC' },
    });
  }

  async findVersion(companyId: string, productId: string, versionId: string) {
    const version = await this.versionRepository.findOne({
      where: { id: versionId, company_id: companyId, product_id: productId },
      relations: VERSION_RELATIONS,
    });

    if (!version) {
      throw new NotFoundException('Product version was not found');
    }

    return version;
  }

  async createNextVersion(
    companyId: string,
    productId: string,
    actorUserId: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const product = await manager
        .getRepository(InsuranceProduct)
        .createQueryBuilder('product')
        .setLock('pessimistic_write')
        .where('product.id = :productId', { productId })
        .andWhere('product.company_id = :companyId', { companyId })
        .getOne();

      if (!product) {
        throw new NotFoundException('Product was not found');
      }

      const existingDraft = await manager
        .getRepository(InsuranceProductVersion)
        .findOne({
          where: {
            product_id: product.id,
            status: ProductVersionStatus.DRAFT,
          },
        });

      if (existingDraft) {
        throw new ConflictException(
          'The product already has an editable draft version',
        );
      }

      const source = product.current_version_id
        ? await this.findVersionWithManager(
            manager,
            companyId,
            product.id,
            product.current_version_id,
          )
        : null;

      const versionNumber = product.latest_version_number + 1;

      const draft = await manager.getRepository(InsuranceProductVersion).save({
        company_id: companyId,
        product_id: product.id,
        version_number: versionNumber,
        status: ProductVersionStatus.DRAFT,
        review_status: ProductReviewStatus.DRAFT,
        product_name: source?.product_name ?? product.product_name,
        description: source?.description ?? product.description,
        business_line: source?.business_line ?? product.business_line,
        supports_fleet: source?.supports_fleet ?? product.supports_fleet,
        tiramis_product_code:
          source?.tiramis_product_code ?? product.tiramis_product_code,
        cover_note_type:
          source?.cover_note_type ??
          (product.business_line === 'MOTOR' ? 3 : 1),
        default_cover_duration_days: source?.default_cover_duration_days ?? 365,
        currency_code: source?.currency_code ?? 'TZS',
        cover_note_description:
          source?.cover_note_description ??
          product.description ??
          product.product_name,
        operative_clause: source?.operative_clause ?? product.product_name,
        policy_operative_clause:
          source?.policy_operative_clause ?? product.product_name,
        special_conditions: source?.special_conditions ?? '',
        exclusions: source?.exclusions ?? '',
        allows_cover_text_override: source?.allows_cover_text_override ?? false,
        effective_from: null,
        effective_to: null,
        is_submission_ready: false,
        definition_hash: null,
        created_by: actorUserId,
        updated_by: actorUserId,
      });

      if (source) {
        await this.cloneChildren(manager, source, draft);
      }

      product.latest_version_number = versionNumber;
      await manager.getRepository(InsuranceProduct).save(product);

      return this.findVersionWithManager(
        manager,
        companyId,
        product.id,
        draft.id,
      );
    });
  }

  async updateDraft(
    companyId: string,
    productId: string,
    versionId: string,
    dto: UpsertProductVersionDto,
    actorUserId: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const version = await this.findVersionWithManager(
        manager,
        companyId,
        productId,
        versionId,
      );

      if (version.status !== ProductVersionStatus.DRAFT) {
        throw new ConflictException(
          'Published or retired product versions are immutable',
        );
      }

      if (version.review_status === ProductReviewStatus.IN_REVIEW) {
        throw new ConflictException(
          'Return the version from review before editing it',
        );
      }

      const product = version.product;

      if (product.business_line !== 'MOTOR' && dto.supports_fleet) {
        throw new BadRequestException(
          'Only motor products can support fleet quotations',
        );
      }

      this.assertDateRange(dto.effective_from, dto.effective_to);

      const subClasses = dto.sub_class_ids?.length
        ? await manager.getRepository(InsuranceSubClass).find({
            where: {
              id: In(dto.sub_class_ids),
              company_id: companyId,
              product_id: productId,
              is_active: true,
            },
          })
        : [];

      if (subClasses.length !== (dto.sub_class_ids?.length ?? 0)) {
        throw new BadRequestException(
          'One or more active subclasses were not found for this product',
        );
      }

      if (
        dto.default_sub_class_id &&
        !dto.sub_class_ids?.includes(dto.default_sub_class_id)
      ) {
        throw new BadRequestException(
          'The default subclass must be included in sub_class_ids',
        );
      }

      version.product_name = dto.product_name.trim();
      version.description = dto.description?.trim() || null;
      // Kept in sync with the product's category while still a draft — the
      // category (and therefore business line) can change up until
      // publication, at which point the version becomes immutable.
      version.business_line = product.business_line;
      version.supports_fleet =
        product.business_line === 'MOTOR'
          ? (dto.supports_fleet ?? false)
          : false;
      version.tiramis_product_code = dto.tiramis_product_code
        .trim()
        .toUpperCase();
      version.cover_note_type = dto.cover_note_type;
      version.default_cover_duration_days = dto.default_cover_duration_days;
      version.currency_code = dto.currency_code.trim().toUpperCase();
      version.cover_note_description = dto.cover_note_description.trim();
      version.operative_clause = dto.operative_clause.trim();
      version.policy_operative_clause = dto.policy_operative_clause.trim();
      version.special_conditions = dto.special_conditions.trim();
      version.exclusions = dto.exclusions.trim();
      version.allows_cover_text_override =
        dto.allows_cover_text_override ?? false;
      version.effective_from = dto.effective_from;
      version.effective_to = dto.effective_to ?? null;
      version.review_status = ProductReviewStatus.DRAFT;
      version.review_comments = null;
      version.is_submission_ready = false;
      version.definition_hash = null;
      version.updated_by = actorUserId;

      await manager.getRepository(InsuranceProductVersion).save(version);

      await Promise.all([
        manager
          .getRepository(ProductDefinitionItem)
          .delete({ product_version_id: version.id }),
        manager
          .getRepository(ProductAddonDefinition)
          .delete({ product_version_id: version.id }),
        manager
          .getRepository(ProductDocumentRequirement)
          .delete({ product_version_id: version.id }),
        manager
          .getRepository(ProductVersionSubClass)
          .delete({ product_version_id: version.id }),
      ]);

      const duplicateCodes = this.findDuplicateCodes([
        ...dto.definition_items.map((item) => item.code),
        ...dto.addons.map((addon) => addon.code),
        ...dto.document_requirements.map((requirement) => requirement.code),
      ]);

      if (duplicateCodes.length) {
        throw new BadRequestException({
          code: 'DUPLICATE_PRODUCT_DEFINITION_CODES',
          message: 'Product-definition codes must be unique',
          details: { duplicateCodes },
        });
      }

      await manager.getRepository(ProductDefinitionItem).save(
        dto.definition_items.map((item) => ({
          company_id: companyId,
          product_version_id: version.id,
          code: item.code.trim().toUpperCase(),
          item_type: item.item_type,
          title: item.title.trim(),
          description: item.description.trim(),
          is_mandatory: item.is_mandatory ?? true,
          sort_order: item.sort_order ?? 100,
        })),
      );

      await manager.getRepository(ProductAddonDefinition).save(
        dto.addons.map((addon) => ({
          company_id: companyId,
          product_version_id: version.id,
          code: addon.code.trim().toUpperCase(),
          tiramis_addon_code: addon.tiramis_addon_code?.trim()
            ? addon.tiramis_addon_code.trim().toUpperCase()
            : null,
          name: addon.name.trim(),
          description: addon.description?.trim() ?? null,
          is_optional: addon.is_optional ?? true,
          is_default_selected: addon.is_default_selected ?? false,
          allows_separate_sum_insured:
            addon.allows_separate_sum_insured ?? false,
          maximum_quantity: addon.maximum_quantity ?? null,
          sort_order: addon.sort_order ?? 100,
        })),
      );

      await manager.getRepository(ProductDocumentRequirement).save(
        dto.document_requirements.map((requirement) => ({
          company_id: companyId,
          product_version_id: version.id,
          code: requirement.code.trim().toUpperCase(),
          requirement_type: requirement.requirement_type,
          applies_to: requirement.applies_to,
          name: requirement.name.trim(),
          description: requirement.description?.trim() ?? null,
          is_mandatory: requirement.is_mandatory ?? true,
          accepted_mime_types: requirement.accepted_mime_types ?? [],
          maximum_file_size_mb: requirement.maximum_file_size_mb ?? null,
          sort_order: requirement.sort_order ?? 100,
        })),
      );

      await manager.getRepository(ProductVersionSubClass).save(
        subClasses.map((subClass) => ({
          company_id: companyId,
          product_version_id: version.id,
          sub_class_id: subClass.id,
          code_snapshot: subClass.code,
          name_snapshot: subClass.name,
          description_snapshot: subClass.description,
          tiramis_sub_class_code_snapshot: subClass.tiramis_sub_class_code,
          cover_type_code_snapshot: subClass.cover_type_code,
          is_default: subClass.id === dto.default_sub_class_id,
          sort_order: subClass.sort_order,
        })),
      );

      return this.findVersionWithManager(
        manager,
        companyId,
        productId,
        versionId,
      );
    });
  }

  async submitForReview(
    companyId: string,
    productId: string,
    versionId: string,
    actorUserId: string,
  ) {
    const version = await this.findVersion(companyId, productId, versionId);

    if (version.status !== ProductVersionStatus.DRAFT) {
      throw new ConflictException(
        'Only a draft version can be submitted for review',
      );
    }

    this.validateDefinition(version);

    version.review_status = ProductReviewStatus.IN_REVIEW;
    version.submitted_for_review_by = actorUserId;
    version.submitted_for_review_at = new Date();
    version.review_comments = null;
    version.updated_by = actorUserId;

    return this.versionRepository.save(version);
  }

  async rejectReview(
    companyId: string,
    productId: string,
    versionId: string,
    comments: string,
    actorUserId: string,
  ) {
    const version = await this.findVersion(companyId, productId, versionId);

    if (
      version.status !== ProductVersionStatus.DRAFT ||
      version.review_status !== ProductReviewStatus.IN_REVIEW
    ) {
      throw new ConflictException('Only a version in review can be rejected');
    }

    version.review_status = ProductReviewStatus.REJECTED;
    version.review_comments = comments.trim();
    version.reviewed_by = actorUserId;
    version.reviewed_at = new Date();
    version.updated_by = actorUserId;

    return this.versionRepository.save(version);
  }

  async returnToDraft(
    companyId: string,
    productId: string,
    versionId: string,
    actorUserId: string,
  ) {
    const version = await this.findVersion(companyId, productId, versionId);

    if (version.status !== ProductVersionStatus.DRAFT) {
      throw new ConflictException(
        'Only an unpublished version can return to draft',
      );
    }

    version.review_status = ProductReviewStatus.DRAFT;
    version.updated_by = actorUserId;

    return this.versionRepository.save(version);
  }

  async publish(
    companyId: string,
    productId: string,
    versionId: string,
    actorUserId: string,
  ) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const version = await this.findVersionWithManager(
          manager,
          companyId,
          productId,
          versionId,
        );

        if (
          version.status !== ProductVersionStatus.DRAFT ||
          version.review_status !== ProductReviewStatus.IN_REVIEW
        ) {
          throw new ConflictException(
            'The version must be in review before it can be published',
          );
        }

        this.validateDefinition(version);
        await this.assertNoEffectiveOverlap(manager, version);

        const snapshot = this.buildSnapshot(version);
        // publishedAt/definitionHash are provenance metadata set as a
        // side effect of publishing, not part of the hashed content —
        // otherwise the hash could never reproduce against its own
        // snapshot once publishedAt is populated.
        const definitionHash = this.hashService.hashDefinition({
          ...snapshot,
          definitionHash: '',
          publishedAt: null,
        });

        version.status = ProductVersionStatus.PUBLISHED;
        version.review_status = ProductReviewStatus.APPROVED;
        version.is_submission_ready = true;
        version.definition_hash = definitionHash;
        version.reviewed_by = actorUserId;
        version.reviewed_at = new Date();
        version.published_by = actorUserId;
        version.published_at = new Date();
        version.updated_by = actorUserId;

        await manager.getRepository(InsuranceProductVersion).save(version);

        const product = version.product;
        product.lifecycle_status = ProductLifecycleStatus.ACTIVE;
        product.current_version_id = version.id;
        product.code_locked_at = product.code_locked_at ?? new Date();

        /*
         * Compatibility projection.
         */
        product.product_name = version.product_name;
        product.description = version.description;
        product.business_line = version.business_line;
        product.supports_fleet = version.supports_fleet;
        product.tiramis_product_code = version.tiramis_product_code;
        product.is_active = true;
        product.updated_by = actorUserId;

        await manager.getRepository(InsuranceProduct).save(product);

        await this.auditService.logCritical(
          {
            userId: actorUserId,
            companyId,
            action: 'product_version.published',
            eventCategory: 'product_catalogue',
            resource: 'insurance_product_version',
            resourceId: version.id,
            afterState: {
              productId,
              versionNumber: version.version_number,
              effectiveFrom: version.effective_from,
              effectiveTo: version.effective_to,
              tiramisProductCode: version.tiramis_product_code,
              definitionHash,
            },
          },
          manager,
        );

        return { ...this.buildSnapshot(version), definitionHash };
      });
    } finally {
      await this.pricingCache.invalidateProductConfiguration(companyId);
    }
  }

  async retire(
    companyId: string,
    productId: string,
    versionId: string,
    actorUserId: string,
  ) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const version = await this.findVersionWithManager(
          manager,
          companyId,
          productId,
          versionId,
        );

        if (version.status !== ProductVersionStatus.PUBLISHED) {
          throw new ConflictException(
            'Only a published version can be retired',
          );
        }

        version.status = ProductVersionStatus.RETIRED;
        version.retired_by = actorUserId;
        version.retired_at = new Date();
        version.updated_by = actorUserId;

        await manager.getRepository(InsuranceProductVersion).save(version);

        const product = version.product;
        if (product.current_version_id === version.id) {
          product.lifecycle_status = ProductLifecycleStatus.RETIRED;
          product.is_active = false;
          product.updated_by = actorUserId;
          await manager.getRepository(InsuranceProduct).save(product);
        }

        await this.auditService.logCritical(
          {
            userId: actorUserId,
            companyId,
            action: 'product_version.retired',
            eventCategory: 'product_catalogue',
            resource: 'insurance_product_version',
            resourceId: version.id,
            afterState: {
              productId,
              versionNumber: version.version_number,
            },
          },
          manager,
        );

        return this.buildSnapshot(version);
      });
    } finally {
      await this.pricingCache.invalidateProductConfiguration(companyId);
    }
  }

  async resolvePublishedDefinition(
    companyId: string,
    productId: string,
    subClassId?: string | null,
    effectiveDate = new Date(),
  ): Promise<ProductDefinitionSnapshot> {
    const date = effectiveDate.toISOString().slice(0, 10);

    const version = await this.versionRepository
      .createQueryBuilder('version')
      .innerJoinAndSelect('version.product', 'product')
      .innerJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('version.definition_items', 'definitionItems')
      .leftJoinAndSelect('version.addons', 'addons')
      .leftJoinAndSelect('version.document_requirements', 'requirements')
      .leftJoinAndSelect('version.sub_classes', 'subClasses')
      .where('version.company_id = :companyId', { companyId })
      .andWhere('version.product_id = :productId', { productId })
      .andWhere('version.status = :status', {
        status: ProductVersionStatus.PUBLISHED,
      })
      .andWhere('version.review_status = :reviewStatus', {
        reviewStatus: ProductReviewStatus.APPROVED,
      })
      .andWhere('version.is_submission_ready = true')
      .andWhere('version.effective_from <= :date', { date })
      .andWhere(
        '(version.effective_to IS NULL OR version.effective_to >= :date)',
        { date },
      )
      .orderBy('version.version_number', 'DESC')
      .getOne();

    if (!version) {
      throw new ForbiddenException({
        code: 'PRODUCT_DEFINITION_NOT_AVAILABLE',
        message:
          'No approved product definition is effective for the selected date',
      });
    }

    if (subClassId) {
      const allowed = version.sub_classes.some(
        (assignment) => assignment.sub_class_id === subClassId,
      );

      if (!allowed) {
        throw new ForbiddenException({
          code: 'PRODUCT_SUB_CLASS_NOT_AVAILABLE',
          message:
            'The selected subclass is not available under this product version',
        });
      }
    }

    return this.buildSnapshot(version);
  }

  private validateDefinition(version: InsuranceProductVersion) {
    const missing: string[] = [];

    const requiredText: Array<[string, string | null]> = [
      ['tiramis_product_code', version.tiramis_product_code],
      ['cover_note_description', version.cover_note_description],
      ['operative_clause', version.operative_clause],
      ['policy_operative_clause', version.policy_operative_clause],
    ];

    for (const [field, value] of requiredText) {
      if (!value?.trim()) {
        missing.push(field);
      }
    }

    if (!version.effective_from) {
      missing.push('effective_from');
    }

    if (version.business_line === 'MOTOR' && version.cover_note_type < 1) {
      missing.push('cover_note_type');
    }

    const duplicateCodes = this.findDuplicateCodes([
      ...version.definition_items.map((item) => item.code),
      ...version.addons.map((addon) => addon.code),
      ...version.document_requirements.map((requirement) => requirement.code),
    ]);

    if (duplicateCodes.length) {
      throw new BadRequestException({
        code: 'DUPLICATE_PRODUCT_DEFINITION_CODES',
        message: 'Product-definition codes must be unique',
        details: { duplicateCodes },
      });
    }

    if (missing.length) {
      throw new BadRequestException({
        code: 'PRODUCT_DEFINITION_INCOMPLETE',
        message: 'The product definition is incomplete',
        details: { missing },
      });
    }
  }

  private buildSnapshot(
    version: InsuranceProductVersion,
  ): ProductDefinitionSnapshot {
    const product = version.product;
    const category = product.category;

    return {
      productId: product.id,
      productVersionId: version.id,
      versionNumber: version.version_number,

      categoryId: category.id,
      categoryCode: category.code,
      categoryName: category.name,

      productCode: product.product_code,
      productName: version.product_name,
      description: version.description,

      businessLine: version.business_line,
      lifecycleStatus: product.lifecycle_status,
      versionStatus: version.status,
      reviewStatus: version.review_status,

      tiramisProductCode: version.tiramis_product_code!,

      supportsFleet: version.supports_fleet,
      coverNoteType: version.cover_note_type,
      defaultCoverDurationDays: version.default_cover_duration_days,
      currencyCode: version.currency_code,

      coverNoteDescription: version.cover_note_description!,
      operativeClause: version.operative_clause!,
      policyOperativeClause: version.policy_operative_clause!,
      specialConditions: version.special_conditions ?? '',
      exclusions: version.exclusions ?? '',

      allowsCoverTextOverride: version.allows_cover_text_override,

      effectiveFrom: version.effective_from!,
      effectiveTo: version.effective_to,

      definitionItems: version.definition_items
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((item) => ({
          id: item.id,
          code: item.code,
          itemType: item.item_type,
          title: item.title,
          description: item.description,
          isMandatory: item.is_mandatory,
          sortOrder: item.sort_order,
        })),

      addons: version.addons
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((addon) => ({
          id: addon.id,
          code: addon.code,
          tiraAddonCode: addon.tiramis_addon_code,
          name: addon.name,
          description: addon.description,
          isOptional: addon.is_optional,
          isDefaultSelected: addon.is_default_selected,
          allowsSeparateSumInsured: addon.allows_separate_sum_insured,
          maximumQuantity: addon.maximum_quantity,
          sortOrder: addon.sort_order,
        })),

      documentRequirements: version.document_requirements
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((requirement) => ({
          id: requirement.id,
          code: requirement.code,
          requirementType: requirement.requirement_type,
          appliesTo: requirement.applies_to,
          name: requirement.name,
          description: requirement.description,
          isMandatory: requirement.is_mandatory,
          acceptedMimeTypes: requirement.accepted_mime_types,
          maximumFileSizeMb: requirement.maximum_file_size_mb,
          sortOrder: requirement.sort_order,
        })),

      subClasses: version.sub_classes
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((assignment) => ({
          id: assignment.sub_class_id,
          code: assignment.code_snapshot,
          name: assignment.name_snapshot,
          description: assignment.description_snapshot,
          tiramisSubClassCode: assignment.tiramis_sub_class_code_snapshot,
          coverTypeCode: assignment.cover_type_code_snapshot,
          isDefault: assignment.is_default,
          sortOrder: assignment.sort_order,
        })),

      definitionHash: version.definition_hash ?? '',
      publishedAt: version.published_at?.toISOString() ?? null,
    };
  }

  private async requireProduct(companyId: string, productId: string) {
    const product = await this.productRepository.findOne({
      where: { id: productId, company_id: companyId },
    });

    if (!product) {
      throw new NotFoundException('Product was not found');
    }

    return product;
  }

  private assertDateRange(from: string, to?: string | null) {
    if (to && new Date(from) > new Date(to)) {
      throw new BadRequestException(
        'effective_from must be before or equal to effective_to',
      );
    }
  }

  private findDuplicateCodes(codes: string[]) {
    const counts = new Map<string, number>();

    for (const value of codes) {
      const code = value.trim().toUpperCase();
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }

    return [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([code]) => code);
  }

  private findVersionWithManager(
    manager: EntityManager,
    companyId: string,
    productId: string,
    versionId: string,
  ) {
    return manager.getRepository(InsuranceProductVersion).findOneOrFail({
      where: { id: versionId, company_id: companyId, product_id: productId },
      relations: VERSION_RELATIONS,
    });
  }

  private async assertNoEffectiveOverlap(
    manager: EntityManager,
    version: InsuranceProductVersion,
  ) {
    const overlap = await manager
      .getRepository(InsuranceProductVersion)
      .createQueryBuilder('other')
      .where('other.product_id = :productId', {
        productId: version.product_id,
      })
      .andWhere('other.id != :versionId', { versionId: version.id })
      .andWhere('other.status = :status', {
        status: ProductVersionStatus.PUBLISHED,
      })
      .andWhere(
        `daterange(other.effective_from, COALESCE(other.effective_to, 'infinity'::date), '[]')
         && daterange(:effectiveFrom::date, COALESCE(:effectiveTo::date, 'infinity'::date), '[]')`,
        {
          effectiveFrom: version.effective_from,
          effectiveTo: version.effective_to,
        },
      )
      .getExists();

    if (overlap) {
      throw new ConflictException(
        'The product version effective period overlaps another published version',
      );
    }
  }

  private async cloneChildren(
    manager: EntityManager,
    source: InsuranceProductVersion,
    target: InsuranceProductVersion,
  ) {
    if (source.definition_items.length) {
      await manager.getRepository(ProductDefinitionItem).save(
        source.definition_items.map((item) => ({
          company_id: target.company_id,
          product_version_id: target.id,
          code: item.code,
          item_type: item.item_type,
          title: item.title,
          description: item.description,
          is_mandatory: item.is_mandatory,
          sort_order: item.sort_order,
        })),
      );
    }

    if (source.addons.length) {
      await manager.getRepository(ProductAddonDefinition).save(
        source.addons.map((addon) => ({
          company_id: target.company_id,
          product_version_id: target.id,
          code: addon.code,
          tiramis_addon_code: addon.tiramis_addon_code,
          name: addon.name,
          description: addon.description,
          is_optional: addon.is_optional,
          is_default_selected: addon.is_default_selected,
          allows_separate_sum_insured: addon.allows_separate_sum_insured,
          maximum_quantity: addon.maximum_quantity,
          sort_order: addon.sort_order,
        })),
      );
    }

    if (source.document_requirements.length) {
      await manager.getRepository(ProductDocumentRequirement).save(
        source.document_requirements.map((requirement) => ({
          company_id: target.company_id,
          product_version_id: target.id,
          code: requirement.code,
          requirement_type: requirement.requirement_type,
          applies_to: requirement.applies_to,
          name: requirement.name,
          description: requirement.description,
          is_mandatory: requirement.is_mandatory,
          accepted_mime_types: requirement.accepted_mime_types,
          maximum_file_size_mb: requirement.maximum_file_size_mb,
          sort_order: requirement.sort_order,
        })),
      );
    }

    if (source.sub_classes.length) {
      await manager.getRepository(ProductVersionSubClass).save(
        source.sub_classes.map((assignment) => ({
          company_id: target.company_id,
          product_version_id: target.id,
          sub_class_id: assignment.sub_class_id,
          code_snapshot: assignment.code_snapshot,
          name_snapshot: assignment.name_snapshot,
          description_snapshot: assignment.description_snapshot,
          tiramis_sub_class_code_snapshot:
            assignment.tiramis_sub_class_code_snapshot,
          cover_type_code_snapshot: assignment.cover_type_code_snapshot,
          is_default: assignment.is_default,
          sort_order: assignment.sort_order,
        })),
      );
    }
  }
}
