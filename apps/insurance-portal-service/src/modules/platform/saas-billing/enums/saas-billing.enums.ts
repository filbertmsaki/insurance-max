export enum SaasPlanStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum SaasPlanVersionStatus {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
  ACTIVE = 'ACTIVE',
  SUPERSEDED = 'SUPERSEDED',
  RETIRED = 'RETIRED',
}

export enum SubscriptionStatus {
  TRIALING = 'TRIALING',
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  SUSPENDED = 'SUSPENDED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum BillingInterval {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
}

export enum SaasBillingCycleStatus {
  OPEN = 'OPEN',
  CALCULATED = 'CALCULATED',
  INVOICED = 'INVOICED',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}

export enum SaasInvoiceStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  VOID = 'VOID',
}

export enum SaasPaymentStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
  REVERSED = 'REVERSED',
}

export enum EntitlementValueType {
  BOOLEAN = 'BOOLEAN',
  INTEGER = 'INTEGER',
  DECIMAL = 'DECIMAL',
  TEXT = 'TEXT',
  JSON = 'JSON',
}

export enum SubscriptionChangeType {
  CREATED = 'CREATED',
  UPGRADE = 'UPGRADE',
  DOWNGRADE = 'DOWNGRADE',
  RENEWAL = 'RENEWAL',
  PLAN_CHANGED = 'PLAN_CHANGED',
  REACTIVATION = 'REACTIVATION',
  SUSPENDED = 'SUSPENDED',
  UNSUSPENSION = 'UNSUSPENSION',
  CANCELLED = 'CANCELLED',
  RESUMED = 'RESUMED',
  MANUAL_ADJUSTMENT = 'MANUAL_ADJUSTMENT',
}

export enum SaasInvoiceAdjustmentType {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
  REVERSAL = 'REVERSAL',
  WRITE_OFF = 'WRITE_OFF',
}

export enum SaasInvoiceAdjustmentStatus {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
  APPLIED = 'APPLIED',
  VOID = 'VOID',
}
