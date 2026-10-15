import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { ProductVersionStatus } from '@insurance-max/contracts';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import { isPagedRequest } from '@insurance-max/portal-shared/dto/table-query.dto';
import { paginateQueryBuilder } from '@insurance-max/portal-shared/utils/paginate-query.util';
import { InsuranceProductVersion } from '../insurance-products/entities/insurance-product-version.entity';
import { ProductAddonDefinition } from '../insurance-products/entities/product-addon-definition.entity';
import { InsuranceRisk } from '../insurance-risks/entities/insurance-risk.entity';
import { RiskRequiredFactor } from '../risk-required-factors/entities/risk-required-factor.entity';
import { ProductAddonRateRule } from '../pricing/entities/product-addon-rate-rule.entity';
import { RiskRuleCondition } from '../risk-rule-conditions/entities/risk-rule-condition.entity';
import { RiskRatingRule } from '../risk-rating-rules/entities/risk-rating-rule.entity';
import { ClonePricingRateBookDto } from './dto/clone-pricing-rate-book.dto';
import { CreatePricingRateBookDto } from './dto/create-pricing-rate-book.dto';
import { FilterPricingRateBookDto } from './dto/filter-pricing-rate-book.dto';
import { UpdatePricingRateBookDto } from './dto/update-pricing-rate-book.dto';
import { CreateAddonRateRuleDto } from './dto/create-addon-rate-rule.dto';
import { UpdateAddonRateRuleDto } from './dto/update-addon-rate-rule.dto';
import { PricingRateBookStatus } from './enums/pricing-rate-book-status.enum';
import { PricingRateBook } from './entities/pricing-rate-book.entity';
import { PricingRuntimeCacheService } from '../pricing/application/pricing-runtime-cache.service';
import { PricingRateBookEditabilityService } from './pricing-rate-book-editability.service';
import { PricingRateBookValidationService } from './pricing-rate-book-validation.service';

@Injectable()
export class PricingRateBooksService {
  constructor(
    @InjectRepository(PricingRateBook)
    private readonly rateBookRepository: Repository<PricingRateBook>,

    @InjectRepository(InsuranceProductVersion)
    private readonly productVersionRepository: Repository<InsuranceProductVersion>,

    @InjectRepository(RiskRatingRule)
    private readonly ruleRepository: Repository<RiskRatingRule>,

    @InjectRepository(RiskRuleCondition)
    private readonly conditionRepository: Repository<RiskRuleCondition>,

    @InjectRepository(ProductAddonRateRule)
    private readonly addonRateRuleRepository: Repository<ProductAddonRateRule>,

    @InjectRepository(ProductAddonDefinition)
    private readonly addonDefinitionRepository: Repository<ProductAddonDefinition>,

    private readonly pricingRuntimeCacheService: PricingRuntimeCacheService,
    private readonly editabilityService: PricingRateBookEditabilityService,
    private readonly validationService: PricingRateBookValidationService,
    private readonly hashService: ProductDefinitionHashService,
  ) {}

  async create(
    companyId: string,
    dto: CreatePricingRateBookDto,
    userId: string,
  ): Promise<PricingRateBook> {
    const productVersion = await this.requirePublishedProductVersion(
      companyId,
      dto.product_version_id,
    );
    this.assertEffectiveDateRange(dto.effective_from, dto.effective_to ?? null);
    this.assertWithinProductVersionPeriod(
      dto.effective_from,
      dto.effective_to ?? null,
      productVersion,
    );

    const entity = this.rateBookRepository.create({
      company_id: companyId,
      product_id: productVersion.product_id,
      product_version_id: productVersion.id,
      product_definition_hash: productVersion.definition_hash,
      code: dto.code.trim().toUpperCase(),
      version: dto.version.trim(),
      name: dto.name?.trim() ?? null,
      currency_code: dto.currency_code?.trim().toUpperCase() ?? null,
      status: PricingRateBookStatus.DRAFT,
      effective_from: dto.effective_from,
      effective_to: dto.effective_to ?? null,
      ...(dto.rounding_mode !== undefined
        ? { rounding_mode: dto.rounding_mode }
        : {}),
      ...(dto.rounding_increment !== undefined
        ? { rounding_increment: String(dto.rounding_increment) }
        : {}),
      ...(dto.proration_method !== undefined
        ? { proration_method: dto.proration_method }
        : {}),
      created_by: userId,
      updated_by: userId,
    });

    try {
      return await this.rateBookRepository.save(entity);
    } catch (error) {
      this.rethrowDuplicate(error, entity.code, entity.version);
      throw error;
    }
  }

