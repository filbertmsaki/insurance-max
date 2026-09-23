import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState, ErrorState } from '@/components/shared/ContentStates';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  useQuotationCategories,
  useQuotationProducts,
  useQuotationRisks,
} from '@/modules/tenant/quotations/hooks';
import type { InsuranceBusinessLine } from '@/types/product-engine';

import {
  portalApi,
  type CreateQuotationDraftPayload,
  type PortalBusinessRecord,
} from '../api';

type QuotationFlow = 'MOTOR_SINGLE' | 'MOTOR_FLEET' | 'NON_MOTOR';

interface DraftFormState {
  customer_id: string;
  category_id: string;
  product_id: string;
  sub_class_id: string;
  quotation_flow: QuotationFlow;
  risk_id: string;
  valid_from: string;
  valid_until: string;
  sum_insured: string;
  description: string;
}

const today = new Date().toISOString().slice(0, 10);

function defaultValidUntil() {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

const emptyState: DraftFormState = {
  customer_id: '',
  category_id: '',
  product_id: '',
  sub_class_id: '',
  quotation_flow: 'MOTOR_SINGLE',
  risk_id: '',
  valid_from: today,
  valid_until: defaultValidUntil(),
  sum_insured: '',
  description: '',
};

export function IntermediaryQuotationFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<DraftFormState>(emptyState);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const businessLine: InsuranceBusinessLine =
    form.quotation_flow === 'NON_MOTOR' ? 'NON_MOTOR' : 'MOTOR';

  const quotationQuery = useQuery({
    queryKey: ['portal', 'intermediary', 'quotations', id],
    enabled: isEdit,
    queryFn: () =>
      portalApi.getBusinessRecord('intermediary', 'quotations', id!),
  });

  const customersQuery = useQuery({
    queryKey: ['portal', 'intermediary', 'customers', 'selector'],
    queryFn: () =>
      portalApi.listBusinessRecords('intermediary', 'customers', {
        limit: 100,
      }),
  });

  const { data: categories = [] } = useQuotationCategories(businessLine);
  const { data: products = [] } = useQuotationProducts({
    business_line: businessLine,
    supports_fleet: form.quotation_flow === 'MOTOR_FLEET' ? true : undefined,
  });
  const { data: risks = [] } = useQuotationRisks(form.product_id);

  useEffect(() => {
    if (!quotationQuery.data) {
      return;
    }

    const quotation = quotationQuery.data;
    const draftPayload = objectRecord(quotation.draft_payload);

    const handle = window.setTimeout(() => {
      setForm({
        customer_id: text(quotation.customer_id) ?? '',
        category_id: text(quotation.category_id) ?? '',
        product_id: text(quotation.product_id) ?? '',
        sub_class_id: text(quotation.sub_class_id) ?? '',
        quotation_flow:
          normalizeFlow(text(quotation.quotation_flow)) ?? 'MOTOR_SINGLE',
        risk_id:
          text(draftPayload?.risk_id) ?? text(draftPayload?.riskId) ?? '',
        valid_from: text(draftPayload?.valid_from) ?? today,
        valid_until: text(draftPayload?.valid_until) ?? defaultValidUntil(),
        sum_insured: text(draftPayload?.sum_insured) ?? '',
        description:
          text(draftPayload?.description) ??
          text(quotation.cover_note_desc) ??
          text(quotation.description) ??
          '',
      });
    }, 0);

    return () => window.clearTimeout(handle);
  }, [quotationQuery.data]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === form.product_id),
    [form.product_id, products],
  );

  const selectedRisk = useMemo(
    () => risks.find((risk) => risk.id === form.risk_id),
    [form.risk_id, risks],
  );

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = buildDraftPayload(form, {
        productCode:
          selectedProduct?.tiramis_product_code ??
          selectedProduct?.product_code ??
          null,
        riskName: selectedRisk?.risk_name ?? null,
      });

      return isEdit
        ? portalApi.updateQuotationDraft('intermediary', id!, {
            ...payload,
            expected_updated_at:
              text(quotationQuery.data?.updated_at) ?? undefined,
          })
        : portalApi.createQuotationDraft(payload, 'intermediary');
    },
    onSuccess: async (quotation) => {
      toast.success(
        isEdit ? 'Quotation draft updated' : 'Quotation draft saved',
      );
      await queryClient.invalidateQueries({
        queryKey: ['portal', 'intermediary', 'quotations'],
      });
      navigate(`/intermediary/quotations/${quotation.id}`);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => portalApi.deleteQuotationDraft('intermediary', id!),
    onSuccess: async () => {
      toast.success('Quotation draft deleted');
      await queryClient.invalidateQueries({
        queryKey: ['portal', 'intermediary', 'quotations'],
      });
      navigate('/intermediary/quotations');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveMutation.mutate();
  };

  if (isEdit && quotationQuery.isError) {
    return (
      <ErrorState
        description="This quotation could not be loaded for editing."
        onRetry={() => {
          void quotationQuery.refetch();
        }}
      />
    );
  }

  if (isEdit && quotationQuery.isLoading) {
    return (
      <EmptyState
        title="Loading quotation"
        description="The draft editor will appear in a moment."
      />
    );
  }

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Quotation Draft"
        description="This archives the draft quotation. Submitted or completed quotations cannot be deleted."
        confirmLabel="Delete Draft"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/intermediary/quotations">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <PageHeader
            eyebrow="Intermediary Portal"
            title={isEdit ? 'Edit Quotation Draft' : 'New Quotation Draft'}
            description="Capture the customer, product, risk, and cover basics before underwriting finalization."
          />
        </div>

        {isEdit ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete Draft
          </Button>
        ) : null}
      </div>

      <form className="space-y-6" onSubmit={submit}>
        <Card className="rounded-xl border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Quotation Scope</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Customer</Label>
              <Select
                value={form.customer_id}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, customer_id: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {(customersQuery.data?.items ?? []).map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {recordLabel(customer)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Flow</Label>
              <Select
                value={form.quotation_flow}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    quotation_flow: value as QuotationFlow,
                    category_id: '',
                    product_id: '',
                    risk_id: '',
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MOTOR_SINGLE">Motor single</SelectItem>
                  <SelectItem value="MOTOR_FLEET">Motor fleet</SelectItem>
                  <SelectItem value="NON_MOTOR">Non-motor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={form.category_id}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    category_id: value,
                    product_id: '',
                    risk_id: '',
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Product</Label>
              <Select
                value={form.product_id}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    product_id: value,
                    risk_id: '',
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products
                    .filter(
                      (product) =>
                        !form.category_id ||
                        product.category_id === form.category_id,
                    )
                    .map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.product_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Risk</Label>
              <Select
                value={form.risk_id}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, risk_id: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select risk" />
                </SelectTrigger>
                <SelectContent>
                  {risks.map((risk) => (
                    <SelectItem key={risk.id} value={risk.id}>
                      {risk.risk_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Cover Basics</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="portal-quote-from">Start date</Label>
              <Input
                id="portal-quote-from"
                type="date"
                required
                value={form.valid_from}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    valid_from: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="portal-quote-until">End date</Label>
              <Input
                id="portal-quote-until"
                type="date"
                required
                value={form.valid_until}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    valid_until: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="portal-quote-sum">Sum insured</Label>
              <Input
                id="portal-quote-sum"
                type="number"
                min="0"
                step="0.01"
                value={form.sum_insured}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    sum_insured: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="portal-quote-description">Description</Label>
              <Textarea
                id="portal-quote-description"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button asChild type="button" variant="outline">
            <Link to="/intermediary/quotations">Cancel</Link>
          </Button>
          <Button
            type="submit"
            disabled={
              saveMutation.isPending ||
              !form.customer_id ||
              !form.category_id ||
              !form.product_id
            }
          >
            {saveMutation.isPending ? 'Saving...' : 'Save Draft'}
          </Button>
        </div>
      </form>
    </div>
  );
}

function buildDraftPayload(
  form: DraftFormState,
  context: { productCode: string | null; riskName: string | null },
): CreateQuotationDraftPayload {
  const quotationType =
    form.quotation_flow === 'NON_MOTOR' ? 'NON_MOTOR' : 'MOTOR';

  return {
    category_id: form.category_id,
    product_id: form.product_id,
    sub_class_id: form.sub_class_id || null,
    quotation_type: quotationType,
    quotation_flow: form.quotation_flow,
    channel_type: 'BROKER',
    is_fleet: form.quotation_flow === 'MOTOR_FLEET',
    current_wizard_step: 'portal-draft',
    draft_payload: {
      ...form,
      quotation_type: quotationType,
      product_code: context.productCode,
      risk_name: context.riskName,
    },
  };
}

function recordLabel(record: PortalBusinessRecord) {
  return (
    text(record.name) ??
    text(record.customer_no) ??
    text(record.policy_no) ??
    text(record.quotation_no) ??
    text(record.id) ??
    'Record'
  );
}

function normalizeFlow(value: string | null): QuotationFlow | null {
  if (
    value === 'MOTOR_SINGLE' ||
    value === 'MOTOR_FLEET' ||
    value === 'NON_MOTOR'
  ) {
    return value;
  }

  return null;
}

function text(value: unknown) {
  const result = typeof value === 'string' ? value.trim() : value?.toString();
  return result || null;
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}
