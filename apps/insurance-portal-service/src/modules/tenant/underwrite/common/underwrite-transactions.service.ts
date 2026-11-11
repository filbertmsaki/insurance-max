import {
  EXPIRING_SOON_DAYS,
  tiraStateOf,
  tiraStateSql,
} from '../../policies/policy-list-views';
import type {
  TransactionListQueryDto,
  TransactionListSummary,
  TransactionListView,
} from '../dto/transaction-list-query.dto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  PolicyTransactionType,
  WorkflowSubmissionStatus,
  quotationFlowForUnderwriteLine,
  type UnderwriteLine,
} from '@insurance-max/contracts';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import {
  isPagedRequest,
  type TableQueryDto,
} from '@insurance-max/portal-shared/dto/table-query.dto';
import {
  buildPaginationMeta,
  escapeLike,
  normalizePage,
  type PaginatedResult,
} from '@insurance-max/portal-shared/utils/paginate-query.util';
import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { DataAccessScopeService } from '../../../shared/authorization/data-access-scope.service';
import { Policy } from '../../policies/entities/policy.entity';
import { policyBusinessLineSql } from '../../policies/utils/policy-business-line.sql';
import { EndorsementType } from '../../policy-transactions/entities/endorsement-type.entity';
import { PolicyEndorsement } from '../../policy-transactions/entities/policy-endorsement.entity';
import { PolicyRenewal } from '../../policy-transactions/entities/policy-renewal.entity';
import { PolicyTransaction } from '../../policy-transactions/entities/policy-transaction.entity';
import { Quotation } from '../../quotations/entities/quotation.entity';
import { QuotationStatus } from '../../quotations/enums/quotation-status.enum';
import { TiraStatus } from '../../quotations/enums/tira-status.enum';

type TransactionKind = 'renewal' | 'endorsement' | 'cancellation';
type TiraQueueKind = 'failed' | 'pending';

interface CustomerSnapshot {
  customer_name?: string;
  name?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  company_name?: string;
  business_name?: string;
}

function customerName(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== 'object') {
    return null;
  }

  const data = snapshot as CustomerSnapshot;
  const direct =
    data.customer_name ?? data.company_name ?? data.business_name ?? data.name;
  if (direct) {
    return direct;
  }

  const names = [data.first_name, data.middle_name, data.last_name].filter(
    Boolean,
  );
  return names.length ? names.join(' ') : null;
}

const RENEWAL_TABLE = {
  sortable: {
    renewal_no: 'renewal.renewal_no',
    renewal_status: 'renewal.renewal_status',
    renewal_start_date: 'renewal.renewal_start_date',
    renewal_end_date: 'renewal.renewal_end_date',
    created_at: 'renewal.created_at',
  } as Record<string, string>,
  searchable: ['renewal.renewal_no', 'policy.policy_no'],
  tieBreaker: 'renewal.id',
};

const TRANSACTION_TABLE = {
  sortable: {
    transaction_no: 'transaction.transaction_no',
    effective_date: 'transaction.effective_date',
    policy_end_date: 'policy.end_date',
    net_premium_difference: 'transaction.net_premium_difference',
    stage: 'transaction.stage',
    submission_status: 'transaction.submission_status',
    created_at: 'transaction.created_at',
  } as Record<string, string>,
  searchable: [
    'transaction.transaction_no',
    'policy.policy_no',
    'policy.cover_note_no',
  ],
  tieBreaker: 'transaction.id',
};

/** Customer display name: the customer record, else the policy snapshot. */
const CUSTOMER_NAME_SQL = `COALESCE(
  NULLIF(customer.display_name, ''),
  NULLIF(customer.company_name, ''),
  NULLIF(CONCAT_WS(' ', customer.first_name, customer.middle_name, customer.last_name), ''),
  policy.customer_snapshot ->> 'displayName'
)`;

const IN_FORCE_TRANSACTION_STAGES = ['COMPLETED', 'APPLIED'];
const RENEWED_STATUSES = ['RENEWED'];
const DRAFT_RENEWAL_STATUSES = ['ELIGIBLE', 'OFFER_DRAFT'];

const VIEW_PARAMS = {
  viewInForceStages: IN_FORCE_TRANSACTION_STAGES,
  viewRenewed: RENEWED_STATUSES,
  viewDraftRenewals: DRAFT_RENEWAL_STATUSES,
  viewExpiringDays: EXPIRING_SOON_DAYS,
};

/**
 * Summary-chip conditions. Endorsements and cancellations are "active" once
 * completed or applied while the policy is still in force; "expiring" when
 * that policy ends within 7 days. Renewals use the renewed period.
 */
const TRANSACTION_VIEW_SQL: Record<TransactionListView, string> = {
  active:
    'transaction.stage IN (:...viewInForceStages) AND policy.end_date >= CURRENT_DATE',
  expiring:
    'transaction.stage IN (:...viewInForceStages) AND policy.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + CAST(:viewExpiringDays AS int)',
  tira_failed: `${tiraStateSql('transaction.submission_status')} = 'failed'`,
  drafts: "transaction.stage = 'DRAFT'",
};

