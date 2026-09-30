import { useMemo, type ReactNode } from 'react';
import { PolicyTransactionScopeContext } from '@/modules/tenant/policies/transaction-scope';
import { useUnderwriteLineParam } from '../hooks';
import { buildUnderwriteTransactionScope } from '../transaction-scope';

/**
 * Points the shared policy/transaction screens rendered inside it at the line
 * in the URL: line-scoped endpoints and `/underwrite/<line>/...` links.
 */
export function UnderwriteTransactionScope({
  children,
}: {
  children: ReactNode;
}) {
  const slug = useUnderwriteLineParam()?.slug;
  const scope = useMemo(
    () => (slug ? buildUnderwriteTransactionScope(slug) : null),
    [slug],
  );

  if (!scope) return null;

  return (
    <PolicyTransactionScopeContext.Provider value={scope}>
      {children}
    </PolicyTransactionScopeContext.Provider>
  );
}
