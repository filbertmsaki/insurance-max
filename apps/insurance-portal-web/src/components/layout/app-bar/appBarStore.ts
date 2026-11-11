import { useSyncExternalStore } from 'react';

/**
 * What the current page asks of the phone app bar. One page at a time owns
 * it; pages without a config get the root bar with their breadcrumb title.
 */
export interface AppBarPageConfig {
  /** root = menu button; inner = back arrow (task flows, detail pages). */
  variant: 'root' | 'inner';
  title?: string;
  /** Inner pages: small uppercase label above the title, e.g. "STEP 1 OF 3". */
  subtitle?: string;
  /** Defaults: shown on root pages, hidden on inner pages. */
  showSearch?: boolean;
  showNotifications?: boolean;
  showAccount?: boolean;
}

interface State {
  owner: symbol | null;
  config: AppBarPageConfig | null;
  /** Element the page's extra icon buttons are portalled into. */
  actionsTarget: HTMLElement | null;
}

let state: State = { owner: null, config: null, actionsTarget: null };
const listeners = new Set<() => void>();
/** Latest back handler of the owning page (kept out of state: no re-render). */
let backHandler: (() => void) | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function sameConfig(a: AppBarPageConfig | null, b: AppBarPageConfig | null) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.variant === b.variant &&
    a.title === b.title &&
    a.subtitle === b.subtitle &&
    a.showSearch === b.showSearch &&
    a.showNotifications === b.showNotifications &&
    a.showAccount === b.showAccount
  );
}

export const appBarStore = {
  subscribe,
  get: () => state,
  claim(owner: symbol, config: AppBarPageConfig) {
    if (state.owner === owner && sameConfig(state.config, config)) return;
    state = { ...state, owner, config };
    emit();
  },
  release(owner: symbol) {
    if (state.owner !== owner) return;
    state = { ...state, owner: null, config: null };
    backHandler = null;
    emit();
  },
  setBackHandler(owner: symbol, handler: (() => void) | null) {
    if (state.owner === owner || state.owner === null) backHandler = handler;
  },
  back() {
    backHandler?.();
  },
  setActionsTarget(element: HTMLElement | null) {
    if (state.actionsTarget === element) return;
    state = { ...state, actionsTarget: element };
    emit();
  },
};

export function useAppBarState() {
  return useSyncExternalStore(
    appBarStore.subscribe,
    appBarStore.get,
    appBarStore.get,
  );
}

/** Height of the phone app bar, for screens that position below it. */
export const APP_BAR_HEIGHT_CSS = 'calc(56px + env(safe-area-inset-top))';