const RENEWAL_TIRA_STATUS_SQL =
  'COALESCE(CAST(renewal_quotation.tira_status AS text), CAST(transaction.submission_status AS text))';

const RENEWAL_VIEW_SQL: Record<TransactionListView, string> = {
  active:
    'renewal.renewal_status IN (:...viewRenewed) AND renewal.renewal_end_date >= CURRENT_DATE',
  expiring:
    'renewal.renewal_status IN (:...viewRenewed) AND renewal.renewal_end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + CAST(:viewExpiringDays AS int)',
  tira_failed: `${tiraStateSql(RENEWAL_TIRA_STATUS_SQL)} = 'failed'`,
  drafts: 'renewal.renewal_status IN (:...viewDraftRenewals)',
};

/**
 * Applies the register filters. `view` (the summary chip) is skipped when
 * counting the chips themselves.
 */
function applyRegisterFilters<T extends ObjectLiteral>(
  query: SelectQueryBuilder<T>,
  filters: TransactionListQueryDto | undefined,
  columns: {
    status: string;
    tiraStatus: string;
    createdAt: string;
    views: Record<TransactionListView, string>;
  },
  includeView = true,
) {
  if (!filters) return;
  if (filters.status) {
    query.andWhere(`${columns.status} = :registerStatus`, {
      registerStatus: filters.status,
    });
  }
  if (filters.tira_state) {
    query.andWhere(`${tiraStateSql(columns.tiraStatus)} = :registerTiraState`, {
      registerTiraState: filters.tira_state,
    });
  }
  if (filters.date_from) {
    query.andWhere(`${columns.createdAt} >= CAST(:registerFrom AS date)`, {
      registerFrom: filters.date_from,
    });
  }
  if (filters.date_to) {
    query.andWhere(
      `${columns.createdAt} < CAST(:registerTo AS date) + INTERVAL '1 day'`,
      { registerTo: filters.date_to },
    );
  }
  if (includeView && filters.view) {
    query.andWhere(columns.views[filters.view], VIEW_PARAMS);
  }
}

async function countRegisterViews<T extends ObjectLiteral>(
  query: SelectQueryBuilder<T>,
  views: Record<TransactionListView, string>,
): Promise<TransactionListSummary> {
  const count = (view: TransactionListView) =>
    `COUNT(*) FILTER (WHERE ${views[view]})`;
  const raw = await query
    .select('COUNT(*)', 'all')
    .addSelect(count('active'), 'active')
    .addSelect(count('expiring'), 'expiring')
    .addSelect(count('tira_failed'), 'tira_failed')
    .addSelect(count('drafts'), 'drafts')
    .setParameters(VIEW_PARAMS)
    .orderBy()
    .getRawOne<Record<keyof TransactionListSummary, string>>();
  return {
    all: Number(raw?.all ?? 0),
    active: Number(raw?.active ?? 0),
    expiring: Number(raw?.expiring ?? 0),
    tira_failed: Number(raw?.tira_failed ?? 0),
    drafts: Number(raw?.drafts ?? 0),
  };
}

/**
 * One line, or several (the Motor Insurance module lists Motor and Fleet
 * together). Single-record checks (`assert*InLine`) stay single-line.
 */
export type LineFilter = UnderwriteLine | readonly UnderwriteLine[];

function realLines(line: LineFilter): UnderwriteLine[] {
  return Array.isArray(line) ? [...line] : [line as UnderwriteLine];
}

function linesOf(line: LineFilter): UnderwriteLine[] {
  const lines = Array.isArray(line) ? [...line] : [line as UnderwriteLine];
  // IN () is invalid SQL; an impossible value keeps the query empty.
  return lines.length > 0 ? lines : ['__NONE__' as UnderwriteLine];
}

/**
 * Applies allowlisted search + sort to a scoped query and returns the page
 * window. Scope/filters must already be on the query so count and rows match.
 * Uses offset/limit because the joins are all many-to-one (one row per root).
 */
async function applyTableWindow<T extends ObjectLiteral>(
  query: SelectQueryBuilder<T>,
  input: TableQueryDto,
  table: {
    sortable: Record<string, string>;
    searchable: string[];
    tieBreaker: string;
  },
) {
  const term = input.search?.trim();
  if (term) {
    query.andWhere(
      `(${table.searchable
        .map(
          (column) => `CAST(${column} AS TEXT) ILIKE :tableSearch ESCAPE '\\'`,
        )
        .join(' OR ')})`,
      { tableSearch: `%${escapeLike(term)}%` },
    );
  }
  const sortKey =
    input.sortBy &&
    Object.prototype.hasOwnProperty.call(table.sortable, input.sortBy)
      ? input.sortBy
      : 'created_at';
  const direction = input.sortOrder === 'ASC' ? 'ASC' : 'DESC';
  query
    .orderBy(table.sortable[sortKey], direction, 'NULLS LAST')
    .addOrderBy(table.tieBreaker, direction);

  const { page, limit, skip } = normalizePage(input);
  const total = await query.getCount();
  query.offset(skip).limit(limit);
  return { page, limit, total };
}

