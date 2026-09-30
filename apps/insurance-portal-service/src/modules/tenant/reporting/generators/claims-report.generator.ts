import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { ReportDefinition } from '../entities/report-definition.entity';
import {
  GeneratedReportPayload,
  ReportGenerator,
  ReportGeneratorContext,
} from '../interfaces/report-generator.interface';

/** Report codes served by this generator (see migration ClaimsReports). */
export const CLAIMS_REPORT_CODES = {
  REGISTER: 'CLAIMS_REGISTER',
  OUTSTANDING: 'CLAIMS_OUTSTANDING',
  PAID: 'CLAIMS_PAID',
  REJECTED: 'CLAIMS_REJECTED',
  RESERVE: 'CLAIMS_RESERVE',
  BY_PRODUCT: 'CLAIMS_BY_PRODUCT',
  BY_CLASS: 'CLAIMS_BY_CLASS',
  BY_BRANCH: 'CLAIMS_BY_BRANCH',
  BY_CLAIMANT: 'CLAIMS_BY_CLAIMANT',
  BY_LOSS_TYPE: 'CLAIMS_BY_LOSS_TYPE',
  BY_STATUS: 'CLAIMS_BY_STATUS',
  PAYMENTS: 'CLAIMS_PAYMENTS',
  ASSESSMENTS: 'CLAIMS_ASSESSMENTS',
  TIRA_SUBMISSIONS: 'CLAIMS_TIRA_SUBMISSIONS',
} as const;

const OPEN_EXCLUDED = `('SETTLED', 'REJECTED', 'CLOSED', 'CANCELLED')`;

interface ScopeSql {
  where: string;
  params: unknown[];
}

/**
 * Claims reports. Every query is bound to the requesting company and the
 * branch/department/user scope carried by the report context, so a report
 * never shows more than the claims list would.
 */
@Injectable()
export class ClaimsReportGenerator implements ReportGenerator {
  readonly key = 'claims';

  constructor(private readonly dataSource: DataSource) {}

  supports(definition: ReportDefinition): boolean {
    return definition.generator_key === this.key;
  }

  async generate(context: ReportGeneratorContext): Promise<GeneratedReportPayload> {
    const code = context.definition.code;
    const scope = this.scope(context);

    switch (code) {
      case CLAIMS_REPORT_CODES.REGISTER:
        return this.register(scope, '');
      case CLAIMS_REPORT_CODES.OUTSTANDING:
        return this.register(
          scope,
          `AND c.status NOT IN ${OPEN_EXCLUDED} AND c.approved_amount > c.paid_amount`,
        );
      case CLAIMS_REPORT_CODES.REJECTED:
        return this.register(
          scope,
          `AND (c.status = 'REJECTED' OR (c.status = 'CLOSED' AND c.liability_status = 'DENIED'))`,
        );
      case CLAIMS_REPORT_CODES.PAID:
        return this.register(scope, `AND c.paid_amount > 0`);
      case CLAIMS_REPORT_CODES.RESERVE:
        return this.reserve(scope);
      case CLAIMS_REPORT_CODES.BY_PRODUCT:
        return this.grouped(scope, "COALESCE(prod.product_name, 'Unknown')", 'product');
      case CLAIMS_REPORT_CODES.BY_CLASS:
        return this.grouped(scope, "COALESCE(cat.name, 'Unknown')", 'insurance_class');
      case CLAIMS_REPORT_CODES.BY_BRANCH:
        return this.grouped(scope, "COALESCE(b.name, 'Unassigned')", 'branch');
      case CLAIMS_REPORT_CODES.BY_LOSS_TYPE:
        return this.grouped(scope, 'c.loss_type', 'loss_type');
      case CLAIMS_REPORT_CODES.BY_STATUS:
        return this.grouped(scope, 'c.status', 'status');
      case CLAIMS_REPORT_CODES.BY_CLAIMANT:
        return this.byClaimant(scope);
      case CLAIMS_REPORT_CODES.PAYMENTS:
        return this.payments(scope);
      case CLAIMS_REPORT_CODES.ASSESSMENTS:
        return this.assessments(scope);
      case CLAIMS_REPORT_CODES.TIRA_SUBMISSIONS:
        return this.tiraSubmissions(scope);
      default:
        return this.register(scope, '');
    }
  }

