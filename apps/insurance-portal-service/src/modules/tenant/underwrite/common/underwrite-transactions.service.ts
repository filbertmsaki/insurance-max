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
    created_at: 'renewal.created_at',
  } as Record<string, string>,
  searchable: ['renewal.renewal_no', 'policy.policy_no'],
  tieBreaker: 'renewal.id',
};

const TRANSACTION_TABLE = {
  sortable: {
    transaction_no: 'transaction.transaction_no',
    effective_date: 'transaction.effective_date',
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
    line: UnderwriteLine,
  ): Promise<UnderwriteRenewalRow[]>;
  listRenewals(
    user: AuthenticatedUser,
    line: UnderwriteLine,
    table?: TableQueryDto,
  ): Promise<UnderwriteRenewalRow[] | PaginatedResult<UnderwriteRenewalRow>>;
  async listRenewals(
    user: AuthenticatedUser,
    line: UnderwriteLine,
    table?: TableQueryDto,
  ) {
    const query = this.renewalRepository
      .createQueryBuilder('renewal')
      .innerJoinAndSelect('renewal.policy_transaction', 'transaction')
      .innerJoin(Policy, 'policy', 'policy.id = transaction.source_policy_id')
      .addSelect('policy.policy_no', 'source_policy_no')
      .where('renewal.company_id = :companyId', { companyId: user.companyId! })
      .andWhere(`${policyBusinessLineSql('policy')} = :line`, { line })
      .orderBy('renewal.created_at', 'DESC');

    this.applyPolicyScope(query, user, 'renewals:read');

    if (table && isPagedRequest(table)) {
      const { page, limit, total } = await applyTableWindow(
        query,
        table,
        RENEWAL_TABLE,
      );
      const data = this.mapRenewals(
        await query.getRawAndEntities<{
          renewal_id: string;
          source_policy_no: string;
        }>(),
      );
      return { data, pagination: buildPaginationMeta(page, limit, total) };
    }

    return this.mapRenewals(
      await query.getRawAndEntities<{
        renewal_id: string;
        source_policy_no: string;
      }>(),
    );
  }

  /** @internal */
  mapRenewals({
    entities,
    raw,
  }: {
    entities: PolicyRenewal[];
    raw: Array<{ renewal_id: string; source_policy_no: string }>;
  }) {
    // PolicyTransaction has no policy number of its own.
    const policyNos = new Map(
      raw.map((row) => [row.renewal_id, row.source_policy_no ?? null]),
    );
    return entities.map((renewal) => {
      const policyNo = policyNos.get(renewal.id) ?? null;
      return {
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
    line: UnderwriteLine,
    kind: Exclude<TransactionKind, 'renewal'>,
  ): Promise<UnderwriteTransactionRow[]>;
  listTransactions(
    user: AuthenticatedUser,
    line: UnderwriteLine,
    kind: Exclude<TransactionKind, 'renewal'>,
    table?: TableQueryDto,
  ): Promise<
    UnderwriteTransactionRow[] | PaginatedResult<UnderwriteTransactionRow>
  >;
  async listTransactions(
    user: AuthenticatedUser,
    line: UnderwriteLine,
    kind: Exclude<TransactionKind, 'renewal'>,
    table?: TableQueryDto,
  ) {
    const query = this.scopedTransactionQuery(user, line)
      .andWhere('transaction.transaction_type = :transactionType', {
        transactionType: transactionTypeForKind(kind),
      })
      .orderBy('transaction.created_at', 'DESC');

    if (table && isPagedRequest(table)) {
      const { page, limit, total } = await applyTableWindow(
        query,
        table,
        TRANSACTION_TABLE,
      );
      const data = this.mapTransactionRows(
        kind,
        await this.fetchTransactionRows(query),
      );
      return { data, pagination: buildPaginationMeta(page, limit, total) };
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
      customer_snapshot: unknown;
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
        regulatory_status_code: _statusCode,
        regulatory_status_description: _statusDescription,
        ...row
      }) => ({
        kind,
        ...row,
        customer_name: customerName(row.customer_snapshot),
      }),
    );
  }

  async listTiraQueue(
    user: AuthenticatedUser,
    line: UnderwriteLine,
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
    line: UnderwriteLine,
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
    this.applyPolicyScope(query, user, permission);

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
    line: UnderwriteLine,
    kind: TiraQueueKind,
  ): Promise<ReturnType<typeof mapQuotationTiraRows>>;
  private async listQuotationTiraQueue(
    user: AuthenticatedUser,
    line: UnderwriteLine,
    kind: TiraQueueKind,
    window: TiraQueueWindow,
  ): Promise<{ rows: ReturnType<typeof mapQuotationTiraRows>; total: number }>;
  private async listQuotationTiraQueue(
    user: AuthenticatedUser,
    line: UnderwriteLine,
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
      .andWhere('quotation.quotation_flow = :quotationFlow', {
        quotationFlow: quotationFlowForUnderwriteLine(line),
      })
      .andWhere('quotation.deleted_at IS NULL');

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
    line: UnderwriteLine,
    kind: TiraQueueKind,
  ): Promise<ReturnType<typeof mapTransactionTiraRows>>;
  private listTransactionTiraQueue(
    user: AuthenticatedUser,
    line: UnderwriteLine,
    kind: TiraQueueKind,
    window: TiraQueueWindow,
  ): Promise<{
    rows: ReturnType<typeof mapTransactionTiraRows>;
    total: number;
  }>;
  private async listTransactionTiraQueue(
    user: AuthenticatedUser,
    line: UnderwriteLine,
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
    line: UnderwriteLine,
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
        'policy.customer_snapshot AS customer_snapshot',
        'COALESCE(endorsement.endorsement_type_code, endorsement_type.code) AS endorsement_type_code',
        'COALESCE(endorsement.endorsement_type_name, endorsement_type.name) AS endorsement_type_name',
        "transaction.regulatory_response ->> 'statusCode' AS regulatory_status_code",
        "transaction.regulatory_response ->> 'statusDescription' AS regulatory_status_description",
      ])
      .innerJoin(Policy, 'policy', 'policy.id = transaction.source_policy_id')
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
      .andWhere(`${policyBusinessLineSql('policy')} = :line`, { line });

    this.applyPolicyScope(query, user, 'policies:read');

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
    customer_name: customerName(row.customer_snapshot),
    updated_at: row.updated_at,
    transaction_type: row.transaction_type,
    source_policy_id: row.source_policy_id,
    policy_no: row.policy_no,
    cover_note_no: row.cover_note_no,
    endorsement_type_code: row.endorsement_type_code,
    endorsement_type_name: row.endorsement_type_name,
  }));
}
