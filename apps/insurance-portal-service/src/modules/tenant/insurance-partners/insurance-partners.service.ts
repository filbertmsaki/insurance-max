import { TiramisPlatformAccessService } from '../../shared/organization/tiramis-platform-access.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';
import { normalizeRateForStorage } from '@insurance-max/portal-shared/utils/pricing-calculation.util';
import { DataSource, In, Repository } from 'typeorm';
import { Company } from '../../platform/companies/entities/company.entity';
import { CreateInsurancePartnerDto } from './dto/create-insurance-partner.dto';
import { ReplacePartnerProductScopesDto } from './dto/replace-partner-product-scopes.dto';
import { InsuranceCompanyPartnerProductScope } from './entities/insurance-company-partner-product-scope.entity';
import { InsuranceCompanyPartnerEvent } from './entities/insurance-company-partner-event.entity';
import { InsuranceCompanyPartner } from './entities/insurance-company-partner.entity';
import { PartnerRelationshipStatus } from './enums/partner-relationship-status.enum';
import { PartnerOperation } from './enums/partner-operation.enum';
import { PartnerType } from './enums/partner-type.enum';
import { InsuranceProduct } from '../insurance-products/entities/insurance-product.entity';
import { RequestPartnerRelationshipDto } from './dto/request-partner-relationship.dto';
import { Branch } from '../branches/entities/branch.entity';
import {
  ProposePartnerAmendmentDto,
  RespondPartnerAmendmentDto,
} from './dto/propose-partner-amendment.dto';
import {
  InsuranceCompanyPartnerAmendment,
  PartnerAmendmentStatus,
} from './entities/insurance-company-partner-amendment.entity';

const NEW_BUSINESS_OPERATIONS = new Set<PartnerOperation>([
  PartnerOperation.QUOTE,
  PartnerOperation.SUBMIT,
  PartnerOperation.REQUEST_RENEWAL,
]);

@Injectable()
export class InsurancePartnersService {
  constructor(
    @InjectRepository(InsuranceCompanyPartner)
    private readonly partnerRepository: Repository<InsuranceCompanyPartner>,
    @InjectRepository(InsuranceCompanyPartnerProductScope)
    private readonly productScopeRepository: Repository<InsuranceCompanyPartnerProductScope>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(InsuranceProduct)
    private readonly productRepository: Repository<InsuranceProduct>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    private readonly dataSource: DataSource,
    @Optional()
    private readonly platformAccess?: TiramisPlatformAccessService,
  ) {}

  async findAmendments(id: string, companyId: string | undefined) {
    const relationship = await this.findPartyRelationship(id, companyId);
    return this.dataSource
      .getRepository(InsuranceCompanyPartnerAmendment)
      .find({
        where: { relationship_id: relationship.id },
        order: { created_at: 'DESC' },
      });
  }