interface RenewalExtraRaw {
  renewal_id: string;
  source_policy_no: string;
  customer_display_name: string | null;
  customer_phone: string | null;
  customer_id_number: string | null;
  business_line: string | null;
  renewal_tira_status: string | null;
  renewal_tira_code: string | null;
  renewal_tira_reason: string | null;
  renewal_payment_status: string | null;
  renewal_premium: string | null;
  renewal_currency: string | null;
}

type UnderwriteRenewalRow = ReturnType<
  UnderwriteTransactionsService['mapRenewals']
>[number];

type UnderwriteTransactionRow = ReturnType<
  UnderwriteTransactionsService['mapTransactionRows']
>[number];

function transactionTypeForKind(kind: Exclude<TransactionKind, 'renewal'>) {
  return kind === 'endorsement'
    ? PolicyTransactionType.ENDORSEMENT
    : PolicyTransactionType.CANCELLATION;
}

/**
 * Read layer for transactions and TIRA queues.
 *
 * The existing policy-transaction services remain the command engine. This
 * service only applies the underwrite line and the same policy/quotation data
 * scopes used by the legacy screens, returning 404-free list rows.
 */
@Injectable()
export class UnderwriteTransactionsService {
  constructor(
    @InjectRepository(PolicyTransaction)
    private readonly transactionRepository: Repository<PolicyTransaction>,
    @InjectRepository(PolicyRenewal)
    private readonly renewalRepository: Repository<PolicyRenewal>,
    @InjectRepository(Policy)
    private readonly policyRepository: Repository<Policy>,
    @InjectRepository(Quotation)
    private readonly quotationRepository: Repository<Quotation>,
    private readonly dataAccessScopeService: DataAccessScopeService,
  ) {}

  listRenewals(
    user: AuthenticatedUser,
    line: LineFilter,
  ): Promise<UnderwriteRenewalRow[]>;
  listRenewals(
    user: AuthenticatedUser,
    line: LineFilter,
    table?: TransactionListQueryDto,
  ): Promise<UnderwriteRenewalRow[] | PaginatedResult<UnderwriteRenewalRow>>;
  async listRenewals(
    user: AuthenticatedUser,
    line: LineFilter,
    table?: TransactionListQueryDto,
  ) {
    const build = () => {
      const query = this.renewalRepository
        .createQueryBuilder('renewal')
        .innerJoinAndSelect('renewal.policy_transaction', 'transaction')
        .innerJoin(Policy, 'policy', 'policy.id = transaction.source_policy_id')
        .leftJoin('customers', 'customer', 'customer.id = policy.customer_id')
        .leftJoin(
          'quotations',
          'renewal_quotation',
          'renewal_quotation.id = renewal.renewal_quotation_id',
        )
        .leftJoin(
          'quotation_cover_notes',
          'renewal_cover_note',
          'renewal_cover_note.quotation_id = renewal.renewal_quotation_id',
        )
        .where('renewal.company_id = :companyId', {
          companyId: user.companyId!,
        })
        .andWhere(`${policyBusinessLineSql('policy')} IN (:...lines)`, {
          lines: linesOf(line),
        });
      this.applyPolicyScope(query, user, 'renewals:read');
      return query;
    };
    const columns = {
      status: 'renewal.renewal_status',
      tiraStatus: RENEWAL_TIRA_STATUS_SQL,
      createdAt: 'renewal.created_at',
      views: RENEWAL_VIEW_SQL,
    };

    const query = build()
      .addSelect('policy.policy_no', 'source_policy_no')
      .addSelect(CUSTOMER_NAME_SQL, 'customer_display_name')
      .addSelect('customer.phone', 'customer_phone')
      .addSelect('customer.id_number', 'customer_id_number')
      .addSelect(policyBusinessLineSql('policy'), 'business_line')
      .addSelect(
        'CAST(renewal_quotation.tira_status AS text)',
        'renewal_tira_status',
      )
      .addSelect('renewal_quotation.tira_response_code', 'renewal_tira_code')
      .addSelect(
        'renewal_quotation.tira_response_description',
        'renewal_tira_reason',
      )
      .addSelect(
        'CAST(renewal_quotation.payment_status AS text)',
        'renewal_payment_status',
      )
      .addSelect(
        'renewal_cover_note.total_premium_including_tax',
        'renewal_premium',
      )
      .addSelect('renewal_cover_note.currency_code', 'renewal_currency')
      .orderBy('renewal.created_at', 'DESC');
    applyRegisterFilters(query, table, columns);

    if (table && isPagedRequest(table)) {
      const summaryQuery = table.include_summary ? build() : null;
      if (summaryQuery)
        applyRegisterFilters(summaryQuery, table, columns, false);
      const { page, limit, total } = await applyTableWindow(
        query,
        table,
        RENEWAL_TABLE,
      );
      const [result, summary] = await Promise.all([
        query.getRawAndEntities<RenewalExtraRaw>(),
        summaryQuery
          ? countRegisterViews(summaryQuery, RENEWAL_VIEW_SQL)
          : Promise.resolve(undefined),
      ]);
      return {
        data: this.mapRenewals(result),
        pagination: buildPaginationMeta(page, limit, total),
        ...(summary ? { summary } : {}),
      };
    }

    return this.mapRenewals(await query.getRawAndEntities<RenewalExtraRaw>());
  }

