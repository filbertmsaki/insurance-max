/** Entry point of the public motor insurance purchase journey. */
export const BUY_INSURANCE_PATH = '/buy-cover';

const publicPaths = new Set([
  '/',
  '/insurance',
  '/about',
  '/contact',
  '/claim-help',
  '/faq',
  '/buy-cover',
  '/buy-insurance',
  '/motor-insurance',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/phone-login',
  '/passwordless',
  '/passwordless/complete',
  '/2fa',
]);

export function isPublicWebsitePath(pathname: string) {
  const path = pathname.replace(/\/+$/, '') || '/';
  return (
    publicPaths.has(path) ||
    path.startsWith('/documents/verify/') ||
    path.startsWith('/signatures/respond/')
  );
}