  async findAll(companyId: string, query: FilterPricingRateBookDto) {
    const qb = this.rateBookRepository
      .createQueryBuilder('rate_book')
      .leftJoinAndSelect('rate_book.product', 'product')
      .where('rate_book.company_id = :companyId', { companyId });

    if (query.product_id) {
      qb.andWhere('rate_book.product_id = :productId', {
        productId: query.product_id,
      });
    }
    if (query.status) {
      qb.andWhere('rate_book.status = :status', { status: query.status });
    }

    if (isPagedRequest(query)) {
      return paginateQueryBuilder(qb, query, {
        sortable: {
          created_at: 'rate_book.created_at',
          code: 'rate_book.code',
          name: 'rate_book.name',
          version: 'rate_book.version',
          product: 'product.product_name',
          effective_from: 'rate_book.effective_from',
          status: 'rate_book.status',
        },
        defaultSort: 'created_at',
        searchable: [
          'rate_book.code',
          'rate_book.name',
          'rate_book.version',
          'product.product_name',
        ],
        tieBreaker: 'rate_book.id',
      });
    }

    return qb.orderBy('rate_book.created_at', 'DESC').getMany();
  }

  async findOne(companyId: string, id: string): Promise<PricingRateBook> {
    const rateBook = await this.rateBookRepository.findOne({
      where: { id, company_id: companyId },
      relations: {
        product: true,
        rules: {
          risk: true,
          conditions: true,
        },
      },
      order: {
        rules: {
          priority: 'ASC',
          created_at: 'ASC',
        },
      },
    });
    if (!rateBook) {
      throw new NotFoundException('Pricing rate book not found');
    }
    return rateBook;
  }

  async update(
    companyId: string,
    id: string,
    dto: UpdatePricingRateBookDto,
    userId: string,
  ): Promise<PricingRateBook> {
    const rateBook = await this.requireRateBook(companyId, id);
    this.assertEditable(rateBook);

    let productVersion: InsuranceProductVersion | null = null;
    if (dto.product_version_id !== undefined) {
      productVersion = await this.requirePublishedProductVersion(
        companyId,
        dto.product_version_id,
      );
      rateBook.product_version_id = productVersion.id;
      rateBook.product_id = productVersion.product_id;
      rateBook.product_definition_hash = productVersion.definition_hash;
    }
    if (dto.code !== undefined) {
      rateBook.code = dto.code.trim().toUpperCase();
    }
    if (dto.version !== undefined) {
      rateBook.version = dto.version.trim();
    }
    if (dto.name !== undefined) {
      rateBook.name = dto.name?.trim() ?? null;
    }
    if (dto.currency_code !== undefined) {
      rateBook.currency_code = dto.currency_code?.trim().toUpperCase() ?? null;
    }
    if (dto.effective_from !== undefined) {
      rateBook.effective_from = dto.effective_from;
    }
    if (dto.effective_to !== undefined) {
      rateBook.effective_to = dto.effective_to ?? null;
    }
    if (dto.rounding_mode !== undefined) {
      rateBook.rounding_mode = dto.rounding_mode;
    }
    if (dto.rounding_increment !== undefined) {
      rateBook.rounding_increment = String(dto.rounding_increment);
    }
    if (dto.proration_method !== undefined) {
      rateBook.proration_method = dto.proration_method;
    }
    this.assertEffectiveDateRange(
      rateBook.effective_from,
      rateBook.effective_to ?? null,
    );

    if (!productVersion && rateBook.product_version_id) {
      productVersion = await this.productVersionRepository.findOne({
        where: { id: rateBook.product_version_id, company_id: companyId },
      });
    }
    if (productVersion) {
      this.assertWithinProductVersionPeriod(
        rateBook.effective_from,
        rateBook.effective_to ?? null,
        productVersion,
      );
    }

    rateBook.updated_by = userId;

    try {
      return await this.rateBookRepository.save(rateBook);
    } catch (error) {
      this.rethrowDuplicate(error, rateBook.code, rateBook.version);
      throw error;
    }
  }

