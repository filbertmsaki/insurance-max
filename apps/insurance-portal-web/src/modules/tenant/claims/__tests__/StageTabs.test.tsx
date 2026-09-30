import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { claimsApi } from '../api';
import { AssessmentTab } from '../pages/detail/AssessmentTab';
import { IntimationTab } from '../pages/detail/IntimationTab';
import type { ClaimClaimant, ClaimDetail } from '../types';

vi.mock('@/modules/shared/auth/store/auth.store', () => ({
  useAuthStore: (
    select: (state: { hasPermission: () => boolean }) => unknown,
  ) => select({ hasPermission: () => true }),
}));

vi.mock('../api', () => ({
  claimsApi: {
    createIntimation: vi.fn(),
    submitIntimation: vi.fn(),
    approveAssessment: vi.fn(),
    declineAssessment: vi.fn(),
  },
}));

const api = vi.mocked(claimsApi);

const claimant: ClaimClaimant = {
  id: 'c-1',
  claimant_type: 'POLICYHOLDER',
  full_name: 'Asha Juma',
  claimant_category: 1,
  party_type: 1,
  id_type: 1,
  identification_number: '123',
  birth_date: null,
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

function claim(overrides: Partial<ClaimDetail>): ClaimDetail {
  return {
    id: 'claim-1',
    claim_no: 'CLM-2026-00001',
    claim_reference_number: 'TIRA-CLM-1',
    status: 'NOTIFICATION_ACCEPTED',
    currency_code: 'TZS',
    claimants: [claimant],
    intimations: [],
    assessments: [],
    approvals: [],
    regulatory_operations: [],
    allowed_actions: [],
    user_names: {},
    ...overrides,
  } as ClaimDetail;
}

function wrap(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('IntimationTab', () => {
  beforeEach(() => vi.clearAllMocks());

  it('prepares an intimation with the reserve and assessor', async () => {
    api.createIntimation.mockResolvedValue({ id: 'int-1' } as never);
    render(
      wrap(
        <IntimationTab
          claim={claim({ allowed_actions: ['create_intimation'] })}
        />,
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: /Prepare intimation/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Reserve amount/), {
      target: { value: '1200000' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Assessor name/), {
      target: { value: 'Bima Adjusters' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Assessor ID number/), {
      target: { value: 'ADJ-77' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Prepare intimation' }),
    );

    // The assessor ID type is a required select left empty.
    expect(
      await within(dialog).findByText('Choose the assessor ID type'),
    ).toBeInTheDocument();
    expect(api.createIntimation).not.toHaveBeenCalled();
  });

  it('blocks submission until every claimant has the TIRA fields', () => {
    render(
      wrap(
        <IntimationTab
          claim={claim({
            status: 'INTIMATION_PENDING',
            allowed_actions: ['submit_intimation'],
            claimants: [{ ...claimant, district: null }],
            intimations: [
              {
                id: 'int-1',
                claim_intimation_number: 'INT-2026-00001',
                status: 'DRAFT',
                claim_reserve_amount: '1200000',
                currency_code: 'TZS',
                loss_assessment_option: 1,
                assessor_name: 'Jane',
                assessor_id_type: 1,
                assessor_id_number: '1',
              },
            ],
          })}
        />,
      ),
    );

    expect(
      screen.getByText(/Asha Juma is missing district/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Submit to TIRA/ }),
    ).toBeDisabled();
  });
});

describe('AssessmentTab', () => {
  beforeEach(() => vi.clearAllMocks());

  it('approves a submitted assessment and reports the pending level', async () => {
    api.approveAssessment.mockResolvedValue({ completed: false });
    render(
      wrap(
        <AssessmentTab
          claim={claim({
            status: 'PENDING_APPROVAL',
            assessments: [
              {
                id: 'asm-1',
                claim_assessment_number: 'ASM-2026-00001',
                status: 'SUBMITTED',
                is_re_assessment: 'N',
                assessment_amount: '1000000',
                approved_claim_amount: '900000',
                assessment_report_summary: 'Front bumper replaced',
              },
            ],
            approvals: [
              {
                id: 'ap-1',
                subject_type: 'ASSESSMENT',
                subject_id: 'asm-1',
                approval_type: 'ASSESSMENT',
                round: 1,
                level: 1,
                required_levels: 2,
                amount: '900000',
                currency_code: 'TZS',
                status: 'PENDING',
                comments: null,
                submitted_by: 'u-1',
                acted_by: null,
                acted_at: null,
                admin_override: null,
              },
            ],
            user_names: { 'u-1': 'Jane Officer' },
          })}
        />,
      ),
    );

    expect(screen.getByText('Level 1 of 2 pending')).toBeInTheDocument();
    expect(screen.getByText('Submitted by Jane Officer')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Comments'), {
      target: { value: 'Within authority' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));

    await waitFor(() =>
      expect(api.approveAssessment).toHaveBeenCalledWith(
        'asm-1',
        'Within authority',
      ),
    );
  });

  it('requires a reason to decline', async () => {
    render(
      wrap(
        <AssessmentTab
          claim={claim({
            status: 'PENDING_APPROVAL',
            assessments: [
              {
                id: 'asm-1',
                claim_assessment_number: 'ASM-2026-00001',
                status: 'SUBMITTED',
                assessment_amount: '1000000',
                approved_claim_amount: '900000',
              },
            ],
          })}
        />,
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Decline or return' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Decline' }));

    expect(
      within(dialog).getByText('Give a reason for the decision.'),
    ).toBeInTheDocument();
    expect(api.declineAssessment).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText(/Reason/), {
      target: { value: 'Photos missing' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Return for rework' }),
    );
    await waitFor(() =>
      expect(api.declineAssessment).toHaveBeenCalledWith('asm-1', {
        comments: 'Photos missing',
        decision: 'RETURN',
      }),
    );
  });
});
