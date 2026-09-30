import { describe, expect, it } from 'vitest';
import {
  activeClaimants,
  claimantMissingFields,
  claimantsLocked,
  operationFor,
  pendingApproval,
  userName,
} from '../claim-records';
import {
  assessmentSchema,
  intimationDefaults,
  intimationSchema,
  netOfDeductions,
  reserveSchema,
  toAssessmentPayload,
  toIntimationPayload,
} from '../stage-schemas';
import type { ClaimClaimant, ClaimDetail } from '../types';

const completeClaimant: ClaimClaimant = {
  id: 'c-1',
  claimant_type: 'POLICYHOLDER',
  full_name: 'Asha Juma',
  claimant_category: 1,
  party_type: 1,
  id_type: 1,
  identification_number: '19900101-12345-00001-12',
  birth_date: '1990-01-01',
  gender: 'F',
  country_code: 'TZA',
  region: null,
  district: 'Ilala',
  street: null,
  phone: '255713000000',
  fax: null,
  postal_address: null,
  email: null,
  status: 'ACTIVE',
};

function claim(overrides: Partial<ClaimDetail> = {}): ClaimDetail {
  const detail: Partial<ClaimDetail> = {
    id: 'claim-1',
    claim_no: 'CLM-2026-00001',
    status: 'INTIMATION_PENDING',
    claimants: [completeClaimant],
    regulatory_operations: [],
    approvals: [],
    ...overrides,
  };
  return detail as ClaimDetail;
}

describe('claimant readiness for TIRA', () => {
  it('matches the backend completeness rule', () => {
    expect(claimantMissingFields(completeClaimant)).toEqual([]);
    expect(
      claimantMissingFields({
        ...completeClaimant,
        id_type: null,
        district: null,
        gender: null,
      }),
    ).toEqual(['ID type', 'district', 'gender']);
    // Gender is not required for corporates.
    expect(
      claimantMissingFields({
        ...completeClaimant,
        party_type: 2,
        gender: null,
      }),
    ).toEqual([]);
  });

  it('ignores removed claimants', () => {
    expect(
      activeClaimants(
        claim({
          claimants: [
            completeClaimant,
            { ...completeClaimant, id: 'c-2', status: 'REMOVED' },
          ],
        }),
      ).map((item) => item.id),
    ).toEqual(['c-1']);
  });

  it('locks claimants once an intimation is with TIRA', () => {
    const operation = (status: string) => ({
      id: 'op',
      operation_type: 'INTIMATION',
      status,
      source_record_id: 'int-1',
    });
    expect(claimantsLocked(claim())).toBe(false);
    expect(
      claimantsLocked(
        claim({ regulatory_operations: [operation('FAILED')] as never }),
      ),
    ).toBe(false);
    expect(
      claimantsLocked(
        claim({ regulatory_operations: [operation('ACKNOWLEDGED')] as never }),
      ),
    ).toBe(true);
    expect(claimantsLocked(claim({ status: 'CLOSED' }))).toBe(true);
  });
});

describe('claim record lookups', () => {
  it('finds the latest TIRA submission of a record', () => {
    const detail = claim({
      regulatory_operations: [
        {
          id: 'a',
          operation_type: 'ASSESSMENT',
          source_record_id: 'asm-1',
          status: 'FAILED',
        },
        {
          id: 'b',
          operation_type: 'ASSESSMENT',
          source_record_id: 'asm-1',
          status: 'ACCEPTED',
        },
      ] as never,
    });
    expect(operationFor(detail, 'ASSESSMENT', 'asm-1')?.id).toBe('b');
    expect(operationFor(detail, 'PAYMENT', 'asm-1')).toBeUndefined();
  });

  it('returns the lowest pending level of the latest round', () => {
    const detail = claim({
      approvals: [
        {
          id: 'old',
          subject_id: 'asm-1',
          round: 1,
          level: 1,
          status: 'PENDING',
        },
        {
          id: 'l2',
          subject_id: 'asm-1',
          round: 2,
          level: 2,
          status: 'PENDING',
        },
        {
          id: 'l1',
          subject_id: 'asm-1',
          round: 2,
          level: 1,
          status: 'PENDING',
        },
      ] as never,
    });
    expect(pendingApproval(detail, 'asm-1')?.id).toBe('l1');
  });

  it('names users from the claim payload', () => {
    const detail = claim({ user_names: { 'u-1': 'Jane Officer' } });
    expect(userName(detail, 'u-1')).toBe('Jane Officer');
    expect(userName(detail, 'u-2')).toBe('Unknown user');
    expect(userName(detail, null)).toBe('-');
  });
});

describe('intimation form', () => {
  it('requires the reserve and the assessor identity (§10.1)', () => {
    const result = intimationSchema.safeParse({
      ...intimationDefaults(null),
      claim_reserve_amount: '0',
      assessor_name: '',
      assessor_id_type: '',
    });
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual([
      'claim_reserve_amount',
      'assessor_name',
      'assessor_id_type',
      'assessor_id_number',
    ]);
  });

  it('maps to the intimation DTO with numeric codes', () => {
    const payload = toIntimationPayload({
      ...intimationDefaults(null, '1500000.00'),
      claim_intimation_date: '2026-09-02T09:00',
      claim_reserve_amount: '1200000',
      loss_assessment_option: '2',
      assessor_name: ' Bima Adjusters ',
      assessor_id_type: '7',
      assessor_id_number: 'INC-1',
    });
    expect(payload).toMatchObject({
      claim_reserve_amount: '1200000',
      claim_reserve_method: 'Case estimate',
      claim_estimated_amount: '1500000.00',
      loss_assessment_option: 2,
      assessor_name: 'Bima Adjusters',
      assessor_id_type: 7,
      exchange_rate: undefined,
    });
    expect(payload.claim_intimation_date).toBe(
      new Date('2026-09-02T09:00').toISOString(),
    );
  });
});

describe('reserve and assessment forms', () => {
  it('needs a positive reserve change with a reason', () => {
    expect(
      reserveSchema.safeParse({
        reserve_type: 'INCREASE',
        amount: '0',
        reason: '',
      }).success,
    ).toBe(false);
    expect(
      reserveSchema.safeParse({
        reserve_type: 'DECREASE',
        amount: '50000',
        reason: 'Salvage',
      }).success,
    ).toBe(true);
  });

  it('keeps the recommended amount within the assessed loss', () => {
    const result = assessmentSchema.safeParse({
      assessment_received_date: '2026-09-05T09:00',
      assessment_report_summary: 'Front bumper replaced',
      assessment_amount: '1000000',
      approved_claim_amount: '1200000',
    });
    expect(result.error?.issues[0].path).toEqual(['approved_claim_amount']);
  });

  it('suggests the assessed loss less deductions', () => {
    expect(
      netOfDeductions({
        assessment_amount: '1000000',
        deductible_amount: '50000',
        salvage_amount: '20000.50',
      }),
    ).toBeCloseTo(929999.5);
    expect(netOfDeductions({ assessment_amount: '' })).toBeNull();
  });

  it('drops empty breakdown amounts from the payload', () => {
    const payload = toAssessmentPayload({
      assessment_received_date: '2026-09-05T09:00',
      assessment_report_summary: ' Front bumper ',
      assessment_amount: '1000000',
      approved_claim_amount: '950000',
      deductible_amount: '50000',
      salvage_amount: '',
    });
    expect(payload).toMatchObject({
      assessment_report_summary: 'Front bumper',
      deductible_amount: '50000',
      salvage_amount: undefined,
    });
  });
});
