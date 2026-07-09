import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CreditCard, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { billingApi } from '@/modules/tenant/billing/api';
import type { InvoiceRecord } from '@/modules/tenant/billing/types';
import { API_MAX_LIST_LIMIT } from '@/modules/shared/api/limits';
import { PaymentStatusBadge } from '../components/PaymentStatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { QuotationStatusBadge } from '../components/QuotationStatusBadge';
import { useDeleteQuotation, useQuotationDetail } from '../hooks';
import { useSubmitQuotationToTiramis } from '@/modules/tenant/tiramis/hooks';
import { TiramisSubmissionDialog } from '@/modules/tenant/tiramis/components/TiramisSubmissionDialog';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import {
  useCreateNonMotorQuotationDetail,
  useNonMotorQuotationDetails,
  useNonMotorQuotationRisks,
  useSubjectMatterOptions,
} from '@/modules/tenant/non-motor/hooks';
import { QuotationNonMotorDetailForm } from '@/modules/tenant/non-motor/components/QuotationNonMotorDetailForm';
import type { NonMotorQuotationDetailRecord } from '@/modules/tenant/non-motor/types';
import { underwritingPaths } from '@/modules/tenant/underwriting/paths';

function Row({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="min-w-36 text-sm text-slate-500">{label}</span>
      <span className="text-sm text-slate-900">{value ?? ' - '}</span>
    </div>
  );
}

