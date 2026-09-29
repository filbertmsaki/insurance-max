import { Navigate } from 'react-router-dom';
import type { UnderwriteActionValue } from '@insurance-max/contracts';
import { ProtectedRoute } from '@/modules/shared/auth/components/ProtectedRoute';
import { useUnderwriteLineParam } from '../hooks';
import { underwriteRoutePermissions } from '../lines';
import { underwritePaths } from '../paths';

interface UnderwriteLineRouteProps {
  action: UnderwriteActionValue;
  /** Existing action permission that the backend also requires. */
  permission?: string;
  /** Existing action permissions when the backend accepts any one of them. */
  anyPermissions?: string[];
}

/**
 * Route guard for `/underwrite/:line/...`: resolves the line from the URL and
 * requires the line gate plus the existing action permission.
 */
export function UnderwriteLineRoute({
  action,
  permission,
  anyPermissions,
}: UnderwriteLineRouteProps) {
  const line = useUnderwriteLineParam();

  if (!line) {
    return <Navigate to={underwritePaths.dashboard} replace />;
  }

  return (
    <ProtectedRoute
      allPermissions={underwriteRoutePermissions(line.line, action, permission)}
      anyPermissions={anyPermissions}
    />
  );
}
