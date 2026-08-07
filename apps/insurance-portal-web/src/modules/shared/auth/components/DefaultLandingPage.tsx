import { Navigate } from 'react-router-dom';

import { useAuthStore } from '@/modules/shared/auth/store/auth.store';

export function DefaultLandingPage() {
  const permissions = useAuthStore(
    (state) => state.authorizationContext?.permissions ?? state.user?.permissions ?? [],
  );

  if (permissions.includes('portal:customer-access')) {
    return <Navigate to="/customer/dashboard" replace />;
  }

  if (permissions.includes('portal:intermediary-access')) {
    return <Navigate to="/intermediary/dashboard" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}
