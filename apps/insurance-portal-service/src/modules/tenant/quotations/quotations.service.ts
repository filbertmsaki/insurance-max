import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  ObjectLiteral,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { SortDirection } from '@insurance-max/portal-shared/dto/pagination.dto';
import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';
import { Branch } from '../branches/entities/branch.entity';
import { Company } from '../../platform/companies/entities/company.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Department } from '../departments/entities/department.entity';
import { InsuranceBusinessLine } from '../insurance-categories/enums/insurance-business-line.enum';
import { InsuranceCategory } from '../insurance-categories/entities/insurance-category.entity';
import { InsuranceProduct } from '../insurance-products/entities/insurance-product.entity';
import { InsuranceRisk } from '../insurance-risks/entities/insurance-risk.entity';
import { InsuranceSubClass } from '../insurance-sub-classes/entities/insurance-sub-class.entity';
import { ProductDistributionService } from '../product-distribution/product-distribution.service';
import { User } from '../users/entities/user.entity';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { FilterQuotationDto } from './dto/filter-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { QuotationCalculationBase } from './enums/quotation-calculation-base.enum';
import { QuotationFlow } from './enums/quotation-flow.enum';
import { QuotationStatus } from './enums/quotation-status.enum';
import { QuotationType } from './enums/quotation-type.enum';
import { QuotationAddon } from './entities/quotation-addon.entity';
import { QuotationAddonTax } from './entities/quotation-addon-tax.entity';
import { Quotation } from './entities/quotation.entity';
import { QuotationFactorValue } from './entities/quotation-factor-value.entity';
import { QuotationPremiumBreakdown } from './entities/quotation-premium-breakdown.entity';
import { QuotationRisk } from './entities/quotation-risk.entity';
import { QuotationStatusHistory } from './entities/quotation-status-history.entity';

type NumericLike = number | string | null | undefined;

const QUOTATION_STATUS_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  [QuotationStatus.DRAFT]: [
    QuotationStatus.RATED,
    QuotationStatus.REFERRED,
    QuotationStatus.CANCELLED,
    QuotationStatus.EXPIRED,
  ],
  [QuotationStatus.RATED]: [
    QuotationStatus.DRAFT,
    QuotationStatus.PENDING_APPROVAL,
    QuotationStatus.REFERRED,
    QuotationStatus.CANCELLED,
    QuotationStatus.EXPIRED,
  ],
  [QuotationStatus.REFERRED]: [
    QuotationStatus.RATED,
    QuotationStatus.PENDING_APPROVAL,
    QuotationStatus.CANCELLED,
    QuotationStatus.EXPIRED,
  ],
  [QuotationStatus.PENDING_APPROVAL]: [
    QuotationStatus.APPROVED,
    QuotationStatus.REJECTED,
    QuotationStatus.CANCELLED,
  ],
  [QuotationStatus.APPROVED]: [
    QuotationStatus.CONVERTED,
    QuotationStatus.CANCELLED,
    QuotationStatus.EXPIRED,
  ],
  [QuotationStatus.REJECTED]: [QuotationStatus.DRAFT, QuotationStatus.CANCELLED],
  [QuotationStatus.CONVERTED]: [],
  [QuotationStatus.EXPIRED]: [],
  [QuotationStatus.CANCELLED]: [],
};

