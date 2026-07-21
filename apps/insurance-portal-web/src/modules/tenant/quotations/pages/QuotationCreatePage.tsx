import { Navigate } from 'react-router-dom';
import { underwritingPaths } from '@/modules/tenant/underwriting/paths';

export function QuotationCreatePage() {
  return <Navigate to={underwritingPaths.quotationWizard} replace />;
}
