import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { escapeLike } from '@insurance-max/portal-shared/utils/paginate-query.util';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';

import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { Company } from '../../../platform/companies/entities/company.entity';
import { TiramisSalePointEntity } from '../../../tiramis/entities/tiramis-sale-point.entity';
import { Branch } from '../../branches/entities/branch.entity';
import { InsurancePartnersService } from '../../insurance-partners/insurance-partners.service';
import { PartnerOperation } from '../../insurance-partners/enums/partner-operation.enum';
import { CommissionTransaction } from '../../billing-commission/entities/commission-transaction.entity';
import { Invoice } from '../../billing-commission/entities/invoice.entity';
import { Receipt } from '../../billing-commission/entities/receipt.entity';
import { Complaint } from '../../claims/entities/complaint.entity';
import { InsuranceClaim } from '../../claims/entities/claim.entity';
import { InsuranceRisk } from '../../insurance-risks/entities/insurance-risk.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { Policy } from '../../policies/entities/policy.entity';
import { ProductChannelType } from '../../product-distribution/enums/product-channel-type.enum';
import {
  SaveQuotationDraftDto,
  UpdateQuotationDraftDto,
} from '../../quotations/dto/quotation-draft.dto';
import { UpdateQuotationDto } from '../../quotations/dto/quotation-payload.dto';
import { Quotation } from '../../quotations/entities/quotation.entity';
import { QuotationsService } from '../../quotations/quotations.service';

import { PortalListQueryDto } from '../dto/portal-query.dto';
import { IntermediarySettlementReportQueryDto } from '../dto/intermediary-settlement-report-query.dto';
import { PortalAccount } from '../entities/portal-account.entity';
import { PortalActorType } from '../enums/portal.enums';

interface PortalPagination {
  page: number;
  limit: number;
}

@Injectable()
export class PortalBusinessAccessService {
  constructor(
    @InjectRepository(Quotation)
    private readonly quotationRepository: Repository<Quotation>,
    @InjectRepository(Policy)
    private readonly policyRepository: Repository<Policy>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
    @InjectRepository(InsuranceClaim)
    private readonly claimRepository: Repository<InsuranceClaim>,
    @InjectRepository(Complaint)
    private readonly complaintRepository: Repository<Complaint>,
    @InjectRepository(CommissionTransaction)
    private readonly commissionRepository: Repository<CommissionTransaction>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(InsuranceRisk)
    private readonly riskRepository: Repository<InsuranceRisk>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(TiramisSalePointEntity)
    private readonly salePointRepository: Repository<TiramisSalePointEntity>,
    private readonly quotationsService: QuotationsService,
    private readonly insurancePartnersService: InsurancePartnersService,
  ) {}

  // =========================================================
  // PORTAL PROFILES
  // =========================================================

  async findCustomerProfile(account: PortalAccount) {
    this.assertCustomerAccount(account);

    const customer = await this.customerRepository.findOne({
      where: { id: account.customer_id, company_id: account.company_id },
    });

    if (!customer) {
      throw new NotFoundException('Linked customer was not found');
    }

    return {
      id: customer.id,
      customer_no: customer.customer_no,
      customer_type: customer.customer_type,
      first_name: customer.first_name,
      middle_name: customer.middle_name,
      last_name: customer.last_name,
      gender: customer.gender,
      date_of_birth: customer.date_of_birth,
      company_name: customer.company_name,
      policy_holder_type: customer.policy_holder_type,
      id_type: customer.id_type,
      id_number: customer.id_number,
      nida_no: customer.nida_no,
      voter_no: customer.voter_no,
      passport_no: customer.passport_no,
      driving_license_no: customer.driving_license_no,
      zanid_no: customer.zanid_no,
      tin: customer.tin,
      registration_no: customer.registration_no,
      incorporation_certificate_no: customer.incorporation_certificate_no,
      vrn: customer.vrn,
      display_name: this.customerName(customer),
      phone: customer.phone,
      alternate_phone: customer.alternate_phone,
      email: customer.email,
      country: customer.country,
      country_code: customer.country_code,
      region: customer.region,
      district: customer.district,
      ward: customer.ward,
      street: customer.street,
      postal_address: customer.postal_address,
      status: customer.status,
    };
  }

  async findIntermediaryProfile(account: PortalAccount) {
    this.assertIntermediaryAccount(account);

    const company =
      account.intermediary_company ??
      (await this.companyRepository.findOne({
        where: { id: account.intermediary_company_id, status: 'active' },
      }));

    if (!company) {
      throw new NotFoundException('Intermediary company was not found');
    }

    this.assertSupportedIntermediaryCompany(company);

    return {
      id: company.id,
      name: company.name,
      slug: company.slug,
      company_type: company.company_type,
      contact_email: company.contact_email,
      contact_phone: company.contact_phone,
      website: company.website,
      logo_url: company.logo_url,
      address: company.address,
      tira_license_number: company.tira_license_number,
      tira_license_status: company.tira_license_status,
    };
  }

  async findIntermediaryDistributionLocations(account: PortalAccount) {
    this.assertIntermediaryAccount(account);
    const companyId = account.intermediary_company_id;
    const company = await this.companyRepository.findOne({
      where: { id: companyId },
    });
    if (!company)
      throw new NotFoundException('Intermediary company was not found');
    this.assertSupportedIntermediaryCompany(company);
    const [branches, salePoints] = await Promise.all([
      this.branchRepository.find({
        where: { company_id: companyId, status: 'active' },
        order: { name: 'ASC' },
      }),
      this.salePointRepository.find({
        where: { companyId, isActive: true },
        order: { salePointName: 'ASC' },
      }),
    ]);
    return {
      company_type: company.company_type,
      branches: branches.map(({ id, name, code }) => ({ id, name, code })),
      sale_points: salePoints.map(
        ({ id, branchId, salePointCode, salePointName }) => ({
          id,
          branch_id: branchId,
          code: salePointCode,
          name: salePointName,
        }),
      ),
    };
  }

  // =========================================================
  // QUOTATIONS
  // =========================================================

  async findQuotations(account: PortalAccount, query: PortalListQueryDto) {
    const { page, limit } = this.pagination(query);

    const qb = this.quotationRepository
      .createQueryBuilder('quotation')
      .leftJoinAndSelect('quotation.product', 'product')
      .leftJoinAndSelect('quotation.customer', 'customer')
      .where('quotation.deleted_at IS NULL');

    this.applyQuotationScope(qb, account);

    if (query.status) {
      qb.andWhere('quotation.status = :status', {
        status: query.status.trim().toUpperCase(),
      });
    }

    if (query.search?.trim()) {
      const searchTerm = `%${escapeLike(query.search.trim())}%`;

      qb.andWhere(
        new Brackets((search) => {
          search
            .where('quotation.quotation_no ILIKE :search', {
              search: searchTerm,
            })
            .orWhere('product.product_name ILIKE :search')
            .orWhere('customer.customer_no ILIKE :search')
            .orWhere('customer.first_name ILIKE :search')
            .orWhere('customer.last_name ILIKE :search')
            .orWhere('customer.company_name ILIKE :search');
        }),
      );
    }

    qb.orderBy('quotation.created_at', 'DESC')
      .addOrderBy('quotation.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((quotation) => this.mapQuotationSummary(quotation)),
      meta: this.paginationMeta(page, limit, total),
    };
  }

  async findQuotation(account: PortalAccount, id: string) {
    const qb = this.quotationRepository
      .createQueryBuilder('quotation')
      .leftJoinAndSelect('quotation.product', 'product')
      .leftJoinAndSelect('quotation.customer', 'customer')
      .where('quotation.id = :id', { id })
      .andWhere('quotation.deleted_at IS NULL');

    this.applyQuotationScope(qb, account);

    const quotation = await qb.getOne();

    if (!quotation) {
      // Return 404 instead of 403 so the caller cannot confirm whether
      // another customer's quotation exists.
      throw new NotFoundException('Quotation not found');
    }

    return {
      ...this.mapQuotationSummary(quotation),
      current_wizard_step: quotation.current_wizard_step,
      // Draft payload belongs to this explicitly scoped customer or
      // intermediary account. Don't return the internal submission
      // response, signing credentials, or raw TIRAMIS secret values.
      draft_payload: quotation.draft_payload ?? {},
      distribution_attribution:
        this.asRecord(quotation.draft_payload?.['distribution_attribution']) ??
        null,
      insurer_company_id: quotation.insurer_company_id,
      intermediary_company_id: quotation.intermediary_company_id,
      customer_id: quotation.customer_id,
      channel_type: quotation.channel_type,
    };
  }

