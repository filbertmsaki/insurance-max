import { useSyncExternalStore } from 'react';

const QUERY = '(max-width: 767px)';

function subscribe(onChange: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

/** True below 768px. Falls back to false (desktop) where matchMedia is missing. */
export function useIsPhone() {
  return useSyncExternalStore(
    subscribe,
    () =>
      typeof window !== 'undefined' && !!window.matchMedia
        ? window.matchMedia(QUERY).matches
        : false,
    () => false,
  );
}