  async clone(
    companyId: string,
    dto: ClonePricingRateBookDto,
    userId: string,
  ): Promise<PricingRateBook> {
    const source = await this.rateBookRepository.findOne({
      where: { id: dto.source_rate_book_id, company_id: companyId },
      relations: {
        rules: {
          conditions: true,
        },
      },
      order: {
        rules: {
          priority: 'ASC',
          created_at: 'ASC',
        },
      },
    });
    if (!source) {
      throw new NotFoundException('Source pricing rate book not found');
    }
    if (!source.product_version_id) {
      throw new BadRequestException(
        'The source rate book has no linked product version and cannot be cloned',
      );
    }

    const draft = await this.create(
      companyId,
      {
        product_version_id: source.product_version_id,
        code: dto.code ?? source.code,
        version: dto.version,
        name: dto.name ?? source.name ?? undefined,
        currency_code: source.currency_code ?? undefined,
        effective_from: dto.effective_from ?? source.effective_from,
        effective_to: dto.effective_to ?? source.effective_to,
      },
      userId,
    );

    const clonedRateBook = await this.rateBookRepository.manager.transaction(
      async (manager) => {
        const ruleRepo = manager.getRepository(RiskRatingRule);
        const conditionRepo = manager.getRepository(RiskRuleCondition);

        for (const rule of source.rules ?? []) {
          const clonedRule = await ruleRepo.save(
            ruleRepo.create({
              company_id: companyId,
              risk_id: rule.risk_id,
              rate_book_id: draft.id,
              rule_name: rule.rule_name,
              rate_type: rule.rate_type,
              percentage_rate: rule.percentage_rate,
              fixed_amount: rule.fixed_amount,
              per_unit_amount: rule.per_unit_amount,
              per_unit_factor_code: rule.per_unit_factor_code,
              minimum_amount: rule.minimum_amount,
              max_discount_rate: rule.max_discount_rate,
              max_discount_amount: rule.max_discount_amount,
              discount_approval_threshold_rate:
                rule.discount_approval_threshold_rate,
              discount_approval_threshold_amount:
                rule.discount_approval_threshold_amount,
              max_loading_rate: rule.max_loading_rate,
              max_loading_amount: rule.max_loading_amount,
              loading_approval_threshold_rate:
                rule.loading_approval_threshold_rate,
              loading_approval_threshold_amount:
                rule.loading_approval_threshold_amount,
              adjustment_effective_from: rule.adjustment_effective_from,
              adjustment_effective_to: rule.adjustment_effective_to,
              formula: rule.formula,
              priority: rule.priority,
              is_active: rule.is_active,
              rule_version: (rule.rule_version ?? 1) + 1,
              created_by: userId,
              updated_by: userId,
            }),
          );

          for (const condition of rule.conditions ?? []) {
            await conditionRepo.save(
              conditionRepo.create({
                company_id: companyId,
                rule_id: clonedRule.id,
                factor_code: condition.factor_code,
                operator: condition.operator,
                value_from: condition.value_from,
                value_to: condition.value_to,
                logical_operator: condition.logical_operator,
                created_by: userId,
                updated_by: userId,
              }),
            );
          }
        }

        return manager.getRepository(PricingRateBook).findOneOrFail({
          where: { id: draft.id, company_id: companyId },
          relations: {
            rules: {
              conditions: true,
            },
          },
        });
      },
    );

    return clonedRateBook;
  }

  async submitForReview(
    companyId: string,
    id: string,
    userId: string,
  ): Promise<PricingRateBook> {
    const rateBook = await this.requireRateBook(companyId, id);
    if (
      ![PricingRateBookStatus.DRAFT, PricingRateBookStatus.REJECTED].includes(
        rateBook.status,
      )
    ) {
      throw new ConflictException(
        'Only DRAFT or REJECTED rate books can be submitted for review',
      );
    }
    await this.validationService.validateForReview(rateBook);
    rateBook.status = PricingRateBookStatus.UNDER_REVIEW;
    rateBook.reviewed_by = userId;
    rateBook.reviewed_at = new Date();
    rateBook.updated_by = userId;
    return this.rateBookRepository.save(rateBook);
  }

  async approve(
    companyId: string,
    id: string,
    userId: string,
  ): Promise<PricingRateBook> {
    const rateBook = await this.requireRateBook(companyId, id);
    if (rateBook.status !== PricingRateBookStatus.UNDER_REVIEW) {
      throw new ConflictException(
        'Only UNDER_REVIEW rate books can be approved',
      );
    }
    await this.validationService.validateForReview(rateBook);
    rateBook.status = PricingRateBookStatus.APPROVED;
    rateBook.approved_by = userId;
    rateBook.approved_at = new Date();
    rateBook.updated_by = userId;
    return this.rateBookRepository.save(rateBook);
  }