  async createQuotationDraft(
    account: PortalAccount,
    dto: SaveQuotationDraftDto,
    userId: string,
  ) {
    const scopedDto = await this.scopeDraft(account, dto);
    await this.assertIntermediaryOperation(
      account,
      scopedDto.insurer_company_id,
      scopedDto.product_id,
      PartnerOperation.QUOTE,
      scopedDto.branch_id,
    );

    return this.quotationsService.createDraft(
      account.company_id,
      scopedDto,
      userId,
    );
  }

  async updateQuotationDraft(
    account: PortalAccount,
    quotationId: string,
    dto: UpdateQuotationDraftDto,
    user: AuthenticatedUser,
  ) {
    const quotation = await this.assertQuotation(account, quotationId);

    this.assertQuotationEditable(quotation);

    const scopedDto = await this.scopeDraft(account, dto, quotation);
    await this.assertIntermediaryOperation(
      account,
      scopedDto.insurer_company_id,
      scopedDto.product_id,
      PartnerOperation.QUOTE,
      scopedDto.branch_id,
    );

    return this.quotationsService.updateDraft(
      account.company_id,
      quotationId,
      { ...scopedDto, expected_updated_at: dto.expected_updated_at },
      user,
    );
  }

  async finalizeQuotation(
    account: PortalAccount,
    quotationId: string,
    payload: UpdateQuotationDto,
    user: Pick<AuthenticatedUser, 'id' | 'permissions'>,
  ) {
    const quotation = await this.assertQuotation(account, quotationId);

    this.assertQuotationEditable(quotation);

    const scopedPayload = await this.scopeFinalPayload(
      account,
      quotation,
      payload,
    );
    await this.assertIntermediaryOperation(
      account,
      quotation.insurer_company_id,
      quotation.product_id,
      PartnerOperation.SUBMIT,
      quotation.branch_id,
    );

    return this.quotationsService.finalize(
      account.company_id,
      quotationId,
      scopedPayload,
      user,
    );
  }

  async submitCustomerQuotationDirect(
    account: PortalAccount,
    draftDto: SaveQuotationDraftDto,
    payload: UpdateQuotationDto,
    user: AuthenticatedUser,
  ) {
    this.assertCustomerAccount(account);

    const scopedDraft = await this.scopeDraft(account, draftDto);
    const draft = await this.quotationsService.createCustomerPortalDraft(
      account.company_id,
      scopedDraft,
      user,
    );
    const quotation = await this.assertQuotation(account, draft.id);
    const scopedPayload = await this.scopeFinalPayload(
      account,
      quotation,
      payload,
    );

    return this.quotationsService.submitCustomerPortalQuotation(
      account.company_id,
      draft.id,
      scopedPayload,
      user,
    );
  }

  // =========================================================
  // POLICIES
  // =========================================================

  async findPolicies(account: PortalAccount, query: PortalListQueryDto) {
    const { page, limit } = this.pagination(query);

    const qb = this.policyRepository
      .createQueryBuilder('policy')
      .leftJoinAndSelect('policy.product', 'product')
      .leftJoinAndSelect('policy.customer', 'customer')
      .where('policy.deleted_at IS NULL');

    this.applyPolicyScope(qb, account);

    if (query.status) {
      qb.andWhere('policy.policy_status = :status', {
        status: query.status.trim().toUpperCase(),
      });
    }

    if (query.search?.trim()) {
      const searchTerm = `%${escapeLike(query.search.trim())}%`;

      qb.andWhere(
        new Brackets((search) => {
          search
            .where('policy.policy_no ILIKE :search', { search: searchTerm })
            .orWhere('policy.cover_note_no ILIKE :search')
            .orWhere('product.product_name ILIKE :search')
            .orWhere('customer.customer_no ILIKE :search');
        }),
      );
    }

    qb.orderBy('policy.created_at', 'DESC')
      .addOrderBy('policy.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((policy) => this.mapPolicySummary(policy)),
      meta: this.paginationMeta(page, limit, total),
    };
  }

  async findPolicy(account: PortalAccount, policyId: string) {
    const qb = this.policyRepository
      .createQueryBuilder('policy')
      .leftJoinAndSelect('policy.product', 'product')
      .leftJoinAndSelect('policy.customer', 'customer')
      .where('policy.id = :policyId', { policyId })
      .andWhere('policy.deleted_at IS NULL');

    this.applyPolicyScope(qb, account);

    const policy = await qb.getOne();

    if (!policy) {
      throw new NotFoundException('Policy not found');
    }

    return {
      ...this.mapPolicySummary(policy),
      insurer_company_id: policy.insurer_company_id,
      intermediary_company_id: policy.intermediary_company_id,
      branch_id: policy.branch_id,
      category_id: policy.category_id,
      product_id: policy.product_id,
      customer_id: policy.customer_id,
      quotation_id: policy.quotation_id,
      tiramis_status: policy.tiramis_status,
      reinsurance_required: policy.reinsurance_required,
      retention_amount: policy.retention_amount,
      ceded_sum_insured: policy.ceded_sum_insured,
      ceded_premium: policy.ceded_premium,
      distribution_snapshot: policy.distribution_snapshot,
    };
  }

  // =========================================================
  // INVOICES
  // =========================================================

  async findInvoices(account: PortalAccount, query: PortalListQueryDto) {
    const { page, limit } = this.pagination(query);

    const qb = this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.policy', 'policy')
      .leftJoinAndSelect('invoice.quotation', 'quotation')
      .where('invoice.deleted_at IS NULL');

    this.applyInvoiceScope(qb, account);

    if (query.status) {
      qb.andWhere('invoice.status = :status', {
        status: query.status.trim().toUpperCase(),
      });
    }

    if (query.search?.trim()) {
      const searchTerm = `%${escapeLike(query.search.trim())}%`;

      qb.andWhere(
        new Brackets((search) => {
          search
            .where('invoice.invoice_no ILIKE :search', { search: searchTerm })
            .orWhere('policy.policy_no ILIKE :search')
            .orWhere('quotation.quotation_no ILIKE :search');
        }),
      );
    }

    qb.orderBy('invoice.created_at', 'DESC')
      .addOrderBy('invoice.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((invoice) => this.mapInvoiceSummary(invoice)),
      meta: this.paginationMeta(page, limit, total),
    };
  }

  async findInvoice(account: PortalAccount, invoiceId: string) {
    const qb = this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.items', 'item')
      .leftJoinAndSelect('invoice.policy', 'policy')
      .leftJoinAndSelect('invoice.quotation', 'quotation')
      .where('invoice.id = :invoiceId', { invoiceId })
      .andWhere('invoice.deleted_at IS NULL');

    this.applyInvoiceScope(qb, account);

    const invoice = await qb.getOne();

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return {
      ...this.mapInvoiceSummary(invoice),
      items:
        invoice.items?.map((item) => ({
          id: item.id,
          item_type: item.item_type,
          item_name: item.item_name,
          description: item.description,
          quantity: item.quantity,
          unit_amount: item.unit_amount,
          total_amount: item.total_amount,
        })) ?? [],
    };
  }

  // =========================================================
  // RECEIPTS
  // =========================================================