  /** @internal */
  mapRenewals({
    entities,
    raw,
  }: {
    entities: PolicyRenewal[];
    raw: RenewalExtraRaw[];
  }) {
    // PolicyTransaction has no policy number of its own.
    const extras = new Map(raw.map((row) => [row.renewal_id, row]));
    return entities.map((renewal) => {
      const extra = extras.get(renewal.id);
      const policyNo = extra?.source_policy_no ?? null;
      // A renewal is priced and sent to TIRA through its renewal quotation.
      const tiraStatus =
        extra?.renewal_tira_status ??
        renewal.policy_transaction?.submission_status ??
        null;
      const failed = tiraStateOf(tiraStatus) === 'failed';
      return {
        business_line: extra?.business_line ?? null,
        customer_name: extra?.customer_display_name ?? null,
        customer_phone: extra?.customer_phone ?? null,
        customer_id_number: extra?.customer_id_number ?? null,
        tira_status: tiraStatus,
        tira_error_code: failed ? (extra?.renewal_tira_code ?? null) : null,
        tira_error_reason: failed ? (extra?.renewal_tira_reason ?? null) : null,
        payment_status:
          extra?.renewal_payment_status ??
          renewal.policy_transaction?.payment_status ??
          null,
        renewal_premium:
          extra?.renewal_premium != null ? String(extra.renewal_premium) : null,
        currency_code:
          extra?.renewal_currency ??
          renewal.policy_transaction?.currency_code ??
          null,
        kind: 'renewal' as const,
        id: renewal.id,
        renewal_no: renewal.renewal_no,
        renewal_status: renewal.renewal_status,
        renewal_start_date: renewal.renewal_start_date,
        renewal_end_date: renewal.renewal_end_date,
        offer_expires_at: renewal.offer_expires_at,
        created_at: renewal.created_at,
        policy_no: policyNo,
        policy_transaction: {
          ...renewal.policy_transaction,
          policy_no: policyNo,
        },
      };
    });
  }

  listTransactions(
    user: AuthenticatedUser,
    line: LineFilter,
    kind: Exclude<TransactionKind, 'renewal'>,
  ): Promise<UnderwriteTransactionRow[]>;
  listTransactions(
    user: AuthenticatedUser,
    line: LineFilter,
    kind: Exclude<TransactionKind, 'renewal'>,
    table?: TransactionListQueryDto,
  ): Promise<
    UnderwriteTransactionRow[] | PaginatedResult<UnderwriteTransactionRow>
  >;
  async listTransactions(
    user: AuthenticatedUser,
    line: LineFilter,
    kind: Exclude<TransactionKind, 'renewal'>,
    table?: TransactionListQueryDto,
  ) {
    const build = () =>
      this.scopedTransactionQuery(user, line, kind).andWhere(
        'transaction.transaction_type = :transactionType',
        { transactionType: transactionTypeForKind(kind) },
      );
    const columns = {
      status: 'transaction.stage',
      tiraStatus: 'transaction.submission_status',
      createdAt: 'transaction.created_at',
      views: TRANSACTION_VIEW_SQL,
    };
    const query = build().orderBy('transaction.created_at', 'DESC');
    applyRegisterFilters(query, table, columns);

    if (table && isPagedRequest(table)) {
      const summaryQuery = table.include_summary ? build() : null;
      if (summaryQuery)
        applyRegisterFilters(summaryQuery, table, columns, false);
      const { page, limit, total } = await applyTableWindow(
        query,
        table,
        TRANSACTION_TABLE,
      );
      const [rows, summary] = await Promise.all([
        this.fetchTransactionRows(query),
        summaryQuery
          ? countRegisterViews(summaryQuery, TRANSACTION_VIEW_SQL)
          : Promise.resolve(undefined),
      ]);
      return {
        data: this.mapTransactionRows(kind, rows),
        pagination: buildPaginationMeta(page, limit, total),
        ...(summary ? { summary } : {}),
      };
    }

    return this.mapTransactionRows(
      kind,
      await this.fetchTransactionRows(query),
    );
  }

