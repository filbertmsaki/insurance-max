import {
  ReportCategory,
  ReportOutputFormat,
  ReportSensitivity,
} from './reporting.enums';

export interface ReportParameterDefinition {
  key: string;
  label: string;
  dataType:
    | 'STRING'
    | 'NUMBER'
    | 'BOOLEAN'
    | 'DATE'
    | 'DATE_RANGE'
    | 'ENUM'
    | 'UUID'
    | 'UUID_ARRAY';
  required: boolean;
  defaultValue?: unknown;
  allowedValues?: Array<{
    value: string;
    label: string;
  }>;
  minimum?: number;
  maximum?: number;
  sensitive?: boolean;
}

export interface RegisteredReportDefinition {
  id?: string;
  code: string;
  name: string;
  description: string;
  category: ReportCategory;
  version: number;
  supportedFormats: ReportOutputFormat[];
  sensitivity: ReportSensitivity;
  permission: string;
  maximumRows: number;
  asynchronousOnly: boolean;
  parameters: ReportParameterDefinition[];
}

export interface ReportExecutionContext {
  companyId: string;
  userId: string | null;
  branchIds: string[];
  departmentIds: string[];
  permissions: string[];
  timezone: string;
  locale: string;
  requestedAt: string;
}
