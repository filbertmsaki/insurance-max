import { Navigate } from 'react-router-dom';
import {
  type UnderwriteActionValue,
  underwritePermissionsGranting,
} from '@insurance-max/contracts';
import { ProtectedRoute } from '@/modules/shared/auth/components/ProtectedRoute';
import { useUnderwriteLineParam } from '../hooks';
import { underwritePaths } from '../paths';

interface UnderwriteLineRouteProps {
  action: UnderwriteActionValue;
  /** Existing action permission that the backend also requires. */
  permission?: string;
  /** Existing action permissions when the backend accepts any one of them. */
  anyPermissions?: string[];
}

/**
 * Route guard for `/apps/underwrite/:line/...`: resolves the line from the URL and
 * requires a line gate granting `action` plus the existing action permission.
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
      allPermissions={permission ? [permission] : []}
      anyPermissions={anyPermissions}
      anyPermissionGroups={[underwritePermissionsGranting(line.line, action)]}
    />
  );
}
