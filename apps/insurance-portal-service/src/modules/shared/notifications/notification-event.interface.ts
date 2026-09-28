export interface PortalNotificationEvent {
  id: string;
  type: string;
  companyId?: string | null;
  targetUserIds?: string[];
  targetRecordType?: string | null;
  targetRecordId?: string | null;
  payload?: Record<string, unknown>;
  occurredAt: string;
}

export interface PublishPortalNotificationEvent {
  type: string;
  companyId?: string | null;
  targetUserIds?: string[];
  targetRecordType?: string | null;
  targetRecordId?: string | null;
  payload?: Record<string, unknown>;
  occurredAt?: string;
}
