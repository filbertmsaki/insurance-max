import {
  ClaimRegulatoryOperationType,
  validateClaimTiramisPayload,
} from '@insurance-max/contracts';

import { ClaimantType } from '../enums/claim.enums';
import { ClaimTiramisPayloadService } from './claim-tiramis-payload.service';

/**
 * Field lists are the TIRAMIS v1.3 message definitions (§9.1–§14.1); header
 * fields are added by the TIRAMIS module and must not appear here.
 */
const NOTIFICATION_FIELDS = [
  'claimNotificationNumber',
  'coverNoteReferenceNumber',
  'claimReportDate',
  'claimFormDullyFilled',
  'lossDate',
  'lossNature',
  'lossType',
  'lossLocation',
  'officerName',
  'officerTitle',
];

const FULL_CLAIMANT_FIELDS = [
  'claimantName',
  'claimantBirthDate',
  'claimantCategory',
  'claimantType',
  'claimantIdNumber',
  'claimantIdType',
  'gender',
  'countryCode',
  'region',
  'district',
  'street',
  'claimantPhoneNumber',
  'claimantFax',
  'postalAddress',
  'emailAddress',
];

const IDENTITY_CLAIMANT_FIELDS = [
  'claimantCategory',
  'claimantType',
  'claimantIdNumber',
  'claimantIdType',
];

const claim = {
  claim_notification_number: 'CLN-2026-00001',
  claim_reference_number: 'TIRA-CLM-1',
  cover_note_reference_number: 'TIRA-CN-1',
  claim_report_date: new Date('2026-09-01T07:00:00Z'),
  claim_form_dully_filled: 'Y',
  loss_date: new Date('2026-08-31T21:30:00Z'),
  loss_nature: 'Collision',
  loss_type: 'Own damage',
  loss_location: 'Morogoro Road',
  currency_code: 'TZS',
} as any;

const claimant = {
  full_name: 'Asha Juma',
  claimant_type: ClaimantType.POLICYHOLDER,
  claimant_category: null,
  party_type: 1,
  id_type: 1,
  identification_number: '19900101-12345-00001-12',
  birth_date: '1990-01-01',
  gender: 'F',
  country_code: 'TZA',
  region: 'Dar es Salaam',
  district: 'Ilala',
  street: null,
  phone: '255713000000',
  fax: null,
  postal_address: null,
  email: 'asha@example.com',
} as any;

