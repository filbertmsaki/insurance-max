import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChartDraftEditor } from '../ChartDraftEditor';
import { makeOverview, uuid } from './fixtures';

describe('Chart draft editor', () => {
  it('does not apply a predecessor response after the selected version changes', async () => {
    const overview = makeOverview();
    overview.inventory.configurations = [9, 10].map((n) => ({
      id: uuid(n),
      kind: 'ACCOUNT_ROLES',
      configuration_key: `CHART${n}`,
      version: 1,
      release_hash: 'a'.repeat(64),
      state: 'REVIEWED_INACTIVE',
      effective_from: '2026-01-01',
      effective_to: null,
    }));
    let resolve!: (value: { payload: Record<string, unknown> }) => void;
    const load = vi.fn(
      () =>
        new Promise<{ payload: Record<string, unknown> }>((done) => {
          resolve = done;
        }),
    );
    render(
      <ChartDraftEditor
        overview={overview}
        submit={vi.fn()}
        loadPredecessor={load}
      />,
    );
    fireEvent.click(screen.getByText('Prepare chart of accounts'));
    fireEvent.change(
      screen.getByLabelText('Supersede reviewed chart (optional)'),
      { target: { value: uuid(9) } },
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Load reviewed chart accounts and roles',
      }),
    );
    fireEvent.change(
      screen.getByLabelText('Supersede reviewed chart (optional)'),
      { target: { value: uuid(10) } },
    );
    await act(async () =>
      resolve({
        payload: {
          schema: 'FINANCE_CHART_SNAPSHOT_V1',
          proposal: {
            schema: 'FINANCE_CHART_V1',
            chartCode: 'STALE',
            supportedProfiles: ['INSURER'],
            accounts: [],
            roles: [],
          },
        },
      }),
    );
    expect(screen.getByLabelText('Chart code')).toHaveValue('');
    expect(screen.getByLabelText('Configuration key')).toHaveValue('CHART10');
  });
  it('loads the exact reviewed predecessor without carrying source dispositions', async () => {
    const overview = makeOverview();
    const previous = {
      id: uuid(9),
      kind: 'ACCOUNT_ROLES',
      configuration_key: 'PREVIOUS',
      version: 3,
      release_hash: 'a'.repeat(64),
      state: 'REVIEWED_INACTIVE',
      effective_from: '2026-01-01',
      effective_to: null,
    };
    overview.inventory.configurations = [previous];
    const load = vi
      .fn()
      .mockResolvedValue({
        payload: {
          schema: 'FINANCE_CHART_SNAPSHOT_V1',
          proposal: {
            schema: 'FINANCE_CHART_V1',
            chartCode: 'EXISTING',
            supportedProfiles: ['INSURER'],
            accounts: [
              {
                code: '1100',
                name: 'Cash',
                type: 'ASSET',
                normalBalance: 'DR',
                posting: true,
                control: false,
                parentCode: null,
              },
            ],
            roles: [
              {
                code: 'BANK',
                accountCode: '1100',
                accountType: 'ASSET',
                requiredDimensions: ['BOOK'],
                dependencyRefs: ['DEC-01'],
              },
            ],
            legacy: {
              mode: 'SCOPED_INVENTORY',
              sourceMapId: uuid(10),
              dispositions: [],
            },
          },
        },
      });
    render(
      <ChartDraftEditor
        overview={overview}
        submit={vi.fn()}
        loadPredecessor={load}
      />,
    );
    fireEvent.click(screen.getByText('Prepare chart of accounts'));
    fireEvent.change(
      screen.getByLabelText('Supersede reviewed chart (optional)'),
      { target: { value: previous.id } },
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Load reviewed chart accounts and roles',
      }),
    );
    expect(await screen.findByDisplayValue('Cash')).toBeInTheDocument();
    expect(load).toHaveBeenCalledWith(previous);
    expect(screen.getByLabelText('Source association')).toHaveValue('');
    expect(screen.getByLabelText('Reason source is unbound')).toHaveValue('');
  });
  it('selects only a reviewed chart as a predecessor and advances its version', () => {
    const overview = makeOverview();
    overview.inventory.configurations = [
      {
        id: uuid(9),
        kind: 'ACCOUNT_ROLES',
        configuration_key: 'PREVIOUS',
        version: 3,
        release_hash: 'a'.repeat(64),
        state: 'REVIEWED_INACTIVE',
        effective_from: '2026-01-01',
        effective_to: null,
      },
    ];
    render(<ChartDraftEditor overview={overview} submit={vi.fn()} />);
    fireEvent.click(screen.getByText('Prepare chart of accounts'));
    fireEvent.change(
      screen.getByLabelText('Supersede reviewed chart (optional)'),
      { target: { value: uuid(9) } },
    );
    expect(screen.getByLabelText('Configuration key')).toHaveValue('PREVIOUS');
    expect(screen.getByLabelText('Version')).toHaveValue(4);
  });
  it('shows only compatible assigned roles for a proposed source account mapping', () => {
    const overview = makeOverview();
    overview.inventory.sourceMaps = [
      {
        id: uuid(1),
        source_system: 'INSURANCE_PORTAL_FINANCE',
        source_company_id: uuid(2),
        legal_role: 'INSURER',
        mapping_version: 1,
        hash: 'a'.repeat(64),
      },
    ];
    overview.inventory.accounts = [
      {
        id: uuid(3),
        account_code: '100',
        account_name: 'Legacy cash',
        account_type: 'ASSET',
        is_active: true,
        is_control_account: false,
      },
    ];
    render(<ChartDraftEditor overview={overview} submit={vi.fn()} />);
    fireEvent.click(screen.getByText('Prepare chart of accounts'));
    fireEvent.change(screen.getByLabelText('Source association'), {
      target: { value: uuid(1) },
    });
    fireEvent.change(screen.getByLabelText('Disposition for 100'), {
      target: { value: 'PROPOSED' },
    });
    expect(screen.getByLabelText('Target role for 100')).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Select a role' }),
    ).toBeInTheDocument();
  });
  it('submits an inactive scoped chart with explicit unbound source and no default account or role', () => {
    const submit = vi.fn();
    const overview = makeOverview();
    overview.inventory.sourceMaps = [
      {
        id: uuid(1),
        source_system: 'INSURANCE_PORTAL_FINANCE',
        source_company_id: uuid(2),
        legal_role: 'INSURER',
        mapping_version: 1,
        hash: 'a'.repeat(64),
      },
    ];
    overview.inventory.accounts = [
      {
        id: uuid(3),
        account_code: '100',
        account_name: 'Legacy cash',
        account_type: 'ASSET',
        is_active: true,
        is_control_account: false,
      },
    ];
    const { rerender } = render(
      <ChartDraftEditor overview={overview} submit={submit} />,
    );
    fireEvent.click(screen.getByText('Prepare chart of accounts'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Create inactive chart draft' }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent('at least one account');
    expect(submit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Configuration key'), {
      target: { value: 'AICL' },
    });
    fireEvent.change(screen.getByLabelText('Chart code'), {
      target: { value: 'CHART' },
    });
    fireEvent.change(screen.getByLabelText('Effective from'), {
      target: { value: '2026-01-01' },
    });
    fireEvent.change(screen.getByLabelText('Reason source is unbound'), {
      target: { value: 'Source evidence pending' },
    });
    fireEvent.change(screen.getByLabelText('Preparation reason'), {
      target: { value: 'Prepare for review' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add account' }));
    fireEvent.change(screen.getByLabelText('Account code'), {
      target: { value: '1100' },
    });
    fireEvent.change(screen.getByLabelText('Account name'), {
      target: { value: 'Cash' },
    });
    fireEvent.change(screen.getByLabelText('Account type'), {
      target: { value: 'ASSET' },
    });
    fireEvent.change(screen.getByLabelText('Normal balance'), {
      target: { value: 'DR' },
    });
    fireEvent.click(screen.getByLabelText('Posting account'));
    fireEvent.click(screen.getByRole('button', { name: 'Add role' }));
    fireEvent.change(screen.getByLabelText('Role code'), {
      target: { value: 'BANK' },
    });
    fireEvent.change(screen.getByLabelText('Role type'), {
      target: { value: 'ASSET' },
    });
    fireEvent.change(screen.getByLabelText('Assigned posting account'), {
      target: { value: '1100' },
    });
    fireEvent.change(
      screen.getByLabelText('Required dimensions (comma separated)'),
      { target: { value: 'TENANT, BOOK' } },
    );
    fireEvent.change(
      screen.getByLabelText('Decision references (comma separated)'),
      { target: { value: 'DEC-05' } },
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Create inactive chart draft' }),
    );
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'ACCOUNT_ROLES',
        payload: expect.objectContaining({
          schema: 'FINANCE_CHART_V1',
          legacy: { mode: 'UNBOUND', reason: 'Source evidence pending' },
          roles: [
            expect.objectContaining({
              code: 'BANK',
              accountCode: '1100',
              requiredDimensions: ['TENANT', 'BOOK'],
            }),
          ],
        }),
      }),
      'Prepare for review',
    );
    fireEvent.change(screen.getByLabelText('Source association'), {
      target: { value: uuid(1) },
    });
    fireEvent.change(screen.getByLabelText('Disposition for 100'), {
      target: { value: 'PROPOSED' },
    });
    fireEvent.change(screen.getByLabelText('Target role for 100'), {
      target: { value: 'BANK' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Create inactive chart draft' }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'reason for every source-account',
    );
    fireEvent.change(screen.getByLabelText('Reason for 100'), {
      target: { value: 'Reviewed source account mapping' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Create inactive chart draft' }),
    );
    expect(submit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          legacy: expect.objectContaining({
            mode: 'SCOPED_INVENTORY',
            dispositions: [
              {
                sourceAccountId: uuid(3),
                state: 'PROPOSED',
                roleCode: 'BANK',
                reason: 'Reviewed source account mapping',
              },
            ],
          }),
        }),
      }),
      'Prepare for review',
    );
    overview.inventory.accounts[0].is_active = false;
    rerender(<ChartDraftEditor overview={overview} submit={submit} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Create inactive chart draft' }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'active, non-quarantined source',
    );
    expect(submit).toHaveBeenCalledTimes(2);
  });
});
