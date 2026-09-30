import { describe, expect, it } from 'vitest';
import { acceptedVoucher, payableAmount } from '../claim-records';
import {
  ALL_CLAIMANTS,
  paymentDefaults,
  paymentSchema,
  toPaymentPayload,
  toVoucherAdjustPayload,
  toVoucherPayload,
  voucherAdjustSchema,
  voucherDefaults,
} from '../stage-schemas';
import type { ClaimDetail } from '../types';

function claim(overrides: Partial<ClaimDetail> = {}): ClaimDetail {
  const detail: Partial<ClaimDetail> = {
    id: 'claim-1',
    claim_no: 'CLM-1',
    status: 'PAYMENT_PENDING',
    approved_amount: '900000.00',
    paid_amount: '0.00',
    discharge_vouchers: [],
    payments: [],
    ...overrides,
  };
  return detail as ClaimDetail;
}

describe('payableAmount', () => {
  it('is zero without an accepted voucher', () => {
    expect(payableAmount(claim())).toBe(0);
  });

  it('caps at the smaller of the approved amount and the voucher', () => {
    const detail = claim({
      discharge_vouchers: [
        {
          id: 'v1',
          discharge_voucher_number: 'DV-1',
          version: 1,
          status: 'REJECTED',
          claim_offer_amount: '900000',
        },
        {
          id: 'v2',
          discharge_voucher_number: 'DV-2',
          version: 2,
          status: 'ACCEPTED',
          claim_offer_amount: '850000',
        },
      ],
    });
    expect(acceptedVoucher(detail)?.id).toBe('v2');
    expect(payableAmount(detail)).toBe(850000);
  });

  it('prefers the reconciled amount and subtracts committed payments', () => {
    const detail = claim({
      discharge_vouchers: [
        {
          id: 'v1',
          discharge_voucher_number: 'DV-1',
          version: 1,
          status: 'ACCEPTED',
          claim_offer_amount: '900000',
          reconciled_amount: '800000',
        },
      ],
      payments: [
        {
          id: 'p1',
          claim_payment_number: 'CP-1',
          status: 'PAID',
          paid_amount: '300000',
        },
        {
          id: 'p2',
          claim_payment_number: 'CP-2',
          status: 'DRAFT',
          paid_amount: '100000',
        },
        {
          id: 'p3',
          claim_payment_number: 'CP-3',
          status: 'CANCELLED',
          paid_amount: '500000',
        },
        {
          id: 'p4',
          claim_payment_number: 'CP-4',
          status: 'REVERSED',
          paid_amount: '200000',
        },
      ],
    });
    expect(payableAmount(detail)).toBe(400000);
  });
});

describe('voucher forms', () => {
  it('sends no claimant for an offer to all claimants', () => {
    const payload = toVoucherPayload({
      ...voucherDefaults(null, '850000.00'),
      claim_offer_communication_date: '2026-09-10T09:00',
    });
    expect(payload).toEqual({
      claim_offer_amount: '850000.00',
      claim_offer_communication_date: new Date(
        '2026-09-10T09:00',
      ).toISOString(),
      claimant_id: undefined,
    });
    expect(voucherDefaults(null).claimant_id).toBe(ALL_CLAIMANTS);
  });

  it('requires a started adjustment or reconciliation to be complete (§12.1)', () => {
    const result = voucherAdjustSchema.safeParse({
      adjustment_amount: '50000',
      reconciliation_summary: 'Agreed with claimant',
    });
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual([
      'adjustment_date',
      'adjustment_reason',
      'reconciliation_date',
      'reconciled_amount',
    ]);
  });

  it('rejects an empty adjustment', () => {
    expect(voucherAdjustSchema.safeParse({}).success).toBe(false);
  });

  it('maps a reconciliation on its own', () => {
    const payload = toVoucherAdjustPayload({
      reconciliation_date: '2026-09-11T09:00',
      reconciliation_summary: ' Salvage retained by claimant ',
      reconciled_amount: '800000',
    });
    expect(payload).toMatchObject({
      adjustment_amount: undefined,
      reconciliation_summary: 'Salvage retained by claimant',
      reconciled_amount: '800000',
    });
  });
});

describe('payment form', () => {
  it('defaults to the payable amount by EFT to the claimant', () => {
    expect(paymentDefaults(400000, 'c-1')).toMatchObject({
      paid_amount: '400000.00',
      payment_mode: '3',
      claimant_id: 'c-1',
      payee_type: 'CLAIMANT',
      claim_resulted_litigation: 'N',
    });
  });

  it('requires a litigation reason for litigated claims (TIRA094)', () => {
    const result = paymentSchema.safeParse({
      ...paymentDefaults(100000),
      claim_resulted_litigation: 'Y',
    });
    expect(result.error?.issues[0].path).toEqual(['litigation_reason']);
  });

  it('names a payee other than the claimant', () => {
    const result = paymentSchema.safeParse({
      ...paymentDefaults(100000),
      payee_type: 'GARAGE',
    });
    expect(result.error?.issues[0].path).toEqual(['payee_name']);
  });

  it('sends bank details only when entered and the litigation flag as a boolean', () => {
    expect(toPaymentPayload(paymentDefaults(100000, 'c-1'))).toMatchObject({
      paid_amount: '100000.00',
      payment_mode: 3,
      claimant_id: 'c-1',
      payee_bank_details: undefined,
      claim_resulted_litigation: false,
      litigation_reason: undefined,
    });
    expect(
      toPaymentPayload({
        ...paymentDefaults(100000),
        bank_name: 'CRDB',
        account_number: '0150123456789',
      }).payee_bank_details,
    ).toEqual({
      bank_name: 'CRDB',
      account_name: undefined,
      account_number: '0150123456789',
    });
  });
});