  /** @internal */
  fetchTransactionRows(query: SelectQueryBuilder<PolicyTransaction>) {
    return query.getRawMany<{
      id: string;
      transaction_no: string;
      transaction_type: string;
      stage: string;
      approval_status: string;
      payment_status: string;
      submission_status: string;
      source_policy_id: string;
      effective_date: string;
      reason: string;
      premium_effect: string;
      additional_premium: string;
      return_premium: string;
      net_premium_difference: string;
      currency_code: string;
      tiramis_request_id: string | null;
      tiramis_transaction_id: string | null;
      created_at: Date;
      updated_at: Date;
      policy_no: string;
      cover_note_no: string | null;
      business_line: string | null;
      policy_start_date: string | null;
      policy_end_date: string | null;
      customer_snapshot: unknown;
      customer_display_name: string | null;
      customer_phone: string | null;
      customer_id_number: string | null;
      endorsement_type_code: string | null;
      endorsement_type_name: string | null;
      regulatory_status_code: string | null;
      regulatory_status_description: string | null;
    }>();
  }

  /** @internal */
  mapTransactionRows(
    kind: Exclude<TransactionKind, 'renewal'>,
    rows: Awaited<
      ReturnType<UnderwriteTransactionsService['fetchTransactionRows']>
    >,
  ) {
    return rows.map(
      ({
        regulatory_status_code: statusCode,
        regulatory_status_description: statusDescription,
        customer_display_name: displayName,
        ...row
      }) => {
        // TIRA's code and reason only while the submission has failed.
        const failed = tiraStateOf(row.submission_status) === 'failed';
        return {
          kind,
          ...row,
          customer_name: displayName ?? customerName(row.customer_snapshot),
          // Period affected: from the effective date to the policy's end.
          cover_start_date: row.effective_date,
          cover_end_date: row.policy_end_date,
          tira_error_code: failed ? (statusCode ?? null) : null,
          tira_error_reason: failed ? (statusDescription ?? null) : null,
        };
      },
    );
  }

  async listTiraQueue(
    user: AuthenticatedUser,
    line: LineFilter,
    kind: TiraQueueKind,
    table?: TableQueryDto,
  ) {
    if (table && isPagedRequest(table)) {
      return this.listTiraQueuePage(user, line, kind, table);
    }

    const [quotations, transactions] = await Promise.all([
      this.listQuotationTiraQueue(user, line, kind),
      this.listTransactionTiraQueue(user, line, kind),
    ]);

    return [...quotations, ...transactions].sort(
      (left, right) =>
        new Date(right.updated_at).getTime() -
        new Date(left.updated_at).getTime(),
    );
  }

  /**
   * Paged TIRA worklist. The queue merges two tables, so each source applies
   * scope, status rules and the search term in SQL, is counted, and returns
   * only its first (skip + limit) rows ordered by updated_at + id. Merging
   * those windows and slicing gives the exact requested page without loading
   * the whole queue.
   */
  private async listTiraQueuePage(
    user: AuthenticatedUser,
    line: LineFilter,
    kind: TiraQueueKind,
    table: TableQueryDto,
  ) {
    const { page, limit, skip } = normalizePage(table);
    const direction: 'ASC' | 'DESC' =
      table.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    const window = {
      term: table.search?.trim() || undefined,
      direction,
      take: skip + limit,
    };

    const [quotations, transactions] = await Promise.all([
      this.listQuotationTiraQueue(user, line, kind, window),
      this.listTransactionTiraQueue(user, line, kind, window),
    ]);

    const sign = direction === 'ASC' ? 1 : -1;
    const data = [...quotations.rows, ...transactions.rows]
      .sort((left, right) => {
        const diff =
          new Date(left.updated_at).getTime() -
          new Date(right.updated_at).getTime();
        if (diff !== 0) return diff * sign;
        return left.id < right.id ? -sign : left.id > right.id ? sign : 0;
      })
      .slice(skip, skip + limit);

    return {
      data,
      pagination: buildPaginationMeta(
        page,
        limit,
        quotations.total + transactions.total,
      ),
    };
  }

  async assertPolicyInLine(
    user: AuthenticatedUser,
    line: UnderwriteLine,
    policyId: string,
  ): Promise<void> {
    const query = this.policyRepository
      .createQueryBuilder('policy')
      .select('policy.id', 'id')
      .where('policy.id = :policyId', { policyId })
      .andWhere('policy.company_id = :companyId', {
        companyId: user.companyId!,
      })
      .andWhere(`${policyBusinessLineSql('policy')} = :line`, { line })
      .andWhere('policy.deleted_at IS NULL');

    this.applyPolicyScope(query, user, 'policies:read');

    const row = await query.getRawOne<{ id: string }>();
    if (!row) {
      throw new NotFoundException('Policy not found');
    }
  }

