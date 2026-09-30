import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import {
  DataSource,
  In,
  ObjectLiteral,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { SortDirection } from '@insurance-max/portal-shared/dto/pagination.dto';
import { DataAccessScopeService } from '../../shared/authorization/data-access-scope.service';
import { Branch } from '../branches/entities/branch.entity';
import { Company } from '../../platform/companies/entities/company.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Department } from '../departments/entities/department.entity';
import { InsuranceCategory } from '../insurance-categories/entities/insurance-category.entity';
import { InsuranceProduct } from '../insurance-products/entities/insurance-product.entity';
import { InsuranceRisk } from '../insurance-risks/entities/insurance-risk.entity';
import { InsuranceSubClass } from '../insurance-sub-classes/entities/insurance-sub-class.entity';
import { MotorVehicle } from '../motor/entities/motor-vehicle.entity';
import { NonMotorPolicyDetail } from '../non-motor/entities/non-motor-policy-detail.entity';
import { SubjectMatter } from '../non-motor/entities/subject-matter.entity';
import { ProductChannelType } from '../product-distribution/enums/product-channel-type.enum';
import { QuotationCalculationBase } from '../quotations/enums/quotation-calculation-base.enum';
import { QuotationPremiumItemType } from '../quotations/enums/quotation-premium-item-type.enum';
import { QuotationStatus } from '../quotations/enums/quotation-status.enum';
import { Quotation } from '../quotations/entities/quotation.entity';
import { QuotationStatusHistory } from '../quotations/entities/quotation-status-history.entity';
import { QuotationLifecycleService } from '../quotations/services/quotation-lifecycle.service';
import { InsuranceChannelPermissionService } from '../quotations/authorization/insurance-channel-permission';
import { QuotationEntryRisk } from '../quotations/entities/structured/quotation-entry-risk.entity';
import { User } from '../users/entities/user.entity';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { FilterPolicyDto } from './dto/filter-policy.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';
import { PolicyPremiumBreakdown } from './entities/policy-premium-breakdown.entity';
import { PolicyRisk } from './entities/policy-risk.entity';
import { PolicyStatusHistory } from './entities/policy-status-history.entity';
import { PolicyVersion } from './entities/policy-version.entity';
import { Policy } from './entities/policy.entity';
import { PolicyVersionDiffService } from './services/policy-version-diff.service';
import { policyBusinessLineSql } from './utils/policy-business-line.sql';

type NumericLike = number | string | null | undefined;

const POLICY_TERMINAL_STATUSES = new Set(['CANCELLED', 'EXPIRED', 'LAPSED']);
const POLICY_BUSINESS_LINE_SQL = policyBusinessLineSql('policy');

@Injectable()
export class PoliciesService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(Policy)
    private readonly policyRepository: Repository<Policy>,

    @InjectRepository(PolicyRisk)
    private readonly policyRiskRepository: Repository<PolicyRisk>,

    @InjectRepository(PolicyPremiumBreakdown)
    private readonly breakdownRepository: Repository<PolicyPremiumBreakdown>,

    @InjectRepository(PolicyStatusHistory)
    private readonly historyRepository: Repository<PolicyStatusHistory>,

    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,

    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,

    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,

    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,

    @InjectRepository(InsuranceCategory)
    private readonly categoryRepository: Repository<InsuranceCategory>,

    @InjectRepository(InsuranceProduct)
    private readonly productRepository: Repository<InsuranceProduct>,

    @InjectRepository(InsuranceSubClass)
    private readonly subClassRepository: Repository<InsuranceSubClass>,

    @InjectRepository(Quotation)
    private readonly quotationRepository: Repository<Quotation>,

    @InjectRepository(QuotationEntryRisk)
    private readonly quotationEntryRiskRepository: Repository<QuotationEntryRisk>,

    @InjectRepository(InsuranceRisk)
    private readonly insuranceRiskRepository: Repository<InsuranceRisk>,

    @InjectRepository(SubjectMatter)
    private readonly subjectMatterRepository: Repository<SubjectMatter>,

    @InjectRepository(MotorVehicle)
    private readonly motorVehicleRepository: Repository<MotorVehicle>,

    @InjectRepository(NonMotorPolicyDetail)
    private readonly nonMotorPolicyDetailRepository: Repository<NonMotorPolicyDetail>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataAccessScopeService: DataAccessScopeService,
    private readonly quotationLifecycleService: QuotationLifecycleService,
    private readonly insuranceChannelPermissionService: InsuranceChannelPermissionService,
    private readonly policyVersionDiffService: PolicyVersionDiffService,
  ) {}

  private isDuplicateEntryError(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) return false;
    const driverError = (
      error as QueryFailedError & { driverError?: { code?: string | number } }
    ).driverError;
    return (
      driverError?.code === '23505' ||
      String(driverError?.code ?? '') === '1062'
    );
  }

  private normalizeText(value?: string | null): string | null {
    if (value === undefined || value === null) return null;
    const normalized = String(value).trim();
    return normalized.length ? normalized : null;
  }

  private normalizeDate(value?: string | null): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
      throw new BadRequestException('Invalid date value');
    return date.toISOString().slice(0, 10);
  }

  private normalizeMoney(value: NumericLike): string {
    const num =
      value === null || value === undefined || value === '' ? 0 : Number(value);
    if (!Number.isFinite(num))
      throw new BadRequestException('Invalid numeric value');
    return String(Math.round(num * 100) / 100);
  }

  private async ensureExists<T extends ObjectLiteral>(
    repository: Repository<T>,
    where: Record<string, unknown>,
    message: string,
  ): Promise<T> {
    const entity = await repository.findOne({ where: where as any });
    if (!entity) throw new BadRequestException(message);
    return entity;
  }

  private mapPolicyNoPrefix(channelType: ProductChannelType): string {
    return `POL-${channelType === ProductChannelType.DIRECT ? 'DIR' : channelType.slice(0, 3)}-${new Date().getFullYear()}-`;
  }

  private async generatePolicyNo(
    companyId: string,
    channelType: ProductChannelType,
  ): Promise<string> {
    const prefix = this.mapPolicyNoPrefix(channelType);
    const last = await this.policyRepository
      .createQueryBuilder('p')
      .where('p.company_id = :companyId', { companyId })
      .andWhere('p.policy_no LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('p.policy_no', 'DESC')
      .limit(1)
      .getOne();

    const next = last?.policy_no
      ? Number(last.policy_no.substring(prefix.length)) + 1
      : 1;
    return `${prefix}${String(next).padStart(5, '0')}`;
  }

  private async validateScope(
    companyId: string,
    dto: CreatePolicyDto | UpdatePolicyDto,
  ): Promise<void> {
    await this.ensureExists(
      this.companyRepository,
      { id: companyId },
      'Company not found',
    );
    await this.ensureExists(
      this.customerRepository,
      { id: dto.customer_id, company_id: companyId },
      'Customer not found for company',
    );
    await this.ensureExists(
      this.categoryRepository,
      { id: dto.category_id, company_id: dto.insurer_company_id },
      'Category not found for insurer',
    );
    await this.ensureExists(
      this.productRepository,
      { id: dto.product_id, company_id: dto.insurer_company_id },
      'Product not found for insurer',
    );

    if (dto.sub_class_id) {
      await this.ensureExists(
        this.subClassRepository,
        {
          id: dto.sub_class_id,
          company_id: dto.insurer_company_id,
          product_id: dto.product_id,
        },
        'Sub-class not found for this product',
      );
    }
    if (dto.branch_id) {
      await this.ensureExists(
        this.branchRepository,
        { id: dto.branch_id, company_id: companyId },
        'Branch not found for company',
      );
    }
    if (dto.department_id) {
      await this.ensureExists(
        this.departmentRepository,
        { id: dto.department_id, company_id: companyId },
        'Department not found for company',
      );
    }
    if (dto.quotation_id) {
      await this.ensureExists(
        this.quotationRepository,
        { id: dto.quotation_id, company_id: companyId },
        'Quotation not found for company',
      );
    }
  }

  private async ensurePolicyOwnership(
    companyId: string,
    id: string,
  ): Promise<Policy> {
    const policy = await this.policyRepository.findOne({
      where: { id, company_id: companyId },
      relations: {
        company: true,
        insurer_company: true,
        intermediary_company: true,
        branch: true,
        department: true,
        creator: true,
        customer: true,
        category: true,
        product: true,
        sub_class: true,
        risks: true,
        premium_breakdowns: true,
        status_history: true,
      },
    });
    if (!policy) throw new NotFoundException('Policy not found');
    return policy;
  }

  private assertGenericMutationAllowed(policy: Policy): void {
    if (!policy.issued_by_system) {
      return;
    }

    throw new ConflictException(
      'System-issued policies cannot be edited or deleted directly. ' +
        'Use policy transactions such as endorsement, renewal, ' +
        'cancellation, or administrative amendment.',
    );
  }

  private async findScopedPolicyEntity(
    user: AuthenticatedUser,
    id: string,
    writeAccess = false,
    withDeleted = false,
  ): Promise<Policy> {
    const scope = this.dataAccessScopeService.resolve(user);

    const queryBuilder = this.policyRepository
      .createQueryBuilder('policy')
      .leftJoinAndSelect('policy.company', 'company')
      .leftJoinAndSelect('policy.insurer_company', 'insurerCompany')
      .leftJoinAndSelect('policy.intermediary_company', 'intermediaryCompany')
      .leftJoinAndSelect('policy.branch', 'branch')
      .leftJoinAndSelect('policy.department', 'department')
      .leftJoinAndSelect('policy.creator', 'creator')
      .leftJoinAndSelect('policy.customer', 'customer')
      .leftJoinAndSelect('policy.category', 'category')
      .leftJoinAndSelect('policy.product', 'product')
      .leftJoinAndSelect('policy.sub_class', 'subClass')
      .leftJoinAndSelect('policy.risks', 'risks')
      .leftJoinAndSelect('policy.premium_breakdowns', 'premiumBreakdowns')
      .leftJoinAndSelect('policy.status_history', 'statusHistory')
      .where('policy.id = :id', { id });

    if (withDeleted) {
      queryBuilder.withDeleted();
    } else {
      queryBuilder.andWhere('policy.deleted_at IS NULL');
    }

    if (writeAccess) {
      this.dataAccessScopeService.applyOwnedRecordWriteScope(
        queryBuilder,
        'policy',
        scope,
      );
    } else {
      this.dataAccessScopeService.applyPolicyReadScope(
        queryBuilder,
        'policy',
        scope,
      );
    }

    const policy = await queryBuilder.getOne();

    if (!policy) {
      throw new NotFoundException('Policy not found');
    }

    return policy;
  }

  private async ensureQuotationEntryRiskBelongsToPolicyContext(
    companyId: string,
    quotationEntryRiskId: string,
  ): Promise<QuotationEntryRisk> {
    const risk = await this.quotationEntryRiskRepository.findOne({
      where: { id: quotationEntryRiskId },
      relations: {
        entry: {
          cover_note: {
            quotation: true,
          },
        },
      },
    });
    if (!risk || risk.entry.cover_note.quotation.company_id !== companyId) {
      throw new BadRequestException(
        'Quotation entry risk not found for this company',
      );
    }
    return risk;
  }

  private async ensureInsuranceRisk(
    companyId: string,
    riskId: string,
    productId: string,
  ): Promise<InsuranceRisk> {
    const risk = await this.insuranceRiskRepository.findOne({
      where: { id: riskId, company_id: companyId, product_id: productId },
    });
    if (!risk)
      throw new BadRequestException(
        'Insurance risk not found for this product',
      );
    return risk;
  }

  private async ensureSubjectMatter(
    companyId: string,
    subjectMatterId: string,
  ): Promise<SubjectMatter> {
    const subjectMatter = await this.subjectMatterRepository.findOne({
      where: { id: subjectMatterId, company_id: companyId },
    });
    if (!subjectMatter)
      throw new BadRequestException('Subject matter not found for company');
    return subjectMatter;
  }

  private async ensureMotorVehicle(
    companyId: string,
    motorVehicleId: string,
  ): Promise<MotorVehicle> {
    const vehicle = await this.motorVehicleRepository.findOne({
      where: { id: motorVehicleId, company_id: companyId },
    });
    if (!vehicle)
      throw new BadRequestException('Motor vehicle not found for company');
    return vehicle;
  }

  private async replacePolicyChildren(
    manager: any,
    policy: Policy,
    dto: CreatePolicyDto | UpdatePolicyDto,
  ): Promise<void> {
    const riskRepo = manager.getRepository(PolicyRisk);
    const breakdownRepo = manager.getRepository(PolicyPremiumBreakdown);

    await riskRepo.delete({ policy_id: policy.id });
    await breakdownRepo.delete({ policy_id: policy.id });

    for (const risk of dto.risks ?? []) {
      await this.ensureInsuranceRisk(
        policy.insurer_company_id,
        risk.risk_id,
        policy.product_id,
      );
      if (risk.quotation_entry_risk_id) {
        await this.ensureQuotationEntryRiskBelongsToPolicyContext(
          policy.company_id,
          risk.quotation_entry_risk_id,
        );
      }
      if (risk.subject_matter_id) {
        await this.ensureSubjectMatter(
          policy.company_id,
          risk.subject_matter_id,
        );
      }
      if (risk.motor_vehicle_id) {
        await this.ensureMotorVehicle(policy.company_id, risk.motor_vehicle_id);
      }
    }

    const risks = (dto.risks ?? []).map((risk) =>
      riskRepo.create({
        policy_id: policy.id,
        quotation_entry_risk_id: risk.quotation_entry_risk_id ?? null,
        risk_id: risk.risk_id,
        subject_matter_id: risk.subject_matter_id ?? null,
        motor_vehicle_id: risk.motor_vehicle_id ?? null,
        sum_insured: this.normalizeMoney(risk.sum_insured),
        rate: String(Number(risk.rate ?? 0)),
        basic_premium: this.normalizeMoney(risk.basic_premium),
        discount_amount: this.normalizeMoney(risk.discount_amount),
        tax_amount: this.normalizeMoney(risk.tax_amount),
        charges_amount: this.normalizeMoney(risk.charges_amount),
        commission_amount: this.normalizeMoney(risk.commission_amount),
        total_premium: this.normalizeMoney(risk.total_premium),
        net_premium: this.normalizeMoney(risk.net_premium),
        reinsurance_required: risk.reinsurance_required ?? false,
        retention_amount: this.normalizeMoney(risk.retention_amount),
        ceded_sum_insured: this.normalizeMoney(risk.ceded_sum_insured),
        ceded_premium: this.normalizeMoney(risk.ceded_premium),
        reinsurance_status:
          this.normalizeText(risk.reinsurance_status) ?? 'NOT_REQUIRED',
        status: risk.status?.trim().toUpperCase() ?? 'ACTIVE',
      }),
    );
    if (risks.length) await riskRepo.save(risks);

    for (const item of dto.premium_breakdowns ?? []) {
      if (item.policy_risk_id) {
        await this.ensurePolicyOwnership(policy.company_id, policy.id);
      }
    }

    const breakdowns = (dto.premium_breakdowns ?? []).map((item, index) =>
      breakdownRepo.create({
        policy_id: policy.id,
        policy_risk_id: item.policy_risk_id ?? null,
        item_type: item.item_type,
        item_code: item.item_code,
        item_name: item.item_name,
        rate: String(Number(item.rate ?? 0)),
        amount: this.normalizeMoney(item.amount),
        calculation_base:
          item.calculation_base ?? QuotationCalculationBase.BASIC_PREMIUM,
        calculation_order: item.calculation_order ?? index + 1,
      }),
    );
    if (breakdowns.length) await breakdownRepo.save(breakdowns);
  }

  async create(
    companyId: string,
    dto: CreatePolicyDto,
    userId: string,
    user?: AuthenticatedUser,
  ): Promise<Policy> {
    if (
      user &&
      (dto.channel_type !== undefined ||
        dto.intermediary_company_id !== undefined)
    ) {
      await this.insuranceChannelPermissionService.authorizePolicyChannel(
        companyId,
        dto,
        user,
        'policy.create',
      );
    }
    await this.validateScope(companyId, dto);
    const created = await this.dataSource
      .transaction(async (manager) => {
        const policyRepo = manager.getRepository(Policy);
        const historyRepo = manager.getRepository(PolicyStatusHistory);

        const policyNo = await this.generatePolicyNo(
          companyId,
          dto.channel_type,
        );
        const policy = policyRepo.create({
          company_id: companyId,
          insurer_company_id: dto.insurer_company_id,
          intermediary_company_id: dto.intermediary_company_id ?? null,
          branch_id: dto.branch_id ?? null,
          department_id: dto.department_id ?? null,
          created_by: userId,
          customer_id: dto.customer_id,
          quotation_id: dto.quotation_id ?? null,
          proposal_id: dto.proposal_id ?? null,
          category_id: dto.category_id,
          product_id: dto.product_id,
          sub_class_id: dto.sub_class_id ?? null,
          policy_no: policyNo,
          cover_note_no: null,
          external_policy_no: null,
          channel_type: dto.channel_type,
          policy_status: dto.policy_status?.trim().toUpperCase() ?? 'DRAFT',
          start_date: this.normalizeDate(dto.start_date)!,
          end_date: this.normalizeDate(dto.end_date)!,
          issue_date: this.normalizeDate(dto.issue_date)!,
          currency: dto.currency?.trim().toUpperCase() ?? 'TZS',
          sum_insured: this.normalizeMoney(dto.sum_insured),
          basic_premium: this.normalizeMoney(dto.basic_premium),
          total_discount: this.normalizeMoney(dto.total_discount),
          total_tax: this.normalizeMoney(dto.total_tax),
          total_charges: this.normalizeMoney(dto.total_charges),
          total_commission: this.normalizeMoney(dto.total_commission),
          total_premium: this.normalizeMoney(dto.total_premium),
          net_premium: this.normalizeMoney(dto.net_premium),
          reinsurance_required: dto.reinsurance_required ?? false,
          reinsurance_status:
            dto.reinsurance_status?.trim().toUpperCase() ?? 'NOT_REQUIRED',
          retention_amount: this.normalizeMoney(dto.retention_amount),
          ceded_sum_insured: this.normalizeMoney(dto.ceded_sum_insured),
          ceded_premium: this.normalizeMoney(dto.ceded_premium),
          tira_status: dto.tira_status?.trim().toUpperCase() ?? 'PENDING',
          tira_portal_transaction_id: this.normalizeText(
            dto.tira_portal_transaction_id,
          ),
          tiramis_transaction_id: this.normalizeText(
            dto.tiramis_transaction_id,
          ),
          metadata: dto.metadata ?? null,
        });

        const saved = await policyRepo.save(policy);
        await this.replacePolicyChildren(manager, saved, dto);
        await historyRepo.save(
          historyRepo.create({
            policy_id: saved.id,
            old_status: 'NONE',
            new_status: saved.policy_status,
            reason: null,
            changed_by: userId,
          }),
        );

        if (dto.quotation_id) {
          const quotationRepo = manager.getRepository(Quotation);
          const quotation = await quotationRepo.findOne({
            where: { id: dto.quotation_id, company_id: companyId },
          });
          if (!quotation) {
            throw new BadRequestException(
              'Quotation not found for this company',
            );
          }
          if (
            quotation.status === QuotationStatus.COMPLETED ||
            quotation.status === QuotationStatus.CANCELLED ||
            quotation.status === QuotationStatus.EXPIRED
          ) {
            throw new ConflictException(
              `Quotation in ${quotation.status} status cannot be converted to a policy`,
            );
          }
        }

        return saved;
      })
      .catch((error) => {
        if (this.isDuplicateEntryError(error)) {
          throw new ConflictException(
            'A policy with this number already exists in this company',
          );
        }
        throw error;
      });

    if (dto.quotation_id) {
      await this.quotationLifecycleService.convertQuotation(
        companyId,
        dto.quotation_id,
        {
          changedBy: userId,
          changedByType: 'USER',
          source: 'SYSTEM',
          reason: `Converted to policy ${created.policy_no}`,
        },
      );
    }

    return this.policyRepository.findOneOrFail({
      where: { id: created.id, company_id: companyId },
      relations: {
        company: true,
        insurer_company: true,
        intermediary_company: true,
        branch: true,
        department: true,
        creator: true,
        customer: true,
        category: true,
        product: true,
        sub_class: true,
        risks: true,
        premium_breakdowns: true,
        status_history: true,
      },
    });
  }

  async createForUser(
    user: AuthenticatedUser,
    dto: CreatePolicyDto,
  ): Promise<Policy> {
    const scope = this.dataAccessScopeService.resolve(user);

    if (dto.branch_id) {
      this.dataAccessScopeService.assertRequestedBranchAllowed(
        scope,
        dto.branch_id,
      );
    }

    const branchId = dto.branch_id ?? user.activeBranchId ?? null;

    if (!scope.canViewAllBranches && !branchId) {
      throw new BadRequestException(
        'An active branch is required to create a policy',
      );
    }

    return this.create(
      user.companyId!,
      {
        ...dto,
        branch_id: branchId,
      },
      user.id,
      user,
    );
  }

  async findAll(companyId: string, query: FilterPolicyDto) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = SortDirection.DESC,
      search,
      policy_status,
      customer_id,
    } = query;
    const allowedSortFields = [
      'policy_no',
      'policy_status',
      'issue_date',
      'start_date',
      'end_date',
      'created_at',
      'updated_at',
    ];
    const safeSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'created_at';
    const direction = sortOrder === SortDirection.ASC ? 'ASC' : 'DESC';

    const qb = this.policyRepository
      .createQueryBuilder('policy')
      .leftJoinAndSelect('policy.customer', 'customer')
      .leftJoinAndSelect('policy.product', 'product')
      .leftJoinAndSelect('policy.category', 'category')
      .where('policy.company_id = :companyId', { companyId })
      .orderBy(`policy.${safeSortBy}`, direction);

    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      qb.andWhere(
        '(policy.policy_no ILIKE :term OR policy.cover_note_no ILIKE :term OR policy.external_policy_no ILIKE :term)',
        { term },
      );
    }
    if (policy_status)
      qb.andWhere('policy.policy_status = :policy_status', { policy_status });
    if (customer_id)
      qb.andWhere('policy.customer_id = :customer_id', { customer_id });

    const skip = (page - 1) * limit;
    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();
    return {
      data: items,
      meta: {
        totalItems: total,
        itemCount: items.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findAllForUser(user: AuthenticatedUser, query: FilterPolicyDto) {
    const scope = this.dataAccessScopeService.resolve(user);
    const {
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = SortDirection.DESC,
      search,
      policy_status,
      customer_id,
    } = query;

    const allowedSortFields = [
      'policy_no',
      'policy_status',
      'issue_date',
      'start_date',
      'end_date',
      'created_at',
      'updated_at',
    ];

    const safeSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'created_at';
    const direction = sortOrder === SortDirection.ASC ? 'ASC' : 'DESC';

    const queryBuilder = this.policyRepository
      .createQueryBuilder('policy')
      .leftJoinAndSelect('policy.customer', 'customer')
      .leftJoinAndSelect('policy.product', 'product')
      .leftJoinAndSelect('policy.category', 'category')
      .where('policy.deleted_at IS NULL')
      .orderBy(`policy.${safeSortBy}`, direction);

    this.dataAccessScopeService.applyPolicyReadScope(
      queryBuilder,
      'policy',
      scope,
    );

    if (search?.trim()) {
      const term = `%${search.trim()}%`;

      queryBuilder.andWhere(
        `(
          policy.policy_no ILIKE :term
          OR policy.cover_note_no ILIKE :term
          OR policy.external_policy_no ILIKE :term
        )`,
        { term },
      );
    }

    if (policy_status) {
      queryBuilder.andWhere('policy.policy_status = :policyStatus', {
        policyStatus: policy_status,
      });
    }

    if (customer_id) {
      queryBuilder.andWhere('policy.customer_id = :customerId', {
        customerId: customer_id,
      });
    }

    if (query.business_line) {
      queryBuilder.andWhere(`${POLICY_BUSINESS_LINE_SQL} = :businessLine`, {
        businessLine: query.business_line,
      });
    }

    const skip = (page - 1) * limit;
    const [items, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data: items,
      meta: {
        totalItems: total,
        itemCount: items.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(companyId: string, id: string): Promise<Policy> {
    return this.ensurePolicyOwnership(companyId, id);
  }

  async findOneForUser(user: AuthenticatedUser, id: string): Promise<Policy> {
    return this.findScopedPolicyEntity(user, id, false);
  }

  async findCurrentVersionForUser(user: AuthenticatedUser, id: string) {
    const policy = await this.findScopedPolicyEntity(user, id, false);

    const repository = this.dataSource.getRepository(PolicyVersion);

    if (policy.active_version_id) {
      const active = await repository.findOne({
        where: {
          id: policy.active_version_id,
          company_id: policy.company_id,
          policy_id: policy.id,
        },
      });

      if (active) {
        return active;
      }
    }

    return repository.findOne({
      where: {
        company_id: policy.company_id,
        policy_id: policy.id,
        is_current: true,
      },
      order: {
        version_number: 'DESC',
      },
    });
  }

  async listVersionsForUser(user: AuthenticatedUser, policyId: string) {
    await this.findScopedPolicyEntity(user, policyId, false);

    return this.dataSource.getRepository(PolicyVersion).find({
      where: {
        company_id: user.companyId!,
        policy_id: policyId,
      },
      order: {
        version_number: 'DESC',
      },
    });
  }

  async compareVersionsForUser(
    user: AuthenticatedUser,
    policyId: string,
    fromVersion: number,
    toVersion: number,
  ) {
    await this.findScopedPolicyEntity(user, policyId, false);

    const versions = await this.dataSource.getRepository(PolicyVersion).find({
      where: {
        company_id: user.companyId!,
        policy_id: policyId,
        version_number: In([fromVersion, toVersion]),
      },
    });
    const from = versions.find((item) => item.version_number === fromVersion);
    const to = versions.find((item) => item.version_number === toVersion);

    if (!from || !to) {
      throw new NotFoundException('Policy version was not found.');
    }

    return {
      from: {
        id: from.id,
        version_number: from.version_number,
        version_type: from.version_type,
      },
      to: {
        id: to.id,
        version_number: to.version_number,
        version_type: to.version_type,
      },
      changes: this.policyVersionDiffService.compare(
        from.policy_snapshot,
        to.policy_snapshot,
      ),
    };
  }

  async update(
    companyId: string,
    id: string,
    dto: UpdatePolicyDto,
    userId: string,
    user?: AuthenticatedUser,
  ): Promise<Policy> {
    const policy = await this.ensurePolicyOwnership(companyId, id);
    this.assertGenericMutationAllowed(policy);
    if (user) {
      await this.insuranceChannelPermissionService.authorizePolicyChannel(
        companyId,
        {
          channel_type: dto.channel_type ?? policy.channel_type,
          intermediary_company_id:
            dto.intermediary_company_id ?? policy.intermediary_company_id,
        },
        user,
        'policy.update',
        id,
      );
    }

    const merged = { ...policy, ...dto } as CreatePolicyDto;
    await this.validateScope(companyId, merged);
    const oldStatus = policy.policy_status;

    if (dto.policy_status !== undefined) {
      const newStatus = dto.policy_status.trim().toUpperCase();
      if (newStatus !== oldStatus && POLICY_TERMINAL_STATUSES.has(oldStatus)) {
        throw new ConflictException(
          `Cannot change policy status from terminal state ${oldStatus} to ${newStatus}`,
        );
      }
    }

    return this.dataSource.transaction(async (manager) => {
      const policyRepo = manager.getRepository(Policy);
      const historyRepo = manager.getRepository(PolicyStatusHistory);

      if (dto.insurer_company_id !== undefined)
        policy.insurer_company_id = dto.insurer_company_id;
      if (dto.intermediary_company_id !== undefined)
        policy.intermediary_company_id = dto.intermediary_company_id ?? null;
      if (dto.branch_id !== undefined) policy.branch_id = dto.branch_id ?? null;
      if (dto.department_id !== undefined)
        policy.department_id = dto.department_id ?? null;
      if (dto.customer_id !== undefined) policy.customer_id = dto.customer_id;
      if (dto.quotation_id !== undefined)
        policy.quotation_id = dto.quotation_id ?? null;
      if (dto.proposal_id !== undefined)
        policy.proposal_id = dto.proposal_id ?? null;
      if (dto.category_id !== undefined) policy.category_id = dto.category_id;
      if (dto.product_id !== undefined) policy.product_id = dto.product_id;
      if (dto.sub_class_id !== undefined)
        policy.sub_class_id = dto.sub_class_id ?? null;
      if (dto.channel_type !== undefined)
        policy.channel_type = dto.channel_type;
      if (dto.policy_status !== undefined)
        policy.policy_status = dto.policy_status.trim().toUpperCase();
      if (dto.start_date !== undefined)
        policy.start_date = this.normalizeDate(dto.start_date)!;
      if (dto.end_date !== undefined)
        policy.end_date = this.normalizeDate(dto.end_date)!;
      if (dto.issue_date !== undefined)
        policy.issue_date = this.normalizeDate(dto.issue_date)!;
      if (dto.currency !== undefined)
        policy.currency = dto.currency.trim().toUpperCase();
      if (dto.sum_insured !== undefined)
        policy.sum_insured = this.normalizeMoney(dto.sum_insured);
      if (dto.basic_premium !== undefined)
        policy.basic_premium = this.normalizeMoney(dto.basic_premium);
      if (dto.total_discount !== undefined)
        policy.total_discount = this.normalizeMoney(dto.total_discount);
      if (dto.total_tax !== undefined)
        policy.total_tax = this.normalizeMoney(dto.total_tax);
      if (dto.total_charges !== undefined)
        policy.total_charges = this.normalizeMoney(dto.total_charges);
      if (dto.total_commission !== undefined)
        policy.total_commission = this.normalizeMoney(dto.total_commission);
      if (dto.total_premium !== undefined)
        policy.total_premium = this.normalizeMoney(dto.total_premium);
      if (dto.net_premium !== undefined)
        policy.net_premium = this.normalizeMoney(dto.net_premium);
      if (dto.reinsurance_required !== undefined)
        policy.reinsurance_required = dto.reinsurance_required;
      if (dto.reinsurance_status !== undefined)
        policy.reinsurance_status = dto.reinsurance_status.trim().toUpperCase();
      if (dto.retention_amount !== undefined)
        policy.retention_amount = this.normalizeMoney(dto.retention_amount);
      if (dto.ceded_sum_insured !== undefined)
        policy.ceded_sum_insured = this.normalizeMoney(dto.ceded_sum_insured);
      if (dto.ceded_premium !== undefined)
        policy.ceded_premium = this.normalizeMoney(dto.ceded_premium);
      if (dto.tira_status !== undefined)
        policy.tira_status = dto.tira_status.trim().toUpperCase();
      if (dto.tira_portal_transaction_id !== undefined)
        policy.tira_portal_transaction_id = this.normalizeText(
          dto.tira_portal_transaction_id,
        );
      if (dto.tiramis_transaction_id !== undefined)
        policy.tiramis_transaction_id = this.normalizeText(
          dto.tiramis_transaction_id,
        );
      if (dto.metadata !== undefined) policy.metadata = dto.metadata ?? null;

      const saved = await policyRepo.save(policy);
      if (dto.risks || dto.premium_breakdowns) {
        await this.replacePolicyChildren(manager, saved, dto);
      }

      if (
        dto.policy_status !== undefined &&
        dto.policy_status.trim().toUpperCase() !== oldStatus
      ) {
        await historyRepo.save(
          historyRepo.create({
            policy_id: saved.id,
            old_status: oldStatus,
            new_status: dto.policy_status.trim().toUpperCase(),
            reason: null,
            changed_by: userId,
          }),
        );
      }

      return policyRepo.findOneOrFail({
        where: { id: saved.id, company_id: companyId },
        relations: {
          company: true,
          insurer_company: true,
          intermediary_company: true,
          branch: true,
          department: true,
          creator: true,
          customer: true,
          category: true,
          product: true,
          sub_class: true,
          risks: true,
          premium_breakdowns: true,
          status_history: true,
        },
      });
    });
  }

  async updateForUser(
    user: AuthenticatedUser,
    id: string,
    dto: UpdatePolicyDto,
  ): Promise<Policy> {
    await this.findScopedPolicyEntity(user, id, true);

    return this.update(user.companyId!, id, dto, user.id, user);
  }

  async remove(companyId: string, id: string): Promise<void> {
    const policy = await this.ensurePolicyOwnership(companyId, id);
    this.assertGenericMutationAllowed(policy);

    await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(PolicyRisk)
        .softDelete({ policy_id: policy.id });
      await manager
        .getRepository(PolicyPremiumBreakdown)
        .softDelete({ policy_id: policy.id });
      await manager
        .getRepository(PolicyStatusHistory)
        .softDelete({ policy_id: policy.id });
      await manager.getRepository(Policy).softDelete(policy.id);
    });
  }

  async removeForUser(
    user: AuthenticatedUser,
    id: string,
  ): Promise<{ message: string }> {
    await this.findScopedPolicyEntity(user, id, true);
    await this.remove(user.companyId!, id);

    return {
      message: 'Policy deleted successfully',
    };
  }

  async restore(companyId: string, id: string): Promise<Policy> {
    const policy = await this.policyRepository.findOne({
      where: { id, company_id: companyId },
      withDeleted: true,
    });
    if (!policy) throw new NotFoundException('Policy not found');

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Policy).restore(policy.id);
      await manager.getRepository(PolicyRisk).restore({ policy_id: policy.id });
      await manager
        .getRepository(PolicyPremiumBreakdown)
        .restore({ policy_id: policy.id });
      await manager
        .getRepository(PolicyStatusHistory)
        .restore({ policy_id: policy.id });
    });

    return this.ensurePolicyOwnership(companyId, id);
  }

  async restoreForUser(user: AuthenticatedUser, id: string): Promise<Policy> {
    await this.findScopedPolicyEntity(user, id, true, true);

    return this.restore(user.companyId!, id);
  }

  async listRisks(companyId: string, policyId?: string) {
    const qb = this.policyRiskRepository
      .createQueryBuilder('risk')
      .leftJoinAndSelect('risk.policy', 'policy')
      .leftJoinAndSelect('risk.risk', 'insuranceRisk')
      .where('policy.company_id = :companyId', { companyId });
    if (policyId) qb.andWhere('risk.policy_id = :policyId', { policyId });
    return qb.orderBy('risk.created_at', 'DESC').getMany();
  }

  async listRisksForUser(user: AuthenticatedUser, policyId: string) {
    await this.findScopedPolicyEntity(user, policyId, false);

    return this.listRisks(user.companyId!, policyId);
  }

  async listBreakdowns(companyId: string, policyId?: string) {
    const qb = this.breakdownRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.policy', 'policy')
      .where('policy.company_id = :companyId', { companyId });
    if (policyId) qb.andWhere('item.policy_id = :policyId', { policyId });
    return qb.orderBy('item.calculation_order', 'ASC').getMany();
  }

  async listBreakdownsForUser(user: AuthenticatedUser, policyId: string) {
    await this.findScopedPolicyEntity(user, policyId, false);

    return this.listBreakdowns(user.companyId!, policyId);
  }

  async listHistory(companyId: string, policyId?: string) {
    const qb = this.historyRepository
      .createQueryBuilder('history')
      .leftJoinAndSelect('history.policy', 'policy')
      .leftJoinAndSelect('history.changer', 'changer')
      .where('policy.company_id = :companyId', { companyId });
    if (policyId) qb.andWhere('history.policy_id = :policyId', { policyId });
    return qb.orderBy('history.created_at', 'DESC').getMany();
  }

  async listHistoryForUser(user: AuthenticatedUser, policyId: string) {
    await this.findScopedPolicyEntity(user, policyId, false);

    return this.listHistory(user.companyId!, policyId);
  }

  /**
   * Backend-computed action list so the frontend never
   * decides for itself whether an endorsement/cancellation/renewal can be
   * started — it just renders whatever this returns.
   */
  async actionsForUser(user: AuthenticatedUser, policyId: string) {
    const policy = await this.findScopedPolicyEntity(user, policyId, false);
    const hasActiveTransaction = Boolean(policy.pending_transaction_id);
    const isActive = policy.policy_status === 'ACTIVE';

    const blockedReason = !isActive
      ? 'The policy is not active.'
      : hasActiveTransaction
        ? 'The policy has an active endorsement, cancellation, or renewal transaction.'
        : null;

    return {
      actions: [
        {
          code: 'CREATE_ENDORSEMENT',
          enabled: isActive && !hasActiveTransaction,
          disabledReason: blockedReason,
        },
        {
          code: 'REQUEST_CANCELLATION',
          enabled: isActive && !hasActiveTransaction,
          disabledReason: blockedReason,
        },
        {
          code: 'CREATE_RENEWAL',
          enabled:
            isActive && !hasActiveTransaction && !policy.renewed_to_policy_id,
          disabledReason: policy.renewed_to_policy_id
            ? 'The policy has already been renewed.'
            : blockedReason,
        },
        {
          code: 'VIEW_VERSION_HISTORY',
          enabled: true,
          disabledReason: null,
        },
        {
          code: 'VIEW_TRANSACTIONS',
          enabled: true,
          disabledReason: null,
        },
      ],
    };
  }
}