  async reject(
    companyId: string,
    id: string,
    userId: string,
  ): Promise<PricingRateBook> {
    const rateBook = await this.requireRateBook(companyId, id);
    if (
      ![
        PricingRateBookStatus.UNDER_REVIEW,
        PricingRateBookStatus.APPROVED,
      ].includes(rateBook.status)
    ) {
      throw new ConflictException(
        'Only UNDER_REVIEW or APPROVED rate books can be rejected',
      );
    }
    rateBook.status = PricingRateBookStatus.REJECTED;
    rateBook.updated_by = userId;
    return this.rateBookRepository.save(rateBook);
  }

  async publish(
    companyId: string,
    id: string,
    userId: string,
  ): Promise<PricingRateBook> {
    const rateBook = await this.requireRateBook(companyId, id);
    if (rateBook.status !== PricingRateBookStatus.APPROVED) {
      throw new ConflictException('Only APPROVED rate books can be published');
    }

    const overlappingPublishedQuery = this.rateBookRepository
      .createQueryBuilder('rate_book')
      .where('rate_book.company_id = :companyId', { companyId })
      .andWhere('rate_book.product_id = :productId', {
        productId: rateBook.product_id,
      })
      .andWhere('rate_book.status = :status', {
        status: PricingRateBookStatus.PUBLISHED,
      });

    if (rateBook.currency_code) {
      overlappingPublishedQuery.andWhere(
        'rate_book.currency_code = :currencyCode',
        {
          currencyCode: rateBook.currency_code,
        },
      );
    } else {
      overlappingPublishedQuery.andWhere('rate_book.currency_code IS NULL');
    }

    const overlappingPublished = await overlappingPublishedQuery.getMany();

    const conflictingBooks = overlappingPublished.filter(
      (candidate) =>
        candidate.id !== rateBook.id &&
        this.dateRangesOverlap(
          rateBook.effective_from,
          rateBook.effective_to,
          candidate.effective_from,
          candidate.effective_to,
        ),
    );

    if (conflictingBooks.length > 0) {
      throw new ConflictException({
        code: 'RATE_BOOK_EFFECTIVE_PERIOD_OVERLAP',
        message: 'The rate book overlaps an existing published rate book.',
        details: {
          rateBooks: conflictingBooks.map((book) => ({
            id: book.id,
            code: book.code,
            version: book.version,
            effectiveFrom: book.effective_from,
            effectiveTo: book.effective_to,
          })),
        },
      });
    }

    const published = await this.rateBookRepository.manager.transaction(
      async (manager) => {
        // Defense in depth: the book could have been edited (rules
        // added/removed/deactivated) after it was last reviewed/approved.
        await this.validationService.validateForReview(rateBook, manager);

        const rules = await manager.getRepository(RiskRatingRule).find({
          where: { rate_book_id: rateBook.id, is_active: true },
          relations: { conditions: true },
          order: { risk_id: 'ASC', priority: 'ASC', rule_name: 'ASC' },
        });

        const requiredFactors = await manager
          .getRepository(RiskRequiredFactor)
          .find({
            where: { rate_book_id: rateBook.id },
            order: { risk_id: 'ASC', sort_order: 'ASC' },
          });

        const addonRules = await manager
          .getRepository(ProductAddonRateRule)
          .find({
            where: { rate_book_id: rateBook.id, is_active: true },
            order: { priority: 'ASC', rule_code: 'ASC' },
          });

        const definition = {
          rateBookId: rateBook.id,
          code: rateBook.code,
          version: rateBook.version,
          productId: rateBook.product_id,
          productVersionId: rateBook.product_version_id,
          productDefinitionHash: rateBook.product_definition_hash,
          currencyCode: rateBook.currency_code,
          effectiveFrom: rateBook.effective_from,
          effectiveTo: rateBook.effective_to,
          roundingMode: rateBook.rounding_mode,
          roundingIncrement: rateBook.rounding_increment,
          prorationMethod: rateBook.proration_method,
          calculationVersion: rateBook.calculation_version,
          requiredFactors,
          rules,
          addonRules,
        };

        rateBook.definition_hash = this.hashService.hashDefinition(definition);
        rateBook.status = PricingRateBookStatus.PUBLISHED;
        rateBook.published_by = userId;
        rateBook.published_at = new Date();
        rateBook.updated_by = userId;

        const savedRateBook = await manager
          .getRepository(PricingRateBook)
          .save(rateBook);

        const riskIds = Array.from(new Set(rules.map((rule) => rule.risk_id)));

        if (riskIds.length > 0) {
          await manager
            .createQueryBuilder()
            .update(InsuranceRisk)
            .set({
              lifecycle_status: 'ACTIVE',
              is_active: true,
              code_locked_at: () => 'COALESCE(code_locked_at, now())',
            })
            .where('id IN (:...riskIds)', { riskIds })
            .andWhere('company_id = :companyId', { companyId })
            .execute();
        }

        return savedRateBook;
      },
    );

    await this.pricingRuntimeCacheService.invalidateRateConfiguration(
      companyId,
    );
    return published;
  }