  async assertTransactionInLine(
    user: AuthenticatedUser,
    line: UnderwriteLine,
    transactionId: string,
    kind?: Exclude<TransactionKind, 'renewal'>,
  ): Promise<void> {
    const query = this.transactionRepository
      .createQueryBuilder('transaction')
      .select('transaction.id', 'id')
      .innerJoin(Policy, 'policy', 'policy.id = transaction.source_policy_id')
      .where('transaction.id = :transactionId', { transactionId })
      .andWhere('transaction.company_id = :companyId', {
        companyId: user.companyId!,
      })
      .andWhere(`${policyBusinessLineSql('policy')} = :line`, { line });

    if (kind) {
      query.andWhere('transaction.transaction_type = :transactionType', {
        transactionType: transactionTypeForKind(kind),
      });
    }

    const permission =
      kind === 'endorsement'
        ? 'endorsements:create'
        : kind === 'cancellation'
          ? 'cancellations:read'
          : 'policy-transactions:read';
    this.applyTransactionScope(query, user, permission, kind);

    const row = await query.getRawOne<{ id: string }>();
    if (!row) {
      throw new NotFoundException('Policy transaction not found');
    }
  }

  async assertQuotationInLine(
    user: AuthenticatedUser,
    line: UnderwriteLine,
    quotationId: string,
  ): Promise<void> {
    const query = this.quotationRepository
      .createQueryBuilder('quotation')
      .select('quotation.id', 'id')
      .where('quotation.id = :quotationId', { quotationId })
      .andWhere('quotation.company_id = :companyId', {
        companyId: user.companyId!,
      })
      .andWhere('quotation.quotation_flow = :quotationFlow', {
        quotationFlow: quotationFlowForUnderwriteLine(line),
      })
      .andWhere('quotation.deleted_at IS NULL');

    this.dataAccessScopeService.applyQuotationReadScope(
      query,
      'quotation',
      this.dataAccessScopeService.resolve(user, 'quotations:read'),
    );

    const row = await query.getRawOne<{ id: string }>();
    if (!row) {
      throw new NotFoundException('Quotation not found');
    }
  }

  async assertRenewalInLine(
    user: AuthenticatedUser,
    line: UnderwriteLine,
    renewalId: string,
  ): Promise<void> {
    const query = this.renewalRepository
      .createQueryBuilder('renewal')
      .select('renewal.id', 'id')
      .innerJoin(
        PolicyTransaction,
        'transaction',
        'transaction.id = renewal.policy_transaction_id',
      )
      .innerJoin(Policy, 'policy', 'policy.id = transaction.source_policy_id')
      .where('renewal.id = :renewalId', { renewalId })
      .andWhere('renewal.company_id = :companyId', {
        companyId: user.companyId!,
      })
      .andWhere('transaction.transaction_type = :transactionType', {
        transactionType: PolicyTransactionType.RENEWAL,
      })
      .andWhere(`${policyBusinessLineSql('policy')} = :line`, { line });

    this.applyPolicyScope(query, user, 'renewals:read');

    const row = await query.getRawOne<{ id: string }>();
    if (!row) {
      throw new NotFoundException('Renewal not found');
    }
  }

  private async listQuotationTiraQueue(
    user: AuthenticatedUser,
    line: LineFilter,
    kind: TiraQueueKind,
  ): Promise<ReturnType<typeof mapQuotationTiraRows>>;
  private async listQuotationTiraQueue(
    user: AuthenticatedUser,
    line: LineFilter,
    kind: TiraQueueKind,
    window: TiraQueueWindow,
  ): Promise<{ rows: ReturnType<typeof mapQuotationTiraRows>; total: number }>;
  private async listQuotationTiraQueue(
    user: AuthenticatedUser,
    line: LineFilter,
    kind: TiraQueueKind,
    window?: TiraQueueWindow,
  ) {
    const query = this.quotationRepository
      .createQueryBuilder('quotation')
      .select([
        'quotation.id AS id',
        'quotation.quotation_no AS reference_no',
        'quotation.status AS workflow_status',
        'quotation.tira_status AS tira_status',
        'quotation.tira_request_id AS tira_request_id',
        'quotation.tira_response_id AS tira_response_id',
        'quotation.tira_response_code AS status_code',
        'quotation.tira_response_description AS status_description',
        'quotation.customer_snapshot AS customer_snapshot',
        'quotation.updated_at AS updated_at',
        "'quotation' AS source_kind",
      ])
      .where('quotation.company_id = :companyId', {
        companyId: user.companyId!,
      })
      .andWhere('quotation.deleted_at IS NULL');

    // quotation_flow is an enum: an empty line list must not reach the IN().
    const quotationFlows = realLines(line).map((item) =>
      quotationFlowForUnderwriteLine(item),
    );
    if (quotationFlows.length > 0) {
      query.andWhere('quotation.quotation_flow IN (:...quotationFlows)', {
        quotationFlows,
      });
    } else {
      query.andWhere('1 = 0');
    }

    if (kind === 'failed') {
      // TIRA failures only: a REJECTED status alone can be an approval
      // rejection, which TIRA never saw (TIRA rejections set tira_status).
      query.andWhere(
        `(quotation.tira_status IN (:...tiraStatuses)
          OR quotation.status = :failedStatus)`,
        {
          tiraStatuses: [TiraStatus.FAILED, TiraStatus.REJECTED],
          failedStatus: QuotationStatus.FAILED,
        },
      );
    } else {
      query.andWhere(
        `(quotation.tira_status IN (:...tiraStatuses)
          OR quotation.status IN (:...quotationStatuses))`,
        {
          tiraStatuses: [
            TiraStatus.SUBMITTING,
            TiraStatus.SUBMITTED,
            TiraStatus.PROCESSING,
          ],
          quotationStatuses: [
            QuotationStatus.SUBMITTING_TO_TIRA,
            QuotationStatus.SUBMITTED_TO_TIRA,
            QuotationStatus.TIRA_PROCESSING,
          ],
        },
      );
    }

    this.dataAccessScopeService.applyQuotationReadScope(
      query,
      'quotation',
      this.dataAccessScopeService.resolve(user, 'quotations:read'),
    );

    if (!window) {
      return mapQuotationTiraRows(await query.getRawMany());
    }

    applyTiraSearch(query, window.term, [
      'quotation.quotation_no',
      'quotation.tira_request_id',
      'quotation.customer_snapshot',
    ]);
    const total = await query.getCount();
    query
      .orderBy('quotation.updated_at', window.direction)
      .addOrderBy('quotation.id', window.direction)
      .limit(window.take);
    return { rows: mapQuotationTiraRows(await query.getRawMany()), total };
  }

