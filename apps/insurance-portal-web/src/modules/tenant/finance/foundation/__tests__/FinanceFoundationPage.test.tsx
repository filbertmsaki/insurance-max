import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { canAccessRoute } from '@/lib/auth/permissions';
import { NAV_NODES } from '@/components/layout/nav-config';
import { FinanceFoundationPage } from '../FinanceFoundationPage';
import { foundationReadApi, FOUNDATION_PATH } from '../api';
import {
  user,
  context,
  scope,
  secondScope,
  summary,
  document,
  uuid,
} from './fixtures';

vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api')>()),
  foundationReadApi: {
    scopes: vi.fn(),
    documents: vi.fn(),
    document: vi.fn(),
    readiness: vi.fn(),
  },
}));
const api = vi.mocked(foundationReadApi);
let client: QueryClient;
function mount() {
  return render(
    <QueryClientProvider client={client}>
      <FinanceFoundationPage />
    </QueryClientProvider>,
  );
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
beforeEach(() => {
  vi.resetAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  useAuthStore.setState({
    user,
    authorizationContext: context,
    accessToken: 'ui-fixture-only',
  });
  api.scopes.mockResolvedValue([scope]);
  api.documents.mockResolvedValue([]);
  api.document.mockResolvedValue(document);
});
afterEach(() => {
  client.clear();
  useAuthStore.setState({
    user: null,
    authorizationContext: null,
    accessToken: null,
  });
});

describe('Read-only foundation workspace', () => {
  it('checks only the selected reviewed context and hides stale results after denial', async () => {
    const reviewed = { ...summary, state: 'REVIEWED' as const };
    api.documents.mockResolvedValue([reviewed]);
    api.document.mockResolvedValue({ ...document, state: 'REVIEWED' });
    api.readiness
      .mockResolvedValueOnce({
        scope: {
          tenantId: scope.tenantId,
          legalEntityId: scope.legalEntityId,
          bookId: scope.bookId,
        },
        contextId: reviewed.id,
        contextHash: reviewed.subject_hash,
        acceptanceScope: 'FOUNDATION_ONLY',
        overallFinanceProductionAccepted: false,
        technicalAcceptance: false,
        productionEligible: false,
        blockers: ['B45_INDEPENDENT_TECHNICAL_ACCEPTANCE_REQUIRED'],
        policyActivation: false,
        financialEffects: 0,
      })
      .mockRejectedValueOnce({ response: { status: 403 } });
    mount();
    fireEvent.click(
      await screen.findByRole('button', { name: 'View CONTEXT-A' }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Check foundation readiness' }),
    );
    expect(
      await screen.findByText('B45_INDEPENDENT_TECHNICAL_ACCEPTANCE_REQUIRED'),
    ).toBeVisible();
    expect(api.readiness).toHaveBeenCalledWith(
      scope,
      reviewed,
      expect.any(AbortSignal),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Check foundation readiness' }),
    );
    expect(await screen.findByText(/Read access is unavailable/)).toBeVisible();
    expect(
      screen.queryByText('B45_INDEPENDENT_TECHNICAL_ACCEPTANCE_REQUIRED'),
    ).not.toBeInTheDocument();
  });
  it('offers the navigation entry only to a company user with the explicit read permission', () => {
    const finance = NAV_NODES.find(
      (n) => n.kind === 'group' && n.label === 'Finance',
    );
    if (!finance || finance.kind !== 'group')
      throw Error('Finance menu missing');
    const entry = finance.children.find((n) => n.to === FOUNDATION_PATH)!;
    const options = {
      requiredPermission: entry.permission,
      allowedScopes: entry.allowedScopes,
    };
    expect(canAccessRoute(user, options)).toBe(true);
    expect(canAccessRoute({ ...user, permissions: [] }, options)).toBe(false);
    expect(
      canAccessRoute({ ...user, scope: 'platform', roles: ['OWNER'] }, options),
    ).toBe(false);
    expect(canAccessRoute({ ...user, scope: 'customer' }, options)).toBe(false);
  });
  it('loads only authorized draft books and shows no inferred balances or policy approvals', async () => {
    mount();
    expect(
      await screen.findByText('No review documents available'),
    ).toBeVisible();
    expect(screen.getByText('Draft')).toBeVisible();
    expect(screen.getByLabelText('Accounting book')).toHaveValue(
      [scope.tenantId, scope.legalEntityId, scope.bookId].join('/'),
    );
    expect(api.documents).toHaveBeenCalledWith(
      scope,
      undefined,
      expect.any(AbortSignal),
    );
    expect(screen.queryByText('0.00')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: /approve|activate|post|prepare|create|save/i,
      }),
    ).not.toBeInTheDocument();
  });
  it('shows expired/unassigned access as no books, without requesting documents', async () => {
    api.scopes.mockResolvedValue([]);
    mount();
    expect(await screen.findByText('No Finance books available')).toBeVisible();
    expect(api.documents).not.toHaveBeenCalled();
  });
  it('shows loading without requesting any book data before scope resolution', async () => {
    api.scopes.mockReturnValue(new Promise(() => {}));
    mount();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Checking authorized Finance books',
    );
    expect(api.documents).not.toHaveBeenCalled();
  });
  it('does not call the API before the live authorization context is loaded', () => {
    useAuthStore.setState({ authorizationContext: null });
    mount();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Checking your current Finance access',
    );
    expect(api.scopes).not.toHaveBeenCalled();
  });
  it.each([
    { ...context, permissions: [] },
    { ...context, scope: 'platform' as const },
    { ...context, userId: uuid(90) },
    { ...context, companyId: uuid(90) },
    { ...context, companyMembershipId: uuid(90) },
  ])(
    'rejects a missing permission or mismatched live identity without role fallback',
    (value) => {
      useAuthStore.setState({ authorizationContext: value });
      mount();
      expect(screen.getByText('Finance read access required')).toBeVisible();
      expect(api.scopes).not.toHaveBeenCalled();
    },
  );
  it('opens only the selected version and preserves exact decimal strings and escaped text', async () => {
    api.documents.mockResolvedValue([summary]);
    mount();
    fireEvent.click(
      await screen.findByRole('button', { name: 'View CONTEXT-A' }),
    );
    expect(
      await screen.findByText(/9007199254740993\.010000000001/),
    ).toBeVisible();
    expect(api.document).toHaveBeenCalledWith(
      scope,
      summary,
      expect.any(AbortSignal),
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getAllByText('No decision recorded').length).toBe(2);
  });
  it('filters with the current book and a supported document kind', async () => {
    mount();
    await screen.findByText('No review documents available');
    fireEvent.change(screen.getByLabelText('Document type'), {
      target: { value: 'EXCHANGE_RATE' },
    });
    await waitFor(() =>
      expect(api.documents).toHaveBeenCalledWith(
        scope,
        'EXCHANGE_RATE',
        expect.any(AbortSignal),
      ),
    );
  });
  it('hides loaded documents and their detail after an access-denied refresh', async () => {
    api.documents
      .mockResolvedValueOnce([summary])
      .mockRejectedValue({ response: { status: 403 } });
    mount();
    fireEvent.click(
      await screen.findByRole('button', { name: 'View CONTEXT-A' }),
    );
    await screen.findByText(/9007199254740993/);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh documents' }));
    expect(
      await screen.findByText(
        'Read access is unavailable or has expired. Contact your company administrator.',
      ),
    ).toBeVisible();
    expect(screen.queryByText(/9007199254740993/)).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
  it('shows a failed scope request as an error rather than a valid empty book', async () => {
    api.scopes.mockRejectedValue({ response: { status: 503 } });
    mount();
    expect(
      await screen.findByText('Finance records unavailable'),
    ).toBeVisible();
    expect(
      screen.queryByText('No Finance books available'),
    ).not.toBeInTheDocument();
  });
  it('does not show a late document response from a previously selected book', async () => {
    const late = deferred<typeof document>();
    api.scopes.mockResolvedValue([scope, secondScope]);
    api.documents.mockResolvedValue([summary]);
    api.document.mockReturnValue(late.promise);
    mount();
    fireEvent.click(
      await screen.findByRole('button', { name: 'View CONTEXT-A' }),
    );
    await waitFor(() => expect(api.document).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText('Accounting book'), {
      target: {
        value: [
          secondScope.tenantId,
          secondScope.legalEntityId,
          secondScope.bookId,
        ].join('/'),
      },
    });
    await waitFor(() =>
      expect(api.documents).toHaveBeenCalledWith(
        secondScope,
        undefined,
        expect.any(AbortSignal),
      ),
    );
    await act(async () => {
      late.resolve(document);
    });
    expect(screen.queryByText(/9007199254740993/)).not.toBeInTheDocument();
  });
  it('clears previous company records immediately while the new scope request is pending', async () => {
    const next = deferred<(typeof scope)[]>();
    mount();
    await screen.findByText('No review documents available');
    api.scopes.mockReturnValue(next.promise);
    act(() =>
      useAuthStore.setState({
        user: { ...user, companyId: uuid(82), companyMembershipId: uuid(83) },
        authorizationContext: {
          ...context,
          companyId: uuid(82),
          companyMembershipId: uuid(83),
        },
      }),
    );
    expect(screen.queryByText('ENTITY-A')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Accounting book')).not.toBeInTheDocument();
    await act(async () => {
      next.resolve([secondScope]);
    });
    expect(await screen.findByText('ENTITY-B')).toBeVisible();
  });
  it('hides cached book data when read permission is revoked or authorization version changes', async () => {
    mount();
    await screen.findByText('No review documents available');
    act(() =>
      useAuthStore.setState({
        authorizationContext: { ...context, permissions: [] },
      }),
    );
    expect(screen.getByText('Finance read access required')).toBeVisible();
    expect(screen.queryByText('ENTITY-A')).not.toBeInTheDocument();
    api.scopes.mockReturnValue(new Promise(() => {}));
    act(() =>
      useAuthStore.setState({
        authorizationContext: { ...context, authorizationVersion: 3 },
      }),
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Checking authorized Finance books',
    );
    expect(screen.queryByText('ENTITY-A')).not.toBeInTheDocument();
  });
});
