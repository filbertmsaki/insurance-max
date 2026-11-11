import { useLayoutEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  appBarStore,
  useAppBarState,
  type AppBarPageConfig,
} from './appBarStore';

/**
 * Sets the phone app bar for the page that renders it: variant, title and
 * back action. Children are extra icon buttons, shown at the right of the
 * bar (e.g. a record's ⋯ menu). Renders nothing in the page itself.
 *
 *   <AppBarConfig variant="inner" title="AICL2611" subtitle="Single motor"
 *     onBack={() => navigate(-1)}>
 *     <RecordActionsMenu />
 *   </AppBarConfig>
 */
export function AppBarConfig({
  children,
  onBack,
  ...config
}: Partial<AppBarPageConfig> & {
  onBack?: () => void;
  children?: ReactNode;
}) {
  const [owner] = useState(() => Symbol('app-bar-owner'));
  const { actionsTarget, owner: current } = useAppBarState();
  const variant = config.variant ?? 'root';

  useLayoutEffect(() => {
    appBarStore.claim(owner, {
      variant,
      title: config.title,
      subtitle: config.subtitle,
      showSearch: config.showSearch,
      showNotifications: config.showNotifications,
      showAccount: config.showAccount,
    });
  }, [
    owner,
    variant,
    config.title,
    config.subtitle,
    config.showSearch,
    config.showNotifications,
    config.showAccount,
  ]);

  // Always the latest handler, without re-rendering the bar.
  useLayoutEffect(() => {
    appBarStore.setBackHandler(owner, onBack ?? null);
  });

  useLayoutEffect(() => () => appBarStore.release(owner), [owner]);

  return children && actionsTarget && current === owner
    ? createPortal(children, actionsTarget)
    : null;
}