  private listTransactionTiraQueue(
    user: AuthenticatedUser,
    line: LineFilter,
    kind: TiraQueueKind,
  ): Promise<ReturnType<typeof mapTransactionTiraRows>>;
  private listTransactionTiraQueue(
    user: AuthenticatedUser,
    line: LineFilter,
    kind: TiraQueueKind,
    window: TiraQueueWindow,
  ): Promise<{
    rows: ReturnType<typeof mapTransactionTiraRows>;
    total: number;
  }>;
  private async listTransactionTiraQueue(
    user: AuthenticatedUser,
    line: LineFilter,
    kind: TiraQueueKind,
    window?: TiraQueueWindow,
  ) {
    const statuses =
      kind === 'failed'
        ? [WorkflowSubmissionStatus.FAILED, WorkflowSubmissionStatus.RETRYABLE]
        : [
            WorkflowSubmissionStatus.READY,
            WorkflowSubmissionStatus.QUEUED,
            WorkflowSubmissionStatus.PROCESSING,
            WorkflowSubmissionStatus.ACKNOWLEDGED,
          ];

    const query = this.scopedTransactionQuery(user, line)
      .andWhere('transaction.submission_status IN (:...statuses)', {
        statuses,
      })
      .andWhere('transaction.transaction_type IN (:...transactionTypes)', {
        transactionTypes: [
          PolicyTransactionType.ENDORSEMENT,
          PolicyTransactionType.CANCELLATION,
        ],
      })
      .orderBy('transaction.updated_at', 'DESC');

    if (!window) {
      return mapTransactionTiraRows(await this.fetchTransactionRows(query));
    }

    applyTiraSearch(query, window.term, [
      'transaction.transaction_no',
      'transaction.tiramis_request_id',
      'policy.policy_no',
      'policy.cover_note_no',
      'policy.customer_snapshot',
    ]);
    const total = await query.getCount();
    query
      .orderBy('transaction.updated_at', window.direction)
      .addOrderBy('transaction.id', window.direction)
      .limit(window.take);
    return {
      rows: mapTransactionTiraRows(await this.fetchTransactionRows(query)),
      total,
    };
  }

