import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { foundationReadApi } from '../../foundation/api';
import { FinanceSetupPage } from '../FinanceSetupPage';
import { setupApi, SETUP_PREPARE, SETUP_REVIEW } from '../api';
import {
  makeOverview,
  scope,
  user,
  context,
  summary,
  detail,
} from './fixtures';
vi.mock('../../foundation/api', async (original) => ({
  ...(await original<typeof import('../../foundation/api')>()),
  foundationReadApi: { scopes: vi.fn() },
}));
vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  setupApi: {
    overview: vi.fn(),
    detail: vi.fn(),
    create: vi.fn(),
    decide: vi.fn(),
    configuration: vi.fn(),
    createConfiguration: vi.fn(),
    decideConfiguration: vi.fn(),
    createSource: vi.fn(),
    sourceRead: vi.fn(),
    createPolicy: vi.fn(),
    policy: vi.fn(),
    decidePolicy: vi.fn(),
  },
}));
const api = vi.mocked(setupApi);
let client: QueryClient;
const mount = () =>
  render(
    <QueryClientProvider client={client}>
      <FinanceSetupPage />
    </QueryClientProvider>,
  );
beforeEach(() => {
  vi.resetAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  useAuthStore.setState({
    user,
    authorizationContext: context,
    accessToken: 'SYNTHETIC-UI-FIXTURE',
  });
  vi.mocked(foundationReadApi.scopes).mockResolvedValue([scope]);
  api.overview.mockResolvedValue(makeOverview());
  api.detail.mockResolvedValue(detail);
  api.create.mockResolvedValue({});
});
afterEach(() => {
  client.clear();
  useAuthStore.setState({
    user: null,
    authorizationContext: null,
    accessToken: null,
  });
});
describe('Scoped company setup workspace', () => {
  it('shows ten incomplete steps and real missing-data states to a reader without write controls', async () => {
    mount();
    await screen.findByText('SYNTHETIC COMPANY', { exact: false });
    expect(screen.getByText('Licence: Not supplied')).toBeInTheDocument();
    expect(screen.getByText(/0 of 10 steps/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Prepare first version/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Configurations and policies' }),
    );
    expect(
      screen.queryByLabelText('Prepared review file'),
    ).not.toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
  });
  it('does not fetch setup records for an unmatched company session', () => {
    useAuthStore.setState({
      authorizationContext: {
        ...context,
        companyId: '00000000-0000-4000-8000-000000000099',
      },
    });
    mount();
    expect(
      screen.getByText('Company Finance access required'),
    ).toBeInTheDocument();
    expect(api.overview).not.toHaveBeenCalled();
    expect(foundationReadApi.scopes).not.toHaveBeenCalled();
  });
  it('surfaces expired access without displaying invented completed steps', async () => {
    api.overview.mockRejectedValue({ response: { status: 403 } });
    mount();
    await screen.findByText('Finance setup could not be verified');
    expect(screen.getByText(/Your access has expired/)).toBeInTheDocument();
    expect(screen.queryByText(/0 of 10 steps/)).not.toBeInTheDocument();
  });
  it('prepares an explicitly incomplete draft without inventing company choices or dates', async () => {
    useAuthStore.setState({
      authorizationContext: {
        ...context,
        permissions: [...context.permissions, SETUP_PREPARE],
      },
    });
    mount();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Prepare first version' }),
    );
    fireEvent.change(screen.getByLabelText('Preparation reason'), {
      target: { value: 'Automated test draft only' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save next draft' }));
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(api.create.mock.calls[0]).toEqual([
      scope,
      expect.objectContaining({
        purpose: 'COMPANY_SETUP',
        step: 'G04-01',
        version: 1,
        effectiveFrom: null,
        effectiveTo: null,
        answers: {},
        dependencies: [],
        evidence: [],
      }),
      'Automated test draft only',
    ]);
    expect(api.decide).not.toHaveBeenCalled();
  });
  it('keeps functional currency and accounting basis blank despite a system TZS setting', async () => {
    useAuthStore.setState({
      authorizationContext: {
        ...context,
        permissions: [...context.permissions, SETUP_PREPARE],
      },
    });
    mount();
    fireEvent.change(await screen.findByLabelText('Setup step'), {
      target: { value: 'G04-03' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Prepare first version' }),
    );
    expect(screen.getByLabelText('Assessed functional currency')).toHaveValue(
      '',
    );
    expect(screen.getByLabelText('Accounting basis')).toHaveValue('');
  });
  it('labels demonstration evidence independently of company completion', async () => {
    api.overview.mockResolvedValue({
      ...makeOverview(),
      completionMeaning: 'DEMONSTRATION_ONLY',
    });
    mount();
    await screen.findByText('Demonstration evidence only');
    expect(screen.getByText(/does not activate policies/)).toBeInTheDocument();
  });
  it('does not offer independent review to the same subject or natural person', async () => {
    const data = makeOverview();
    data.steps[0].latest = { ...summary, state: 'SUBMITTED' };
    api.overview.mockResolvedValue(data);
    api.detail.mockResolvedValue({ ...detail, state: 'SUBMITTED' });
    useAuthStore.setState({
      authorizationContext: {
        ...context,
        permissions: [...context.permissions, SETUP_REVIEW],
      },
    });
    mount();
    await screen.findByText('Audit history');
    expect(
      screen.queryByRole('button', {
        name: 'Record independent inactive review',
      }),
    ).not.toBeInTheDocument();
  });
  it('renders saved markup as text and never interprets it as HTML', async () => {
    const data = makeOverview();
    data.steps[0].latest = summary;
    api.overview.mockResolvedValue(data);
    const view = mount();
    await screen.findByLabelText('Legal entity and product perimeter');
    expect(
      screen.getByLabelText('Legal entity and product perimeter'),
    ).toHaveValue('<img src=x onerror=alert(1)>');
    expect(view.container.querySelector('img')).toBeNull();
  });
  it('discards pending company data after logout', async () => {
    let resolve!: (v: ReturnType<typeof makeOverview>) => void;
    api.overview.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    mount();
    await screen.findByText('Checking company setup and evidence…');
    act(() =>
      useAuthStore.setState({
        user: null,
        authorizationContext: null,
        accessToken: null,
      }),
    );
    await act(async () => resolve(makeOverview()));
    expect(
      screen.queryByText('SYNTHETIC COMPANY', { exact: false }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('Company Finance access required'),
    ).toBeInTheDocument();
  });
});
