/**
 * Register filters shared by the policy list and its summary-chip counts.
 *
 * `policy.tira_status` stores the latest TIRAMIS submission status as text
 * (SUCCESS, FINAL_SUCCESS, COMPLETED, ACK_FAILED, WAITING_FINAL_RESPONSE...).
 * The register groups those into four states; the web app's `tiraState()`
 * helper uses the same grouping for display.
 */

export const TIRA_STATES = [
  'success',
  'failed',
  'pending',
  'not_submitted',
] as const;
export type TiraState = (typeof TIRA_STATES)[number];

export const POLICY_LIST_VIEWS = ['active', 'expiring', 'tira_failed'] as const;
export type PolicyListView = (typeof POLICY_LIST_VIEWS)[number];

/** Days or fewer of cover left for a record to count as expiring soon. */
export const EXPIRING_SOON_DAYS = 7;

export const IN_FORCE_POLICY_STATUSES = [
  'ACTIVE',
  'ENDORSED',
  'COVER_NOTE_ISSUED',
];

/** SQL CASE grouping a TIRA status column into a `TiraState`. */
export function tiraStateSql(column: string): string {
  const value = `UPPER(COALESCE(CAST(${column} AS text), ''))`;
  return `(CASE
    WHEN ${value} IN ('SUCCESS', 'FINAL_SUCCESS', 'COMPLETED', 'ENDORSED', 'SYNCED', 'ISSUED', 'ACCEPTED', 'IN_SYNC') THEN 'success'
    WHEN ${value} ~ '(FAIL|REJECT|ERROR|EXHAUST|RETRYABLE)' THEN 'failed'
    WHEN ${value} <> 'NOT_SUBMITTED' AND ${value} ~ '(SUBMIT|PROCESS|QUEUE|ACK|RETRY|PENDING|WAITING|SENT|OVERDUE|VALIDATED)' THEN 'pending'
    ELSE 'not_submitted'
  END)`;
}

/** Same grouping as tiraStateSql(), for values already loaded. */
export function tiraStateOf(status: string | null | undefined): TiraState {
  const value = (status ?? '').toUpperCase();
  if (
    [
      'SUCCESS',
      'FINAL_SUCCESS',
      'COMPLETED',
      'ENDORSED',
      'SYNCED',
      'ISSUED',
      'ACCEPTED',
      'IN_SYNC',
    ].includes(value)
  )
    return 'success';
  if (/FAIL|REJECT|ERROR|EXHAUST|RETRYABLE/.test(value)) return 'failed';
  if (
    value !== 'NOT_SUBMITTED' &&
    /SUBMIT|PROCESS|QUEUE|ACK|RETRY|PENDING|WAITING|SENT|OVERDUE|VALIDATED/.test(
      value,
    )
  )
    return 'pending';
  return 'not_submitted';
}

export const POLICY_VIEW_PARAMS = {
  viewInForce: IN_FORCE_POLICY_STATUSES,
  viewExpiringDays: EXPIRING_SOON_DAYS,
};

export const POLICY_VIEW_CONDITIONS: Record<PolicyListView, string> = {
  active:
    'policy.policy_status IN (:...viewInForce) AND policy.end_date >= CURRENT_DATE',
  expiring:
    'policy.policy_status IN (:...viewInForce) AND policy.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + CAST(:viewExpiringDays AS int)',
  tira_failed: `${tiraStateSql('policy.tira_status')} = 'failed'`,
};

export interface PolicyListSummary {
  all: number;
  active: number;
  expiring: number;
  tira_failed: number;
}