  private scopedTransactionQuery(
    user: AuthenticatedUser,
    line: LineFilter,
    kind?: Exclude<TransactionKind, 'renewal'>,
  ) {
    const query = this.transactionRepository
      .createQueryBuilder('transaction')
      .select([
        'transaction.id AS id',
        'transaction.transaction_no AS transaction_no',
        'transaction.transaction_type AS transaction_type',
        'transaction.stage AS stage',
        'transaction.approval_status AS approval_status',
        'transaction.payment_status AS payment_status',
        'transaction.submission_status AS submission_status',
        'transaction.source_policy_id AS source_policy_id',
        'transaction.effective_date AS effective_date',
        'transaction.reason AS reason',
        'transaction.premium_effect AS premium_effect',
        'transaction.additional_premium AS additional_premium',
        'transaction.return_premium AS return_premium',
        'transaction.net_premium_difference AS net_premium_difference',
        'transaction.currency_code AS currency_code',
        'transaction.tiramis_request_id AS tiramis_request_id',
        'transaction.tiramis_transaction_id AS tiramis_transaction_id',
        'transaction.created_at AS created_at',
        'transaction.updated_at AS updated_at',
        'policy.policy_no AS policy_no',
        'policy.cover_note_no AS cover_note_no',
        `${policyBusinessLineSql('policy')} AS business_line`,
        'policy.start_date AS policy_start_date',
        'policy.end_date AS policy_end_date',
        'policy.customer_snapshot AS customer_snapshot',
        `${CUSTOMER_NAME_SQL} AS customer_display_name`,
        'customer.phone AS customer_phone',
        'customer.id_number AS customer_id_number',
        'COALESCE(endorsement.endorsement_type_code, endorsement_type.code) AS endorsement_type_code',
        'COALESCE(endorsement.endorsement_type_name, endorsement_type.name) AS endorsement_type_name',
        "transaction.regulatory_response ->> 'statusCode' AS regulatory_status_code",
        "transaction.regulatory_response ->> 'statusDescription' AS regulatory_status_description",
      ])
      .innerJoin(Policy, 'policy', 'policy.id = transaction.source_policy_id')
      .leftJoin('customers', 'customer', 'customer.id = policy.customer_id')
      .leftJoin(
        PolicyEndorsement,
        'endorsement',
        'endorsement.policy_transaction_id = transaction.id',
      )
      .leftJoin(
        EndorsementType,
        'endorsement_type',
        'endorsement_type.id = endorsement.endorsement_type_id',
      )
      .where('transaction.company_id = :companyId', {
        companyId: user.companyId!,
      })
      .andWhere(`${policyBusinessLineSql('policy')} IN (:...lines)`, {
        lines: linesOf(line),
      });

    this.applyTransactionScope(query, user, 'policies:read', kind);

    return query;
  }

  private applyPolicyScope<T extends ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    user: AuthenticatedUser,
    permission = 'policies:read',
  ) {
    this.dataAccessScopeService.applyPolicyReadScope(
      query,
      'policy',
      this.dataAccessScopeService.resolve(user, permission),
    );
  }

  /**
   * Policy scope for a transaction query. Holders of the kind's approve
   * permission also see transactions awaiting approval outside their scope.
   */
  private applyTransactionScope<T extends ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    user: AuthenticatedUser,
    permission: string,
    kind?: Exclude<TransactionKind, 'renewal'>,
  ) {
    const approvePermission =
      kind === 'endorsement'
        ? 'endorsements:approve'
        : kind === 'cancellation'
          ? 'cancellations:approve'
          : null;
    this.dataAccessScopeService.applyPolicyTransactionReadScope(
      query,
      'policy',
      'transaction',
      this.dataAccessScopeService.resolve(user, permission),
      !!approvePermission &&
        (user.permissions ?? []).includes(approvePermission),
    );
  }
}

interface TiraQueueWindow {
  term?: string;
  direction: 'ASC' | 'DESC';
  /** Rows to read from each source: skip + limit of the requested page. */
  take: number;
}

function applyTiraSearch<T extends ObjectLiteral>(
  query: SelectQueryBuilder<T>,
  term: string | undefined,
  columns: string[],
) {
  if (!term) return;
  query.andWhere(
    `(${columns
      .map((column) => `CAST(${column} AS TEXT) ILIKE :tiraSearch ESCAPE '\\'`)
      .join(' OR ')})`,
    { tiraSearch: `%${escapeLike(term)}%` },
  );
}

function mapQuotationTiraRows(
  rows: Array<{
    id: string;
    reference_no: string;
    workflow_status: string;
    tira_status: string | null;
    tira_request_id: string | null;
    tira_response_id: string | null;
    status_code: string | null;
    status_description: string | null;
    customer_snapshot: unknown;
    updated_at: Date;
    source_kind: 'quotation';
  }>,
) {
  return rows.map((row) => ({
    ...row,
    customer_name: customerName(row.customer_snapshot),
  }));
}

function mapTransactionTiraRows(
  rows: Awaited<
    ReturnType<UnderwriteTransactionsService['fetchTransactionRows']>
  >,
) {
  return rows.map((row) => ({
    source_kind: 'policy_transaction' as const,
    id: row.id,
    reference_no: row.transaction_no,
    workflow_status: row.submission_status,
    tira_status: row.submission_status,
    tira_request_id: row.tiramis_request_id,
    tira_response_id: row.tiramis_transaction_id,
    // TIRA's own outcome when one was captured, else the business reason.
    status_code: row.regulatory_status_code ?? null,
    status_description: row.regulatory_status_description ?? row.reason,
    customer_snapshot: row.customer_snapshot,
    customer_name:
      row.customer_display_name ?? customerName(row.customer_snapshot),
    updated_at: row.updated_at,
    transaction_type: row.transaction_type,
    source_policy_id: row.source_policy_id,
    policy_no: row.policy_no,
    cover_note_no: row.cover_note_no,
    endorsement_type_code: row.endorsement_type_code,
    endorsement_type_name: row.endorsement_type_name,
  }));
}
