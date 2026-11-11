import { useNavigate } from 'react-router-dom';
import {
  UnderwriteAction,
  UnderwriteLine,
  underwritePermission,
} from '@insurance-max/contracts';
import { CompanySwitcher } from '@/components/layout/CompanySwitcher';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { QuotationRegister } from '@/modules/tenant/quotations/components/QuotationRegister';
import { motorInsuranceApi, motorInsuranceKeys } from '../api';
import { motorInsurancePaths } from '../paths';

/**
 * Motor Insurance quotation register: Single Motor and Fleet together on the
 * standard list page. The backend only returns the lines the user holds the
 * line gate for, with the usual data scope applied.
 */
export function MotorInsuranceQuotationsPage() {
  const navigate = useNavigate();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canCreate = (line: UnderwriteLine) =>
    hasPermission(underwritePermission(line, UnderwriteAction.CREATE)) &&
    hasPermission('quotations:create');
  const canCreateAny =
    canCreate(UnderwriteLine.MOTOR) || canCreate(UnderwriteLine.FLEET);

  return (
    <QuotationRegister
      title="Quotations"
      description="Single Motor and Fleet quotations in one register."
      breadcrumb={[
        { label: 'Motor Insurance', href: motorInsurancePaths.root },
        { label: 'Quotations' },
      ]}
      queryKey={motorInsuranceKeys.quotations()}
      stateKey="motor-quotations"
      fetcher={(params, signal) =>
        motorInsuranceApi.getQuotations(
          params as Parameters<typeof motorInsuranceApi.getQuotations>[0],
          signal,
        )
      }
      typeChips={[
        { id: 'all', label: 'All' },
        { id: 'single', label: 'Single' },
        { id: 'fleet', label: 'Fleet' },
      ]}
      detailHref={motorInsurancePaths.quotationDetail}
      editHref={motorInsurancePaths.quotationEdit}
      primaryAction={
        canCreateAny
          ? {
              label: 'New quotation',
              onClick: () => navigate(motorInsurancePaths.quotationCreate()),
            }
          : undefined
      }
      headerExtras={<CompanySwitcher menuLabel="Filter by owner company" />}
    />
  );
}