@Injectable()
export class QuotationsService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(Quotation)
    private readonly quotationRepository: Repository<Quotation>,

    @InjectRepository(QuotationRisk)
    private readonly quotationRiskRepository: Repository<QuotationRisk>,

    @InjectRepository(QuotationFactorValue)
    private readonly factorValueRepository: Repository<QuotationFactorValue>,

    @InjectRepository(QuotationPremiumBreakdown)
    private readonly breakdownRepository: Repository<QuotationPremiumBreakdown>,

    @InjectRepository(QuotationAddon)
    private readonly addonRepository: Repository<QuotationAddon>,

    @InjectRepository(QuotationAddonTax)
    private readonly addonTaxRepository: Repository<QuotationAddonTax>,

    @InjectRepository(QuotationStatusHistory)
    private readonly historyRepository: Repository<QuotationStatusHistory>,

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

    @InjectRepository(InsuranceRisk)
    private readonly riskRepository: Repository<InsuranceRisk>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly productDistributionService: ProductDistributionService,
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
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date value');
    }
    return date.toISOString().slice(0, 10);
  }

  private normalizeMoney(value: NumericLike): string {
    const num =
      value === null || value === undefined || value === '' ? 0 : Number(value);
    if (!Number.isFinite(num)) {
      throw new BadRequestException('Invalid numeric value');
    }
    return String(Math.round(num * 100) / 100);
  }

  private normalizeRate(value: NumericLike): string {
    const num =
      value === null || value === undefined || value === '' ? 0 : Number(value);
    if (!Number.isFinite(num)) {
      throw new BadRequestException('Invalid rate value');
    }
    return String(Math.round(num * 1000000) / 1000000);
  }

  private mapQuotationNoPrefix(quotationType: QuotationType): string {
    return quotationType === QuotationType.MOTOR ? 'QTN-MTR' : 'QTN-NM';
  }

  private async generateQuotationNo(
    companyId: string,
    quotationType: QuotationType,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `${this.mapQuotationNoPrefix(quotationType)}-${year}-`;
    const last = await this.quotationRepository
      .createQueryBuilder('q')
      .where('q.company_id = :companyId', { companyId })
      .andWhere('q.quotation_no LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('q.quotation_no', 'DESC')
      .limit(1)
      .getOne();

    const next = last?.quotation_no
      ? Number(last.quotation_no.substring(prefix.length)) + 1
      : 1;
    return `${prefix}${String(next).padStart(5, '0')}`;
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

  private async validateScope(
    companyId: string,
    dto: CreateQuotationDto | UpdateQuotationDto,
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
    const category = await this.ensureExists(
      this.categoryRepository,
      { id: dto.category_id, company_id: dto.insurer_company_id },
      'Category not found for insurer',
    );
    const product = await this.ensureExists(
      this.productRepository,
      { id: dto.product_id, company_id: dto.insurer_company_id },
      'Product not found for insurer',
    );

    if (product.category_id !== dto.category_id) {
      throw new BadRequestException(
        'Selected product does not belong to the selected category',
      );
    }

    if (product.business_line !== category.business_line) {
      throw new BadRequestException(
        'Selected product business line does not match its category',
      );
    }

    const quotationFlow = this.resolveQuotationFlow(dto);
    const requiredBusinessLine =
      quotationFlow === QuotationFlow.NON_MOTOR
        ? InsuranceBusinessLine.NON_MOTOR
        : InsuranceBusinessLine.MOTOR;
    const requiredQuotationType =
      quotationFlow === QuotationFlow.NON_MOTOR
        ? QuotationType.NON_MOTOR
        : QuotationType.MOTOR;

    if (dto.quotation_type !== requiredQuotationType) {
      throw new BadRequestException(
        `quotation_type must be ${requiredQuotationType} for ${quotationFlow} flow`,
      );
    }

    if (dto.is_fleet !== undefined) {
      const expectedFleet = quotationFlow === QuotationFlow.MOTOR_FLEET;
      if (dto.is_fleet !== expectedFleet) {
        throw new BadRequestException(
          `is_fleet must be ${expectedFleet} for ${quotationFlow} flow`,
        );
      }
    }

    if (category.business_line !== requiredBusinessLine) {
      throw new BadRequestException(
        `Selected category does not support ${quotationFlow} quotations`,
      );
    }

    if (product.business_line !== requiredBusinessLine) {
      throw new BadRequestException(
        `Selected product does not support ${quotationFlow} quotations`,
      );
    }

    if (
      quotationFlow === QuotationFlow.MOTOR_FLEET &&
      !product.supports_fleet
    ) {
      throw new BadRequestException(
        'Selected product does not support motor fleet quotations',
      );
    }

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

    if (dto.intermediary_company_id) {
      await this.ensureExists(
        this.companyRepository,
        { id: dto.intermediary_company_id },
        'Intermediary company not found',
      );
    }

    if (dto.risks?.length) {
      for (const risk of dto.risks) {
        await this.ensureExists(
          this.riskRepository,
          {
            id: risk.risk_id,
            company_id: dto.insurer_company_id,
            product_id: dto.product_id,
          },
          'Quotation risk not found for insurer product',
        );
      }
    }
  }

  private async assertQuotationChannelAllowed(
    requestingCompanyId: string,
    companyType: CompanyType | undefined,
    insurerCompanyId: string,
    productId: string,
  ): Promise<void> {
    if (!companyType || companyType === CompanyType.INSURANCE_COMPANY) {
      return;
    }

    await this.productDistributionService.assertCanQuote(
      requestingCompanyId,
      companyType,
      insurerCompanyId,
      productId,
    );
  }

  private buildQuotationTotals(dto: CreateQuotationDto | UpdateQuotationDto) {
    return {
      sum_insured: this.normalizeMoney(dto.sum_insured ?? 0),
      basic_premium: this.normalizeMoney(dto.basic_premium ?? 0),
      total_discount: this.normalizeMoney(dto.total_discount ?? 0),
      total_tax: this.normalizeMoney(dto.total_tax ?? 0),
      total_charges: this.normalizeMoney(dto.total_charges ?? 0),
      total_commission: this.normalizeMoney(dto.total_commission ?? 0),
      total_premium: this.normalizeMoney(dto.total_premium ?? 0),
      net_premium: this.normalizeMoney(dto.net_premium ?? 0),
    };
  }

  private resolveQuotationFlow(
    dto: CreateQuotationDto | UpdateQuotationDto,
  ): QuotationFlow {
    if (dto.quotation_flow) return dto.quotation_flow;
    if (dto.quotation_type === QuotationType.NON_MOTOR) {
      return QuotationFlow.NON_MOTOR;
    }
    return dto.is_fleet ? QuotationFlow.MOTOR_FLEET : QuotationFlow.MOTOR_SINGLE;
  }

  private resolveRiskReference(
    quotationRiskId: string | null | undefined,
    riskClientRef: string | null | undefined,
    riskIdByClientRef: Map<string, string>,
  ): string | null {
    if (quotationRiskId) return quotationRiskId;
    if (!riskClientRef) return null;

    const resolvedId = riskIdByClientRef.get(riskClientRef);
    if (!resolvedId) {
      throw new BadRequestException(
        `No quotation risk found for risk_client_ref "${riskClientRef}"`,
      );
    }
    return resolvedId;
  }

  private hasChildCollections(dto: UpdateQuotationDto): boolean {
    return (
      dto.risks !== undefined ||
      dto.factor_values !== undefined ||
      dto.premium_breakdowns !== undefined ||
      dto.addons !== undefined
    );
  }

  private async replaceQuotationChildren(
    manager: any,
    quotationId: string,
    dto: CreateQuotationDto | UpdateQuotationDto,
  ): Promise<void> {
    const riskRepo = manager.getRepository(QuotationRisk);
    const factorRepo = manager.getRepository(QuotationFactorValue);
    const breakdownRepo = manager.getRepository(QuotationPremiumBreakdown);
    const addonRepo = manager.getRepository(QuotationAddon);
    const addonTaxRepo = manager.getRepository(QuotationAddonTax);

    await addonTaxRepo
      .createQueryBuilder()
      .delete()
      .where(
        '"quotation_addon_id" IN (SELECT id FROM quotation_addons WHERE quotation_id = :quotationId)',
        { quotationId },
      )
      .execute();
    await addonRepo.delete({ quotation_id: quotationId });
    await breakdownRepo.delete({ quotation_id: quotationId });
    await factorRepo.delete({ quotation_id: quotationId });
    await riskRepo.delete({ quotation_id: quotationId });

    const risks = (dto.risks ?? []).map((risk) =>
      riskRepo.create({
        quotation_id: quotationId,
        risk_id: risk.risk_id,
        subject_matter_id: risk.subject_matter_id ?? null,
        motor_vehicle_id: risk.motor_vehicle_id ?? null,
        client_ref: risk.client_ref ?? null,
        sum_insured: this.normalizeMoney(risk.sum_insured ?? 0),
        rate: this.normalizeRate(risk.rate ?? 0),
        fixed_amount: this.normalizeMoney(risk.fixed_amount ?? 0),
        basic_premium: this.normalizeMoney(risk.basic_premium ?? 0),
        discount_amount: this.normalizeMoney(risk.discount_amount ?? 0),
        tax_amount: this.normalizeMoney(risk.tax_amount ?? 0),
        charges_amount: this.normalizeMoney(risk.charges_amount ?? 0),
        commission_amount: this.normalizeMoney(risk.commission_amount ?? 0),
        total_premium: this.normalizeMoney(risk.total_premium ?? 0),
        net_premium: this.normalizeMoney(risk.net_premium ?? 0),
        rating_rule_id: risk.rating_rule_id ?? null,
        rating_result_metadata: risk.rating_result_metadata ?? null,
      }),
    );
    if (risks.length) {
      await riskRepo.save(risks);
    }

    const riskIdByClientRef = new Map<string, string>();
    for (const risk of risks) {
      if (risk.client_ref) {
        riskIdByClientRef.set(risk.client_ref, risk.id);
      }
    }

    const factors = (dto.factor_values ?? []).map((factor) =>
      factorRepo.create({
        quotation_id: quotationId,
        quotation_risk_id: this.resolveRiskReference(
          factor.quotation_risk_id,
          factor.risk_client_ref,
          riskIdByClientRef,
        ),
        risk_client_ref: factor.risk_client_ref ?? null,
        factor_id: factor.factor_id,
        value_text: factor.value_text ?? null,
        value_number:
          factor.value_number !== undefined && factor.value_number !== null
            ? String(factor.value_number)
            : null,
        value_date: factor.value_date
          ? this.normalizeDate(factor.value_date)
          : null,
        value_boolean:
          factor.value_boolean === undefined ? null : factor.value_boolean,
        value_json: factor.value_json ?? null,
      }),
    );
    if (factors.length) {
      await factorRepo.save(factors);
    }

    const breakdowns = (dto.premium_breakdowns ?? []).map((item, index) =>
      breakdownRepo.create({
        quotation_id: quotationId,
        quotation_risk_id: this.resolveRiskReference(
          item.quotation_risk_id,
          item.risk_client_ref,
          riskIdByClientRef,
        ),
        risk_client_ref: item.risk_client_ref ?? null,
        item_type: item.item_type,
        item_code: item.item_code,
        item_name: item.item_name,
        rate: this.normalizeRate(item.rate ?? 0),
        amount: this.normalizeMoney(item.amount ?? 0),
        calculation_base:
          item.calculation_base ?? QuotationCalculationBase.BASIC_PREMIUM,
        calculation_order: item.calculation_order ?? index + 1,
      }),
    );
    if (breakdowns.length) {
      await breakdownRepo.save(breakdowns);
    }

    const addons = (dto.addons ?? []).map((addon) =>
      addonRepo.create({
        quotation_id: quotationId,
        addon_reference: addon.addon_reference,
        addon_desc: addon.addon_desc,
        addon_amount: this.normalizeMoney(addon.addon_amount ?? 0),
        addon_premium_rate: this.normalizeRate(addon.addon_premium_rate ?? 0),
        premium_excluding_tax: this.normalizeMoney(
          addon.premium_excluding_tax ?? 0,
        ),
        premium_excluding_tax_equivalent: this.normalizeMoney(
          addon.premium_excluding_tax_equivalent ??
            addon.premium_excluding_tax ??
            0,
        ),
        premium_including_tax: this.normalizeMoney(
          addon.premium_including_tax ?? 0,
        ),
        is_active: addon.is_active ?? true,
      }),
    );
    if (addons.length) {
      await addonRepo.save(addons);
    }

    const addonTaxes = addons.flatMap((addon, index) =>
      (dto.addons?.[index]?.taxes ?? []).map((tax) =>
        addonTaxRepo.create({
          quotation_addon_id: addon.id,
          tax_code: tax.tax_code,
          is_tax_exempted:
            tax.is_tax_exempted === true ||
            String(tax.is_tax_exempted ?? '').toUpperCase() === 'Y'
              ? 'Y'
              : 'N',
          tax_exemption_type: tax.tax_exemption_type ?? null,
          tax_exemption_reference: tax.tax_exemption_reference ?? null,
          tax_rate: this.normalizeRate(tax.tax_rate ?? 0),
          tax_amount: this.normalizeMoney(tax.tax_amount ?? 0),
        }),
      ),
    );
    if (addonTaxes.length) {
      await addonTaxRepo.save(addonTaxes);
    }
  }

  async create(
    companyId: string,
    companyType: CompanyType | undefined,
    dto: CreateQuotationDto,
    userId: string,
  ): Promise<Quotation> {
    await this.validateScope(companyId, dto);
    await this.assertQuotationChannelAllowed(
      companyId,
      companyType,
      dto.insurer_company_id,
      dto.product_id,
    );

    return this.dataSource
      .transaction(async (manager) => {
        const quotationRepository = manager.getRepository(Quotation);
        const quotationFlow = this.resolveQuotationFlow(dto);

        const quotationNo = await this.generateQuotationNo(
          companyId,
          dto.quotation_type,
        );
        const quotation = quotationRepository.create({
          company_id: companyId,
          insurer_company_id: dto.insurer_company_id,
          intermediary_company_id: dto.intermediary_company_id ?? null,
          branch_id: dto.branch_id ?? null,
          department_id: dto.department_id ?? null,
          created_by: userId,
          customer_id: dto.customer_id,
          category_id: dto.category_id,
          product_id: dto.product_id,
          sub_class_id: dto.sub_class_id ?? null,
          quotation_no: quotationNo,
          quotation_type: dto.quotation_type,
          quotation_flow: quotationFlow,
          is_fleet:
            dto.is_fleet ?? quotationFlow === QuotationFlow.MOTOR_FLEET,
          channel_type: dto.channel_type,
          status: dto.status ?? QuotationStatus.DRAFT,
          currency: dto.currency?.trim().toUpperCase() ?? 'TZS',
          exchange_rate: this.normalizeMoney(dto.exchange_rate ?? 1),
          cover_note_type: dto.cover_note_type ?? '1',
          prev_cover_note_reference_number: this.normalizeText(
            dto.prev_cover_note_reference_number,
          ),
          sale_point_code: this.normalizeText(dto.sale_point_code),
          payment_mode_tira: dto.payment_mode_tira ?? '1',
          officer_name: this.normalizeText(dto.officer_name),
          officer_title: this.normalizeText(dto.officer_title),
          ...this.buildQuotationTotals(dto),
          valid_from: this.normalizeDate(dto.valid_from)!,
          valid_until: this.normalizeDate(dto.valid_until)!,
          rating_version: this.normalizeText(dto.rating_version),
          rating_metadata: dto.rating_metadata ?? null,
          rejection_reason: this.normalizeText(dto.rejection_reason),
        });

        const saved = await quotationRepository.save(quotation);
        await this.replaceQuotationChildren(manager, saved.id, dto);

        return quotationRepository.findOneOrFail({
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
            factor_values: true,
            premium_breakdowns: true,
            addons: {
              taxes: true,
            },
            status_history: true,
          },
        });
      })
      .catch((error) => {
        if (this.isDuplicateEntryError(error)) {
          throw new ConflictException(
            'A quotation with this number already exists in this company',
          );
        }
        throw error;
      });
  }

  async findAll(companyId: string, query: FilterQuotationDto) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = SortDirection.DESC,
      search,
      status,
      quotation_type,
      customer_id,
      product_id,
    } = query;

    const allowedSortFields = [
      'quotation_no',
      'status',
      'created_at',
      'updated_at',
      'valid_from',
      'valid_until',
    ];
    const safeSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'created_at';
    const direction = sortOrder === SortDirection.ASC ? 'ASC' : 'DESC';

    const qb = this.quotationRepository
      .createQueryBuilder('quotation')
      .leftJoinAndSelect('quotation.customer', 'customer')
      .leftJoinAndSelect('quotation.category', 'category')
      .leftJoinAndSelect('quotation.product', 'product')
      .leftJoinAndSelect('quotation.sub_class', 'subClass')
      .leftJoinAndSelect('quotation.insurer_company', 'insurerCompany')
      .where('quotation.company_id = :companyId', { companyId })
      .orderBy(`quotation.${safeSortBy}`, direction);

    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      qb.andWhere(
        '(quotation.quotation_no ILIKE :term OR customer.first_name ILIKE :term OR customer.last_name ILIKE :term OR customer.company_name ILIKE :term OR quotation.rejection_reason ILIKE :term)',
        { term },
      );
    }
    if (status) qb.andWhere('quotation.status = :status', { status });
    if (quotation_type)
      qb.andWhere('quotation.quotation_type = :quotation_type', {
        quotation_type,
      });
    if (customer_id)
      qb.andWhere('quotation.customer_id = :customer_id', { customer_id });
    if (product_id)
      qb.andWhere('quotation.product_id = :product_id', { product_id });

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

  async findOne(companyId: string, id: string): Promise<Quotation> {
    const quotation = await this.quotationRepository.findOne({
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
        factor_values: true,
        premium_breakdowns: true,
        addons: {
          taxes: true,
        },
        status_history: true,
      },
    });
    if (!quotation) throw new NotFoundException('Quotation not found');
    return quotation;
  }

  async update(
    companyId: string,
    companyType: CompanyType | undefined,
    id: string,
    dto: UpdateQuotationDto,
    userId: string,
  ): Promise<Quotation> {
    const quotation = await this.findOne(companyId, id);
    const merged = { ...quotation, ...dto } as CreateQuotationDto;
    await this.validateScope(companyId, merged);
    await this.assertQuotationChannelAllowed(
      companyId,
      companyType,
      merged.insurer_company_id,
      merged.product_id,
    );

    const oldStatus = quotation.status;

    if (dto.status !== undefined && dto.status !== oldStatus) {
      const allowedNextStatuses =
        QUOTATION_STATUS_TRANSITIONS[oldStatus] ?? [];
      if (!allowedNextStatuses.includes(dto.status)) {
        throw new ConflictException(
          `Cannot change quotation status from ${oldStatus} to ${dto.status}`,
        );
      }
    }

    return this.dataSource.transaction(async (manager) => {
      const quotationRepo = manager.getRepository(Quotation);
      const historyRepo = manager.getRepository(QuotationStatusHistory);

      if (dto.insurer_company_id !== undefined)
        quotation.insurer_company_id = dto.insurer_company_id;
      if (dto.intermediary_company_id !== undefined)
        quotation.intermediary_company_id = dto.intermediary_company_id ?? null;
      if (dto.branch_id !== undefined)
        quotation.branch_id = dto.branch_id ?? null;
      if (dto.department_id !== undefined)
        quotation.department_id = dto.department_id ?? null;
      if (dto.customer_id !== undefined)
        quotation.customer_id = dto.customer_id;
      if (dto.category_id !== undefined)
        quotation.category_id = dto.category_id;
      if (dto.product_id !== undefined) quotation.product_id = dto.product_id;
      if (dto.sub_class_id !== undefined)
        quotation.sub_class_id = dto.sub_class_id ?? null;
      if (dto.quotation_type !== undefined)
        quotation.quotation_type = dto.quotation_type;
      if (dto.quotation_flow !== undefined)
        quotation.quotation_flow = dto.quotation_flow;
      if (dto.is_fleet !== undefined) quotation.is_fleet = dto.is_fleet;
      if (dto.channel_type !== undefined)
        quotation.channel_type = dto.channel_type;
      if (dto.status !== undefined) quotation.status = dto.status;
      if (dto.currency !== undefined)
        quotation.currency = dto.currency.trim().toUpperCase();
      if (dto.exchange_rate !== undefined)
        quotation.exchange_rate = this.normalizeMoney(dto.exchange_rate);
      if (dto.cover_note_type !== undefined)
        quotation.cover_note_type = dto.cover_note_type;
      if (dto.prev_cover_note_reference_number !== undefined)
        quotation.prev_cover_note_reference_number = this.normalizeText(
          dto.prev_cover_note_reference_number,
        );
      if (dto.sale_point_code !== undefined)
        quotation.sale_point_code = this.normalizeText(dto.sale_point_code);
      if (dto.payment_mode_tira !== undefined)
        quotation.payment_mode_tira = dto.payment_mode_tira;
      if (dto.officer_name !== undefined)
        quotation.officer_name = this.normalizeText(dto.officer_name);
      if (dto.officer_title !== undefined)
        quotation.officer_title = this.normalizeText(dto.officer_title);
      if (dto.sum_insured !== undefined)
        quotation.sum_insured = this.normalizeMoney(dto.sum_insured);
      if (dto.basic_premium !== undefined)
        quotation.basic_premium = this.normalizeMoney(dto.basic_premium);
      if (dto.total_discount !== undefined)
        quotation.total_discount = this.normalizeMoney(dto.total_discount);
      if (dto.total_tax !== undefined)
        quotation.total_tax = this.normalizeMoney(dto.total_tax);
      if (dto.total_charges !== undefined)
        quotation.total_charges = this.normalizeMoney(dto.total_charges);
      if (dto.total_commission !== undefined)
        quotation.total_commission = this.normalizeMoney(dto.total_commission);
      if (dto.total_premium !== undefined)
        quotation.total_premium = this.normalizeMoney(dto.total_premium);
      if (dto.net_premium !== undefined)
        quotation.net_premium = this.normalizeMoney(dto.net_premium);
      if (dto.valid_from !== undefined)
        quotation.valid_from = this.normalizeDate(dto.valid_from)!;
      if (dto.valid_until !== undefined)
        quotation.valid_until = this.normalizeDate(dto.valid_until)!;
      if (dto.rating_version !== undefined)
        quotation.rating_version = this.normalizeText(dto.rating_version);
      if (dto.rating_metadata !== undefined)
        quotation.rating_metadata = dto.rating_metadata ?? null;
      if (dto.rejection_reason !== undefined)
        quotation.rejection_reason = this.normalizeText(dto.rejection_reason);

      quotation.created_by = quotation.created_by ?? userId;
      quotation.quotation_flow = this.resolveQuotationFlow({
        ...merged,
        ...dto,
        quotation_type: quotation.quotation_type,
        is_fleet: quotation.is_fleet,
        quotation_flow: dto.quotation_flow ?? quotation.quotation_flow,
      });
      quotation.is_fleet =
        quotation.quotation_flow === QuotationFlow.MOTOR_FLEET;

      const saved = await quotationRepo.save(quotation);
      if (this.hasChildCollections(dto)) {
        await this.replaceQuotationChildren(
          manager,
          saved.id,
          merged as CreateQuotationDto,
        );
      }

      if (dto.status !== undefined && dto.status !== oldStatus) {
        await historyRepo.save(
          historyRepo.create({
            quotation_id: saved.id,
            old_status: oldStatus,
            new_status: dto.status,
            reason: dto.rejection_reason ?? null,
            changed_by: userId,
          }),
        );
      }

      return quotationRepo.findOneOrFail({
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
          factor_values: true,
          premium_breakdowns: true,
          addons: {
            taxes: true,
          },
          status_history: true,
        },
      });
    });
  }

  async remove(companyId: string, id: string): Promise<void> {
    const quotation = await this.findOne(companyId, id);
    await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(QuotationRisk)
        .softDelete({ quotation_id: quotation.id });
      await manager
        .getRepository(QuotationFactorValue)
        .softDelete({ quotation_id: quotation.id });
      await manager
        .getRepository(QuotationPremiumBreakdown)
        .softDelete({ quotation_id: quotation.id });
      await manager
        .getRepository(QuotationStatusHistory)
        .softDelete({ quotation_id: quotation.id });
      await manager.getRepository(Quotation).softDelete(quotation.id);
    });
  }

  async restore(companyId: string, id: string): Promise<Quotation> {
    const quotation = await this.quotationRepository.findOne({
      where: { id, company_id: companyId },
      withDeleted: true,
    });
    if (!quotation) throw new NotFoundException('Quotation not found');

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Quotation).restore(quotation.id);
      await manager
        .getRepository(QuotationRisk)
        .restore({ quotation_id: quotation.id });
      await manager
        .getRepository(QuotationFactorValue)
        .restore({ quotation_id: quotation.id });
      await manager
        .getRepository(QuotationPremiumBreakdown)
        .restore({ quotation_id: quotation.id });
      await manager
        .getRepository(QuotationStatusHistory)
        .restore({ quotation_id: quotation.id });
    });

    return this.findOne(companyId, id);
  }
}
