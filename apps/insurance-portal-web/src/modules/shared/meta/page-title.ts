import { createContext, useContext, useEffect } from 'react';
import { APP_NAME } from '@/modules/shared/config';

/** `Page Name | App Name`, or just the app name when there is no page name. */
export function formatPageTitle(pageName?: string | null) {
  const name = pageName?.trim();
  return name ? `${name} | ${APP_NAME}` : APP_NAME;
}

export const SetPageTitleContext = createContext<
  ((pageName: string | null) => void) | null
>(null);

/**
 * Replaces the route's page name with a record-specific one, e.g.
 * `usePageTitle(quotation && \`Quotation ${quotation.quotation_no}\`)`.
 * Pass a falsy value while data loads to keep the route's fallback title.
 */
export function usePageTitle(pageName: string | null | undefined | false) {
  const setPageTitle = useContext(SetPageTitleContext);
  useEffect(() => {
    if (!setPageTitle || !pageName) return;
    setPageTitle(pageName);
    return () => setPageTitle(null);
  }, [setPageTitle, pageName]);
}
