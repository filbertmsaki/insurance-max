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
import { engagementApi } from '@/modules/tenant/engagement/api';
import { claimsApi } from '../api';
import { DocumentsTab } from '../pages/detail/DocumentsTab';
import { RejectionTab } from '../pages/detail/RejectionTab';
import { rejectionDefaults, rejectionSchema } from '../stage-schemas';
import type { ClaimDetail } from '../types';

vi.mock('@/modules/shared/auth/store/auth.store', () => ({
  useAuthStore: (
    select: (state: { hasPermission: () => boolean }) => unknown,
  ) => select({ hasPermission: () => true }),
}));

vi.mock('../api', () => ({
  claimsApi: {
    createRejection: vi.fn(),
    submitRejectionToTiramis: vi.fn(),
    documents: vi.fn(),
    createDocumentUploadSession: vi.fn(),
    linkDocument: vi.fn(),
    verifyDocument: vi.fn(),
  },
}));

vi.mock('@/modules/tenant/engagement/api', () => ({
  engagementApi: {
    completeUploadSession: vi.fn(),
    downloadDocument: vi.fn(),
  },
}));

const api = vi.mocked(claimsApi);
const registry = vi.mocked(engagementApi);

function claim(overrides: Partial<ClaimDetail>): ClaimDetail {
  return {
    id: 'claim-1',
    claim_no: 'CLM-2026-00001',
    status: 'ASSESSMENT_PENDING',
    currency_code: 'TZS',
    estimated_amount: '1200000.00',
    paid_amount: '0.00',
    intimations: [],
    rejections: [],
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

describe('rejection form (§14.1)', () => {
  it('limits the TIRA rejection reason to 100 characters', () => {
    const result = rejectionSchema.safeParse({
      ...rejectionDefaults('1000'),
      rejection_reason: 'Loss excluded by the policy',
      tira_rejection_reason: 'x'.repeat(101),
    });
    expect(result.error?.issues[0].path).toEqual(['tira_rejection_reason']);
  });
});

describe('RejectionTab', () => {
  beforeEach(() => vi.clearAllMocks());

  it('recommends a rejection with a separate TIRA reason', async () => {
    api.createRejection.mockResolvedValue({} as never);
    render(
      wrap(
        <RejectionTab
          claim={claim({
            allowed_actions: ['reject'],
            intimations: [{ id: 'i-1', status: 'ACCEPTED' }] as never,
          })}
        />,
      ),
    );

    fireEvent.click(
      screen.getByRole('button', { name: /Recommend rejection/ }),
    );
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Reason for rejection/), {
      target: { value: 'The driver was unlicensed at the time of loss.' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Reason reported to TIRA/), {
      target: { value: 'Unlicensed driver' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Submit for approval' }),
    );

    await waitFor(() =>
      expect(api.createRejection).toHaveBeenCalledWith(
        'claim-1',
        expect.objectContaining({
          tira_rejection_reason: 'Unlicensed driver',
          claim_amount: '1200000.00',
          claim_resulted_litigation: false,
        }),
      ),
    );
  });

  it('explains that a rejection before intimation is not reported', () => {
    render(
      wrap(
        <RejectionTab
          claim={claim({
            status: 'REJECTED',
            rejections: [
              {
                id: 'r-1',
                claim_rejection_number: 'CRJ-2026-00001',
                status: 'APPROVED',
                tira_rejection_reason: 'Late notification',
                claim_intimation_number: null,
              },
            ],
          })}
        />,
      ),
    );

    expect(
      screen.getByText(/rejected before\s+intimation/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Send to TIRA/ })).toBeNull();
  });

  it('sends an approved, intimated rejection to TIRA', async () => {
    api.submitRejectionToTiramis.mockResolvedValue({});
    render(
      wrap(
        <RejectionTab
          claim={claim({
            status: 'REJECTED',
            rejections: [
              {
                id: 'r-1',
                claim_rejection_number: 'CRJ-2026-00001',
                status: 'APPROVED',
                claim_intimation_number: 'INT-1',
              },
            ],
          })}
        />,
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: /Send to TIRA/ }));
    await waitFor(() =>
      expect(api.submitRejectionToTiramis).toHaveBeenCalledWith('r-1', false),
    );
  });
});

describe('DocumentsTab', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uploads a required document through the registry and links it', async () => {
    api.documents.mockResolvedValue({
      documents: [],
      requirements: [
        {
          id: 'req-1',
          claim_stage: 'NOTIFICATION',
          document_type: 'POLICE_REPORT',
          title: 'Police report',
          is_mandatory: true,
          satisfied: false,
          verified: false,
        },
      ],
    });
    api.createDocumentUploadSession.mockResolvedValue({
      id: 's-1',
      token: 'token-1',
    });
    registry.completeUploadSession.mockResolvedValue({ id: 'doc-1' } as never);
    api.linkDocument.mockResolvedValue({ title: 'Police report' } as never);

    render(wrap(<DocumentsTab claim={claim({})} />));

    expect(
      await screen.findByText(/1 required document is still missing/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
    const dialog = await screen.findByRole('dialog');
    const file = new File(['scan'], 'police.pdf', { type: 'application/pdf' });
    fireEvent.change(within(dialog).getByLabelText(/^File/), {
      target: { files: [file] },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Upload' }));

    const details = {
      document_type: 'POLICE_REPORT',
      title: 'Police report',
      claim_stage: 'NOTIFICATION',
      requirement_code: 'POLICE_REPORT',
    };
    await waitFor(() =>
      expect(api.linkDocument).toHaveBeenCalledWith('claim-1', {
        ...details,
        document_id: 'doc-1',
      }),
    );
    expect(api.createDocumentUploadSession).toHaveBeenCalledWith(
      'claim-1',
      details,
    );
    expect(registry.completeUploadSession).toHaveBeenCalledWith(
      'token-1',
      file,
    );
  });
});