  async findReceipts(account: PortalAccount, query: PortalListQueryDto) {
    const { page, limit } = this.pagination(query);

    const qb = this.receiptRepository
      .createQueryBuilder('receipt')
      .leftJoinAndSelect('receipt.invoice', 'invoice')
      .leftJoinAndSelect('invoice.policy', 'policy')
      .leftJoinAndSelect('invoice.quotation', 'quotation')
      .where('receipt.deleted_at IS NULL');

    this.applyReceiptScope(qb, account);

    if (query.status) {
      qb.andWhere('receipt.status = :status', {
        status: query.status.trim().toUpperCase(),
      });
    }

    if (query.search?.trim()) {
      const searchTerm = `%${escapeLike(query.search.trim())}%`;

      qb.andWhere(
        new Brackets((search) => {
          search
            .where('receipt.receipt_no ILIKE :search', { search: searchTerm })
            .orWhere('receipt.payment_reference ILIKE :search')
            .orWhere('invoice.invoice_no ILIKE :search');
        }),
      );
    }

    qb.orderBy('receipt.created_at', 'DESC')
      .addOrderBy('receipt.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((receipt) => ({
        id: receipt.id,
        receipt_no: receipt.receipt_no,
        payment_method: receipt.payment_method,
        amount: receipt.amount,
        currency: receipt.currency,
        payment_reference: receipt.payment_reference,
        received_at: receipt.received_at,
        status: receipt.status,
        invoice: receipt.invoice
          ? {
              id: receipt.invoice.id,
              invoice_no: receipt.invoice.invoice_no,
              status: receipt.invoice.status,
            }
          : null,
        policy_no: receipt.invoice?.policy?.policy_no ?? null,
        quotation_no: receipt.invoice?.quotation?.quotation_no ?? null,
      })),
      meta: this.paginationMeta(page, limit, total),
    };
  }

  // =========================================================
  // CLAIMS AND COMPLAINTS
  // =========================================================

  async findClaims(account: PortalAccount, query: PortalListQueryDto) {
    const { page, limit } = this.pagination(query);

    const qb = this.claimRepository
      .createQueryBuilder('claim')
      .leftJoinAndSelect('claim.policy', 'policy')
      .leftJoinAndSelect('claim.customer', 'customer')
      .where('claim.deleted_at IS NULL');

    this.applyClaimScope(qb, account);

    if (query.status) {
      qb.andWhere('claim.status = :status', {
        status: query.status.trim().toUpperCase(),
      });
    }

    if (query.search?.trim()) {
      const searchTerm = `%${escapeLike(query.search.trim())}%`;

      qb.andWhere(
        new Brackets((search) => {
          search
            .where('claim.claim_no ILIKE :search', { search: searchTerm })
            .orWhere('claim.claim_notification_number ILIKE :search')
            .orWhere('claim.claim_reference_number ILIKE :search')
            .orWhere('claim.loss_type ILIKE :search')
            .orWhere('claim.loss_location ILIKE :search')
            .orWhere('policy.policy_no ILIKE :search')
            .orWhere('customer.customer_no ILIKE :search');
        }),
      );
    }

    qb.orderBy('claim.created_at', 'DESC')
      .addOrderBy('claim.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((claim) => this.mapClaimSummary(claim)),
      meta: this.paginationMeta(page, limit, total),
    };
  }

  async findClaim(account: PortalAccount, claimId: string) {
    const qb = this.claimRepository
      .createQueryBuilder('claim')
      .leftJoinAndSelect('claim.policy', 'policy')
      .leftJoinAndSelect('claim.customer', 'customer')
      .where('claim.id = :claimId', { claimId })
      .andWhere('claim.deleted_at IS NULL');

    this.applyClaimScope(qb, account);

    const claim = await qb.getOne();

    if (!claim) {
      throw new NotFoundException('Claim not found');
    }

    return this.mapClaimSummary(claim);
  }

  async findComplaints(account: PortalAccount, query: PortalListQueryDto) {
    const { page, limit } = this.pagination(query);

    const qb = this.complaintRepository
      .createQueryBuilder('complaint')
      .leftJoin(Policy, 'policy', 'policy.id = complaint.policy_id')
      .leftJoin(Customer, 'customer', 'customer.id = complaint.customer_id')
      .where('1 = 1');

    this.applyComplaintScope(qb, account);

    if (query.status) {
      qb.andWhere('complaint.status = :status', {
        status: query.status.trim().toUpperCase(),
      });
    }

    if (query.search?.trim()) {
      const searchTerm = `%${escapeLike(query.search.trim())}%`;

      qb.andWhere(
        new Brackets((search) => {
          search
            .where('complaint.complaint_no ILIKE :search', {
              search: searchTerm,
            })
            .orWhere('complaint.category ILIKE :search')
            .orWhere('complaint.subject ILIKE :search')
            .orWhere('policy.policy_no ILIKE :search')
            .orWhere('customer.customer_no ILIKE :search');
        }),
      );
    }

    qb.addSelect(['policy.id', 'policy.policy_no'])
      .addSelect(['customer.id', 'customer.customer_no'])
      .orderBy('complaint.created_at', 'DESC')
      .addOrderBy('complaint.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    const rawRows = await qb.getRawMany();
    const references = new Map(
      rawRows.map((row) => [
        row.complaint_id as string,
        {
          policy_no: (row.policy_policy_no as string | null) ?? null,
          customer_no: (row.customer_customer_no as string | null) ?? null,
        },
      ]),
    );

    return {
      items: items.map((complaint) =>
        this.mapComplaintSummary(complaint, references.get(complaint.id)),
      ),
      meta: this.paginationMeta(page, limit, total),
    };
  }

  async findComplaint(account: PortalAccount, complaintId: string) {
    const qb = this.complaintRepository
      .createQueryBuilder('complaint')
      .leftJoin(Policy, 'policy', 'policy.id = complaint.policy_id')
      .leftJoin(Customer, 'customer', 'customer.id = complaint.customer_id')
      .addSelect(['policy.id', 'policy.policy_no'])
      .addSelect(['customer.id', 'customer.customer_no'])
      .where('complaint.id = :complaintId', { complaintId });

    this.applyComplaintScope(qb, account);

    const complaint = await qb.getOne();
    const raw = await qb.getRawOne<{
      policy_policy_no?: string | null;
      customer_customer_no?: string | null;
    }>();

    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    return this.mapComplaintSummary(complaint, {
      policy_no: raw?.policy_policy_no ?? null,
      customer_no: raw?.customer_customer_no ?? null,
    });
  }

  // =========================================================
  // INTERMEDIARY COMMISSIONS
  // =========================================================

  async findCommissions(account: PortalAccount, query: PortalListQueryDto) {
    this.assertIntermediaryAccount(account);

    const { page, limit } = this.pagination(query);

    const qb = this.commissionRepository
      .createQueryBuilder('commission')
      .leftJoinAndSelect('commission.policy', 'policy')
      .leftJoinAndSelect('commission.quotation', 'quotation')
      .where('commission.intermediary_company_id = :intermediaryCompanyId', {
        intermediaryCompanyId: account.intermediary_company_id,
      })
      .andWhere('commission.deleted_at IS NULL');

    this.applyIntermediaryProductScope(
      qb,
      account.intermediary_company_id,
      'commission.insurer_company_id',
      'COALESCE(policy.product_id, quotation.product_id)',
      PartnerOperation.VIEW_COMMISSION,
      'COALESCE(policy.branch_id, quotation.branch_id)',
    );

    if (query.status) {
      qb.andWhere('commission.status = :status', {
        status: query.status.trim().toUpperCase(),
      });
    }

    if (query.search?.trim()) {
      const searchTerm = `%${escapeLike(query.search.trim())}%`;

      qb.andWhere(
        new Brackets((search) => {
          search.where('policy.policy_no ILIKE :search', {
            search: searchTerm,
          });
        }),
      );
    }

    qb.orderBy('commission.created_at', 'DESC')
      .addOrderBy('commission.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((commission) => ({
        id: commission.id,
        policy_id: commission.policy_id,
        policy_no: commission.policy?.policy_no ?? null,
        commission_type: commission.commission_type,
        calculation_base: commission.calculation_base,
        gross_premium: commission.gross_premium,
        net_premium: commission.net_premium,
        commission_rate: commission.commission_rate,
        commission_amount: commission.commission_amount,
        status: commission.status,
        earned_at: commission.earned_at,
        paid_at: commission.paid_at,
      })),
      meta: this.paginationMeta(page, limit, total),
    };
  }

  // =========================================================
  // INTERMEDIARY CUSTOMER PORTFOLIO
  // =========================================================

  async findPortfolioCustomers(
    account: PortalAccount,
    query: PortalListQueryDto,
  ) {
    this.assertIntermediaryAccount(account);

    const { page, limit } = this.pagination(query);
    const intermediaryCompanyId = account.intermediary_company_id;

    const qb = this.customerRepository
      .createQueryBuilder('customer')
      .where('customer.deleted_at IS NULL')
      .andWhere(
        new Brackets((portfolio) => {
          // Customers created directly under the intermediary company.
          // Customers connected through policies.
          // Customers connected through quotations.
          portfolio.where('customer.company_id = :intermediaryCompanyId', {
            intermediaryCompanyId,
          }).orWhere(`
              EXISTS (
                SELECT 1 FROM quotations portfolio_quotation
                WHERE portfolio_quotation.customer_id = customer.id
                  AND portfolio_quotation.intermediary_company_id = :intermediaryCompanyId
                  AND portfolio_quotation.deleted_at IS NULL
              )
            `).orWhere(`
              EXISTS (
                SELECT 1 FROM policies portfolio_policy
                WHERE portfolio_policy.customer_id = customer.id
                  AND portfolio_policy.intermediary_company_id = :intermediaryCompanyId
                  AND portfolio_policy.deleted_at IS NULL
              )
            `);
        }),
      );

    if (query.status) {
      qb.andWhere('customer.status = :status', {
        status: query.status.trim().toLowerCase(),
      });
    }

    if (query.search?.trim()) {
      const searchTerm = `%${escapeLike(query.search.trim())}%`;

      qb.andWhere(
        new Brackets((search) => {
          search
            .where('customer.customer_no ILIKE :search', {
              search: searchTerm,
            })
            .orWhere('customer.first_name ILIKE :search')
            .orWhere('customer.last_name ILIKE :search')
            .orWhere('customer.company_name ILIKE :search')
            .orWhere('customer.email ILIKE :search')
            .orWhere('customer.phone ILIKE :search');
        }),
      );
    }

    qb.orderBy('customer.created_at', 'DESC')
      .addOrderBy('customer.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [customers, total] = await qb.getManyAndCount();

    return {
      items: customers.map((customer) => ({
        id: customer.id,
        customer_no: customer.customer_no,
        customer_type: customer.customer_type,
        name: this.customerName(customer),
        phone: customer.phone,
        email: customer.email,
        status: customer.status,
      })),
      meta: this.paginationMeta(page, limit, total),
    };
  }

  async assertPortfolioCustomer(
    account: PortalAccount,
    customerId: string,
  ): Promise<Customer> {
    this.assertIntermediaryAccount(account);

    const intermediaryCompanyId = account.intermediary_company_id;

    const customer = await this.customerRepository
      .createQueryBuilder('customer')
      .where('customer.id = :customerId', { customerId })
      .andWhere('customer.deleted_at IS NULL')
      .andWhere(
        new Brackets((portfolio) => {
          portfolio.where('customer.company_id = :intermediaryCompanyId', {
            intermediaryCompanyId,
          }).orWhere(`
              EXISTS (
                SELECT 1 FROM quotations scoped_quotation
                WHERE scoped_quotation.customer_id = customer.id
                  AND scoped_quotation.intermediary_company_id = :intermediaryCompanyId
                  AND scoped_quotation.deleted_at IS NULL
              )
            `).orWhere(`
              EXISTS (
                SELECT 1 FROM policies scoped_policy
                WHERE scoped_policy.customer_id = customer.id
                  AND scoped_policy.intermediary_company_id = :intermediaryCompanyId
                  AND scoped_policy.deleted_at IS NULL
              )
            `);
        }),
      )
      .getOne();

    if (!customer) {
      throw new NotFoundException(
        'Customer not found in intermediary portfolio',
      );
    }

    return customer;
  }

  // =========================================================
  // OWNERSHIP ASSERTIONS
  // =========================================================

  async assertQuotation(
    account: PortalAccount,
    quotationId: string,
  ): Promise<Quotation> {
    const qb = this.quotationRepository
      .createQueryBuilder('quotation')
      .where('quotation.id = :quotationId', { quotationId })
      .andWhere('quotation.deleted_at IS NULL');

    this.applyQuotationScope(qb, account);

    const quotation = await qb.getOne();

    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }

    return quotation;
  }

  async assertPolicy(
    account: PortalAccount,
    policyId: string,
  ): Promise<Policy> {
    const qb = this.policyRepository
      .createQueryBuilder('policy')
      .where('policy.id = :policyId', { policyId })
      .andWhere('policy.deleted_at IS NULL');

    this.applyPolicyScope(qb, account);

    const policy = await qb.getOne();

    if (!policy) {
      throw new NotFoundException('Policy not found');
    }

    return policy;
  }

  async findIntermediarySettlementReport(
    account: PortalAccount,
    query: IntermediarySettlementReportQueryDto,
  ) {
    this.assertIntermediaryAccount(account);
    const company = await this.companyRepository.findOne({
      where: { id: account.intermediary_company_id, status: 'active' },
    });
    if (company?.company_type !== CompanyType.BANCASSURANCE) {
      throw new ForbiddenException(
        'This report is available to bancassurance partners only',
      );
    }
    if (query.from_date && query.to_date && query.from_date > query.to_date) {
      throw new BadRequestException('from_date must not be after to_date');
    }

    const branchId = `COALESCE(policy.distribution_snapshot ->> 'intermediaryBranchId', quotation.draft_payload #>> '{distribution_attribution,branch_id}')`;
    const branchName = `COALESCE(policy.distribution_snapshot ->> 'intermediaryBranchName', quotation.draft_payload #>> '{distribution_attribution,branch_name}')`;
    const salePointId = `COALESCE(policy.distribution_snapshot ->> 'intermediarySalePointId', quotation.draft_payload #>> '{distribution_attribution,sale_point_id}')`;
    const salePointCode = `COALESCE(policy.distribution_snapshot ->> 'intermediarySalePointCode', quotation.draft_payload #>> '{distribution_attribution,sale_point_code}')`;
    const salePointName = `COALESCE(policy.distribution_snapshot ->> 'intermediarySalePointName', quotation.draft_payload #>> '{distribution_attribution,sale_point_name}')`;
    const qb = this.commissionRepository
      .createQueryBuilder('commission')
      .leftJoin('commission.policy', 'policy')
      .leftJoin('commission.quotation', 'quotation')
      .leftJoin('commission.insurer_company', 'insurer')
      .where('commission.intermediary_company_id = :intermediaryCompanyId', {
        intermediaryCompanyId: account.intermediary_company_id,
      })
      .andWhere('commission.deleted_at IS NULL');

    this.applyIntermediaryProductScope(
      qb,
      account.intermediary_company_id,
      'commission.insurer_company_id',
      'COALESCE(policy.product_id, quotation.product_id)',
      PartnerOperation.VIEW_COMMISSION,
      'COALESCE(policy.branch_id, quotation.branch_id)',
    );
    if (query.from_date) {
      qb.andWhere(
        'COALESCE(commission.earned_at, commission.created_at)::date >= :fromDate',
        {
          fromDate: query.from_date,
        },
      );
    }
    if (query.to_date) {
      qb.andWhere(
        'COALESCE(commission.earned_at, commission.created_at)::date <= :toDate',
        {
          toDate: query.to_date,
        },
      );
    }

    const rows = await qb
      .select('commission.insurer_company_id', 'insurer_company_id')
      .addSelect('insurer.name', 'insurer_name')
      .addSelect(branchId, 'branch_id')
      .addSelect(branchName, 'branch_name')
      .addSelect(salePointId, 'sale_point_id')
      .addSelect(salePointCode, 'sale_point_code')
      .addSelect(salePointName, 'sale_point_name')
      .addSelect('commission.status', 'status')
      .addSelect('COUNT(commission.id)::int', 'transaction_count')
      .addSelect(
        'COALESCE(SUM(commission.commission_amount), 0)',
        'commission_amount',
      )
      .addSelect('COALESCE(SUM(commission.paid_amount), 0)', 'paid_amount')
      .addSelect(
        'COALESCE(SUM(commission.balance_amount), 0)',
        'balance_amount',
      )
      .groupBy('commission.insurer_company_id')
      .addGroupBy('insurer.name')
      .addGroupBy(branchId)
      .addGroupBy(branchName)
      .addGroupBy(salePointId)
      .addGroupBy(salePointCode)
      .addGroupBy(salePointName)
      .addGroupBy('commission.status')
      .orderBy('insurer.name', 'ASC')
      .addOrderBy(branchName, 'ASC')
      .addOrderBy(salePointName, 'ASC')
      .getRawMany();

    return {
      from_date: query.from_date ?? null,
      to_date: query.to_date ?? null,
      groups: rows.map((row) => ({
        ...row,
        branch_id: row.branch_id ?? null,
        branch_name: row.branch_name ?? 'Unattributed branch',
        sale_point_id: row.sale_point_id ?? null,
        sale_point_code: row.sale_point_code ?? null,
        sale_point_name: row.sale_point_name ?? 'Unattributed sales point',
      })),
      totals: rows.reduce(
        (totals, row) => ({
          transaction_count:
            totals.transaction_count + Number(row.transaction_count ?? 0),
          commission_amount:
            totals.commission_amount + Number(row.commission_amount ?? 0),
          paid_amount: totals.paid_amount + Number(row.paid_amount ?? 0),
          balance_amount:
            totals.balance_amount + Number(row.balance_amount ?? 0),
        }),
        {
          transaction_count: 0,
          commission_amount: 0,
          paid_amount: 0,
          balance_amount: 0,
        },
      ),
    };
  }

  async compareQuotations(account: PortalAccount, quotationIds: string[]) {
    this.assertIntermediaryAccount(account);
    const ids = Array.from(new Set(quotationIds));
    if (ids.length < 2 || ids.length > 10) {
      throw new BadRequestException(
        'Choose between 2 and 10 quotations to compare',
      );
    }
    const items = await this.quotationRepository
      .createQueryBuilder('quotation')
      .leftJoinAndSelect('quotation.product', 'product')
      .leftJoinAndSelect('quotation.category', 'category')
      .leftJoinAndSelect('quotation.insurer_company', 'insurer')
      .leftJoinAndSelect('quotation.cover_note', 'cover_note')
      .where('quotation.id IN (:...ids)', { ids })
      .andWhere('quotation.deleted_at IS NULL')
      .andWhere('quotation.intermediary_company_id = :intermediaryId', {
        intermediaryId: account.intermediary_company_id,
      })
      .andWhere(
        `EXISTS (
        SELECT 1 FROM insurance_company_partners rel
        WHERE rel.insurer_company_id = quotation.insurer_company_id
          AND rel.intermediary_company_id = :intermediaryId
          AND rel.status = 'ACTIVE'
          AND (rel.start_date IS NULL OR rel.start_date <= CURRENT_DATE)
          AND (rel.end_date IS NULL OR rel.end_date >= CURRENT_DATE)
          AND (rel.scope_mode = 'LEGACY' OR EXISTS (
            SELECT 1 FROM insurance_company_partner_product_scopes ps
            WHERE ps.relationship_id = rel.id AND ps.product_id = quotation.product_id
              AND ps.is_active AND ps.allowed_operations @> ARRAY['VIEW_QUOTATION']::varchar[]
              AND (ps.branch_ids IS NULL OR quotation.branch_id = ANY(ps.branch_ids))
          ))
      )`,
      )
      .getMany();

    if (items.length !== ids.length) {
      throw new NotFoundException('One or more quotations are unavailable');
    }
    const customerIds = new Set(items.map((item) => item.customer_id));
    if (customerIds.size !== 1) {
      throw new BadRequestException('Compare quotations for the same customer');
    }

    return items.map((item) => ({
      id: item.id,
      quotation_no: item.quotation_no,
      insurer_company_id: item.insurer_company_id,
      insurer_name: item.insurer_company?.name ?? null,
      product_id: item.product_id,
      product_name: item.product?.product_name,
      category_name: item.category?.name,
      status: item.status,
      currency: item.cover_note?.currency_code ?? null,
      premium_excluding_tax:
        item.cover_note?.total_premium_excluding_tax ?? null,
      premium_including_tax:
        item.cover_note?.total_premium_including_tax ?? null,
      cover_note_start_date: item.cover_note?.cover_note_start_date ?? null,
      cover_note_end_date: item.cover_note?.cover_note_end_date ?? null,
      product_definition_snapshot: item.product_definition_snapshot,
      finalization_snapshot: item.finalization_snapshot,
      created_at: item.created_at,
    }));
  }

  async assertPolicyOperation(
    account: PortalAccount,
    policy: Policy,
    operation: PartnerOperation,
  ) {
    await this.assertIntermediaryOperation(
      account,
      policy.insurer_company_id,
      policy.product_id,
      operation,
      policy.branch_id,
    );
  }

  async assertInvoice(
    account: PortalAccount,
    invoiceId: string,
  ): Promise<Invoice> {
    const qb = this.invoiceRepository
      .createQueryBuilder('invoice')
      .where('invoice.id = :invoiceId', { invoiceId })
      .andWhere('invoice.deleted_at IS NULL');

    this.applyInvoiceScope(qb, account);

    const invoice = await qb.getOne();

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  // =========================================================
  // QUERY SCOPING
  //
  // Customer scope is always company_id + customer_id (the linked
  // customer UUID) - never email/phone/name/guessed document number.
  // Intermediary scope is always intermediary_company_id alone (not
  // OR'd with company_id, since intermediary-owned records are never
  // stored under the insurer's own company_id in this data model).
  // =========================================================

  private applyQuotationScope(
    qb: SelectQueryBuilder<Quotation>,
    account: PortalAccount,
  ) {
    if (account.actor_type === PortalActorType.CUSTOMER) {
      this.assertCustomerAccount(account);

      qb.andWhere(
        `
        EXISTS (
          SELECT 1
          FROM portal_accounts scoped_account
          WHERE scoped_account.user_id = :portalUserId
            AND scoped_account.actor_type = :portalCustomerActorType
            AND scoped_account.status = 'ACTIVE'
            AND scoped_account.deleted_at IS NULL
            AND scoped_account.company_id = quotation.company_id
            AND scoped_account.customer_id = quotation.customer_id
        )
        `,
        {
          portalUserId: account.user_id,
          portalCustomerActorType: PortalActorType.CUSTOMER,
        },
      );

      return;
    }

    this.assertIntermediaryAccount(account);

    qb.andWhere(
      'quotation.intermediary_company_id = :portalIntermediaryCompanyId',
      { portalIntermediaryCompanyId: account.intermediary_company_id },
    );
    qb.andWhere(
      `EXISTS (
        SELECT 1
        FROM insurance_company_partners scope_relationship
        WHERE scope_relationship.insurer_company_id = quotation.insurer_company_id
          AND scope_relationship.intermediary_company_id = :portalIntermediaryCompanyId
          AND scope_relationship.status IN ('ACTIVE', 'SUSPENDED')
          AND (scope_relationship.start_date IS NULL OR scope_relationship.start_date <= CURRENT_DATE)
          AND (scope_relationship.end_date IS NULL OR scope_relationship.end_date >= CURRENT_DATE)
          AND (
            scope_relationship.scope_mode = 'LEGACY'
            OR EXISTS (
              SELECT 1
              FROM insurance_company_partner_product_scopes product_scope
              WHERE product_scope.relationship_id = scope_relationship.id
                AND product_scope.product_id = quotation.product_id
                AND product_scope.is_active = true
                AND product_scope.allowed_operations @> ARRAY['VIEW_QUOTATION']::varchar[]
                AND (product_scope.branch_ids IS NULL OR quotation.branch_id = ANY(product_scope.branch_ids))
            )
          )
      )`,
      { portalIntermediaryCompanyId: account.intermediary_company_id },
    );
  }

  private applyPolicyScope(
    qb: SelectQueryBuilder<Policy>,
    account: PortalAccount,
  ) {
    if (account.actor_type === PortalActorType.CUSTOMER) {
      this.assertCustomerAccount(account);

      qb.andWhere(
        `
        EXISTS (
          SELECT 1
          FROM portal_accounts scoped_account
          WHERE scoped_account.user_id = :portalUserId
            AND scoped_account.actor_type = :portalCustomerActorType
            AND scoped_account.status = 'ACTIVE'
            AND scoped_account.deleted_at IS NULL
            AND scoped_account.company_id = policy.company_id
            AND scoped_account.customer_id = policy.customer_id
        )
        `,
        {
          portalUserId: account.user_id,
          portalCustomerActorType: PortalActorType.CUSTOMER,
        },
      );

      return;
    }

    this.assertIntermediaryAccount(account);

    qb.andWhere(
      'policy.intermediary_company_id = :portalIntermediaryCompanyId',
      { portalIntermediaryCompanyId: account.intermediary_company_id },
    );
    qb.andWhere(
      `EXISTS (
        SELECT 1
        FROM insurance_company_partners scope_relationship
        WHERE scope_relationship.insurer_company_id = policy.insurer_company_id
          AND scope_relationship.intermediary_company_id = :portalIntermediaryCompanyId
          AND scope_relationship.status IN ('ACTIVE', 'SUSPENDED')
          AND (scope_relationship.start_date IS NULL OR scope_relationship.start_date <= CURRENT_DATE)
          AND (scope_relationship.end_date IS NULL OR scope_relationship.end_date >= CURRENT_DATE)
          AND (
            scope_relationship.scope_mode = 'LEGACY'
            OR EXISTS (
              SELECT 1
              FROM insurance_company_partner_product_scopes product_scope
              WHERE product_scope.relationship_id = scope_relationship.id
                AND product_scope.product_id = policy.product_id
                AND product_scope.is_active = true
                AND product_scope.allowed_operations @> ARRAY['VIEW_POLICY']::varchar[]
                AND (product_scope.branch_ids IS NULL OR policy.branch_id = ANY(product_scope.branch_ids))
            )
          )
      )`,
      { portalIntermediaryCompanyId: account.intermediary_company_id },
    );
  }

  private applyInvoiceScope(
    qb: SelectQueryBuilder<Invoice>,
    account: PortalAccount,
  ) {
    if (account.actor_type === PortalActorType.CUSTOMER) {
      this.assertCustomerAccount(account);

      qb.andWhere(
        `
        EXISTS (
          SELECT 1
          FROM portal_accounts scoped_account
          WHERE scoped_account.user_id = :portalUserId
            AND scoped_account.actor_type = :portalCustomerActorType
            AND scoped_account.status = 'ACTIVE'
            AND scoped_account.deleted_at IS NULL
            AND scoped_account.company_id = invoice.company_id
            AND scoped_account.customer_id = invoice.customer_id
        )
        `,
        {
          portalUserId: account.user_id,
          portalCustomerActorType: PortalActorType.CUSTOMER,
        },
      );

      return;
    }

    this.assertIntermediaryAccount(account);

    qb.andWhere(
      'invoice.intermediary_company_id = :portalIntermediaryCompanyId',
      { portalIntermediaryCompanyId: account.intermediary_company_id },
    );
    this.applyIntermediaryProductScope(
      qb,
      account.intermediary_company_id,
      'COALESCE(policy.insurer_company_id, quotation.insurer_company_id)',
      'COALESCE(policy.product_id, quotation.product_id)',
      PartnerOperation.VIEW_PAYMENT,
      'COALESCE(policy.branch_id, quotation.branch_id)',
    );
  }

  private applyReceiptScope(
    qb: SelectQueryBuilder<Receipt>,
    account: PortalAccount,
  ) {
    if (account.actor_type === PortalActorType.CUSTOMER) {
      this.assertCustomerAccount(account);

      qb.andWhere(
        `
        EXISTS (
          SELECT 1
          FROM portal_accounts scoped_account
          WHERE scoped_account.user_id = :portalUserId
            AND scoped_account.actor_type = :portalCustomerActorType
            AND scoped_account.status = 'ACTIVE'
            AND scoped_account.deleted_at IS NULL
            AND scoped_account.company_id = receipt.company_id
            AND scoped_account.customer_id = receipt.customer_id
        )
        `,
        {
          portalUserId: account.user_id,
          portalCustomerActorType: PortalActorType.CUSTOMER,
        },
      );

      return;
    }

    this.assertIntermediaryAccount(account);

    // Receipt has no intermediary_company_id column - it may belong
    // operationally to the insurer, so scope through the related invoice.
    qb.andWhere(
      'invoice.intermediary_company_id = :portalIntermediaryCompanyId',
      { portalIntermediaryCompanyId: account.intermediary_company_id },
    );
    this.applyIntermediaryProductScope(
      qb,
      account.intermediary_company_id,
      'COALESCE(policy.insurer_company_id, quotation.insurer_company_id)',
      'COALESCE(policy.product_id, quotation.product_id)',
      PartnerOperation.VIEW_PAYMENT,
      'COALESCE(policy.branch_id, quotation.branch_id)',
    );
  }

  private applyClaimScope(
    qb: SelectQueryBuilder<InsuranceClaim>,
    account: PortalAccount,
  ) {
    if (account.actor_type === PortalActorType.CUSTOMER) {
      this.assertCustomerAccount(account);

      qb.andWhere(
        `
        EXISTS (
          SELECT 1
          FROM portal_accounts scoped_account
          WHERE scoped_account.user_id = :portalUserId
            AND scoped_account.actor_type = :portalCustomerActorType
            AND scoped_account.status = 'ACTIVE'
            AND scoped_account.deleted_at IS NULL
            AND scoped_account.company_id = claim.company_id
            AND scoped_account.customer_id = claim.customer_id
        )
        `,
        {
          portalUserId: account.user_id,
          portalCustomerActorType: PortalActorType.CUSTOMER,
        },
      );

      return;
    }

    this.assertIntermediaryAccount(account);

    qb.andWhere(
      'claim.intermediary_company_id = :portalIntermediaryCompanyId',
      { portalIntermediaryCompanyId: account.intermediary_company_id },
    );
    this.applyIntermediaryProductScope(
      qb,
      account.intermediary_company_id,
      'claim.insurer_company_id',
      'policy.product_id',
      PartnerOperation.VIEW_CLAIM,
      'policy.branch_id',
    );
  }

  private applyComplaintScope(
    qb: SelectQueryBuilder<Complaint>,
    account: PortalAccount,
  ) {
    if (account.actor_type === PortalActorType.CUSTOMER) {
      this.assertCustomerAccount(account);

      qb.andWhere(
        `
        EXISTS (
          SELECT 1
          FROM portal_accounts scoped_account
          WHERE scoped_account.user_id = :portalUserId
            AND scoped_account.actor_type = :portalCustomerActorType
            AND scoped_account.status = 'ACTIVE'
            AND scoped_account.deleted_at IS NULL
            AND scoped_account.company_id = complaint.company_id
            AND scoped_account.customer_id = complaint.customer_id
        )
        `,
        {
          portalUserId: account.user_id,
          portalCustomerActorType: PortalActorType.CUSTOMER,
        },
      );

      return;
    }

    this.assertIntermediaryAccount(account);

    qb.andWhere(
      `
      EXISTS (
        SELECT 1
        FROM policies scoped_policy
        WHERE scoped_policy.id = complaint.policy_id
          AND scoped_policy.intermediary_company_id = :portalIntermediaryCompanyId
          AND scoped_policy.deleted_at IS NULL
      )
      `,
      { portalIntermediaryCompanyId: account.intermediary_company_id },
    );
    this.applyIntermediaryProductScope(
      qb,
      account.intermediary_company_id,
      'policy.insurer_company_id',
      'policy.product_id',
      PartnerOperation.VIEW_CLAIM,
      'policy.branch_id',
    );
  }

  async findAuthorizedInsurers(account: PortalAccount) {
    this.assertIntermediaryAccount(account);
    return this.insurancePartnersService.findAuthorizedInsurers(
      account.intermediary_company_id,
    );
  }

  async findAuthorizedProductRisks(
    account: PortalAccount,
    insurerCompanyId: string,
    productId: string,
    branchId?: string,
  ) {
    this.assertIntermediaryAccount(account);
    await this.assertIntermediaryOperation(
      account,
      insurerCompanyId,
      productId,
      PartnerOperation.QUOTE,
      branchId,
    );
    return this.riskRepository.find({
      where: {
        company_id: insurerCompanyId,
        product_id: productId,
        is_active: true,
        lifecycle_status: 'ACTIVE',
      },
      order: { risk_name: 'ASC' },
    });
  }

  private applyIntermediaryProductScope(
    qb: SelectQueryBuilder<any>,
    intermediaryCompanyId: string,
    insurerCompanySql: string,
    productIdSql: string,
    operation: PartnerOperation,
    branchIdSql?: string,
    branchId?: string | null,
  ) {
    qb.andWhere(
      `EXISTS (
        SELECT 1
        FROM insurance_company_partners scope_relationship
        WHERE scope_relationship.insurer_company_id = ${insurerCompanySql}
          AND scope_relationship.intermediary_company_id = :partnerScopeCompanyId
          AND scope_relationship.status IN ('ACTIVE', 'SUSPENDED')
          AND (scope_relationship.start_date IS NULL OR scope_relationship.start_date <= CURRENT_DATE)
          AND (scope_relationship.end_date IS NULL OR scope_relationship.end_date >= CURRENT_DATE)
          AND (
            scope_relationship.scope_mode = 'LEGACY'
            OR EXISTS (
              SELECT 1
              FROM insurance_company_partner_product_scopes product_scope
              WHERE product_scope.relationship_id = scope_relationship.id
                AND product_scope.product_id = ${productIdSql}
                AND product_scope.is_active = true
                AND product_scope.allowed_operations @> ARRAY['${operation}']::varchar[]
                ${branchIdSql ? `AND (product_scope.branch_ids IS NULL OR ${branchIdSql} = ANY(product_scope.branch_ids))` : ''}
            )
          )
      )`,
      { partnerScopeCompanyId: intermediaryCompanyId },
    );
  }

  // =========================================================
  // QUOTATION WRITE SCOPING
  // =========================================================

  private async scopeDraft<
    T extends SaveQuotationDraftDto | UpdateQuotationDraftDto,
  >(account: PortalAccount, dto: T, existingQuotation?: Quotation): Promise<T> {
    if (account.actor_type === PortalActorType.CUSTOMER) {
      this.assertCustomerAccount(account);

      return {
        ...dto,
        insurer_company_id: account.company_id,
        intermediary_company_id: null,
        customer_id: account.customer_id,
        channel_type: ProductChannelType.DIRECT,
      };
    }

    this.assertIntermediaryAccount(account);

    const insurerCompanyId =
      existingQuotation?.insurer_company_id ?? dto.insurer_company_id;

    if (!insurerCompanyId) {
      throw new BadRequestException('Insurer company is required');
    }

    await this.assertActiveInsurer(insurerCompanyId);

    const customerId = existingQuotation?.customer_id ?? dto.customer_id;

    if (!customerId) {
      throw new BadRequestException('Customer is required');
    }

    await this.assertPortfolioCustomer(account, customerId);

    const draftPayload = { ...(dto.draft_payload ?? {}) };
    if (
      this.intermediaryChannel(account) === ProductChannelType.BANCASSURANCE
    ) {
      const attribution =
        this.asRecord(draftPayload['distribution_attribution']) ?? {};
      const branchId =
        typeof attribution['branch_id'] === 'string'
          ? attribution['branch_id']
          : null;
      const salePointId =
        typeof attribution['sale_point_id'] === 'string'
          ? attribution['sale_point_id']
          : null;
      const branch = branchId
        ? await this.branchRepository.findOne({
            where: {
              id: branchId,
              company_id: account.intermediary_company_id,
              status: 'active',
            },
          })
        : null;
      if (branchId && !branch)
        throw new BadRequestException(
          'Distribution branch must be active and owned by the bank',
        );
      const salePoint = salePointId
        ? await this.salePointRepository.findOne({
            where: {
              id: salePointId,
              companyId: account.intermediary_company_id,
              isActive: true,
            },
          })
        : null;
      if (
        salePointId &&
        (!salePoint ||
          (branchId && salePoint.branchId && salePoint.branchId !== branchId))
      ) {
        throw new BadRequestException(
          'Sales point must be active, owned by the bank, and linked to the selected branch',
        );
      }
      if (branch || salePoint) {
        draftPayload['distribution_attribution'] = {
          branch_id: branch?.id ?? null,
          branch_name: branch?.name ?? null,
          branch_code: branch?.code ?? null,
          sale_point_id: salePoint?.id ?? null,
          sale_point_code: salePoint?.salePointCode ?? null,
          sale_point_name: salePoint?.salePointName ?? null,
        };
      }
    } else {
      delete draftPayload['distribution_attribution'];
    }

    return {
      ...dto,
      insurer_company_id: insurerCompanyId,
      intermediary_company_id: account.intermediary_company_id,
      customer_id: customerId,
      channel_type: this.intermediaryChannel(account),
      draft_payload: draftPayload,
    };
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private async scopeFinalPayload(
    account: PortalAccount,
    quotation: Quotation,
    payload: UpdateQuotationDto,
  ): Promise<UpdateQuotationDto> {
    const internalDraft = await this.scopeDraft(
      account,
      {
        ...payload.internal_quotation,
        // These temporary values are required by the quotation draft DTO
        // type but are not persisted through this helper.
        current_wizard_step: null,
        draft_payload: {},
      },
      quotation,
    );

    if (account.actor_type === PortalActorType.CUSTOMER) {
      this.assertCustomerAccount(account);

      const customer = await this.customerRepository.findOne({
        where: { id: account.customer_id, company_id: account.company_id },
      });

      if (!customer) {
        throw new NotFoundException('Linked customer was not found');
      }

      const policyholder = payload.cover_note_dtl.policy_holders?.[0];

      if (!policyholder) {
        throw new BadRequestException('Policyholder information is required');
      }

      const isCommercialPolicyholder = policyholder.policy_holder_type === 2;
      const expectedId = customer.id_number?.trim();
      const suppliedId = policyholder.policy_holder_id_number?.trim();

      if (
        !isCommercialPolicyholder &&
        expectedId &&
        suppliedId !== expectedId
      ) {
        throw new ForbiddenException(
          'Policyholder identification must match the linked customer',
        );
      }

      const expectedPhone = this.normalizePhone(customer.phone);
      const suppliedPhone = this.normalizePhone(
        policyholder.policy_holder_phone_number,
      );

      if (
        !isCommercialPolicyholder &&
        (!expectedPhone || expectedPhone !== suppliedPhone)
      ) {
        throw new ForbiddenException(
          'Policyholder phone must match the linked customer',
        );
      }
    }

    // Ownership fields come from the scoped quotation and portal account,
    // not from the browser request. Note: the quotation's customer_id is
    // set once at draft creation and isn't part of this payload at all -
    // InternalQuotationDto has no customer_id field to overwrite.
    return {
      ...payload,
      internal_quotation: {
        ...payload.internal_quotation,
        insurer_company_id: internalDraft.insurer_company_id,
        intermediary_company_id: internalDraft.intermediary_company_id ?? null,
        channel_type: internalDraft.channel_type,
      },
    };
  }

  private async assertIntermediaryOperation(
    account: PortalAccount,
    insurerCompanyId: string | null | undefined,
    productId: string,
    operation: PartnerOperation,
    branchId?: string | null,
  ) {
    if (account.actor_type !== PortalActorType.INTERMEDIARY) return;
    this.assertIntermediaryAccount(account);
    if (!insurerCompanyId) {
      throw new BadRequestException('Insurer company is required');
    }
    await this.insurancePartnersService.authorizeOperation(
      insurerCompanyId,
      account.intermediary_company_id,
      productId,
      operation,
      branchId,
    );
  }
  private assertQuotationEditable(quotation: Quotation) {
    const editableStatuses = new Set(['DRAFT', 'INCOMPLETE', 'RETURNED']);

    if (!editableStatuses.has(String(quotation.status).toUpperCase())) {
      throw new BadRequestException(
        'Only a draft or returned quotation can be changed through the portal',
      );
    }
  }

  // =========================================================
  // ACTOR AND COMPANY VALIDATION
  // =========================================================

  private assertCustomerAccount(
    account: PortalAccount,
  ): asserts account is PortalAccount & { customer_id: string } {
    if (
      account.actor_type !== PortalActorType.CUSTOMER ||
      !account.customer_id
    ) {
      throw new ForbiddenException('Customer portal access is required');
    }
  }

  private assertIntermediaryAccount(
    account: PortalAccount,
  ): asserts account is PortalAccount & { intermediary_company_id: string } {
    if (
      account.actor_type !== PortalActorType.INTERMEDIARY ||
      !account.intermediary_company_id
    ) {
      throw new ForbiddenException('Intermediary portal access is required');
    }
  }

  private async assertActiveInsurer(insurerCompanyId: string) {
    const insurer = await this.companyRepository.findOne({
      where: {
        id: insurerCompanyId,
        company_type: CompanyType.INSURANCE_COMPANY,
        status: 'active',
      },
    });

    if (!insurer) {
      throw new BadRequestException('Active insurer company was not found');
    }

    return insurer;
  }

  private assertSupportedIntermediaryCompany(company: Company) {
    const supportedTypes = new Set<CompanyType>([
      CompanyType.BROKER,
      CompanyType.AGENCY,
      CompanyType.BANCASSURANCE,
    ]);

    if (!supportedTypes.has(company.company_type)) {
      throw new ForbiddenException('Company is not a supported intermediary');
    }
  }

  private intermediaryChannel(account: PortalAccount): ProductChannelType {
    this.assertIntermediaryAccount(account);

    const company = account.intermediary_company;

    if (!company) {
      throw new ForbiddenException('Intermediary company context is missing');
    }

    switch (company.company_type) {
      case CompanyType.BROKER:
        return ProductChannelType.BROKER;
      case CompanyType.AGENCY:
        return ProductChannelType.AGENCY;
      case CompanyType.BANCASSURANCE:
        return ProductChannelType.BANCASSURANCE;
      default:
        throw new ForbiddenException('Unsupported intermediary company type');
    }
  }

  // =========================================================
  // RESPONSE MAPPERS
  //
  // Only fields required by the customer/intermediary interface are
  // returned here - never approval comments, underwriting notes, fraud
  // flags, risk scoring, TIRAMIS private payloads/signatures, internal
  // assignments, audit metadata, or deleted timestamps.
  // =========================================================

  private mapQuotationSummary(quotation: Quotation) {
    return {
      id: quotation.id,
      quotation_no: quotation.quotation_no,
      quotation_type: quotation.quotation_type,
      quotation_flow: quotation.quotation_flow,
      status: quotation.status,
      approval_status: quotation.approval_status,
      payment_status: quotation.payment_status,
      tira_status: quotation.tira_status,
      product: quotation.product
        ? { id: quotation.product.id, name: quotation.product.product_name }
        : null,
      customer: quotation.customer
        ? {
            id: quotation.customer.id,
            customer_no: quotation.customer.customer_no,
            name: this.customerName(quotation.customer),
          }
        : null,
      created_at: quotation.created_at,
      updated_at: quotation.updated_at,
    };
  }

  private mapPolicySummary(policy: Policy) {
    return {
      id: policy.id,
      policy_no: policy.policy_no,
      cover_note_no: policy.cover_note_no,
      policy_status: policy.policy_status,
      start_date: policy.start_date,
      end_date: policy.end_date,
      issue_date: policy.issue_date,
      currency: policy.currency,
      sum_insured: policy.sum_insured,
      basic_premium: policy.basic_premium,
      total_premium: policy.total_premium,
      net_premium: policy.net_premium,
      product: policy.product
        ? { id: policy.product.id, name: policy.product.product_name }
        : null,
      customer: policy.customer
        ? {
            id: policy.customer.id,
            customer_no: policy.customer.customer_no,
            name: this.customerName(policy.customer),
          }
        : null,
      created_at: policy.created_at,
      updated_at: policy.updated_at,
    };
  }

  private mapInvoiceSummary(invoice: Invoice) {
    return {
      id: invoice.id,
      invoice_no: invoice.invoice_no,
      invoice_type: invoice.invoice_type,
      currency: invoice.currency,
      gross_amount: invoice.gross_amount,
      tax_amount: invoice.tax_amount,
      discount_amount: invoice.discount_amount,
      total_amount: invoice.total_amount,
      paid_amount: invoice.paid_amount,
      balance_amount: invoice.balance_amount,
      status: invoice.status,
      due_date: invoice.due_date,
      policy: invoice.policy
        ? { id: invoice.policy.id, policy_no: invoice.policy.policy_no }
        : null,
      quotation: invoice.quotation
        ? {
            id: invoice.quotation.id,
            quotation_no: invoice.quotation.quotation_no,
          }
        : null,
      created_at: invoice.created_at,
      updated_at: invoice.updated_at,
    };
  }

  private mapClaimSummary(claim: InsuranceClaim) {
    return {
      id: claim.id,
      claim_no: claim.claim_no,
      claim_notification_number: claim.claim_notification_number,
      claim_reference_number: claim.claim_reference_number,
      policy_id: claim.policy_id,
      policy_no: claim.policy?.policy_no ?? null,
      customer_id: claim.customer_id,
      customer_no: claim.customer?.customer_no ?? null,
      customer_name: claim.customer ? this.customerName(claim.customer) : null,
      loss_date: claim.loss_date,
      claim_report_date: claim.claim_report_date,
      loss_type: claim.loss_type,
      loss_location: claim.loss_location,
      description: claim.description,
      currency: claim.currency_code,
      estimated_amount: claim.estimated_amount,
      approved_amount: claim.approved_amount,
      paid_amount: claim.paid_amount,
      outstanding_reserve: claim.outstanding_reserve,
      status: claim.status,
      priority: claim.priority,
      claim_stage: claim.claim_stage,
      coverage_status: claim.coverage_status,
      settlement_status: claim.settlement_status,
      created_at: claim.created_at,
      updated_at: claim.updated_at,
    };
  }

  private mapComplaintSummary(
    complaint: Complaint,
    references?: { policy_no: string | null; customer_no: string | null },
  ) {
    return {
      id: complaint.id,
      complaint_no: complaint.complaint_no,
      category: complaint.category,
      subject: complaint.subject,
      description: complaint.description,
      policy_id: complaint.policy_id,
      policy_no: references?.policy_no ?? null,
      claim_id: complaint.claim_id,
      customer_id: complaint.customer_id,
      customer_no: references?.customer_no ?? null,
      priority: complaint.priority,
      status: complaint.status,
      reported_channel: complaint.reported_channel,
      acknowledged_at: complaint.acknowledged_at,
      resolution: complaint.resolution,
      resolved_at: complaint.resolved_at,
      closed_at: complaint.closed_at,
      acknowledgement_due_at: complaint.acknowledgement_due_at,
      resolution_due_at: complaint.resolution_due_at,
      customer_acceptance_status: complaint.customer_acceptance_status,
      created_at: complaint.created_at,
      updated_at: complaint.updated_at,
    };
  }

  // =========================================================
  // COMMON HELPERS
  // =========================================================

  private customerName(customer: Customer): string {
    if (String(customer.customer_type).toUpperCase() === 'CORPORATE') {
      return customer.company_name ?? customer.customer_no;
    }

    return [customer.first_name, customer.middle_name, customer.last_name]
      .filter(Boolean)
      .join(' ');
  }

  private normalizePhone(value: string | null | undefined): string {
    return String(value ?? '')
      .replace(/[^\d+]/g, '')
      .trim();
  }

  private pagination(query: PortalListQueryDto): PortalPagination {
    return {
      page: Math.max(1, Number(query.page ?? 1)),
      limit: Math.min(100, Math.max(1, Number(query.limit ?? 10))),
    };
  }

  private paginationMeta(page: number, limit: number, total: number) {
    return {
      page,
      limit,
      total,
      total_pages: total > 0 ? Math.ceil(total / limit) : 0,
    };
  }
}
