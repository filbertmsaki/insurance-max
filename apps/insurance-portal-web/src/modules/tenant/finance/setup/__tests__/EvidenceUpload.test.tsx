import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EvidenceUpload } from '../EvidenceUpload';
import { SetupFields } from '../SetupFields';
import type { SetupEvidence } from '../api';
import { makeOverview, scope, uuid } from './fixtures';

const create = vi.fn();
const complete = vi.fn();
vi.mock('@/modules/tenant/engagement/api', () => ({
  engagementApi: {
    createUploadSession: (...args: unknown[]) => create(...args),
    completeUploadSession: (...args: unknown[]) => complete(...args),
  },
}));
const identity = ['user', 'company', 'membership', 'session', '1'];
function wrap(node: React.ReactNode, client = new QueryClient()) {
  return render(
    <QueryClientProvider client={client}>{node}</QueryClientProvider>,
  );
}
beforeEach(() => {
  create.mockReset();
  complete.mockReset();
});
describe('Finance evidence', () => {
  it('explains an empty list and allows a book-scoped scanned document upload', async () => {
    create.mockResolvedValue({ token: 'token' });
    complete.mockResolvedValue({ id: 'doc' });
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    wrap(
      <EvidenceUpload scope={scope} identity={identity} canUpload />,
      client,
    );
    const file = new File(['evidence'], 'reconciliation.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(screen.getByLabelText('Upload supporting evidence'), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Upload evidence' }));
    await waitFor(() => expect(complete).toHaveBeenCalledWith('token', file));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        resource_type: 'FINANCE_SETUP',
        resource_id: scope.bookId,
        customer_visible: false,
        intermediary_visible: false,
      }),
    );
    await waitFor(() => expect(invalidate).toHaveBeenCalled());
    expect(await screen.findByText(/Evidence uploaded/)).toBeInTheDocument();
  });
  it('selects the exact available version and attaches it as population evidence', () => {
    const overview = makeOverview();
    const document = {
      id: uuid(101),
      title: 'Population report',
      status: 'AVAILABLE',
      version_id: uuid(102),
      version_number: 1,
      sha256_hash: 'a'.repeat(64),
      version_status: 'AVAILABLE',
    };
    overview.inventory.documents = [document];
    const change = vi.fn();
    wrap(
      <SetupFields
        step="G04-05"
        answers={{}}
        change={vi.fn()}
        overview={overview}
        disabled={false}
        evidence={[]}
        changeWithEvidence={change}
        scope={scope}
        identity={identity}
        canUploadEvidence={false}
      />,
    );
    fireEvent.change(screen.getByLabelText('Source population evidence'), {
      target: { value: document.version_id },
    });
    expect(change).toHaveBeenCalledWith(
      { populationEvidenceHash: document.sha256_hash },
      [
        {
          id: document.version_id,
          documentId: document.id,
          hash: document.sha256_hash,
          purpose: 'POPULATION',
        },
      ],
    );
  });
  it('explains why the source evidence selector is empty', () => {
    wrap(
      <SetupFields
        step="G04-05"
        answers={{}}
        change={vi.fn()}
        overview={makeOverview()}
        disabled={false}
        evidence={[]}
        changeWithEvidence={vi.fn()}
        scope={scope}
        identity={identity}
        canUploadEvidence={false}
      />,
    );
    expect(screen.getByLabelText('Source population evidence')).toBeDisabled();
    expect(
      screen.getByText(/No available supporting documents/),
    ).toBeInTheDocument();
  });
  it('keeps the chosen version distinct when documents have the same hash', () => {
    const overview = makeOverview();
    const hash = 'a'.repeat(64);
    overview.inventory.documents = [
      {
        id: uuid(101),
        title: 'First',
        status: 'AVAILABLE',
        version_id: uuid(102),
        version_number: 1,
        sha256_hash: hash,
        version_status: 'AVAILABLE',
      },
      {
        id: uuid(103),
        title: 'Second',
        status: 'AVAILABLE',
        version_id: uuid(104),
        version_number: 1,
        sha256_hash: hash,
        version_status: 'AVAILABLE',
      },
    ];
    function Editor() {
      const [answers, setAnswers] = useState<Record<string, unknown>>({});
      const [evidence, setEvidence] = useState<SetupEvidence[]>([]);
      return (
        <SetupFields
          step="G04-05"
          answers={answers}
          change={setAnswers}
          overview={overview}
          disabled={false}
          evidence={evidence}
          changeWithEvidence={(next, attachments) => {
            setAnswers(next);
            setEvidence(attachments);
          }}
          scope={scope}
          identity={identity}
          canUploadEvidence={false}
        />
      );
    }
    wrap(<Editor />);
    const field = screen.getByLabelText('Source population evidence');
    fireEvent.change(field, { target: { value: uuid(102) } });
    fireEvent.change(field, { target: { value: uuid(104) } });
    expect(field).toHaveValue(uuid(104));
    fireEvent.change(field, { target: { value: uuid(102) } });
    expect(field).toHaveValue(uuid(102));
  });
  it('does not offer upload without document permission', () => {
    wrap(
      <EvidenceUpload scope={scope} identity={identity} canUpload={false} />,
    );
    expect(
      screen.queryByRole('button', { name: 'Upload evidence' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Ask a document administrator/),
    ).toBeInTheDocument();
  });
});