  async proposeAmendment(
    id: string,
    companyId: string | undefined,
    userId: string,
    dto: ProposePartnerAmendmentDto,
  ) {
    const relationship = await this.findPartyRelationship(id, companyId);
    if (relationship.status !== PartnerRelationshipStatus.ACTIVE)
      throw new ConflictException('Only active relationships can be amended.');
    if (
      dto.start_date &&
      dto.end_date &&
      new Date(dto.end_date) < new Date(dto.start_date)
    )
      throw new BadRequestException(
        'Agreement end date must be on or after its start date.',
      );
    const terms: Record<string, unknown> = {};
    for (const key of [
      'commission_rate',
      'start_date',
      'end_date',
      'agreement_reference',
      'agreement_document_url',
    ] as const) {
      if (dto[key] !== undefined)
        terms[key] =
          dto[key] === null
            ? null
            : key === 'commission_rate'
              ? normalizeRateForStorage(dto[key])
              : dto[key];
    }
    if (!Object.keys(terms).length)
      throw new BadRequestException(
        'Provide at least one agreement term to amend.',
      );
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        relationship.id,
      ]);
      const activeRelationship = await manager
        .getRepository(InsuranceCompanyPartner)
        .createQueryBuilder('relationship')
        .setLock('pessimistic_write')
        .where('relationship.id = :id', { id: relationship.id })
        .getOne();
      if (
        !activeRelationship ||
        activeRelationship.status !== PartnerRelationshipStatus.ACTIVE
      )
        throw new ConflictException(
          'Only active relationships can be amended.',
        );
      const repository = manager.getRepository(
        InsuranceCompanyPartnerAmendment,
      );
      const pending = await repository.findOne({
        where: {
          relationship_id: relationship.id,
          status: PartnerAmendmentStatus.PENDING,
        },
      });
      if (pending)
        throw new ConflictException(
          'A pending amendment already exists for this relationship.',
        );
      const amendment = await repository.save(
        repository.create({
          relationship_id: relationship.id,
          proposed_by_company_id: companyId!,
          proposed_by_user_id: userId,
          proposed_terms: terms,
          note: dto.note?.trim() || null,
          status: PartnerAmendmentStatus.PENDING,
        }),
      );
      await manager.getRepository(InsuranceCompanyPartnerEvent).save({
        relationship_id: relationship.id,
        actor_company_id: companyId,
        actor_user_id: userId,
        event_type: 'AMENDMENT_PROPOSED',
        previous_status: relationship.status,
        new_status: relationship.status,
        notes: dto.note?.trim() || null,
        metadata: { amendment_id: amendment.id, proposed_terms: terms },
      });
      return amendment;
    });
  }

  async respondToAmendment(
    id: string,
    amendmentId: string,
    companyId: string | undefined,
    userId: string,
    accept: boolean,
    dto: RespondPartnerAmendmentDto,
  ) {
    const relationship = await this.findPartyRelationship(id, companyId);
    if (relationship.status !== PartnerRelationshipStatus.ACTIVE)
      throw new ConflictException('Only active relationships can be amended.');
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        relationship.id,
      ]);
      const activeRelationship = await manager
        .getRepository(InsuranceCompanyPartner)
        .createQueryBuilder('relationship')
        .setLock('pessimistic_write')
        .where('relationship.id = :id', { id: relationship.id })
        .getOne();
      if (
        !activeRelationship ||
        activeRelationship.status !== PartnerRelationshipStatus.ACTIVE
      )
        throw new ConflictException('The relationship is no longer active.');
      const amendmentRepository = manager.getRepository(
        InsuranceCompanyPartnerAmendment,
      );
      const amendment = await amendmentRepository
        .createQueryBuilder('amendment')
        .setLock('pessimistic_write')
        .where('amendment.id = :amendmentId', { amendmentId })
        .andWhere('amendment.relationship_id = :relationshipId', {
          relationshipId: relationship.id,
        })
        .andWhere('amendment.status = :status', {
          status: PartnerAmendmentStatus.PENDING,
        })
        .getOne();
      if (!amendment)
        throw new NotFoundException('Pending agreement amendment not found.');
      if (amendment.proposed_by_company_id === companyId)
        throw new ForbiddenException(
          'Only the other party can respond to this amendment.',
        );
      amendment.status = accept
        ? PartnerAmendmentStatus.ACCEPTED
        : PartnerAmendmentStatus.REJECTED;
      amendment.responded_by_company_id = companyId!;
      amendment.responded_by_user_id = userId;
      amendment.responded_at = new Date();
      amendment.response_reason = dto.reason?.trim() || null;
      if (accept) {
        const relationshipRepository = manager.getRepository(
          InsuranceCompanyPartner,
        );
        const terms = amendment.proposed_terms;
        if ('commission_rate' in terms)
          activeRelationship.commission_rate = terms.commission_rate as
            | string
            | null;
        if ('start_date' in terms)
          activeRelationship.start_date = terms.start_date
            ? new Date(String(terms.start_date))
            : null;
        if ('end_date' in terms)
          activeRelationship.end_date = terms.end_date
            ? new Date(String(terms.end_date))
            : null;
        if ('agreement_reference' in terms)
          activeRelationship.agreement_reference = terms.agreement_reference as
            | string
            | null;
        if ('agreement_document_url' in terms)
          activeRelationship.agreement_document_url =
            terms.agreement_document_url as string | null;
        if (
          activeRelationship.start_date &&
          activeRelationship.end_date &&
          activeRelationship.end_date < activeRelationship.start_date
        )
          throw new BadRequestException(
            'Agreement end date must be on or after its start date.',
          );
        await relationshipRepository.save(activeRelationship);
        amendment.applied_at = new Date();
      }
      const saved = await amendmentRepository.save(amendment);
      await manager.getRepository(InsuranceCompanyPartnerEvent).save({
        relationship_id: relationship.id,
        actor_company_id: companyId,
        actor_user_id: userId,
        event_type: accept ? 'AMENDMENT_ACCEPTED' : 'AMENDMENT_REJECTED',
        previous_status: relationship.status,
        new_status: relationship.status,
        notes: dto.reason?.trim() || null,
        metadata: {
          amendment_id: amendment.id,
          proposed_terms: amendment.proposed_terms,
        },
      });
      return saved;
    });
  }

  async withdrawAmendment(
    id: string,
    amendmentId: string,
    companyId: string | undefined,
    userId: string,
  ) {
    const relationship = await this.findPartyRelationship(id, companyId);
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        relationship.id,
      ]);
      const currentRelationship = await manager
        .getRepository(InsuranceCompanyPartner)
        .createQueryBuilder('relationship')
        .setLock('pessimistic_write')
        .where('relationship.id = :id', { id: relationship.id })
        .getOne();
      if (!currentRelationship)
        throw new NotFoundException('Relationship not found.');
      const repo = manager.getRepository(InsuranceCompanyPartnerAmendment);
      const amendment = await repo
        .createQueryBuilder('amendment')
        .setLock('pessimistic_write')
        .where('amendment.id = :amendmentId', { amendmentId })
        .andWhere('amendment.relationship_id = :relationshipId', {
          relationshipId: relationship.id,
        })
        .andWhere('amendment.status = :status', {
          status: PartnerAmendmentStatus.PENDING,
        })
        .getOne();
      if (!amendment)
        throw new NotFoundException('Pending agreement amendment not found.');
      if (amendment.proposed_by_company_id !== companyId)
        throw new ForbiddenException(
          'Only the proposing party can withdraw this amendment.',
        );
      amendment.status = PartnerAmendmentStatus.WITHDRAWN;
      const saved = await repo.save(amendment);
      await manager.getRepository(InsuranceCompanyPartnerEvent).save({
        relationship_id: relationship.id,
        actor_company_id: companyId,
        actor_user_id: userId,
        event_type: 'AMENDMENT_WITHDRAWN',
        previous_status: relationship.status,
        new_status: relationship.status,
        notes: null,
        metadata: { amendment_id: amendment.id },
      });
      return saved;
    });
  }

  private async findPartyRelationship(
    id: string,
    companyId: string | undefined,
  ) {
    if (!companyId)
      throw new ForbiddenException('An active company is required.');
    const relationship = await this.partnerRepository.findOne({
      where: { id },
    });
    if (!relationship) throw new NotFoundException('Relationship not found.');
    if (
      ![
        relationship.insurer_company_id,
        relationship.intermediary_company_id,
      ].includes(companyId)
    )
      throw new ForbiddenException(
        'This relationship belongs to another organization.',
      );
    return relationship;
  }

  private mapPartnerTypeToCompanyType(partnerType: PartnerType): CompanyType {
    switch (partnerType) {
      case PartnerType.REINSURANCE_COMPANY:
        return CompanyType.REINSURANCE_COMPANY;
      case PartnerType.REINSURANCE_BROKER:
        return CompanyType.REINSURANCE_BROKER;
      case PartnerType.BROKER:
        return CompanyType.BROKER;
      case PartnerType.AGENCY:
        return CompanyType.AGENCY;
      case PartnerType.BANCASSURANCE:
        return CompanyType.BANCASSURANCE;
      case PartnerType.SERVICE_PROVIDER:
        return CompanyType.SERVICE_PROVIDER;
      default:
        throw new BadRequestException('Invalid partner type');
    }
  }

  async findAll(activeCompanyId: string | undefined) {
    const insurerCompanyId = this.requireActiveInsurer(activeCompanyId);
    return this.partnerRepository.find({
      where: { insurer_company_id: insurerCompanyId },
      relations: {
        intermediary_company: true,
        product_scopes: { product: true },
      },
      order: { created_at: 'DESC' },
    });
  }

  async findInsurerProducts(activeCompanyId: string | undefined) {
    const insurerCompanyId = this.requireActiveInsurer(activeCompanyId);
    return this.productRepository.find({
      where: { company_id: insurerCompanyId, is_active: true },
      relations: { category: true },
      order: { product_name: 'ASC' },
    });
  }

  async findInsurerBranches(activeCompanyId: string | undefined) {
    const insurerCompanyId = this.requireActiveInsurer(activeCompanyId);
    return this.branchRepository.find({
      where: { company_id: insurerCompanyId, status: 'active' },
      select: { id: true, name: true, code: true },
      order: { name: 'ASC' },
    });
  }

  async findRelationshipInsurerDirectory() {
    const insurers = await this.companyRepository.find({
      where: {
        company_type: CompanyType.INSURANCE_COMPANY,
        status: 'active',
        verification_status: 'VERIFIED',
      },
      select: { id: true, name: true, tira_license_number: true },
      order: { name: 'ASC' },
    });
    return this.onlyTiramisActive(insurers, (insurer) => insurer.id);
  }

  /** Insurers without active TIRAMIS access are hidden from new business. */
  private async onlyTiramisActive<T>(
    rows: T[],
    insurerId: (row: T) => string,
  ): Promise<T[]> {
    if (!this.platformAccess) return rows;
    const active = await this.platformAccess.activeCompanyIds();
    return rows.filter((row) => active.has(insurerId(row)));
  }

  async findIntermediaryRelationships(
    intermediaryCompanyId: string | undefined,
  ) {
    if (!intermediaryCompanyId)
      throw new ForbiddenException(
        'An active partner organization is required.',
      );
    return this.partnerRepository.find({
      where: { intermediary_company_id: intermediaryCompanyId },
      relations: { insurer_company: true, product_scopes: { product: true } },
      order: { created_at: 'DESC' },
    });
  }

  async findAuthorizedInsurers(intermediaryCompanyId: string | undefined) {
    if (!intermediaryCompanyId) {
      throw new ForbiddenException(
        'An active intermediary company is required.',
      );
    }
    const relationships = await this.partnerRepository.find({
      where: {
        intermediary_company_id: intermediaryCompanyId,
        status: PartnerRelationshipStatus.ACTIVE,
      },
      relations: {
        insurer_company: true,
        product_scopes: { product: { category: true } },
      },
      order: { created_at: 'DESC' },
    });
    const activeRelationships = await this.onlyTiramisActive(
      relationships,
      (relationship) => relationship.insurer_company_id,
    );
    const today = new Date();
    const results: Array<{
      relationship_id: string;
      insurer_company_id: string;
      insurer_name: string | null;
      partner_type: PartnerType;
      products: Array<Record<string, unknown>>;
    }> = [];
    for (const relationship of activeRelationships) {
      if (
        (relationship.start_date && relationship.start_date > today) ||
        (relationship.end_date && relationship.end_date < today)
      )
        continue;

      const products =
        relationship.scope_mode === 'LEGACY'
          ? await this.productRepository
              .find({
                where: {
                  company_id: relationship.insurer_company_id,
                  is_active: true,
                },
                relations: { category: true },
                order: { product_name: 'ASC' },
              })
              .then((rows) =>
                rows.map((product) => ({
                  ...product,
                  partner_scope: {
                    allowed_operations: Object.values(PartnerOperation),
                    branch_ids: null,
                    commission_rate: relationship.commission_rate,
                  },
                })),
              )
          : relationship.product_scopes
              .filter(
                (scope) =>
                  scope.is_active &&
                  scope.allowed_operations.includes(PartnerOperation.QUOTE),
              )
              .map((scope) => ({
                ...scope.product,
                partner_scope: {
                  allowed_operations: scope.allowed_operations,
                  branch_ids: scope.branch_ids,
                  commission_rate: scope.commission_rate,
                },
              }));

      const productsWithBranches = await Promise.all(
        products.map(async (product) => {
          const branchIds = product.partner_scope?.branch_ids;
          const branches = await this.branchRepository.find({
            where: {
              company_id: relationship.insurer_company_id,
              status: 'active',
              ...(branchIds ? { id: In(branchIds) } : {}),
            },
            order: { name: 'ASC' },
          });
          return {
            ...product,
            partner_scope: {
              ...product.partner_scope,
              branches: branches.map(({ id, name, code }) => ({
                id,
                name,
                code,
              })),
            },
          };
        }),
      );

      results.push({
        relationship_id: relationship.id,
        insurer_company_id: relationship.insurer_company_id,
        insurer_name: relationship.insurer_company?.name ?? null,
        partner_type: relationship.partner_type,
        products: productsWithBranches,
      });
    }
    return results;
  }

  async findOne(id: string, activeCompanyId: string | undefined) {
    return this.findOwnedRelationship(id, activeCompanyId);
  }

  async findEvents(id: string, activeCompanyId: string | undefined) {
    const relationship = await this.findOwnedRelationship(id, activeCompanyId);
    return this.dataSource.getRepository(InsuranceCompanyPartnerEvent).find({
      where: { relationship_id: relationship.id },
      order: { created_at: 'ASC' },
    });
  }

  async findEventsForParticipant(
    id: string,
    activeCompanyId: string | undefined,
  ) {
    if (!activeCompanyId) {
      throw new ForbiddenException('An active company is required.');
    }
    const relationship = await this.partnerRepository.findOne({
      where: [
        { id, insurer_company_id: activeCompanyId },
        { id, intermediary_company_id: activeCompanyId },
      ],
    });
    if (!relationship) {
      throw new NotFoundException('Relationship not found');
    }
    return this.dataSource.getRepository(InsuranceCompanyPartnerEvent).find({
      where: { relationship_id: relationship.id },
      order: { created_at: 'ASC' },
    });
  }

  async requestRelationship(
    dto: RequestPartnerRelationshipDto,
    activeCompanyId: string | undefined,
    actorUserId: string,
  ) {
    if (!activeCompanyId) {
      throw new ForbiddenException('An active company is required.');
    }
    const partnerCompany = await this.companyRepository.findOne({
      where: { id: activeCompanyId, status: 'active' },
    });
    if (!partnerCompany) {
      throw new ForbiddenException(
        'The active partner organization is unavailable.',
      );
    }

    const partnerTypeByCompanyType: Partial<Record<CompanyType, PartnerType>> =
      {
        [CompanyType.AGENCY]: PartnerType.AGENCY,
        [CompanyType.BROKER]: PartnerType.BROKER,
        [CompanyType.BANCASSURANCE]: PartnerType.BANCASSURANCE,
        [CompanyType.REINSURANCE_COMPANY]: PartnerType.REINSURANCE_COMPANY,
        [CompanyType.REINSURANCE_BROKER]: PartnerType.REINSURANCE_BROKER,
      };
    const partnerType = partnerTypeByCompanyType[partnerCompany.company_type];
    if (!partnerType) {
      throw new ForbiddenException(
        'Only an agent, broker, or bancassurance organization can request this appointment.',
      );
    }

    const insurer = await this.companyRepository.findOne({
      where: {
        id: dto.insurer_company_id,
        company_type: CompanyType.INSURANCE_COMPANY,
        status: 'active',
      },
    });
    if (!insurer) {
      throw new NotFoundException('Active insurer was not found');
    }

    return this.dataSource.transaction(async (manager) => {
      // Serialize concurrent requests for this pair before checking for an open link.
      await manager.query(
        'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
        [insurer.id, partnerCompany.id],
      );
      await this.assertNoOpenRelationship(
        manager,
        insurer.id,
        partnerCompany.id,
      );

      const repository = manager.getRepository(InsuranceCompanyPartner);
      const relationship = await repository.save(
        repository.create({
          insurer_company_id: insurer.id,
          intermediary_company_id: partnerCompany.id,
          requested_by_company_id: partnerCompany.id,
          partner_type: partnerType,
          status: PartnerRelationshipStatus.PENDING,
          scope_mode: 'RESTRICTED',
          commission_rate: null,
          start_date: null,
          end_date: null,
          agreement_reference: null,
          agreement_document_url: null,
          metadata: { requested_by: actorUserId },
        }),
      );
      await manager.getRepository(InsuranceCompanyPartnerEvent).save({
        relationship_id: relationship.id,
        actor_company_id: partnerCompany.id,
        actor_user_id: actorUserId,
        event_type: 'REQUESTED',
        previous_status: null,
        new_status: PartnerRelationshipStatus.PENDING,
        notes: dto.request_note ?? null,
        metadata: null,
      });
      return relationship;
    });
  }

  async findProductScopes(id: string, activeCompanyId: string | undefined) {
    const relationship = await this.findOwnedRelationship(id, activeCompanyId);
    return this.productScopeRepository.find({
      where: { relationship_id: relationship.id },
      relations: { product: true },
      order: { created_at: 'ASC' },
    });
  }

  async replaceProductScopes(
    id: string,
    activeCompanyId: string | undefined,
    dto: ReplacePartnerProductScopesDto,
    actorUserId: string,
  ) {
    const relationship = await this.findOwnedRelationship(id, activeCompanyId);
    const productIds = dto.product_scopes.map((scope) => scope.product_id);
    if (new Set(productIds).size !== productIds.length) {
      throw new BadRequestException('Each product can only be configured once');
    }

    if (productIds.length > 0) {
      const products = await this.productRepository.find({
        where: {
          id: In(productIds),
          company_id: relationship.insurer_company_id,
          is_active: true,
        },
      });
      if (products.length !== productIds.length) {
        throw new BadRequestException(
          'Every product must be active and owned by the current insurer',
        );
      }
    }
    const branchIds = Array.from(
      new Set(dto.product_scopes.flatMap((scope) => scope.branch_ids ?? [])),
    );
    if (branchIds.length > 0) {
      const branches = await this.branchRepository.find({
        where: {
          id: In(branchIds),
          company_id: relationship.insurer_company_id,
          status: 'active',
        },
      });
      if (branches.length !== branchIds.length) {
        throw new BadRequestException(
          'Every scoped branch must be active and owned by the insurer',
        );
      }
    }

    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(
        InsuranceCompanyPartnerProductScope,
      );
      await repository.delete({ relationship_id: relationship.id });
      await manager
        .getRepository(InsuranceCompanyPartner)
        .update(relationship.id, { scope_mode: 'RESTRICTED' });
      if (dto.product_scopes.length === 0) return;

      await repository.save(
        dto.product_scopes.map((scope) =>
          repository.create({
            relationship_id: relationship.id,
            product_id: scope.product_id,
            allowed_operations: [...new Set(scope.allowed_operations)],
            branch_ids:
              scope.branch_ids === undefined || scope.branch_ids === null
                ? null
                : [...new Set(scope.branch_ids)],
            commission_rate:
              scope.commission_rate !== undefined &&
              scope.commission_rate !== null
                ? normalizeRateForStorage(scope.commission_rate)
                : null,
            is_active: true,
            created_by: actorUserId,
            updated_by: actorUserId,
          }),
        ),
      );
    });

    return this.findProductScopes(id, activeCompanyId);
  }

  async authorizeOperation(
    insurerCompanyId: string,
    intermediaryCompanyId: string,
    productId: string,
    operation: PartnerOperation,
    branchId?: string | null,
  ) {
    // New business with an insurer requires its TIRAMIS access to be active;
    // viewing and servicing existing business does not.
    if (NEW_BUSINESS_OPERATIONS.has(operation)) {
      await this.platformAccess?.assertCompanyCanTransact(insurerCompanyId);
    }
    const relationship = await this.partnerRepository.findOne({
      where: {
        insurer_company_id: insurerCompanyId,
        intermediary_company_id: intermediaryCompanyId,
        status: PartnerRelationshipStatus.ACTIVE,
      },
    });
    if (!relationship) {
      throw new ForbiddenException(
        'An active insurer-partner relationship is required',
      );
    }
    const today = new Date();
    if (
      (relationship.start_date && relationship.start_date > today) ||
      (relationship.end_date && relationship.end_date < today)
    ) {
      throw new ForbiddenException(
        'The insurer-partner relationship is outside its effective dates.',
      );
    }

    if (branchId) {
      const branch = await this.branchRepository.findOne({
        where: {
          id: branchId,
          company_id: insurerCompanyId,
          status: 'active',
        },
      });
      if (!branch) {
        throw new ForbiddenException(
          'The selected branch is not active under this insurer.',
        );
      }
    }

    const productScope = await this.productScopeRepository.findOne({
      where: {
        relationship_id: relationship.id,
        product_id: productId,
        is_active: true,
      },
    });
    if (relationship.scope_mode === 'LEGACY') {
      return { relationship, productScope: null, legacy: true };
    }

    if (!productScope?.allowed_operations.includes(operation)) {
      throw new ForbiddenException(
        `The relationship does not allow ${operation} for this product`,
      );
    }
    if (
      productScope.branch_ids !== null &&
      productScope.branch_ids !== undefined &&
      (!branchId || !productScope.branch_ids.includes(branchId))
    ) {
      throw new ForbiddenException(
        'The relationship does not allow this branch for the requested operation',
      );
    }

    return { relationship, productScope, legacy: false };
  }

  async findActiveCompanyRelationship(
    insurerCompanyId: string,
    partnerCompanyId: string,
    partnerType: PartnerType,
  ) {
    const relationship = await this.partnerRepository.findOne({
      where: {
        insurer_company_id: insurerCompanyId,
        intermediary_company_id: partnerCompanyId,
        partner_type: partnerType,
        status: PartnerRelationshipStatus.ACTIVE,
      },
    });
    if (!relationship) return null;
    const today = new Date();
    if (
      (relationship.start_date && relationship.start_date > today) ||
      (relationship.end_date && relationship.end_date < today)
    ) {
      return null;
    }
    return relationship;
  }

  async create(
    dto: CreateInsurancePartnerDto,
    activeCompanyId: string | undefined,
    actorUserId: string,
  ) {
    const insurerCompanyId = this.requireActiveInsurer(activeCompanyId);
    if (dto.insurer_company_id !== insurerCompanyId) {
      throw new ForbiddenException(
        'The insurer must match the active company context.',
      );
    }

    const insurerCompany = await this.companyRepository.findOne({
      where: { id: insurerCompanyId },
    });
    if (!insurerCompany) {
      throw new NotFoundException('Insurance company not found');
    }

    const intermediaryCompany = await this.companyRepository.findOne({
      where: { id: dto.intermediary_company_id },
    });
    if (!intermediaryCompany) {
      throw new NotFoundException('Partner company not found');
    }

    const expectedCompanyType = this.mapPartnerTypeToCompanyType(
      dto.partner_type,
    );
    if (intermediaryCompany.company_type !== expectedCompanyType) {
      throw new BadRequestException(
        `intermediary_company_id must belong to ${expectedCompanyType}`,
      );
    }

    const relationship = this.partnerRepository.create({
      insurer_company_id: insurerCompanyId,
      intermediary_company_id: dto.intermediary_company_id,
      partner_type: dto.partner_type,
      commission_rate:
        dto.commission_rate !== undefined
          ? normalizeRateForStorage(dto.commission_rate)
          : null,
      start_date: dto.start_date ? new Date(dto.start_date) : null,
      end_date: dto.end_date ? new Date(dto.end_date) : null,
      agreement_reference: dto.agreement_reference ?? null,
      agreement_document_url: dto.agreement_document_url ?? null,
      status: PartnerRelationshipStatus.PENDING,
      scope_mode: 'RESTRICTED',
      metadata: { created_by: actorUserId },
    });

    return this.dataSource.transaction(async (manager) => {
      await manager.query(
        'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
        [insurerCompanyId, intermediaryCompany.id],
      );
      await this.assertNoOpenRelationship(
        manager,
        insurerCompanyId,
        intermediaryCompany.id,
      );
      const saved = await manager
        .getRepository(InsuranceCompanyPartner)
        .save(relationship);
      await manager.getRepository(InsuranceCompanyPartnerEvent).save({
        relationship_id: saved.id,
        actor_company_id: insurerCompanyId,
        actor_user_id: actorUserId,
        event_type: 'CREATED',
        previous_status: null,
        new_status: PartnerRelationshipStatus.PENDING,
        notes: null,
        metadata: null,
      });
      return saved;
    });
  }

  async approve(
    id: string,
    activeCompanyId: string | undefined,
    actorUserId: string,
  ) {
    const relationship = await this.findOwnedRelationship(id, activeCompanyId);
    if (relationship.status !== PartnerRelationshipStatus.PENDING) {
      throw new BadRequestException(
        'Only a pending relationship can be approved.',
      );
    }
    const today = new Date();
    if (relationship.start_date && relationship.start_date > today) {
      throw new BadRequestException(
        'The relationship start date is in the future.',
      );
    }
    if (relationship.end_date && relationship.end_date < today) {
      throw new BadRequestException('The relationship end date has passed.');
    }
    const previousStatus = relationship.status;
    relationship.status = PartnerRelationshipStatus.ACTIVE;
    relationship.approved_by = actorUserId;
    relationship.approved_at = new Date();
    return this.saveTransition(
      relationship,
      previousStatus,
      'APPROVED',
      activeCompanyId!,
      actorUserId,
    );
  }

  async reject(
    id: string,
    activeCompanyId: string | undefined,
    reason: string,
    actorUserId: string,
  ) {
    const relationship = await this.findOwnedRelationship(id, activeCompanyId);
    if (relationship.status !== PartnerRelationshipStatus.PENDING) {
      throw new BadRequestException(
        'Only a pending relationship can be rejected.',
      );
    }
    const previousStatus = relationship.status;
    relationship.status = PartnerRelationshipStatus.REJECTED;
    return this.saveTransition(
      relationship,
      previousStatus,
      'REJECTED',
      activeCompanyId!,
      actorUserId,
      reason,
    );
  }

  async withdrawRequest(
    id: string,
    activeCompanyId: string | undefined,
    reason: string,
    actorUserId: string,
  ) {
    if (!activeCompanyId)
      throw new ForbiddenException('An active company is required.');
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(InsuranceCompanyPartner);
      const relationship = await repository
        .createQueryBuilder('relationship')
        .setLock('pessimistic_write')
        .where('relationship.id = :id', { id })
        .andWhere('relationship.intermediary_company_id = :activeCompanyId', {
          activeCompanyId,
        })
        .getOne();
      if (!relationship)
        throw new NotFoundException('Relationship request not found');
      if (
        relationship.status !== PartnerRelationshipStatus.PENDING ||
        relationship.requested_by_company_id !== activeCompanyId
      ) {
        throw new BadRequestException(
          'Only a pending request created by this organization can be withdrawn.',
        );
      }
      relationship.status = PartnerRelationshipStatus.WITHDRAWN;
      const saved = await repository.save(relationship);
      await manager.getRepository(InsuranceCompanyPartnerEvent).save({
        relationship_id: saved.id,
        actor_company_id: activeCompanyId,
        actor_user_id: actorUserId,
        event_type: 'WITHDRAWN',
        previous_status: PartnerRelationshipStatus.PENDING,
        new_status: PartnerRelationshipStatus.WITHDRAWN,
        notes: reason,
        metadata: null,
      });
      return saved;
    });
  }

  async suspend(
    id: string,
    activeCompanyId: string | undefined,
    reason: string,
    actorUserId: string,
  ) {
    const relationship = await this.findOwnedRelationship(id, activeCompanyId);
    if (relationship.status !== PartnerRelationshipStatus.ACTIVE) {
      throw new BadRequestException(
        'Only an active relationship can be suspended.',
      );
    }
    const previousStatus = relationship.status;
    relationship.status = PartnerRelationshipStatus.SUSPENDED;
    relationship.suspension_reason = reason;
    return this.saveTransition(
      relationship,
      previousStatus,
      'SUSPENDED',
      activeCompanyId!,
      actorUserId,
      reason,
    );
  }

  async terminate(
    id: string,
    activeCompanyId: string | undefined,
    reason: string,
    actorUserId: string,
  ) {
    const relationship = await this.findOwnedRelationship(id, activeCompanyId);
    if (relationship.status === PartnerRelationshipStatus.TERMINATED) {
      throw new BadRequestException('The relationship is already terminated.');
    }
    const previousStatus = relationship.status;
    relationship.status = PartnerRelationshipStatus.TERMINATED;
    relationship.termination_reason = reason;
    relationship.end_date = new Date();
    return this.saveTransition(
      relationship,
      previousStatus,
      'TERMINATED',
      activeCompanyId!,
      actorUserId,
      reason,
    );
  }

  async reactivate(
    id: string,
    activeCompanyId: string | undefined,
    actorUserId: string,
  ) {
    const relationship = await this.findOwnedRelationship(id, activeCompanyId);
    if (relationship.status !== PartnerRelationshipStatus.SUSPENDED) {
      throw new BadRequestException(
        'Only a suspended relationship can be reactivated.',
      );
    }
    const previousStatus = relationship.status;
    relationship.status = PartnerRelationshipStatus.ACTIVE;
    relationship.suspension_reason = null;
    return this.saveTransition(
      relationship,
      previousStatus,
      'REACTIVATED',
      activeCompanyId!,
      actorUserId,
    );
  }

  private async saveTransition(
    relationship: InsuranceCompanyPartner,
    previousStatus: PartnerRelationshipStatus,
    eventType: string,
    actorCompanyId: string,
    actorUserId: string | null,
    notes: string | null = null,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(InsuranceCompanyPartner);
      const current = await repository
        .createQueryBuilder('relationship')
        .setLock('pessimistic_write')
        .where('relationship.id = :id', { id: relationship.id })
        .andWhere('relationship.insurer_company_id = :actorCompanyId', {
          actorCompanyId,
        })
        .getOne();
      if (!current) throw new NotFoundException('Relationship not found');
      if (current.status !== previousStatus) {
        throw new ConflictException(
          'The relationship changed while this action was being processed. Refresh and retry.',
        );
      }
      current.status = relationship.status;
      current.approved_by = relationship.approved_by;
      current.approved_at = relationship.approved_at;
      current.suspension_reason = relationship.suspension_reason;
      current.termination_reason = relationship.termination_reason;
      current.end_date = relationship.end_date;
      const saved = await repository.save(current);
      await manager.getRepository(InsuranceCompanyPartnerEvent).save({
        relationship_id: saved.id,
        actor_company_id: actorCompanyId,
        actor_user_id: actorUserId,
        event_type: eventType,
        previous_status: previousStatus,
        new_status: saved.status,
        notes,
        metadata: null,
      });
      return saved;
    });
  }

  private async assertNoOpenRelationship(
    manager: import('typeorm').EntityManager,
    insurerCompanyId: string,
    intermediaryCompanyId: string,
  ) {
    const existing = await manager
      .getRepository(InsuranceCompanyPartner)
      .findOne({
        where: {
          insurer_company_id: insurerCompanyId,
          intermediary_company_id: intermediaryCompanyId,
          status: In([
            PartnerRelationshipStatus.PENDING,
            PartnerRelationshipStatus.ACTIVE,
            PartnerRelationshipStatus.SUSPENDED,
          ]),
        },
      });
    if (existing) {
      throw new ConflictException(
        'An open relationship already exists with this organization.',
      );
    }
  }

  private async findOwnedRelationship(
    id: string,
    activeCompanyId: string | undefined,
  ) {
    const insurerCompanyId = this.requireActiveInsurer(activeCompanyId);
    const relationship = await this.partnerRepository.findOne({
      where: { id, insurer_company_id: insurerCompanyId },
      relations: {
        intermediary_company: true,
        product_scopes: { product: true },
      },
    });
    if (!relationship) {
      throw new NotFoundException('Relationship not found');
    }
    return relationship;
  }

  private requireActiveInsurer(activeCompanyId: string | undefined): string {
    if (!activeCompanyId) {
      throw new ForbiddenException('An active company is required.');
    }
    return activeCompanyId;
  }
}