export function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuthStore();
  const canCreate = hasPermission('non-motor:create');
  const { data: quotation, isLoading } = useQuotationDetail(id);
  const deleteMutation = useDeleteQuotation();
  const submitMutation = useSubmitQuotationToTiramis(quotation);
  const { data: nonMotorDetails = [] } = useNonMotorQuotationDetails(
    quotation?.id,
  );
  const { data: quotationRisks = [] } = useNonMotorQuotationRisks(
    quotation?.id,
  );
  const { data: subjectMatterOptions = [] } = useSubjectMatterOptions();
  const createNonMotorMutation = useCreateNonMotorQuotationDetail();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [nonMotorOpen, setNonMotorOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [invoice, setInvoice] = useState<InvoiceRecord | null>(null);
  const isPaid = invoice?.status === 'PAID';

  useEffect(() => {
    if (!quotation?.id) return;
    let cancelled = false;
    billingApi.getInvoices({ limit: API_MAX_LIST_LIMIT }).then((page) => {
      if (!cancelled) setInvoice(page.data.find((inv) => inv.quotation_id === quotation.id) ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [quotation?.id]);

  const nonMotorColumns: Column<NonMotorQuotationDetailRecord>[] = useMemo(
    () => [
      {
        key: 'subject_matter',
        header: 'Subject Matter',
        cell: (row) =>
          row.subject_matter?.subject_code ?? row.subject_matter_id,
      },
      {
        key: 'risk',
        header: 'Quotation Risk',
        cell: (row) =>
          row.quotation_risk?.risk?.risk_name ?? row.quotation_risk_id,
      },
      {
        key: 'insured_value',
        header: 'Insured Value',
        cell: (row) => row.insured_value ?? ' - ',
      },
      {
        key: 'limit',
        header: 'Limit',
        cell: (row) => row.limit_of_liability ?? ' - ',
      },
      {
        key: 'created_at',
        header: 'Created',
        cell: (row) => new Date(row.created_at).toLocaleString(),
      },
    ],
    [],
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="text-center py-24 text-slate-500">
        <p className="font-medium">Quotation not found</p>
        <Button
          variant="link"
          onClick={() => navigate(underwritingPaths.quotations)}
        >
          Back to Quotations
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(underwritingPaths.quotations)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">
                {quotation.quotation_no}
              </h1>
              <QuotationStatusBadge status={quotation.status} />
              <PaymentStatusBadge status={invoice?.status} />
            </div>
            <p className="text-sm text-slate-500">
              {quotation.customer?.company_name ?? quotation.customer_id}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(underwritingPaths.quotationPayment(quotation.id))}
          >
            <CreditCard className="mr-1.5 h-3.5 w-3.5" />
            Payment
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSubmitOpen(true)}
            disabled={submitMutation.isPending || !isPaid}
            title={isPaid ? undefined : 'Payment must be completed before submitting to TIRAMIS'}
          >
            <Play className="mr-1.5 h-3.5 w-3.5" />
            Submit to TIRAMIS
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              navigate(underwritingPaths.quotationWizardEdit(quotation.id))
            }
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="risks">Risks</TabsTrigger>
          <TabsTrigger value="non-motor">Non-Motor Details</TabsTrigger>
          <TabsTrigger value="breakdowns">Premium Breakdown</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Quotation Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Row
                label="Customer"
                value={
                  quotation.customer?.company_name ?? quotation.customer_id
                }
              />
              <Row
                label="Category"
                value={quotation.category?.name ?? quotation.category_id}
              />
              <Row
                label="Product"
                value={quotation.product?.product_name ?? quotation.product_id}
              />
              <Row
                label="Sub-Class"
                value={quotation.sub_class?.name ?? quotation.sub_class_id}
              />
              <Row label="Type" value={quotation.quotation_type} />
              <Row label="Channel" value={quotation.channel_type} />
              <Row
                label="Sum Insured"
                value={`${quotation.currency} ${quotation.sum_insured}`}
              />
              <Row
                label="Premium"
                value={`${quotation.currency} ${quotation.total_premium}`}
              />
              <Row
                label="Validity"
                value={`${quotation.valid_from} to ${quotation.valid_until}`}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risks" className="space-y-4">
          {(quotation.risks ?? []).map((risk) => (
            <Card key={risk.id}>
              <CardContent className="space-y-2 pt-6">
                <Row
                  label="Risk"
                  value={risk.risk?.risk_name ?? risk.risk_id}
                />
                <Row label="Sum Insured" value={risk.sum_insured} />
                <Row label="Rate" value={risk.rate} />
                <Row label="Premium" value={risk.total_premium} />
                <Row
                  label="Vehicle"
                  value={
                    risk.motor_vehicle?.registration_no ?? risk.motor_vehicle_id
                  }
                />
              </CardContent>
            </Card>
          ))}
          {(quotation.risks ?? []).length === 0 && (
            <p className="text-sm text-slate-500">No risks attached.</p>
          )}
        </TabsContent>

        <TabsContent value="non-motor" className="space-y-4">
          {canCreate && (
            <div className="flex justify-end">
              <Button onClick={() => setNonMotorOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Non-Motor Detail
              </Button>
            </div>
          )}
          <DataTable
            columns={nonMotorColumns}
            data={nonMotorDetails}
            loading={false}
            page={1}
            limit={nonMotorDetails.length || 1}
            total={nonMotorDetails.length}
            totalPages={1}
            onPageChange={() => undefined}
            onLimitChange={() => undefined}
          />
        </TabsContent>

        <TabsContent value="breakdowns" className="space-y-4">
          {(quotation.premium_breakdowns ?? []).map((item) => (
            <Card key={item.id}>
              <CardContent className="space-y-2 pt-6">
                <Row label="Item" value={item.item_name} />
                <Row label="Code" value={item.item_code} />
                <Row label="Amount" value={item.amount} />
              </CardContent>
            </Card>
          ))}
          {(quotation.premium_breakdowns ?? []).length === 0 && (
            <p className="text-sm text-slate-500">No breakdown items.</p>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {(quotation.status_history ?? []).map((entry) => (
            <Card key={entry.id}>
              <CardContent className="space-y-2 pt-6">
                <Row label="From" value={entry.old_status} />
                <Row label="To" value={entry.new_status} />
                <Row label="Reason" value={entry.reason} />
                <Row label="Changed At" value={entry.created_at} />
              </CardContent>
            </Card>
          ))}
          {(quotation.status_history ?? []).length === 0 && (
            <p className="text-sm text-slate-500">No history yet.</p>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={nonMotorOpen} onOpenChange={setNonMotorOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Non-Motor Detail</DialogTitle>
          </DialogHeader>
          {canCreate && (
            <QuotationNonMotorDetailForm
              quotation={quotation}
              risks={quotationRisks}
              subjectMatters={subjectMatterOptions}
              isPending={createNonMotorMutation.isPending}
              submitLabel="Create Detail"
              onSubmit={(values) => {
                createNonMotorMutation.mutate(values, {
                  onSuccess: () => setNonMotorOpen(false),
                });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <TiramisSubmissionDialog
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        title="Submit Quotation to TIRAMIS"
        description="Choose the branch and sale point for this submission. If a unique or default sale point exists, it will be used automatically."
        initialBranchId={quotation.branch_id}
        isPending={submitMutation.isPending}
        onSubmit={(selection) => {
          submitMutation.mutate(selection, {
            onSuccess: (result) => {
              setSubmitOpen(false);
              navigate(
                underwritingPaths.submissionDetail(result.submission.id),
              );
            },
          });
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Quotation"
        description="This will soft-delete the quotation."
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() =>
          deleteMutation.mutate(quotation.id, {
            onSuccess: () => navigate(underwritingPaths.quotations),
          })
        }
      />
    </div>
  );
}