  async retire(
    companyId: string,
    id: string,
    userId: string,
  ): Promise<PricingRateBook> {
    const rateBook = await this.requireRateBook(companyId, id);
    if (rateBook.status !== PricingRateBookStatus.PUBLISHED) {
      throw new ConflictException('Only PUBLISHED rate books can be retired');
    }
    rateBook.status = PricingRateBookStatus.RETIRED;
    rateBook.updated_by = userId;
    const retired = await this.rateBookRepository.save(rateBook);
    await this.pricingRuntimeCacheService.invalidateRateConfiguration(
      companyId,
    );
    return retired;
  }

  async remove(companyId: string, id: string): Promise<void> {
    const rateBook = await this.requireRateBook(companyId, id);
    this.assertEditable(rateBook);
    await this.rateBookRepository.softDelete(rateBook.id);
  }

  async requireRateBook(
    companyId: string,
    id: string,
  ): Promise<PricingRateBook> {
    const rateBook = await this.rateBookRepository.findOne({
      where: { id, company_id: companyId },
    });
    if (!rateBook) {
      throw new NotFoundException('Pricing rate book not found');
    }
    return rateBook;
  }

  private assertEditable(rateBook: PricingRateBook): void {
    this.editabilityService.assertEditable(rateBook);
  }

  private async requirePublishedProductVersion(
    companyId: string,
    productVersionId: string,
  ): Promise<InsuranceProductVersion> {
    const version = await this.productVersionRepository.findOne({
      where: {
        id: productVersionId,
        company_id: companyId,
        status: ProductVersionStatus.PUBLISHED,
      },
    });
    if (!version) {
      throw new BadRequestException(
        'An approved published product version is required.',
      );
    }
    return version;
  }

  private assertWithinProductVersionPeriod(
    effectiveFrom: string,
    effectiveTo: string | null,
    version: InsuranceProductVersion,
  ): void {
    if (version.effective_from && effectiveFrom < version.effective_from) {
      throw new BadRequestException(
        'The rate book cannot become effective before the product version.',
      );
    }
    if (
      version.effective_to &&
      (!effectiveTo || effectiveTo > version.effective_to)
    ) {
      throw new BadRequestException(
        'The rate-book period cannot exceed the product-version period.',
      );
    }
  }

