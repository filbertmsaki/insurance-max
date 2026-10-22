/** Every authenticated screen lives under this prefix, apart from the public website. */
export const APP_BASE_PATH = '/apps';

/** First path segments used by authenticated screens before they moved under `/apps`. */
const LEGACY_APP_SEGMENTS = new Set([
  'analytics',
  'api-clients',
  'audit-logs',
  'branches',
  'claims',
  'communications',
  'companies',
  'company-features',
  'complaints',
  'customer',
  'dashboard',
  'departments',
  'devices',
  'document-templates',
  'documents',
  'endorsement-types',
  'finance',
  'forbidden',
  'insurance-partners',
  'intermediary',
  'my-company',
  'notification-preferences',
  'notifications',
  'permissions',
  'platform',
  'platform-intelligence',
  'portal-invitations',
  'portal-requests',
  'product-engine',
  'reference-data',
  'regulatory',
  'reinsurance',
  'reports',
  'roles',
  'saas-billing',
  'sale-points',
  'security-policy',
  'sessions',
  'settings',
  'signatures',
  'tiramis',
  'underwrite',
  'users',
  'verifications',
  'work-items',
]);

/**
 * The `/apps` equivalent of a pre-`/apps` URL (old bookmarks, emailed or
 * server-generated links), or null when the path was never an app screen.
 */
export function legacyAppRedirect(pathname: string): string | null {
  const segment = pathname.split('/')[1];
  return segment && LEGACY_APP_SEGMENTS.has(segment)
    ? `${APP_BASE_PATH}${pathname}`
    : null;
}
