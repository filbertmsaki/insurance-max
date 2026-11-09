import appSource from '../../../../App.tsx?raw';
import { act, render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { APP_NAME } from '@/modules/shared/config';
import { claimsPaths } from '@/modules/tenant/claims/paths';
import { underwritePaths } from '@/modules/tenant/underwrite/paths';
import { DocumentTitle } from '../DocumentTitle';
import { formatPageTitle, usePageTitle } from '../page-title';
import { routeTitleFor } from '../route-titles';

// Relative child paths only exist under the two portal shells (`*` is the catch-all).
const PORTAL_CHILDREN = /<Route\s+path="([^"/*][^"]*)"/g;

/** Every concrete-ish path declared in App.tsx, with portal children expanded. */
function appTsxPaths(): string[] {
  const source = appSource;
  const absolute = [...source.matchAll(/path="(\/apps[^"]*)"/g)].map(
    (m) => m[1],
  );
  const relative = [...source.matchAll(PORTAL_CHILDREN)].map((m) => m[1]);
  const portal = ['customer', 'intermediary'].flatMap((audience) =>
    relative.map((child) => `/apps/${audience}/${child}`),
  );
  return [...absolute, ...portal].map((path) =>
    path.replace(/:[A-Za-z]+/g, 'abc-123'),
  );
}

function underwriteSamplePaths(): string[] {
  const lines = ['motor', 'fleet', 'non-motor'] as const;
  return [
    underwritePaths.dashboard,
    underwritePaths.motorVehicles,
    underwritePaths.motorVehicleCreate,
    underwritePaths.motorVehicleDetail('v1'),
    underwritePaths.motorVehicleEdit('v1'),
    underwritePaths.nonMotorRisks,
    underwritePaths.nonMotorRiskCreate,
    underwritePaths.nonMotorRiskDetail('r1'),
    underwritePaths.nonMotorRiskEdit('r1'),
    underwritePaths.riskSchemas,
    ...lines.flatMap((line) => [
      underwritePaths.lineDashboard(line),
      underwritePaths.quotations(line),
      underwritePaths.quotationCreate(line),
      underwritePaths.quotationDetail(line, 'q1'),
      underwritePaths.quotationEdit(line, 'q1'),
      underwritePaths.policies(line),
      underwritePaths.policyDetail(line, 'p1'),
      underwritePaths.policyEndorsementCreate(line, 'p1'),
      underwritePaths.policyEndorsementEdit(line, 'p1', 'e1'),
      underwritePaths.policyCancellationCreate(line, 'p1'),
      underwritePaths.policyCancellationDetail(line, 'p1', 'c1'),
      underwritePaths.policyRenewalDetail(line, 'p1', 'r1'),
      underwritePaths.customers(line),
      underwritePaths.customerCreate(line),
      underwritePaths.customerDetail(line, 'c1'),
      underwritePaths.customerEdit(line, 'c1'),
      underwritePaths.renewals(line),
      underwritePaths.endorsements(line),
      underwritePaths.cancellations(line),
      underwritePaths.tiraFailed(line),
      underwritePaths.tiraPending(line),
    ]),
  ];
}

function claimsSamplePaths(): string[] {
  return [
    claimsPaths.list,
    claimsPaths.create,
    claimsPaths.dashboard,
    claimsPaths.documents,
    claimsPaths.reports,
    claimsPaths.configuration,
    claimsPaths.queue('assessment'),
    claimsPaths.detail('c1'),
    claimsPaths.edit('c1'),
  ];
}

describe('route titles', () => {
  it('gives every authenticated route a page name', () => {
    const paths = [
      ...appTsxPaths(),
      ...underwriteSamplePaths(),
      ...claimsSamplePaths(),
    ];
    expect(paths.length).toBeGreaterThan(150);
    const missing = paths.filter((path) => !routeTitleFor(path));
    expect(missing).toEqual([]);
  });

  it('leaves public and auth pages to usePageMeta', () => {
    for (const path of ['/', '/about', '/login', '/register', '/faq']) {
      expect(routeTitleFor(path)).toBeNull();
    }
    expect(routeTitleFor('/documents/verify/abc')).toBeNull();
  });

  it('prefers static segments over record ids', () => {
    expect(routeTitleFor('/apps/underwrite/motor/quotations/new')).toBe(
      'New Motor Quotation',
    );
    expect(routeTitleFor('/apps/underwrite/fleet/quotations/q1/edit')).toBe(
      'Edit Fleet Quotation',
    );
    expect(routeTitleFor('/apps/underwrite/non-motor/quotations/q1')).toBe(
      'Non-Motor Quotation Details',
    );
    expect(routeTitleFor('/apps/claims/new')).toBe('New Claim');
    expect(routeTitleFor('/apps/claims/dashboard')).toBe('Claims Dashboard');
    expect(routeTitleFor('/apps/claims/c1')).toBe('Claim Details');
    expect(routeTitleFor('/apps/intermediary/quotations/new')).toBe(
      'New Quotation',
    );
  });

  it('formats titles as "Page | App"', () => {
    expect(formatPageTitle('Dashboard')).toBe(`Dashboard | ${APP_NAME}`);
    expect(formatPageTitle('  ')).toBe(APP_NAME);
  });
});

describe('DocumentTitle', () => {
  function RecordPage({ name }: { name?: string }) {
    usePageTitle(name && `Quotation ${name}`);
    return null;
  }

  let navigate: ReturnType<typeof useNavigate>;
  function CaptureNavigate() {
    navigate = useNavigate();
    return null;
  }

  function renderAt(path: string, recordName?: string) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <DocumentTitle>
          <CaptureNavigate />
          <Routes>
            <Route
              path="/apps/underwrite/:line/quotations/:id"
              element={<RecordPage name={recordName} />}
            />
            <Route path="*" element={null} />
          </Routes>
        </DocumentTitle>
      </MemoryRouter>,
    );
  }

  it('uses the route fallback while loading, then the record title', () => {
    const view = renderAt('/apps/underwrite/motor/quotations/q1');
    expect(document.title).toBe(`Motor Quotation Details | ${APP_NAME}`);

    view.rerender(
      <MemoryRouter initialEntries={['/apps/underwrite/motor/quotations/q1']}>
        <DocumentTitle>
          <Routes>
            <Route
              path="/apps/underwrite/:line/quotations/:id"
              element={<RecordPage name="AIC261102001" />}
            />
          </Routes>
        </DocumentTitle>
      </MemoryRouter>,
    );
    expect(document.title).toBe(`Quotation AIC261102001 | ${APP_NAME}`);
  });

  it('updates on client-side navigation and drops the record title', () => {
    renderAt('/apps/underwrite/motor/quotations/q1', 'AIC261102001');
    expect(document.title).toBe(`Quotation AIC261102001 | ${APP_NAME}`);
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow',
    );

    act(() => navigate('/apps/finance/invoices'));
    expect(document.title).toBe(`Invoices | ${APP_NAME}`);

    act(() => navigate('/about'));
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  });
});
