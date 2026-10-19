const publicPaths = new Set([
  '/',
  '/insurance',
  '/about',
  '/contact',
  '/claims',
  '/faq',
  '/buy-cover',
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
