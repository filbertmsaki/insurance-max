import { lazy, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import { TableSkeleton } from '@/components/shared/ContentStates';
import { UnderwriteRecordGate } from '../components/UnderwriteRecordGate';
import { useUnderwriteRecordCheck } from '../hooks';
import { FleetVehiclesPanel } from './FleetVehiclesPanel';

const QuotationDetailPage = lazy(() =>
  import('@/modules/tenant/quotations/pages/QuotationDetailPage').then(
    (module) => ({ default: module.QuotationDetailPage }),
  ),
);
const PolicyDetailPage = lazy(() =>
  import('@/modules/tenant/policies/pages/PolicyDetailPage').then((module) => ({
    default: module.PolicyDetailPage,
  })),
);

/**
 * Fleet quotation details: the shared quotation screen (header, workflow
 * actions, approval, payment, TIRA). Per-vehicle cover notes, stickers and the
 * fleet-register link sit in its TIRAMIS tab, next to cover note issuance.
 */
export function FleetQuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { quotation } = useUnderwriteRecordCheck('quotation', 'fleet', id);

  return (
    <UnderwriteRecordGate kind="quotation">
      <Suspense fallback={<TableSkeleton />}>
        <QuotationDetailPage
          line="fleet"
          tiramisPanel={
            <FleetVehiclesPanel
              kind="quotation"
              id={id!}
              showSummary={false}
              currency={
                quotation?.cover_note_dtl.fleet_hdr?.currency_code ??
                quotation?.cover_note_dtl.currency_code ??
                'TZS'
              }
            />
          }
        />
      </Suspense>
    </UnderwriteRecordGate>
  );
}

/**
 * Fleet policy details: every vehicle with its cover status, cover note and
 * sticker above the shared policy screen (endorsements, renewals,
 * cancellations, TIRA, history).
 */
export function FleetPolicyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { policy } = useUnderwriteRecordCheck('policy', 'fleet', id);

  return (
    <UnderwriteRecordGate kind="policy">
      <div className="space-y-5">
        <FleetVehiclesPanel
          kind="policy"
          id={id!}
          currency={policy?.currency ?? 'TZS'}
        />
        <Suspense fallback={<TableSkeleton />}>
          <PolicyDetailPage />
        </Suspense>
      </div>
    </UnderwriteRecordGate>
  );
}