  private scope(context: ReportGeneratorContext): ScopeSql {
    const filters = { ...(context.filters ?? {}), ...(context.parameters ?? {}) };
    const params: unknown[] = [context.companyId];
    const clauses: string[] = [];
    const add = (sql: string, value: unknown) => {
      params.push(value);
      clauses.push(sql.replace('?', `$${params.length}`));
    };
    const text = (key: string) =>
      typeof filters[key] === 'string' && (filters[key] as string).trim()
        ? (filters[key] as string).trim()
        : null;

    const from = text('period_start') ?? text('from');
    const to = text('period_end') ?? text('to');

    if (from) add('c.created_at >= ?::date', from);
    if (to) add("c.created_at < (?::date + INTERVAL '1 day')", to);
    if (text('branch_id')) add('c.branch_id = ?', text('branch_id'));
    if (text('product_id')) add('p.product_id = ?', text('product_id'));
    if (text('category_id')) add('p.category_id = ?', text('category_id'));
    if (text('status')) add('c.status = ?', text('status'));

    if (context.allowedBranchIds) {
      add('c.branch_id = ANY(?::uuid[])', context.allowedBranchIds);
    }

    if (context.allowedDepartmentIds) {
      add('c.department_id = ANY(?::uuid[])', context.allowedDepartmentIds);
    }

    if (context.scopedUserId) {
      params.push(context.scopedUserId);
      const index = `$${params.length}`;
      clauses.push(
        `(c.assigned_user_id = ${index} OR c.reported_by_user_id = ${index} OR c.created_by = ${index})`,
      );
    }

    return {
      where: clauses.length ? `AND ${clauses.join(' AND ')}` : '',
      params,
    };
  }

  private base() {
    return `
      FROM claims c
      JOIN policies p ON p.id = c.policy_id
      JOIN customers cu ON cu.id = c.customer_id
      LEFT JOIN insurance_products prod ON prod.id = p.product_id
      LEFT JOIN insurance_categories cat ON cat.id = p.category_id
      LEFT JOIN branches b ON b.id = c.branch_id
      WHERE c.company_id = $1 AND c.deleted_at IS NULL`;
  }

  private async register(scope: ScopeSql, extra: string): Promise<GeneratedReportPayload> {
    const rows = await this.dataSource.query(
      `SELECT c.claim_no, c.claim_reference_number, c.claim_notification_number,
              p.policy_no, c.cover_note_reference_number,
              COALESCE(cu.display_name, cu.company_name,
                CONCAT_WS(' ', cu.first_name, cu.last_name)) AS customer,
              prod.product_name AS product, cat.name AS insurance_class,
              b.name AS branch, c.loss_date, c.claim_report_date, c.loss_type,
              c.loss_nature, c.status, c.currency_code, c.estimated_amount,
              c.outstanding_reserve AS reserve, c.approved_amount, c.paid_amount,
              GREATEST(c.approved_amount - c.paid_amount, 0) AS outstanding_amount,
              c.created_at
       ${this.base()} ${scope.where} ${extra}
       ORDER BY c.created_at DESC`,
      scope.params,
    );

    return {
      columns: [
        'claim_no', 'claim_reference_number', 'claim_notification_number', 'policy_no',
        'cover_note_reference_number', 'customer', 'product', 'insurance_class', 'branch',
        'loss_date', 'claim_report_date', 'loss_type', 'loss_nature', 'status',
        'currency_code', 'estimated_amount', 'reserve', 'approved_amount', 'paid_amount',
        'outstanding_amount', 'created_at',
      ],
      rows,
    };
  }

  private async reserve(scope: ScopeSql): Promise<GeneratedReportPayload> {
    const rows = await this.dataSource.query(
      `SELECT c.claim_no, m.movement_no, m.movement_type, m.signed_amount,
              m.currency_code, m.reason, m.effective_at, m.created_at
       ${this.base().replace('WHERE', 'JOIN claim_reserve_movements m ON m.claim_id = c.id WHERE')}
       ${scope.where}
       ORDER BY c.claim_no, m.created_at`,
      scope.params,
    );

    return {
      columns: ['claim_no', 'movement_no', 'movement_type', 'signed_amount', 'currency_code', 'reason', 'effective_at', 'created_at'],
      rows,
    };
  }

