import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { legacyAppRedirect } from '@/modules/shared/auth/app-paths';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';

const EMPTY_PERMISSIONS: string[] = [];

export function DefaultLandingPage() {
  const { pathname, search, hash } = useLocation();
  const user = useAuthStore((state) => state.user);
  const permissions = useAuthStore(
    (state) =>
      state.authorizationContext?.permissions ??
      state.user?.permissions ??
      EMPTY_PERMISSIONS,
  );
  const [hydrated, setHydrated] = useState(useAuthStore.persist.hasHydrated());

  useEffect(() => {
    const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });

    return unsubscribe;
  }, []);

  const legacyTarget = legacyAppRedirect(pathname);
  if (legacyTarget) {
    return <Navigate to={`${legacyTarget}${search}${hash}`} replace />;
  }

  if (!hydrated) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (permissions.includes('portal:intermediary-access')) {
    return <Navigate to="/apps/intermediary/dashboard" replace />;
  }

  if (
    user?.scope === 'customer' ||
    (user?.scope === 'company' && user.userType === 'CUSTOMER')
  ) {
    return <Navigate to="/apps/customer/dashboard" replace />;
  }

  return <Navigate to="/apps/dashboard" replace />;
}
