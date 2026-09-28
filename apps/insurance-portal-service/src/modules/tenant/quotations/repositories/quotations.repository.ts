import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { SortDirection } from '@insurance-max/portal-shared/dto/pagination.dto';
import { DataAccessScopeService } from '../../../shared/authorization/data-access-scope.service';
import type { TenantDataScope } from '../../../shared/authorization/interfaces/tenant-data-scope.interface';
import { FilterQuotationDto } from '../dto/filter-quotation.dto';
import { Quotation } from '../entities/quotation.entity';
import { QuotationMotorDetail } from '../entities/structured/quotation-motor-detail.entity';
import { QuotationPolicyHolder } from '../entities/structured/quotation-policy-holder.entity';
import type { QuotationListItemExtra } from '../mappers/quotation-payload.mapper';

export interface QuotationPaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_previous_page: boolean;
  has_next_page: boolean;
}

export interface PaginatedQuotations {
  items: Quotation[];
  meta: QuotationPaginationMeta;
  extrasByQuotationId: Map<string, QuotationListItemExtra>;
}

export interface QuotationAccessSnapshot {
  id: string;
  company_id: string;
  branch_id: string | null;
  created_by: string | null;
  status: string;
  tira_status: string;
}

@Injectable()
export class QuotationsRepository {
  constructor(
    @InjectRepository(Quotation)
    private readonly quotationRepository: Repository<Quotation>,
    private readonly dataAccessScopeService: DataAccessScopeService,
  ) {}

