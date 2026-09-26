import { ReportDefinition } from '../entities/report-definition.entity';
import { ReportFormat } from '../enums/reporting.enums';
import { QuotationPolicyDataScope } from '../../../shared/authorization/quotation-policy-data-scope.enum';

export const REPORT_GENERATORS = Symbol('REPORT_GENERATORS');

export type ReportFilters = Record<string, unknown>;

export interface ReportGeneratorContext {
  companyId: string;
  branchId?: string | null;
  allowedBranchIds?: string[] | null;
  allowedDepartmentIds?: string[] | null;
  scopedUserId?: string | null;
  requestedBy?: string | null;
  filters?: ReportFilters;
  parameters?: ReportFilters;
  format: ReportFormat;
  definition: ReportDefinition;
  requestedAt?: string;
  quotationPolicyDataScope?: QuotationPolicyDataScope | null;
}

export interface GeneratedReportPayload {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown>;
  fileName?: string;
}

export interface ReportGenerator {
  readonly key: string;
  supports(definition: ReportDefinition): boolean;
  generate(context: ReportGeneratorContext): Promise<GeneratedReportPayload>;
}
