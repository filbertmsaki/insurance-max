import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuthStore } from '@/modules/shared/auth/store/auth.store';

const EMPTY_PERMISSIONS: string[] = [];

export function DefaultLandingPage() {
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

  if (!hydrated) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (permissions.includes('portal:intermediary-access')) {
    return <Navigate to="/intermediary/dashboard" replace />;
  }

  if (
    user?.scope === 'customer' ||
    (user?.scope === 'company' && user.userType === 'CUSTOMER')
  ) {
    return <Navigate to="/customer/dashboard" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}
