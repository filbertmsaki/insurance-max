import { useEffect, useState } from 'react';
import { usersApi } from '@/modules/tenant/users/api/users';
import { authorizationApi } from '@/modules/shared/auth/api/authorization';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';

const AUTHORIZATION_CONTEXT_REFRESH_MS = 5 * 60 * 1000;
const AUTHORIZATION_CONTEXT_MIN_GAP_MS = 30 * 1000;

export function AuthBootstrap() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const profile = useAuthStore((state) => state.profile);
  const setProfile = useAuthStore((state) => state.setProfile);
  const setAuthorizationContext = useAuthStore(
    (state) => state.setAuthorizationContext,
  );
  const [hydrated, setHydrated] = useState(useAuthStore.persist.hasHydrated());

  useEffect(() => {
    const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!hydrated) {
      return undefined;
    }

    if (!accessToken) {
      setProfile(null);
      setAuthorizationContext(null);
      return undefined;
    }

    if (profile) {
      return undefined;
    }

    void usersApi
      .getMe()
      .then((profile) => {
        if (!cancelled) {
          setProfile(profile);
        }
      })
      .catch(() => {
        // The API client already handles token refresh/revocation paths.
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, hydrated, profile, setProfile, setAuthorizationContext]);

  useEffect(() => {
    let cancelled = false;

    if (!hydrated || !accessToken) {
      return undefined;
    }

    let inFlight = false;
    let lastRequestedAt = 0;

    const refreshAuthorizationContext = () => {
      inFlight = true;
      lastRequestedAt = Date.now();

      void authorizationApi
        .getContext()
        .then((context) => {
          if (!cancelled) {
            setAuthorizationContext(context);
          }
        })
        .catch(() => {
          // The API client already handles token refresh/revocation paths.
        })
        .finally(() => {
          inFlight = false;
        });
    };

    // Focus and visibilitychange usually fire together when returning to the
    // tab; skip refreshes that overlap or follow a recent one.
    const refreshOnReturn = () => {
      if (
        document.visibilityState !== 'visible' ||
        inFlight ||
        Date.now() - lastRequestedAt < AUTHORIZATION_CONTEXT_MIN_GAP_MS
      ) {
        return;
      }

      refreshAuthorizationContext();
    };

    refreshAuthorizationContext();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !inFlight) {
        refreshAuthorizationContext();
      }
    }, AUTHORIZATION_CONTEXT_REFRESH_MS);
    window.addEventListener('focus', refreshOnReturn);
    document.addEventListener('visibilitychange', refreshOnReturn);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshOnReturn);
      document.removeEventListener('visibilitychange', refreshOnReturn);
    };
  }, [accessToken, hydrated, setAuthorizationContext]);

  return null;
}