  private assertEffectiveDateRange(
    effectiveFrom: string,
    effectiveTo: string | null,
  ) {
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new BadRequestException(
        'effective_to must be on or after effective_from',
      );
    }
  }

  private dateRangesOverlap(
    startA: string,
    endA: string | null,
    startB: string,
    endB: string | null,
  ) {
    const normalizedEndA = endA ?? '9999-12-31';
    const normalizedEndB = endB ?? '9999-12-31';
    return startA <= normalizedEndB && startB <= normalizedEndA;
  }

  private rethrowDuplicate(
    error: unknown,
    code: string,
    version: string,
  ): never | void {
    if (!(error instanceof QueryFailedError)) {
      return;
    }
    const driverError = (
      error as QueryFailedError & { driverError?: { code?: string | number } }
    ).driverError;
    if (
      driverError?.code === '23505' ||
      String(driverError?.code ?? '') === '1062'
    ) {
      throw new ConflictException(
        `A pricing rate book with code "${code}" and version "${version}" already exists`,
      );
    }
  }

  // ─── Add-on Rate Rules (nested sub-resource) ────────────────────────────────

  async findAddonRules(
    companyId: string,
    rateBookId: string,
  ): Promise<ProductAddonRateRule[]> {
    await this.requireRateBook(companyId, rateBookId);
    return this.addonRateRuleRepository.find({
      where: { company_id: companyId, rate_book_id: rateBookId },
      relations: { addon_definition: true },
      order: { priority: 'ASC', created_at: 'ASC' },
    });
  }

  async createAddonRule(
    companyId: string,
    rateBookId: string,
    dto: CreateAddonRateRuleDto,
    userId: string,
  ): Promise<ProductAddonRateRule> {
    const rateBook = await this.requireRateBook(companyId, rateBookId);
    this.assertEditable(rateBook);

    const addonDefinition = await this.addonDefinitionRepository.findOne({
      where: { id: dto.addon_definition_id, company_id: companyId },
    });
    if (!addonDefinition) {
      throw new BadRequestException(
        'Add-on definition not found or does not belong to this company',
      );
    }

    const entity = this.addonRateRuleRepository.create({
      company_id: companyId,
      rate_book_id: rateBook.id,
      product_version_id: addonDefinition.product_version_id,
      addon_definition_id: addonDefinition.id,
      rule_code: dto.rule_code.trim().toUpperCase(),
      pricing_type: dto.pricing_type,
      percentage_rate: dto.percentage_rate?.toString() ?? null,
      fixed_amount: dto.fixed_amount?.toString() ?? null,
      per_unit_amount: dto.per_unit_amount?.toString() ?? null,
      per_unit_factor_code: dto.per_unit_factor_code ?? null,
      minimum_amount: dto.minimum_amount?.toString() ?? null,
      maximum_amount: dto.maximum_amount?.toString() ?? null,
      effective_from: dto.effective_from ?? null,
      effective_to: dto.effective_to ?? null,
      priority: dto.priority ?? 100,
      is_active: dto.is_active ?? true,
      addon_snapshot: {
        code: addonDefinition.code,
        name: addonDefinition.name,
        tiramis_addon_code: addonDefinition.tiramis_addon_code,
        is_optional: addonDefinition.is_optional,
        is_default_selected: addonDefinition.is_default_selected,
        allows_separate_sum_insured:
          addonDefinition.allows_separate_sum_insured,
        maximum_quantity: addonDefinition.maximum_quantity,
      },
      created_by: userId,
      updated_by: userId,
    });

    return this.addonRateRuleRepository.save(entity);
  }

  async updateAddonRule(
    companyId: string,
    rateBookId: string,
    ruleId: string,
    dto: UpdateAddonRateRuleDto,
    userId: string,
  ): Promise<ProductAddonRateRule> {
    const rateBook = await this.requireRateBook(companyId, rateBookId);
    this.assertEditable(rateBook);

    const rule = await this.addonRateRuleRepository.findOne({
      where: { id: ruleId, company_id: companyId, rate_book_id: rateBookId },
    });
    if (!rule) {
      throw new NotFoundException('Add-on rate rule not found');
    }

    if (dto.rule_code !== undefined)
      rule.rule_code = dto.rule_code.trim().toUpperCase();
    if (dto.pricing_type !== undefined) rule.pricing_type = dto.pricing_type;
    if (dto.percentage_rate !== undefined)
      rule.percentage_rate = dto.percentage_rate?.toString() ?? null;
    if (dto.fixed_amount !== undefined)
      rule.fixed_amount = dto.fixed_amount?.toString() ?? null;
    if (dto.per_unit_amount !== undefined)
      rule.per_unit_amount = dto.per_unit_amount?.toString() ?? null;
    if (dto.per_unit_factor_code !== undefined)
      rule.per_unit_factor_code = dto.per_unit_factor_code ?? null;
    if (dto.minimum_amount !== undefined)
      rule.minimum_amount = dto.minimum_amount?.toString() ?? null;
    if (dto.maximum_amount !== undefined)
      rule.maximum_amount = dto.maximum_amount?.toString() ?? null;
    if (dto.effective_from !== undefined)
      rule.effective_from = dto.effective_from ?? null;
    if (dto.effective_to !== undefined)
      rule.effective_to = dto.effective_to ?? null;
    if (dto.priority !== undefined) rule.priority = dto.priority;
    if (dto.is_active !== undefined) rule.is_active = dto.is_active;
    rule.updated_by = userId;

    return this.addonRateRuleRepository.save(rule);
  }

  async removeAddonRule(
    companyId: string,
    rateBookId: string,
    ruleId: string,
  ): Promise<void> {
    await this.requireRateBook(companyId, rateBookId);
    const rule = await this.addonRateRuleRepository.findOne({
      where: { id: ruleId, company_id: companyId, rate_book_id: rateBookId },
    });
    if (!rule) {
      throw new NotFoundException('Add-on rate rule not found');
    }
    await this.addonRateRuleRepository.softDelete(rule.id);
  }
}
