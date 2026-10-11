import { Navigate } from 'react-router-dom';
import { sharedUnderwritePaths } from '@/modules/tenant/underwrite/paths';

export function QuotationCreatePage() {
  return <Navigate to={sharedUnderwritePaths.quotationWizard} replace />;
}