  private async grouped(scope: ScopeSql, dimension: string, label: string): Promise<GeneratedReportPayload> {
    const rows = await this.dataSource.query(
      `SELECT ${dimension} AS ${label},
              COUNT(*)::int AS claims,
              COUNT(*) FILTER (WHERE c.status NOT IN ${OPEN_EXCLUDED})::int AS open_claims,
              COALESCE(SUM(c.estimated_amount), 0) AS estimated_amount,
              COALESCE(SUM(c.outstanding_reserve), 0) AS reserve,
              COALESCE(SUM(c.approved_amount), 0) AS approved_amount,
              COALESCE(SUM(c.paid_amount), 0) AS paid_amount
       ${this.base()} ${scope.where}
       GROUP BY 1 ORDER BY claims DESC`,
      scope.params,
    );

    return {
      columns: [label, 'claims', 'open_claims', 'estimated_amount', 'reserve', 'approved_amount', 'paid_amount'],
      rows,
    };
  }

  private async byClaimant(scope: ScopeSql): Promise<GeneratedReportPayload> {
    const rows = await this.dataSource.query(
      `SELECT cl.full_name AS claimant, cl.identification_number, cl.claimant_category,
              COUNT(DISTINCT c.id)::int AS claims,
              COALESCE(SUM(c.approved_amount), 0) AS approved_amount,
              COALESCE(SUM(c.paid_amount), 0) AS paid_amount
       ${this.base().replace('WHERE', "JOIN claim_claimants cl ON cl.claim_id = c.id AND cl.status = 'ACTIVE' WHERE")}
       ${scope.where}
       GROUP BY 1, 2, 3 ORDER BY claims DESC`,
      scope.params,
    );

    return {
      columns: ['claimant', 'identification_number', 'claimant_category', 'claims', 'approved_amount', 'paid_amount'],
      rows,
    };
  }

  private async payments(scope: ScopeSql): Promise<GeneratedReportPayload> {
    const rows = await this.dataSource.query(
      `SELECT c.claim_no, pay.claim_payment_number, pay.status, pay.paid_amount,
              pay.currency_code, pay.payment_mode, pay.payment_reference,
              pay.payment_date, pay.tiramis_status, pay.created_at
       ${this.base().replace('WHERE', 'JOIN claim_payments pay ON pay.claim_id = c.id WHERE')}
       ${scope.where}
       ORDER BY pay.created_at DESC`,
      scope.params,
    );

    return {
      columns: ['claim_no', 'claim_payment_number', 'status', 'paid_amount', 'currency_code', 'payment_mode', 'payment_reference', 'payment_date', 'tiramis_status', 'created_at'],
      rows,
    };
  }

  private async assessments(scope: ScopeSql): Promise<GeneratedReportPayload> {
    const rows = await this.dataSource.query(
      `SELECT c.claim_no, a.claim_assessment_number, a.is_re_assessment, a.status,
              a.assessment_amount, a.approved_claim_amount, a.currency_code,
              a.assessment_received_date, a.claim_approval_date,
              a.claim_approval_authority, a.tiramis_status
       ${this.base().replace('WHERE', 'JOIN claim_assessments a ON a.claim_id = c.id WHERE')}
       ${scope.where}
       ORDER BY a.created_at DESC`,
      scope.params,
    );

    return {
      columns: ['claim_no', 'claim_assessment_number', 'is_re_assessment', 'status', 'assessment_amount', 'approved_claim_amount', 'currency_code', 'assessment_received_date', 'claim_approval_date', 'claim_approval_authority', 'tiramis_status'],
      rows,
    };
  }

  private async tiraSubmissions(scope: ScopeSql): Promise<GeneratedReportPayload> {
    const rows = await this.dataSource.query(
      `SELECT c.claim_no, op.operation_type, op.source_record_number, op.sequence_number,
              op.status, op.regulatory_reference, op.acknowledgement_code,
              op.final_response_code, op.final_response_message,
              op.submitted_at, op.completed_at
       ${this.base().replace('WHERE', 'JOIN claim_regulatory_operations op ON op.claim_id = c.id WHERE')}
       ${scope.where}
       ORDER BY op.created_at DESC`,
      scope.params,
    );

    return {
      columns: ['claim_no', 'operation_type', 'source_record_number', 'sequence_number', 'status', 'regulatory_reference', 'acknowledgement_code', 'final_response_code', 'final_response_message', 'submitted_at', 'completed_at'],
      rows,
    };
  }
}
