import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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
const stepButton = (index: number) => {
  const nav = screen.getByRole('navigation', { name: 'Setup progress' });
  let button = within(nav).queryByRole('button', {
    name: new RegExp('^' + index + '\\. Synthetic step ' + index),
  });
  if (!button) {
    const stage =
      index <= 2
        ? 'Company and book'
        : index <= 5
          ? 'Accounting basics'
          : index <= 8
            ? 'Accounts and policies'
            : 'Review and finish';
    fireEvent.click(
      within(nav).getByRole('button', { name: new RegExp(stage) }),
    );
    button = within(nav).getByRole('button', {
      name: new RegExp(
        '^' + index + '\\. Synthetic step ' + index,
      ),
    });
  }
  return button;
};
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
  localStorage.clear();
  useAuthStore.setState({
    user: null,
    authorizationContext: null,
    accessToken: null,
  });
});

it('shows book management for a company session with release permission', async () => {
  useAuthStore.setState({
    authorizationContext: {
      ...context,
      permissions: [...context.permissions, 'finance-foundation:release'],
    },
  });
  mount();
  const bookSection = await screen.findByRole('region', {
    name: 'Accounting book management',
  });
  expect(
    within(bookSection).getByLabelText('Accounting book'),
  ).toBeInTheDocument();
  expect(
    within(bookSection).getByRole('button', { name: 'Create another book' }),
  ).toBeInTheDocument();
  expect(
    within(bookSection).getByRole('button', { name: 'Archive selected book' }),
  ).toBeInTheDocument();
  fireEvent.click(
    within(bookSection).getByRole('button', { name: 'Create another book' }),
  );
  expect(
    within(bookSection).getByLabelText('Code for the new book'),
  ).toHaveValue('');
  expect(
    within(bookSection).queryByLabelText('New code for the selected book'),
  ).not.toBeInTheDocument();
  fireEvent.click(
    within(bookSection).getByRole('button', { name: 'Rename selected book' }),
  );
  expect(
    within(bookSection).getByLabelText('New code for the selected book'),
  ).toHaveValue(scope.book_code);
  expect(
    within(bookSection).queryByLabelText('Code for the new book'),
  ).not.toBeInTheDocument();
});
describe('Scoped company setup workspace', () => {
  it('shows every step and lets users reopen previously reviewed answers', async () => {
    const overview = makeOverview();
    overview.steps[0].complete = true;
    overview.steps[0].latest = { ...summary, state: 'REVIEWED_INACTIVE' };
    api.overview.mockResolvedValue(overview);
    api.detail.mockResolvedValue({ ...detail, state: 'REVIEWED_INACTIVE' });
    mount();
    await screen.findByRole('navigation', { name: 'Setup progress' });
    expect(
      screen.getByRole('button', { name: /Company and book/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Accounting basics/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Accounts and policies/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Review and finish/ }),
    ).toBeInTheDocument();
    expect(stepButton(1)).toHaveTextContent('Reviewed');
    fireEvent.click(stepButton(1));
    expect(
      screen.getByText(
        'Check your company, legal records and insurance products.',
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByLabelText('Legal entity and product perimeter'),
    ).toHaveValue('<img src=x onerror=alert(1)>');
  });
  it('opens company legal record editing for an authorized company user', async () => {
    useAuthStore.setState({
      authorizationContext: {
        ...context,
        permissions: [...context.permissions, 'update_company_data'],
      },
    });
    mount();
    fireEvent.mouseDown(
      await screen.findByRole('tab', { name: 'Company legal records' }),
      { button: 0 },
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit company details' }),
    );
    expect(screen.getByLabelText('Company name')).toHaveValue(
      'SYNTHETIC COMPANY',
    );
    expect(screen.getByLabelText('Accounting book')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Accounting book')).toBeEnabled();
  });
  it('navigates the existing setup steps and protects an unsaved draft', async () => {
    useAuthStore.setState({
      authorizationContext: {
        ...context,
        permissions: [...context.permissions, SETUP_PREPARE],
      },
    });
    mount();
    await screen.findByRole('navigation', { name: 'Setup progress' });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(stepButton(2)).toHaveAttribute('aria-current', 'step');
    fireEvent.click(screen.getByRole('button', { name: 'Start this step' }));
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    expect(screen.getByLabelText('Accounting book')).toBeDisabled();
    expect(
      screen.getByText('Save or cancel your changes before changing steps.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(stepButton(1)).toHaveAttribute('aria-current', 'step');
  });
  it('returns to the last visited step for the same user and book', async () => {
    const view = mount();
    await screen.findByRole('navigation', { name: 'Setup progress' });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    view.unmount();
    mount();
    await screen.findByRole('navigation', { name: 'Setup progress' });
    expect(stepButton(2)).toHaveAttribute('aria-current', 'step');
  });
  it('opens the first incomplete step when there is no saved browser position', async () => {
    const data = makeOverview();
    data.steps[0].complete = true;
    api.overview.mockResolvedValue(data);
    mount();
    await screen.findByRole('navigation', { name: 'Setup progress' });
    expect(stepButton(2)).toHaveAttribute('aria-current', 'step');
  });
  it('links review issues back to their setup step without implying activation', async () => {
    mount();
    await screen.findByRole('navigation', { name: 'Setup progress' });
    fireEvent.click(stepButton(10));
    expect(screen.getByText('Setup review summary')).toBeInTheDocument();
    expect(
      screen.getByText(/Completing it does not activate/),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: /1\. Synthetic step 1/ }),
    );
    expect(stepButton(1)).toHaveAttribute('aria-current', 'step');
  });
  it('returns to the chart step after visiting the existing configuration workspace', async () => {
    mount();
    await screen.findByRole('navigation', { name: 'Setup progress' });
    fireEvent.click(stepButton(6));
    fireEvent.click(
      screen.getByRole('button', { name: 'Open chart configuration' }),
    );
    expect(
      screen.getByText('Configuration and policy review'),
    ).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Setup steps' }), {
      button: 0,
    });
    expect(stepButton(6)).toHaveAttribute('aria-current', 'step');
  });
  it('shows ten incomplete steps and real missing-data states to a reader without write controls', async () => {
    mount();
    fireEvent.mouseDown(
      await screen.findByRole('tab', { name: 'Company legal records' }),
      { button: 0 },
    );
    await screen.findByText('SYNTHETIC COMPANY', { exact: false });
    expect(screen.getByText('Licence: Not supplied')).toBeInTheDocument();
    expect(screen.getByText(/0 of 10 steps/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Start this step' }),
    ).not.toBeInTheDocument();
    fireEvent.mouseDown(
      screen.getByRole('tab', { name: 'Configurations and policies' }),
      { button: 0 },
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
      await screen.findByRole('button', { name: 'Start this step' }),
    );
    fireEvent.change(screen.getByLabelText('Reason for this change'), {
      target: { value: 'Automated test draft only' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
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
  it('generates monthly periods for the selected financial year without replacing them', async () => {
    useAuthStore.setState({
      authorizationContext: {
        ...context,
        permissions: [...context.permissions, SETUP_PREPARE],
      },
    });
    mount();
    await screen.findByRole('navigation', { name: 'Setup progress' });
    fireEvent.click(stepButton(4));
    fireEvent.click(screen.getByRole('button', { name: 'Start this step' }));
    fireEvent.change(screen.getByLabelText(/Financial year-end/), {
      target: { value: '06-30' },
    });
    fireEvent.change(screen.getByLabelText('Financial year ending in'), {
      target: { value: '2027' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Generate 12 monthly periods' }),
    );
    expect(
      screen.getByLabelText('Starts on', { selector: '#setup-from-0' }),
    ).toHaveValue('2026-07-01');
    expect(
      screen.getByLabelText('Ends before', { selector: '#setup-to-11' }),
    ).toHaveValue('2027-07-01');
    expect(
      screen.getByRole('button', { name: 'Generate 12 monthly periods' }),
    ).toBeDisabled();
  });
  it('keeps functional currency and accounting basis blank despite a system TZS setting', async () => {
    useAuthStore.setState({
      authorizationContext: {
        ...context,
        permissions: [...context.permissions, SETUP_PREPARE],
      },
    });
    mount();
    await screen.findByRole('navigation', { name: 'Setup progress' });
    fireEvent.click(stepButton(3));
    fireEvent.click(screen.getByRole('button', { name: 'Start this step' }));
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
    expect(screen.getByText(/does not activate/)).toBeInTheDocument();
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
    await screen.findByText(/Checking company setup and evidence/);
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
