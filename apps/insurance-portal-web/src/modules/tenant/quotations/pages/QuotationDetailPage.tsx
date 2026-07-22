import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CreditCard, Pencil, Play, Trash2 } from 'lucide-react';
import { billingApi } from '@/modules/tenant/billing/api';
import type { InvoiceRecord } from '@/modules/tenant/billing/types';
import { API_MAX_LIST_LIMIT } from '@/modules/shared/api/limits';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { getSubmissionDetailId } from '@/modules/tenant/tiramis/utils';
import { QuotationStatusBadge } from '../components/QuotationStatusBadge';
import { PaymentStatusBadge } from '../components/PaymentStatusBadge';
import {
  useDeleteQuotation,
  useQuotationDetail,
  useQuotationPayload,
  useSubmitQuotation,
} from '../hooks';
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
      <span className="min-w-44 text-sm text-slate-500">{label}</span>
      <span className="text-sm text-slate-900">{value ?? ' - '}</span>
    </div>
  );
}

export function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: quotation, isLoading } = useQuotationDetail(id);
  const { data: payload } = useQuotationPayload(id);
  const deleteMutation = useDeleteQuotation();
  const submitMutation = useSubmitQuotation(id);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [invoice, setInvoice] = useState<InvoiceRecord | null>(null);

  useEffect(() => {
    if (!quotation?.id) return;
    let cancelled = false;
    billingApi.getInvoices({ limit: API_MAX_LIST_LIMIT }).then((page) => {
      if (cancelled) return;
      setInvoice(
        page.data.find((item) => item.quotation_id === quotation.id) ?? null,
      );
    });
    return () => {
      cancelled = true;
    };
  }, [quotation?.id]);

  const isPaid = invoice?.status === 'PAID';
  const detail = quotation?.cover_note_dtl;
  const internalQuotation = quotation?.internal_quotation;
  const paymentMode =
    detail?.fleet_hdr?.payment_mode ?? detail?.payment_mode ?? 1;
  const canSubmitToTiramis = paymentMode === 1 || isPaid;
  const policyHolder = useMemo(() => {
    if (!detail || !internalQuotation) return null;
    return internalQuotation.quotation_flow === 'MOTOR_FLEET'
      ? (detail.fleet_hdr?.policy_holders?.[0] ?? null)
      : (detail.policy_holders?.[0] ?? null);
  }, [detail, internalQuotation]);

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
      <div className="py-24 text-center text-slate-500">
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
              {policyHolder?.policy_holder_name ?? 'Policyholder not available'}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              navigate(underwritingPaths.quotationPayment(quotation.id))
            }
          >
            <CreditCard className="mr-1.5 h-3.5 w-3.5" />
            Payment
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!canSubmitToTiramis || submitMutation.isPending}
            title={
              canSubmitToTiramis
                ? undefined
                : 'Payment must be completed before submitting to TIRAMIS'
            }
            onClick={() =>
              submitMutation.mutate(undefined, {
                onSuccess: (result) => {
                  const submissionDetailId = getSubmissionDetailId(
                    result.submission,
                  );
                  if (submissionDetailId) {
                    navigate(
                      underwritingPaths.submissionDetail(submissionDetailId),
                    );
                    return;
                  }

                  navigate(underwritingPaths.quotationDetail(quotation.id));
                },
              })
            }
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
        <TabsList className="h-auto flex-wrap gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="payload">Authoritative Payload</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quotation Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Row label="Quotation Number" value={quotation.quotation_no} />
              <Row
                label="Flow"
                value={internalQuotation?.quotation_flow}
              />
              <Row
                label="Type"
                value={internalQuotation?.quotation_type}
              />
              <Row
                label="Channel"
                value={internalQuotation?.channel_type}
              />
              <Row
                label="Branch"
                value={internalQuotation?.branch_id}
              />
              <Row
                label="Department"
                value={internalQuotation?.department_id}
              />
              <Row
                label="Category"
                value={internalQuotation?.category_id}
              />
              <Row
                label="Product"
                value={internalQuotation?.product_id}
              />
              <Row
                label="Sub-Class"
                value={internalQuotation?.sub_class_id}
              />
              <Row
                label="Policyholder"
                value={policyHolder?.policy_holder_name}
              />
              <Row
                label="Premium"
                value={`${detail?.fleet_hdr?.currency_code ?? detail?.currency_code ?? 'TZS'} ${
                  detail?.fleet_hdr
                    ?.total_premium_including_tax ??
                  detail?.total_premium_including_tax ??
                  0
                }`}
              />
              <Row
                label="Cover Period"
                value={`${
                  detail?.fleet_hdr?.cover_note_start_date ??
                  detail?.cover_note_start_date
                } to ${
                  detail?.fleet_hdr?.cover_note_end_date ??
                  detail?.cover_note_end_date
                }`}
              />
              <Row label="Submitted At" value={quotation.submitted_at} />
              <Row label="Created At" value={quotation.created_at} />
              <Row label="Updated At" value={quotation.updated_at} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payload">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Authoritative Payload</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="max-h-[40rem] overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
                {JSON.stringify(payload ?? quotation, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Quotation"
        description="This deletes the quotation draft from the current company workspace."
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
