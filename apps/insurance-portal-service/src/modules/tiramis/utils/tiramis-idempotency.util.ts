import { createHash } from 'crypto';

function stableJson(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value !== 'object') {
    return String(value);
  }

  const keys = Object.keys(value).sort();
  const ordered: Record<string, any> = {};

  for (const key of keys) {
    ordered[key] = value[key];
  }

  return JSON.stringify(ordered);
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function buildTiramisBusinessFingerprint(params: {
  sourceCompanyId?: string | null;
  requestType: string;
  sourceModule?: string | null;
  sourceRecordId?: string | null;
  businessReference?: string | null;
}) {
  return digest(
    [
      params.sourceCompanyId || '',
      params.requestType || '',
      params.sourceModule || '',
      params.sourceRecordId || '',
      params.businessReference || '',
    ].join('|'),
  );
}

export function buildTiramisIdempotencyKey(params: {
  sourceCompanyId?: string | null;
  requestType: string;
  sourceModule?: string | null;
  sourceRecordId?: string | null;
  businessReference?: string | null;
  forceResubmit?: boolean;
  resubmissionId?: string | null;
}) {
  return digest(
    [
      params.sourceCompanyId || '',
      params.requestType || '',
      params.sourceModule || '',
      params.sourceRecordId || '',
      params.businessReference || '',
      params.forceResubmit ? 'force' : 'normal',
      params.forceResubmit ? params.resubmissionId || '' : '',
    ].join('|'),
  );
}

export function buildDuplicateMessage(params: {
  requestType: string;
  sourceModule?: string | null;
  sourceRecordId?: string | null;
  businessReference?: string | null;
  existingTrackingId?: string | null;
}) {
  return `Duplicate TIRAMIS submission prevented for ${params.requestType} (${params.sourceModule || 'unknown'}:${params.sourceRecordId || 'unknown'})${params.existingTrackingId ? `, existing tracking ${params.existingTrackingId}` : ''}.`;
}
