import { Suspense, lazy, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Copy, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import {
  UnderwriteAction,
  UnderwriteLine,
  getUnderwriteLineDefinition,
  underwritePermission,
} from '@insurance-max/contracts';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState, TableSkeleton } from '@/components/shared/ContentStates';
import { getApiErrorMessage } from '@/lib/api-error';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import {
  useQuotationPreview,
  useQuotationWorkflow,
} from '@/modules/tenant/quotations/hooks';
import { canEditQuotation } from '@/modules/tenant/quotations/utils/quotation-editability';
import { underwriteApi } from '@/modules/tenant/underwrite/api';
import { FleetVehiclesPanel } from '@/modules/tenant/underwrite/fleet/FleetVehiclesPanel';
import { motorInsuranceApi, motorInsuranceKeys } from '../api';
import { MotorWizardNavigation } from '../components/MotorWizardNavigation';
import { buildDuplicateDraft } from '../duplicate';
import { motorInsurancePaths } from '../paths';

const loadQuotationDetailPage = () =>
  import('@/modules/tenant/quotations/pages/QuotationDetailPage');
const QuotationDetailPage = lazy(() =>
  loadQuotationDetailPage().then((module) => ({
    default: module.QuotationDetailPage,
  })),
);

/**
 * One quotation detail screen for Single Motor and Fleet. The line comes from
 * the stored record (server-checked, with read scope); the shared quotation
 * page supplies the header, workflow actions, approval, payment, TIRAMIS and
 * history, and Fleet adds its per-vehicle panel. Edit and Duplicate keep the
 * user inside the Motor Insurance module.
 */
export function MotorQuotationDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const lineQuery = useQuery({
    queryKey: motorInsuranceKeys.line('quotation', id),
    queryFn: () => motorInsuranceApi.resolveQuotationLine(id),
    enabled: Boolean(id),
    retry: false,
  });
  // Start everything the detail screen needs while the line resolves, instead
  // of waiting for it: the screen's code and its preview/workflow data (same
  // query keys, so the inner page reuses these requests).
  useEffect(() => {
    void loadQuotationDetailPage();
  }, []);
  useQuotationPreview(id || undefined);
  useQuotationWorkflow(id || undefined);

  if (lineQuery.isPending) return <TableSkeleton />;

  if (lineQuery.isError || !lineQuery.data) {
    return (
      <EmptyState
        title="Quotation not found"
        description="It does not exist, or you do not have access to it."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to={motorInsurancePaths.quotations}>Back to quotations</Link>
          </Button>
        }
      />
    );
  }

  return <QuotationDetail id={id} line={lineQuery.data.line} />;
}

function QuotationDetail({ id, line }: { id: string; line: UnderwriteLine }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const slug = getUnderwriteLineDefinition(line).slug;
  const isFleet = line === UnderwriteLine.FLEET;

  const record = useQuery({
    queryKey: [...motorInsuranceKeys.all, 'quotation', id, 'record'],
    queryFn: () => underwriteApi.getQuotation(slug, id),
  });

  const canEdit =
    hasPermission(underwritePermission(line, UnderwriteAction.EDIT)) &&
    hasPermission('quotations:update') &&
    !!record.data &&
    canEditQuotation({
      quotation_status: record.data.quotation_status ?? record.data.status,
      tira_status: record.data.tira_status,
      submitted_at: record.data.submitted_at,
      source_policy_transaction_id: null,
    });
  const canDuplicate =
    hasPermission(underwritePermission(line, UnderwriteAction.CREATE)) &&
    hasPermission('quotations:create') &&
    !!record.data;

  const duplicate = useMutation({
    mutationFn: () =>
      underwriteApi.duplicateQuotation(
        slug,
        id,
        buildDuplicateDraft(record.data!, line),
      ),
    onSuccess: (copy) => {
      void queryClient.invalidateQueries({ queryKey: motorInsuranceKeys.all });
      toast.success(`Quotation duplicated as ${copy.quotation_no}`);
      navigate(motorInsurancePaths.quotationEdit(copy.id));
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  return (
    <MotorWizardNavigation>
      <Suspense fallback={<TableSkeleton />}>
        <QuotationDetailPage
          line={slug}
          onBack={() => navigate(motorInsurancePaths.quotations)}
          hostActions={[
            ...(canDuplicate
              ? [
                  {
                    label: 'Duplicate',
                    menuLabel: 'Duplicate quotation',
                    icon: <Copy className="mr-2 h-4 w-4" />,
                    disabled: duplicate.isPending,
                    onClick: () => setConfirmDuplicate(true),
                  },
                ]
              : []),
            ...(canEdit
              ? [
                  {
                    label: 'Edit',
                    icon: <Pencil className="mr-2 h-4 w-4" />,
                    onClick: () =>
                      navigate(motorInsurancePaths.quotationEdit(id)),
                  },
                ]
              : []),
          ]}
          tiramisPanel={
            isFleet ? (
              <FleetVehiclesPanel
                kind="quotation"
                id={id}
                showSummary={false}
                currency={
                  record.data?.cover_note_dtl.fleet_hdr?.currency_code ??
                  record.data?.cover_note_dtl.currency_code ??
                  'TZS'
                }
              />
            ) : undefined
          }
        />
      </Suspense>

      <ConfirmDialog
        open={confirmDuplicate}
        onOpenChange={setConfirmDuplicate}
        title="Duplicate this quotation?"
        description="A new draft is created with the same customer, product, vehicles and covers, and a new one-year cover period from today. Approval, payment and TIRA status are not copied, and the new quotation is repriced when you finalize it."
        confirmLabel="Duplicate"
        variant="default"
        loading={duplicate.isPending}
        onConfirm={() => {
          setConfirmDuplicate(false);
          duplicate.mutate();
        }}
      />
    </MotorWizardNavigation>
  );
}