describe('ClaimTiramisPayloadService', () => {
  const service = new ClaimTiramisPayloadService();

  it('builds exactly the ClaimNotificationRefReq detail fields', () => {
    const payload = service.notification(claim, {
      name: 'Jane Officer',
      title: 'Claims Officer',
    });

    expect(Object.keys(payload).sort()).toEqual(
      [...NOTIFICATION_FIELDS].sort(),
    );
    expect(payload.officerName).toBe('Jane Officer');
  });

  it('formats timestamps in East Africa Time without offset', () => {
    const payload = service.notification(claim, { name: 'x', title: 'y' });

    // 21:30Z on the 31st is 00:30 on the 1st in Dar es Salaam (UTC+3).
    expect(payload.lossDate).toBe('2026-09-01T00:30:00');
    expect(payload.claimReportDate).toBe('2026-09-01T10:00:00');
  });

  it('uses the full claimant record for intimation', () => {
    const payload = service.intimation(
      claim,
      {
        claim_intimation_number: 'INT-2026-00001',
        claim_intimation_date: new Date('2026-09-02T06:00:00Z'),
        currency_code: 'TZS',
        exchange_rate: '1.000000',
        claim_estimated_amount: '1500000',
        claim_reserve_amount: '1200000',
        claim_reserve_method: 'Case estimate',
        loss_assessment_option: 2,
        assessor_name: 'Bima Adjusters',
        assessor_id_number: '123-456-789',
        assessor_id_type: 6,
      } as any,
      [claimant],
    );

    expect(payload.claimReferenceNumber).toBe('TIRA-CLM-1');
    expect(payload.claimReserveAmount).toBe('1200000.00');
    expect(payload.exchangeRate).toBe('1.00');
    expect(Object.keys(payload.claimants[0]).sort()).toEqual(
      [...FULL_CLAIMANT_FIELDS].sort(),
    );
    // Policyholder claimant defaults to TIRA category 1.
    expect(payload.claimants[0].claimantCategory).toBe(1);
  });

  it('uses identity-only claimants for later stages', () => {
    const identity = service.identityClaimant({
      ...claimant,
      claimant_type: ClaimantType.THIRD_PARTY,
    });

    expect(Object.keys(identity).sort()).toEqual(
      [...IDENTITY_CLAIMANT_FIELDS].sort(),
    );
    expect(identity.claimantCategory).toBe(2);
  });

  it('keeps optional discharge-voucher tags present as empty values', () => {
    const payload = service.dischargeVoucher(claim, {
      discharge_voucher_number: 'DV-2026-00001',
      claim_assessment_number: 'ASM-2026-00001',
      discharge_voucher_date: new Date('2026-09-10T06:00:00Z'),
      currency_code: 'TZS',
      exchange_rate: '1',
      claim_offer_communication_date: new Date('2026-09-10T06:00:00Z'),
      claim_offer_amount: '900000',
      claimant_response_date: new Date('2026-09-11T06:00:00Z'),
      adjustment_date: null,
      adjustment_reason: null,
      adjustment_amount: null,
      reconciliation_date: null,
      reconciliation_summary: null,
      reconciled_amount: null,
      offer_accepted: 'Y',
      claimants: [service.identityClaimant(claimant)],
    } as any);

    for (const key of [
      'adjustmentDate',
      'adjustmentReason',
      'adjustmentAmount',
      'reconciliationDate',
      'reconciliationSummary',
      'reconciledAmount',
    ]) {
      expect(payload).toHaveProperty(key, '');
    }
    expect(payload.claimOfferAmount).toBe('900000.00');
  });

  it('sends the 100-character TIRA rejection reason, not the internal one', () => {
    const payload = service.rejection(claim, {
      claim_rejection_number: 'CRJ-2026-00001',
      claim_intimation_number: 'INT-2026-00001',
      rejection_date: new Date('2026-09-12T06:00:00Z'),
      rejection_reason: 'Long internal investigation narrative '.repeat(10),
      tira_rejection_reason: 'Loss excluded under policy exclusion 4(b)',
      claim_resulted_litigation: 'N',
      claim_amount: '1500000',
      currency_code: 'TZS',
      exchange_rate: '1',
      claimants: [],
    } as any);

    expect(payload.rejectionReason).toBe(
      'Loss excluded under policy exclusion 4(b)',
    );
    expect(payload).not.toHaveProperty('claimAssessmentNumber');
  });

  it('sends an empty mandatory LitigationReason when not litigated', () => {
    const payload = service.payment(claim, {
      claim_payment_number: 'CP-2026-00001',
      claim_intimation_number: 'INT-2026-00001',
      payment_date: new Date('2026-09-15T06:00:00Z'),
      paid_amount: '900000',
      payment_mode: 3,
      parties_notified: 'Y',
      net_premium_earned: '150000',
      claim_resulted_litigation: 'N',
      litigation_reason: null,
      currency_code: 'TZS',
      exchange_rate: '1',
      claimants: [],
    } as any);

    expect(payload.litigationReason).toBe('');
    expect(payload.paymentMode).toBe(3);
  });

  it('builds payloads that pass the shared TIRAMIS claim rules', () => {
    const identity = [service.identityClaimant(claimant)];
    const payloads: Array<[ClaimRegulatoryOperationType, object]> = [
      [
        ClaimRegulatoryOperationType.NOTIFICATION,
        service.notification(claim, {
          name: 'Jane Officer',
          title: 'Claims Officer',
        }),
      ],
      [
        ClaimRegulatoryOperationType.INTIMATION,
        service.intimation(
          claim,
          {
            claim_intimation_number: 'INT-2026-00001',
            claim_intimation_date: new Date('2026-09-02T06:00:00Z'),
            currency_code: 'TZS',
            exchange_rate: '1',
            claim_estimated_amount: '1500000',
            claim_reserve_amount: '1200000',
            claim_reserve_method: 'Case estimate',
            loss_assessment_option: 2,
            assessor_name: 'Bima Adjusters',
            assessor_id_number: '123-456-789',
            assessor_id_type: 7,
          } as any,
          [claimant],
        ),
      ],
      [
        ClaimRegulatoryOperationType.ASSESSMENT,
        service.assessment(
          claim,
          {
            claim_assessment_number: 'ASM-2026-00001',
            claim_intimation_number: 'INT-2026-00001',
            assessment_received_date: new Date('2026-09-05T06:00:00Z'),
            assessment_report_summary: 'Front bumper and bonnet replaced',
            currency_code: 'TZS',
            exchange_rate: '1',
            assessment_amount: '1000000',
            approved_claim_amount: '900000',
            claim_approval_date: new Date('2026-09-06T06:00:00Z'),
            claim_approval_authority: 'Claims Manager',
            is_re_assessment: 'N',
          } as any,
          [claimant],
        ),
      ],
      [
        ClaimRegulatoryOperationType.DISCHARGE_VOUCHER,
        service.dischargeVoucher(claim, {
          discharge_voucher_number: 'DV-2026-00001',
          claim_assessment_number: 'ASM-2026-00001',
          discharge_voucher_date: new Date('2026-09-10T06:00:00Z'),
          currency_code: 'TZS',
          exchange_rate: '1',
          claim_offer_communication_date: new Date('2026-09-10T06:00:00Z'),
          claim_offer_amount: '900000',
          claimant_response_date: new Date('2026-09-11T06:00:00Z'),
          offer_accepted: 'Y',
          claimants: identity,
        } as any),
      ],
      [
        ClaimRegulatoryOperationType.PAYMENT,
        service.payment(claim, {
          claim_payment_number: 'CP-2026-00001',
          claim_intimation_number: 'INT-2026-00001',
          payment_date: new Date('2026-09-15T06:00:00Z'),
          paid_amount: '900000',
          payment_mode: 3,
          parties_notified: 'Y',
          net_premium_earned: '150000',
          claim_resulted_litigation: 'N',
          litigation_reason: null,
          currency_code: 'TZS',
          exchange_rate: '1',
          claimants: identity,
        } as any),
      ],
      [
        ClaimRegulatoryOperationType.REJECTION,
        service.rejection(claim, {
          claim_rejection_number: 'CRJ-2026-00001',
          claim_intimation_number: 'INT-2026-00001',
          rejection_date: new Date('2026-09-12T06:00:00Z'),
          tira_rejection_reason: 'Loss excluded under policy exclusion 4(b)',
          claim_resulted_litigation: 'N',
          claim_amount: '1500000',
          currency_code: 'TZS',
          exchange_rate: '1',
          claimants: identity,
        } as any),
      ],
    ];

    for (const [type, payload] of payloads) {
      expect({
        type,
        errors: validateClaimTiramisPayload(
          type,
          payload as Record<string, unknown>,
        ),
      }).toEqual({ type, errors: [] });
    }
  });
});
