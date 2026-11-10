import { describe, expect, it } from 'vitest';
import type { PolicyRecord, PolicyVersionRecord } from '../types';
import { daysLeftLabel, policyStatusView } from '../utils/policyDisplay';
import { policySummary } from '../utils/policySummary';

const now = new Date('2026-11-10T09:00:00');

const policy = (over: Partial<PolicyRecord> = {}) =>
  ({
    id: 'p1',
    policy_no: 'P11/2026/100',
    policy_status: 'ACTIVE',
    start_date: '2026-11-09',
    end_date: '2027-11-08',
    issue_date: '2026-11-09',
    currency: 'TZS',
    total_premium: '23600',
    quotation_id: 'q1',
    tira_status: 'SUCCESS',
    sticker_no: 'STK-1',
    cover_note_no: 'CN-1',
    tiramis_last_error_message: null,
    tiramis_final_response_status_code: null,
    tiramis_acknowledgement_status_code: null,
    insurer_company: { id: 'c', name: 'Alliance', slug: 'a' },
    customer: null,
    ...over,
  }) as unknown as PolicyRecord;

const version = {
  policy_snapshot: { source: { quotationNo: 'AICL261109011' } },
} as unknown as PolicyVersionRecord;

describe('policy status display', () => {
  it('marks in-force policies ending within 30 days as expiring soon', () => {
    expect(policyStatusView('ACTIVE', '2026-11-22', now)).toEqual({
      label: 'Expiring soon',
      tone: 'progress',
      daysLeft: 12,
    });
    expect(policyStatusView('ACTIVE', '2027-11-08', now).tone).toBe('success');
    expect(policyStatusView('CANCELLED', '2027-11-08', now).tone).toBe(
      'danger',
    );
    expect(daysLeftLabel(-3)).toBe('Expired 3 days ago');
  });
});

describe('policy summary', () => {
  it('links the source quotation and shows TIRA numbers', () => {
    const s = policySummary({
      policy: policy(),
      kind: 'single',
      version,
      coverNotes: [
        {
          id: 'n1',
          status: 'ISSUED',
          cover_note_reference_number: '81603-99065-39949',
          sticker_number: 'STK-1',
        } as never,
      ],
      quotationHref: '/apps/motor/quotations/q1',
      now,
    });
    expect(s.entity).toBe('policy');
    expect(s.reference).toMatchObject({
      label: 'Quotation no.',
      value: 'AICL261109011',
      href: '/apps/motor/quotations/q1',
    });
    expect(s.tira).toMatchObject({
      state: 'success',
      sticker: 'STK-1',
      coverRef: '81603-99065-39949',
    });
    expect(s.footer.map((f) => f.label)).toEqual(['Issued by', 'Issued on']);
    expect(s.notice).toBeNull();
  });

  it('offers renewal when the policy expires within 30 days', () => {
    const renew = { onClick: () => undefined };
    const s = policySummary({
      policy: policy({ end_date: '2026-11-22' }),
      kind: 'single',
      renew,
      now,
    });
    expect(s.notice?.text).toBe('Expires in 12 days');
    expect(s.notice?.action?.label).toBe('Renew');
  });

  it('derives the payment badge from the policy invoices', () => {
    const base = { policy: policy(), kind: 'single' as const, now };
    expect(
      policySummary({
        ...base,
        invoices: [
          {
            status: 'PAID',
            balance_amount: '0',
            paid_amount: '23600',
          } as never,
        ],
      }).payment?.label,
    ).toBe('PAID');
    expect(
      policySummary({
        ...base,
        invoices: [
          {
            status: 'ISSUED',
            balance_amount: '23600',
            paid_amount: '0',
          } as never,
        ],
      }).payment?.label,
    ).toBe('UNPAID');
    expect(policySummary(base).payment).toBeNull();
  });

  it('counts fleet cover notes and hides numbers when TIRA failed', () => {
    const fleet = policySummary({
      policy: policy(),
      kind: 'fleet',
      coverNotes: [
        {
          id: '1',
          fleet_entry: 1,
          status: 'ISSUED',
          cover_note_reference_number: 'A',
        },
        {
          id: '2',
          fleet_entry: 2,
          status: 'ISSUED',
          cover_note_reference_number: null,
        },
      ] as never,
      now,
    });
    expect(fleet.tira.fleet).toEqual({ total: 2, issued: 1, failed: [] });
    const failed = policySummary({
      policy: policy({
        tira_status: 'FAILED',
        tiramis_last_error_message: 'Context not ready',
        tiramis_final_response_status_code: 'E42',
      }),
      kind: 'single',
      now,
    });
    expect(failed.tira).toMatchObject({
      state: 'failed',
      error: 'Context not ready',
      code: 'E42',
    });
  });
});
