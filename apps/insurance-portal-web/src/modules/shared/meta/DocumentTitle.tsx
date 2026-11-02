import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { formatPageTitle, SetPageTitleContext } from './page-title';
import { routeTitleFor } from './route-titles';

/**
 * Keeps `document.title` in step with the current authenticated route and
 * marks those pages `noindex`. Routes without an entry in `route-titles`
 * (public site, auth) are left to `usePageMeta`.
 */
export function DocumentTitle({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [override, setOverride] = useState<string | null>(null);
  const routeTitle = routeTitleFor(pathname);
  const title =
    routeTitle === null ? null : formatPageTitle(override ?? routeTitle);

  useEffect(() => {
    if (title === null) return;
    document.title = title;
  }, [title]);

  const isAppRoute = routeTitle !== null;
  useEffect(() => {
    if (!isAppRoute) return;
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, nofollow';
    document.head.appendChild(robots);
    return () => robots.remove();
  }, [isAppRoute]);

  return (
    <SetPageTitleContext.Provider value={setOverride}>
      {children}
    </SetPageTitleContext.Provider>
  );
}
