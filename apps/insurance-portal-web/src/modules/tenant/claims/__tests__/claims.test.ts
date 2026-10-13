import { describe, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { NAV_NODES, type NavGroup } from '@/components/layout/nav-config';
import { CLAIM_QUEUES, CLAIM_STATUSES, getClaimQueueMeta } from '../constants';
import { buildClaimsNavNodes } from '../nav';
import { claimsPaths } from '../paths';
import type { ClaimDetail } from '../types';
import { claimErrorLines, fromDateTimeLocal, toDateTimeLocal } from '../utils';
import {
  claimFormSchema,
  defaultClaimValues,
  emptyClaimant,
  policyholderClaimant,
  toCreatePayload,
  valuesFromClaim,
  type ClaimFormValues,
} from '../wizard/schema';
import { lossDateProblem } from '../wizard/useClaimWizard';

describe('claims navigation', () => {
  const nodes = buildClaimsNavNodes();

  it('adds direct Claims links without a Claims dropdown', () => {
    expect(nodes[0]).toMatchObject({
      kind: 'link',
      section: 'Claims',
      label: 'Dashboard',
      to: claimsPaths.dashboard,
    });
    expect(nodes.map((item) => ('to' in item ? item.to : undefined))).toEqual([
      '/claims/dashboard',
      '/claims',
      '/analytics/metrics',
      '/claims/new',
      '/claims/queue/notification',
      '/claims/queue/intimation',
      '/claims/queue/assessment',
      '/claims/queue/discharge',
      '/claims/queue/payment',
      '/claims/queue/rejection',
      '/claims/documents',
      '/claims/reports',
      '/claims/configuration',
    ]);
  });

  it('gates reading by claims:read and the wizard by claims:create', () => {
    const permissions = Object.fromEntries(
      nodes
        .filter((item) => item.kind === 'link')
        .map((item) => [item.to, item.permission]),
    );
    const dashboard = nodes[0];
    expect(dashboard).toMatchObject({
      anyPermission: ['claims:dashboard', 'claims:read'],
    });
    expect(permissions[claimsPaths.create]).toBe('claims:create');
    expect(permissions[claimsPaths.documents]).toBe('claims:document-verify');
    expect(permissions[claimsPaths.reports]).toBe('claims:report-read');
    expect(permissions[claimsPaths.configuration]).toBe(
      'claims:configuration-manage',
    );
    for (const queue of CLAIM_QUEUES) {
      expect(permissions[claimsPaths.queue(queue.queue)]).toBe('claims:read');
    }
  });

  it('does not render Claims as a dropdown menu', () => {
    const underwriting = NAV_NODES.find(
      (node): node is NavGroup =>
        node.kind === 'group' && node.label === 'Underwriting',
    );
    expect(underwriting).toBeUndefined();
    expect(
      NAV_NODES.some(
        (node): node is NavGroup =>
          node.kind === 'group' && node.label === 'Claims',
      ),
    ).toBe(false);
  });
});

describe('claim queues', () => {
  it('match the backend stage menus (claim-lifecycle.ts CLAIM_QUEUE_STATUSES)', () => {
    expect(
      Object.fromEntries(
        CLAIM_QUEUES.map((queue) => [queue.queue, queue.statuses]),
      ),
    ).toEqual({
      notification: ['DRAFT', 'NOTIFICATION_SUBMITTED', 'NOTIFICATION_FAILED'],
      intimation: [
        'NOTIFICATION_ACCEPTED',
        'INTIMATION_PENDING',
        'INTIMATION_SUBMITTED',
        'INTIMATION_FAILED',
      ],
      assessment: [
        'INTIMATED',
        'ASSESSMENT_PENDING',
        'UNDER_ASSESSMENT',
        'ASSESSED',
        'REASSESSMENT_REQUIRED',
        'PENDING_APPROVAL',
        'REOPENED',
      ],
      discharge: [
        'APPROVED',
        'DISCHARGE_PENDING',
        'DISCHARGE_ISSUED',
        'DISCHARGE_REJECTED',
      ],
      payment: [
        'DISCHARGE_ACCEPTED',
        'PAYMENT_PENDING',
        'PARTIALLY_PAID',
        'PAID',
      ],
      rejection: ['REJECTION_PENDING', 'REJECTED'],
    });
  });

  it('only uses known statuses and resolves unknown queues to null', () => {
    for (const queue of CLAIM_QUEUES) {
      for (const status of queue.statuses) {
        expect(CLAIM_STATUSES).toContain(status);
      }
    }
    expect(getClaimQueueMeta('payment')?.label).toBe('Claim Payment');
    expect(getClaimQueueMeta('settlement')).toBeNull();
  });
});

function validValues(
  overrides: Partial<ClaimFormValues> = {},
): ClaimFormValues {
  return {
    ...defaultClaimValues(),
    policy_id: 'policy-1',
    policy_risk_id: 'risk-1',
    loss_date: '2026-09-01T08:30',
    claim_report_date: '2026-09-02T10:00',
    loss_nature: 'Collision',
    loss_type: 'Own damage',
    loss_location: 'Morogoro Road',
    description: 'Rear-ended at the traffic lights.',
    claimants: [policyholderClaimant(true)],
    ...overrides,
  };
}

describe('claim wizard schema', () => {
  it('accepts a complete claim', () => {
    expect(claimFormSchema.safeParse(validValues()).success).toBe(true);
  });

  it('requires a policy, the TIRA loss fields and at least one claimant', () => {
    const result = claimFormSchema.safeParse(
      validValues({ policy_id: '', loss_nature: '', claimants: [] }),
    );
    const paths = result.success
      ? []
      : result.error.issues.map((issue) => issue.path.join('.'));
    expect(paths).toEqual(
      expect.arrayContaining(['policy_id', 'loss_nature', 'claimants']),
    );
  });

  it('needs a name for a claimant that is not the policyholder', () => {
    const result = claimFormSchema.safeParse(
      validValues({ claimants: [emptyClaimant({ is_primary: true })] }),
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(['claimants', 0, 'full_name']);
  });

  it('rejects a report date before the loss date', () => {
    const result = claimFormSchema.safeParse(
      validValues({ claim_report_date: '2026-08-31T10:00' }),
    );
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain(
      'claim_report_date',
    );
  });

  it('checks claimant formats (country code, email)', () => {
    const result = claimFormSchema.safeParse(
      validValues({
        claimants: [
          emptyClaimant({
            is_primary: true,
            full_name: 'Juma Hassan',
            country_code: 'tz',
            email: 'not-an-email',
          }),
        ],
      }),
    );
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual([
      'claimants.0.country_code',
      'claimants.0.email',
    ]);
  });
});

describe('lossDateProblem', () => {
  it('mirrors the backend loss date rules', () => {
    expect(lossDateProblem('2999-01-01T00:00', '2999-01-02T00:00')?.field).toBe(
      'loss_date',
    );
    expect(lossDateProblem('2026-09-02T00:00', '2026-09-01T00:00')?.field).toBe(
      'claim_report_date',
    );
    expect(lossDateProblem('2026-09-01T00:00', '2026-09-01T00:00')).toBeNull();
  });
});

describe('claim payloads', () => {
  it('sends only the role for a policyholder claimant', () => {
    const payload = toCreatePayload(validValues());
    expect(payload.claimants).toEqual([
      {
        claimant_type: 'POLICYHOLDER',
        uses_policyholder: true,
        is_primary: true,
        amount_claimed: undefined,
      },
    ]);
  });

  it('maps a manual claimant to the TIRA identity fields', () => {
    const payload = toCreatePayload(
      validValues({
        claimants: [
          emptyClaimant({
            is_primary: true,
            full_name: ' Juma Hassan ',
            claimant_category: '2',
            party_type: '1',
            id_type: '1',
            identification_number: '19900101-12345-00001-12',
            gender: 'M',
            district: 'Ilala',
            phone: '255713000000',
          }),
        ],
      }),
    );
    expect(payload.claimants[0]).toMatchObject({
      claimant_type: 'THIRD_PARTY',
      full_name: 'Juma Hassan',
      claimant_category: 2,
      party_type: 1,
      id_type: 1,
      gender: 'M',
      country_code: 'TZA',
      district: 'Ilala',
      region: undefined,
    });
  });

  it('sends ISO timestamps and drops empty incident details', () => {
    const payload = toCreatePayload(
      validValues({ incident_details: { driver_name: 'Asha', repairer: ' ' } }),
    );
    expect(payload.loss_date).toBe(new Date('2026-09-01T08:30').toISOString());
    expect(payload.incident_details).toEqual({ driver_name: 'Asha' });
    expect(payload.estimated_amount).toBeUndefined();
  });

  it('round-trips a saved draft into the edit form', () => {
    const claim = {
      id: 'claim-1',
      claim_no: 'CLM-2026-00001',
      status: 'DRAFT',
      policy_id: 'policy-1',
      policy_risk_id: 'risk-1',
      loss_date: '2026-09-01T05:30:00.000Z',
      claim_report_date: '2026-09-02T07:00:00.000Z',
      loss_nature: 'Collision',
      loss_type: 'Own damage',
      loss_location: 'Morogoro Road',
      description: 'Rear-ended',
      claim_form_dully_filled: 'Y',
      estimated_amount: '0.00',
      priority: 'HIGH',
      incident_details: { driver_name: 'Asha' },
      claimants: [
        {
          id: 'c-1',
          claimant_type: 'POLICYHOLDER',
          uses_policyholder: true,
          is_primary: true,
          full_name: 'Asha Juma',
          claimant_category: 1,
          party_type: 1,
          id_type: 1,
          identification_number: '123',
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
          amount_claimed: '0.00',
          status: 'ACTIVE',
        },
      ],
    } as unknown as ClaimDetail;

    const values = valuesFromClaim(claim);
    expect(values).toMatchObject({
      policy_id: 'policy-1',
      loss_date: toDateTimeLocal('2026-09-01T05:30:00.000Z'),
      claim_form_dully_filled: true,
      estimated_amount: '',
      priority: 'HIGH',
      incident_details: { driver_name: 'Asha' },
    });
    expect(values.claimants[0]).toMatchObject({
      id: 'c-1',
      uses_policyholder: true,
      claimant_category: '1',
      amount_claimed: '',
    });
    expect(fromDateTimeLocal(values.loss_date)).toBe(
      '2026-09-01T05:30:00.000Z',
    );
  });
});

describe('claimErrorLines', () => {
  const apiError = (status: number, error: Record<string, unknown>) =>
    new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
      status,
      statusText: '',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: {
        success: false,
        error,
        meta: {
          requestId: 'r',
          correlationId: 'c',
          timestamp: '',
          method: 'POST',
          path: '/',
          statusCode: status,
          contractVersion: '1',
        },
      },
    });

  it('lists the TIRAMIS rule failures under the headline', () => {
    const result = claimErrorLines(
      apiError(400, {
        code: 'CLAIM_TIRAMIS_PAYLOAD_INVALID',
        message: 'Claim notification CLN-1 is not ready for TIRAMIS',
        errors: [{ message: 'lossDate must not be after claimReportDate' }],
      }),
    );
    expect(result.code).toBe('CLAIM_TIRAMIS_PAYLOAD_INVALID');
    expect(result.lines).toEqual([
      'lossDate must not be after claimReportDate',
    ]);
  });

  it('reads nested detail lists and the duplicate reference', () => {
    const incomplete = claimErrorLines(
      apiError(422, {
        code: 'CLAIMANT_DETAILS_INCOMPLETE',
        message: 'Complete the claimant details required by TIRAMIS',
        details: { details: ['Juma is missing ID type, district'] },
      }),
    );
    expect(incomplete.lines).toEqual(['Juma is missing ID type, district']);

    const duplicate = claimErrorLines(
      apiError(409, {
        code: 'CLAIM_POSSIBLE_DUPLICATE',
        message: 'This looks like claim CLM-2026-00001.',
        details: {
          duplicate_of: { id: 'claim-1', claim_no: 'CLM-2026-00001' },
        },
      }),
    );
    expect(duplicate.details?.duplicate_of).toEqual({
      id: 'claim-1',
      claim_no: 'CLM-2026-00001',
    });
  });
});
