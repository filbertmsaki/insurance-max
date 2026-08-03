import { ReportDefinition } from '../entities/report-definition.entity';
import { ReportFormat } from '../enums/reporting.enums';

export const REPORT_GENERATORS = Symbol('REPORT_GENERATORS');

export type ReportFilters = Record<string, unknown>;

export interface ReportGeneratorContext {
  companyId: string;
  branchId?: string | null;
  requestedBy?: string | null;
  filters?: ReportFilters;
  format: ReportFormat;
  definition: ReportDefinition;
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
