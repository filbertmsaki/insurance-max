import { useNavigate } from 'react-router-dom';
import {
  UnderwriteAction,
  underwritePermission,
} from '@insurance-max/contracts';
import { CompanySwitcher } from '@/components/layout/CompanySwitcher';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { QuotationRegister } from '@/modules/tenant/quotations/components/QuotationRegister';
import { underwriteApi } from '../api';
import { underwriteKeys, useUnderwriteLineParam } from '../hooks';
import type { UnderwriteLineMeta } from '../lines';
import { underwritePaths } from '../paths';

/** Non-Motor quotation register on the standard list page. */
function QuotationsList({ line }: { line: UnderwriteLineMeta }) {
  const navigate = useNavigate();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canCreate =
    line.hasWizard &&
    hasPermission(underwritePermission(line.line, UnderwriteAction.CREATE)) &&
    hasPermission('quotations:create');

  return (
    <QuotationRegister
      title={`${line.label} quotations`}
      description={line.description}
      breadcrumb={[
        { label: line.label, href: underwritePaths.lineDashboard(line.slug) },
        { label: 'Quotations' },
      ]}
      queryKey={underwriteKeys.quotations(line.slug)}
      stateKey={`${line.slug}-quotations`}
      fetcher={(params, signal) =>
        underwriteApi.getQuotations(
          line.slug,
          params as Parameters<typeof underwriteApi.getQuotations>[1],
          signal,
        )
      }
      detailHref={(id) => underwritePaths.quotationDetail(line.slug, id)}
      editHref={(id) => underwritePaths.quotationEdit(line.slug, id)}
      nonMotorLine={line.line}
      canEditLine={() => line.hasWizard}
      primaryAction={
        canCreate
          ? {
              label: 'New quotation',
              onClick: () =>
                navigate(underwritePaths.quotationCreate(line.slug)),
            }
          : undefined
      }
      headerExtras={<CompanySwitcher menuLabel="Filter by owner company" />}
    />
  );
}

export function NonMotorQuotationsPage() {
  const line = useUnderwriteLineParam();
  return line?.line === 'NON_MOTOR' ? (
    <QuotationsList key={line.slug} line={line} />
  ) : null;
}
