import { Navigate, useParams } from 'react-router-dom';
import { sharedUnderwritePaths } from '@/modules/tenant/underwrite/paths';

/**
 * Retired in favor of the wizard's edit mode — editing a quotation
 * now needs to hydrate motor/fleet/non-motor detail rows alongside the base
 * fields, which only the wizard's multi-fetch load does. Kept as a thin
 * redirect rather than deleted so old links (`/quotations/:id/edit`) still work.
 */
export function QuotationEditPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <Navigate to={sharedUnderwritePaths.quotationWizardEdit(id!)} replace />
  );
}