  async assertReadable(scope: TenantDataScope, id: string): Promise<void> {
    const queryBuilder = this.quotationRepository
      .createQueryBuilder('quotation')
      .select('quotation.id')
      .where('quotation.id = :id', { id })
      .andWhere('quotation.deleted_at IS NULL');

    this.dataAccessScopeService.applyQuotationReadScope(
      queryBuilder,
      'quotation',
      scope,
    );

    const quotation = await queryBuilder.getOne();

    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }
  }

  async assertWritable(scope: TenantDataScope, id: string): Promise<void> {
    const queryBuilder = this.quotationRepository
      .createQueryBuilder('quotation')
      .select('quotation.id')
      .where('quotation.id = :id', { id })
      .andWhere('quotation.deleted_at IS NULL');

    this.dataAccessScopeService.applyOwnedRecordWriteScope(
      queryBuilder,
      'quotation',
      scope,
    );

    const quotation = await queryBuilder.getOne();

    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }
  }

  async findAccessSnapshotForScope(
    scope: TenantDataScope,
    id: string,
  ): Promise<QuotationAccessSnapshot> {
    const queryBuilder = this.quotationRepository
      .createQueryBuilder('quotation')
      .select([
        'quotation.id',
        'quotation.company_id',
        'quotation.branch_id',
        'quotation.created_by',
        'quotation.status',
        'quotation.tira_status',
      ])
      .where('quotation.id = :id', { id })
      .andWhere('quotation.deleted_at IS NULL');

    this.dataAccessScopeService.applyQuotationReadScope(
      queryBuilder,
      'quotation',
      scope,
    );

    const quotation = await queryBuilder.getOne();

    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }

    return {
      id: quotation.id,
      company_id: quotation.company_id,
      branch_id: quotation.branch_id,
      created_by: quotation.created_by,
      status: quotation.status,
      tira_status: quotation.tira_status,
    };
  }

  /**
   * Load the complete quotation aggregate.
   */
  async findOneAggregate(companyId: string, id: string): Promise<Quotation> {
    const quotation = await this.buildAggregateQuery()
      .where('quotation.id = :id', { id })
      .andWhere('quotation.company_id = :companyId', { companyId })
      .andWhere('quotation.deleted_at IS NULL')
      .getOne();

    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }

    if (!quotation.cover_note) {
      throw new NotFoundException(
        'Quotation cover-note information was not found',
      );
    }

    return quotation;
  }

  async findOneAggregateForScope(
    scope: TenantDataScope,
    id: string,
  ): Promise<Quotation> {
    const queryBuilder = this.buildAggregateQuery()
      .where('quotation.id = :id', { id })
      .andWhere('quotation.deleted_at IS NULL');

    this.dataAccessScopeService.applyQuotationReadScope(
      queryBuilder,
      'quotation',
      scope,
    );

    const quotation = await queryBuilder.getOne();

    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }

    if (!quotation.cover_note) {
      throw new NotFoundException(
        'Quotation cover-note information was not found',
      );
    }

    return quotation;
  }

  /**
   * Load only the root and cover-note header for the list screen.
   * Policy-transaction quotations are visible here so users can open and
   * reuse their pricing/cover data, but direct submission is still blocked
   * by `QuotationsService`.
   *
   */
  async findAll(
    companyId: string,
    query: FilterQuotationDto,
  ): Promise<PaginatedQuotations> {
    const page = this.normalizePage(query.page);
    const limit = this.normalizeLimit(query.limit);

    const queryBuilder = this.quotationRepository
      .createQueryBuilder('quotation')
      .leftJoinAndSelect('quotation.cover_note', 'coverNote')
      .leftJoinAndSelect('quotation.product', 'product')
      .where('quotation.company_id = :companyId', { companyId })
      .andWhere('quotation.deleted_at IS NULL');
    this.selectListColumns(queryBuilder);
    this.applyListFilters(queryBuilder, query, page, limit);

    const [items, total] = await queryBuilder.getManyAndCount();
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        total_pages: totalPages,
        has_previous_page: page > 1,
        has_next_page: page < totalPages,
      },
      extrasByQuotationId: await this.loadListExtras(
        items.map((item) => item.id),
      ),
    };
  }

  async findAllForScope(
    scope: TenantDataScope,
    query: FilterQuotationDto,
  ): Promise<PaginatedQuotations> {
    const page = this.normalizePage(query.page);
    const limit = this.normalizeLimit(query.limit);

    const queryBuilder = this.quotationRepository
      .createQueryBuilder('quotation')
      .leftJoinAndSelect('quotation.cover_note', 'coverNote')
      .leftJoinAndSelect('quotation.product', 'product')
      .where('quotation.deleted_at IS NULL');

    this.dataAccessScopeService.applyQuotationReadScope(
      queryBuilder,
      'quotation',
      scope,
    );
    this.selectListColumns(queryBuilder);
    this.applyListFilters(queryBuilder, query, page, limit);

    const [items, total] = await queryBuilder.getManyAndCount();
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        total_pages: totalPages,
        has_previous_page: page > 1,
        has_next_page: page < totalPages,
      },
      extrasByQuotationId: await this.loadListExtras(
        items.map((item) => item.id),
      ),
    };
  }

  /**
   * Customer name and vehicle identifiers each live on a to-many child table
   * (a quotation can have multiple policyholder/motor-detail rows in theory,
   * even though in practice there's exactly one for the whole quotation/
   * fleet). Fetching these via leftJoinAndSelect on the paginated list query
   * would multiply root rows against the SQL LIMIT/OFFSET, corrupting
   * pagination — so they're batch-loaded separately for just this page's
   * quotation ids and merged in afterwards.
   */
  private async loadListExtras(
    quotationIds: string[],
  ): Promise<Map<string, QuotationListItemExtra>> {
    const extras = new Map<string, QuotationListItemExtra>();
    if (quotationIds.length === 0) {
      return extras;
    }

    for (const id of quotationIds) {
      extras.set(id, {
        customerName: null,
        vehicleRegistrationNumber: null,
        vehicleChassisNumber: null,
      });
    }

    const [policyHolders, vehicleRows] = await Promise.all([
      this.quotationRepository.manager
        .getRepository(QuotationPolicyHolder)
        .createQueryBuilder('holder')
        .select([
          'holder.id',
          'holder.quotation_id',
          'holder.policy_holder_name',
          'holder.sequence_no',
        ])
        .where('holder.quotation_id IN (:...quotationIds)', { quotationIds })
        .orderBy('holder.sequence_no', 'ASC')
        .getMany(),
      this.quotationRepository.manager
        .createQueryBuilder()
        .select('coverNote.quotation_id', 'quotation_id')
        .addSelect('motor.registration_number', 'registration_number')
        .addSelect('motor.chassis_number', 'chassis_number')
        .from(QuotationMotorDetail, 'motor')
        .innerJoin('motor.entry', 'entry')
        .innerJoin('entry.cover_note', 'coverNote')
        .where('coverNote.quotation_id IN (:...quotationIds)', {
          quotationIds,
        })
        .orderBy('entry.entry_number', 'ASC')
        .getRawMany<{
          quotation_id: string;
          registration_number: string | null;
          chassis_number: string | null;
        }>(),
    ]);

    for (const holder of policyHolders) {
      const extra = extras.get(holder.quotation_id);
      if (extra && extra.customerName === null) {
        extra.customerName = holder.policy_holder_name;
      }
    }

    for (const row of vehicleRows) {
      const extra = extras.get(row.quotation_id);
      if (
        extra &&
        extra.vehicleRegistrationNumber === null &&
        extra.vehicleChassisNumber === null
      ) {
        extra.vehicleRegistrationNumber = row.registration_number || null;
        extra.vehicleChassisNumber = row.chassis_number || null;
      }
    }

    return extras;
  }

  private selectListColumns(queryBuilder: SelectQueryBuilder<Quotation>): void {
    queryBuilder.select([
      'quotation.id',
      'quotation.quotation_no',
      'quotation.quotation_type',
      'quotation.quotation_flow',
      'quotation.channel_type',
      'quotation.status',
      'quotation.approval_status',
      'quotation.payment_status',
      'quotation.tira_status',
      'quotation.requires_approval',
      'quotation.requires_payment',
      'quotation.is_fleet',
      'quotation.source_policy_transaction_id',
      'quotation.source_policy_id',
      'quotation.previous_quotation_id',
      'quotation.submitted_at',
      'quotation.created_at',
      'quotation.updated_at',
      'coverNote.id',
      'coverNote.fleet_id',
      'coverNote.currency_code',
      'coverNote.product_code',
      'coverNote.cover_note_start_date',
      'coverNote.cover_note_end_date',
      'coverNote.total_premium_excluding_tax',
      'coverNote.total_premium_including_tax',
      'product.id',
      'product.product_name',
    ]);
  }

  async exists(companyId: string, id: string): Promise<boolean> {
    return this.quotationRepository.exists({
      where: {
        id,
        company_id: companyId,
      },
    });
  }

  private buildAggregateQuery() {
    return this.quotationRepository
      .createQueryBuilder('quotation')
      .leftJoinAndSelect('quotation.company', 'company')
      .leftJoinAndSelect('quotation.insurer_company', 'insurerCompany')
      .leftJoinAndSelect(
        'quotation.intermediary_company',
        'intermediaryCompany',
      )
      .leftJoinAndSelect('quotation.branch', 'branch')
      .leftJoinAndSelect('quotation.department', 'department')
      .leftJoinAndSelect('quotation.creator', 'creator')
      .leftJoinAndSelect('quotation.updater', 'updater')
      .leftJoinAndSelect('quotation.submitter', 'submitter')
      .leftJoinAndSelect('quotation.customer', 'customer')
      .leftJoinAndSelect('quotation.category', 'category')
      .leftJoinAndSelect('quotation.product', 'product')
      .leftJoinAndSelect('quotation.sub_class', 'subClass')
      .leftJoinAndSelect('quotation.cover_note', 'coverNote')
      .leftJoinAndSelect('coverNote.entries', 'entry')
      .leftJoinAndSelect('entry.risks', 'risk')
      .leftJoinAndSelect('risk.insurance_risk', 'insuranceRisk')
      .leftJoinAndSelect('risk.discounts', 'riskDiscount')
      .leftJoinAndSelect('risk.premium_overrides', 'riskPremiumOverride')
      .leftJoinAndSelect(
        'riskPremiumOverride.requester',
        'riskPremiumOverrideRequester',
      )
      .leftJoinAndSelect(
        'riskPremiumOverride.approver',
        'riskPremiumOverrideApprover',
      )
      .leftJoinAndSelect('risk.taxes', 'riskTax')
      .leftJoinAndSelect('entry.subject_matters', 'subjectMatter')
      .leftJoinAndSelect('entry.addons', 'addon')
      .leftJoinAndSelect('addon.taxes', 'addonTax')
      .leftJoinAndSelect('entry.motor_detail', 'motorDetail')
      .leftJoinAndSelect('quotation.policy_holders', 'policyHolder')
      .leftJoinAndSelect('quotation.status_history', 'statusHistory')
      .leftJoinAndSelect('statusHistory.changer', 'statusChanger')
      .orderBy('entry.entry_number', 'ASC')
      .addOrderBy('risk.sequence_no', 'ASC')
      .addOrderBy('riskDiscount.sequence_no', 'ASC')
      .addOrderBy('riskPremiumOverride.sequence_no', 'ASC')
      .addOrderBy('riskTax.sequence_no', 'ASC')
      .addOrderBy('subjectMatter.sequence_no', 'ASC')
      .addOrderBy('addon.sequence_no', 'ASC')
      .addOrderBy('addonTax.sequence_no', 'ASC')
      .addOrderBy('policyHolder.sequence_no', 'ASC')
      .addOrderBy('statusHistory.created_at', 'ASC');
  }

  private applyListFilters(
    queryBuilder: SelectQueryBuilder<Quotation>,
    query: FilterQuotationDto,
    page: number,
    limit: number,
  ): void {
    if (query.status) {
      queryBuilder.andWhere('quotation.status = :status', {
        status: query.status,
      });
    }

    if (query.quotation_type) {
      queryBuilder.andWhere('quotation.quotation_type = :quotationType', {
        quotationType: query.quotation_type,
      });
    }

    if (query.quotation_flow) {
      queryBuilder.andWhere('quotation.quotation_flow = :quotationFlow', {
        quotationFlow: query.quotation_flow,
      });
    }

    if (query.product_id) {
      queryBuilder.andWhere('quotation.product_id = :productId', {
        productId: query.product_id,
      });
    }

    if (query.customer_id) {
      queryBuilder.andWhere(
        new Brackets((customerQuery) => {
          customerQuery.where('quotation.customer_id = :customerId', {
            customerId: query.customer_id,
          }).orWhere(`
              EXISTS (
                SELECT 1
                FROM quotation_policy_holders AS customer_holder
                WHERE
                  customer_holder.quotation_id = quotation.id
                  AND customer_holder.customer_id = :customerId
              )
            `);
        }),
      );
    }

    const search = query.search?.trim();

    if (search) {
      const searchValue = `%${search}%`;

      queryBuilder.andWhere(
        new Brackets((searchQuery) => {
          searchQuery
            .where('quotation.quotation_no ILIKE :search', {
              search: searchValue,
            })
            .orWhere('CAST(quotation.status AS text) ILIKE :search')
            .orWhere('CAST(quotation.approval_status AS text) ILIKE :search')
            .orWhere('CAST(quotation.payment_status AS text) ILIKE :search')
            .orWhere('CAST(quotation.tira_status AS text) ILIKE :search')
            .orWhere('CAST(quotation.quotation_type AS text) ILIKE :search')
            .orWhere('CAST(quotation.quotation_flow AS text) ILIKE :search')
            .orWhere('CAST(quotation.channel_type AS text) ILIKE :search')
            .orWhere('quotation.payment_request_reference ILIKE :search')
            .orWhere('quotation.tira_request_id ILIKE :search')
            .orWhere('quotation.tira_response_id ILIKE :search')
            .orWhere('quotation.tira_response_code ILIKE :search')
            .orWhere('quotation.tira_response_description ILIKE :search')
            .orWhere('product.product_name ILIKE :search')
            .orWhere('coverNote.fleet_id ILIKE :search')
            .orWhere('coverNote.product_code ILIKE :search')
            .orWhere('coverNote.currency_code ILIKE :search')
            .orWhere('coverNote.sale_point_code ILIKE :search')
            .orWhere('coverNote.officer_name ILIKE :search').orWhere(`
              EXISTS (
                SELECT 1
                FROM quotation_cover_note_entries AS entry_search
                WHERE
                  entry_search.cover_note_id = coverNote.id
                  AND (
                    entry_search.cover_note_number ILIKE :search
                    OR entry_search.prev_cover_note_reference_number ILIKE :search
                    OR entry_search.cover_note_desc ILIKE :search
                    OR entry_search.operative_clause ILIKE :search
                    OR entry_search.endorsement_reason ILIKE :search
                  )
              )
            `).orWhere(`
              EXISTS (
                SELECT 1
                FROM quotation_policy_holders AS holder_search
                WHERE
                  holder_search.quotation_id = quotation.id
                  AND (
                    holder_search.policy_holder_name ILIKE :search
                    OR holder_search.policy_holder_id_number ILIKE :search
                    OR holder_search.policy_holder_phone_number ILIKE :search
                    OR holder_search.email_address ILIKE :search
                    OR holder_search.region ILIKE :search
                    OR holder_search.district ILIKE :search
                    OR holder_search.street ILIKE :search
                    OR holder_search.postal_address ILIKE :search
                  )
              )
            `).orWhere(`
              EXISTS (
                SELECT 1
                FROM quotation_cover_note_entries AS motor_entry_search
                INNER JOIN quotation_motor_details AS motor_search
                  ON motor_search.entry_id = motor_entry_search.id
                WHERE
                  motor_entry_search.cover_note_id = coverNote.id
                  AND (
                    motor_search.registration_number ILIKE :search
                    OR motor_search.chassis_number ILIKE :search
                    OR motor_search.engine_number ILIKE :search
                    OR motor_search.owner_name ILIKE :search
                    OR motor_search.make ILIKE :search
                    OR motor_search.model ILIKE :search
                    OR motor_search.model_number ILIKE :search
                    OR motor_search.body_type ILIKE :search
                    OR motor_search.color ILIKE :search
                  )
              )
            `).orWhere(`
              EXISTS (
                SELECT 1
                FROM quotation_cover_note_entries AS subject_entry_search
                INNER JOIN quotation_subject_matters AS subject_search
                  ON subject_search.entry_id = subject_entry_search.id
                WHERE
                  subject_entry_search.cover_note_id = coverNote.id
                  AND (
                    subject_search.subject_matter_reference ILIKE :search
                    OR subject_search.subject_matter_desc ILIKE :search
                  )
              )
            `);
        }),
      );
    }

    const sortFields: Record<string, string> = {
      quotation_no: 'quotation.quotation_no',
      quotation_status: 'quotation.status',
      tira_status: 'quotation.tira_status',
      customer_name: 'sortPolicyHolder.policy_holder_name',
      vehicle_registration_number: 'sortMotor.registration_number',
      cover_note_start_date: 'coverNote.cover_note_start_date',
      product_name: 'product.product_name',
      total_premium_including_tax: 'coverNote.total_premium_including_tax',
      created_at: 'quotation.created_at',
    };
    const sortField =
      sortFields[query.sortBy ?? 'created_at'] ?? sortFields.created_at;
    const sortOrder = query.sortOrder === SortDirection.ASC ? 'ASC' : 'DESC';

    if (
      query.sortBy === 'customer_name' ||
      query.sortBy === 'vehicle_registration_number'
    ) {
      queryBuilder
        .leftJoin(
          'quotation_policy_holders',
          'sortPolicyHolder',
          'sortPolicyHolder.quotation_id = quotation.id AND sortPolicyHolder.sequence_no = 1',
        )
        .leftJoin(
          'quotation_cover_note_entries',
          'sortEntry',
          'sortEntry.cover_note_id = coverNote.id AND sortEntry.entry_number = 1',
        )
        .leftJoin(
          'quotation_motor_details',
          'sortMotor',
          'sortMotor.entry_id = sortEntry.id',
        );
    }

    queryBuilder
      .orderBy(sortField, sortOrder)
      .addOrderBy('quotation.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
  }

  private normalizePage(value: unknown): number {
    const parsed = Number(value ?? 1);

    if (!Number.isFinite(parsed) || parsed < 1) {
      return 1;
    }

    return Math.floor(parsed);
  }

  private normalizeLimit(value: unknown): number {
    const parsed = Number(value ?? 20);

    if (!Number.isFinite(parsed) || parsed < 1) {
      return 20;
    }

    return Math.min(100, Math.floor(parsed));
  }
}
