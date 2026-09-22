import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  Check,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState, ErrorState } from '@/components/shared/ContentStates';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { portalApi } from '../api';

type SelectableCardProps = {
  selected: boolean;
  disabled?: boolean;
  title: string;
  description?: string | null;
  badge?: string;
  onClick: () => void;
};

function SelectableCard({
  selected,
  disabled = false,
  title,
  description,
  badge,
  onClick,
}: SelectableCardProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'w-full rounded-lg border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        selected
          ? 'border-blue-500 bg-blue-50'
          : 'border-slate-200 bg-white hover:bg-slate-50',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-slate-950">{title}</div>
          {description ? (
            <div className="mt-1 text-sm text-slate-500">{description}</div>
          ) : null}
        </div>
        {selected ? <Check className="h-4 w-4 shrink-0 text-blue-600" /> : null}
      </div>
      {badge ? (
        <Badge variant="outline" className="mt-3">
          {badge}
        </Badge>
      ) : null}
    </button>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function PortalBuyCoverPage() {
  const navigate = useNavigate();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [riskId, setRiskId] = useState<string | null>(null);

  const companiesQuery = useQuery({
    queryKey: ['customer-marketplace', 'companies'],
    queryFn: () => portalApi.listCustomerCompanies(),
  });

  const selectedCompanyId =
    companyId ??
    (companiesQuery.data?.length === 1 ? companiesQuery.data[0].id : null);

  const productsQuery = useQuery({
    queryKey: ['customer-marketplace', selectedCompanyId, 'products'],
    queryFn: () => portalApi.listCustomerCompanyProducts(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId),
  });

  const selectedProductId =
    productId ??
    (productsQuery.data?.length === 1 ? productsQuery.data[0].id : null);

  const risksQuery = useQuery({
    queryKey: [
      'customer-marketplace',
      selectedCompanyId,
      selectedProductId,
      'risks',
    ],
    queryFn: () =>
      portalApi.listCustomerCompanyProductRisks(
        selectedCompanyId!,
        selectedProductId!,
      ),
    enabled: Boolean(selectedCompanyId && selectedProductId),
  });

  const selectedRiskId =
    riskId ?? (risksQuery.data?.length === 1 ? risksQuery.data[0].id : null);

  const selectedCompany = useMemo(
    () =>
      companiesQuery.data?.find((item) => item.id === selectedCompanyId) ??
      null,
    [companiesQuery.data, selectedCompanyId],
  );

  const selectedProduct = useMemo(
    () =>
      productsQuery.data?.find((item) => item.id === selectedProductId) ?? null,
    [productsQuery.data, selectedProductId],
  );

  const selectedRisk = useMemo(
    () => risksQuery.data?.find((item) => item.id === selectedRiskId) ?? null,
    [risksQuery.data, selectedRiskId],
  );

  const currentStep = !selectedCompany ? 1 : !selectedProduct ? 2 : 3;
  const isReady = Boolean(selectedCompany && selectedProduct && selectedRisk);

  const startQuotationMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCompany || !selectedProduct || !selectedRisk) {
        throw new Error('Select a company, product, and risk first');
      }

      if (!selectedProduct.category) {
        throw new Error(
          'This product has no insurance category configured; contact support',
        );
      }

      await portalApi.ensureCustomerCompanyContext(selectedCompany.id);

      return portalApi.createQuotationDraft({
        category_id: selectedProduct.category.id,
        product_id: selectedProduct.id,
        quotation_type: 'MOTOR',
        quotation_flow: selectedProduct.supports_fleet
          ? 'MOTOR_FLEET'
          : 'MOTOR_SINGLE',
        channel_type: 'DIRECT',
        is_fleet: false,
        draft_payload: { risk_id: selectedRisk.id },
      });
    },
    onSuccess: () => {
      toast.success('Quotation started. Continue it from your quotations.');
      navigate('/customer/quotations');
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Could not start quotation',
      );
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Customer Portal"
        title="Buy Cover"
        description="Start with the insurer, pick the product, then choose the cover."
      />

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-3">
        {[
          ['1', 'Insurer', selectedCompany?.name],
          ['2', 'Product', selectedProduct?.name],
          ['3', 'Cover', selectedRisk?.name],
        ].map(([step, label, value], index) => {
          const active = currentStep === index + 1;
          const done = Boolean(value);

          return (
            <div
              key={step}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-3 py-2.5',
                active
                  ? 'border-blue-500 bg-blue-50'
                  : done
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-slate-100 bg-slate-50',
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  done
                    ? 'bg-emerald-600 text-white'
                    : active
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 text-slate-500',
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : step}
              </span>
              <div className="min-w-0">
                <div className="text-xs font-medium uppercase text-slate-500">
                  {label}
                </div>
                <div className="truncate text-sm font-semibold text-slate-950">
                  {value || 'Not selected'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <section className="grid gap-5 xl:grid-cols-3">
        <Card className="rounded-xl border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-slate-500" />
              Insurance Company
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {companiesQuery.isLoading ? (
              <LoadingState label="Loading companies..." />
            ) : companiesQuery.isError ? (
              <ErrorState
                description="Insurance companies could not be loaded."
                onRetry={() => {
                  void companiesQuery.refetch();
                }}
              />
            ) : (companiesQuery.data?.length ?? 0) === 0 ? (
              <EmptyState
                title="No companies available"
                description="No active insurance companies are available."
              />
            ) : (
              companiesQuery.data?.map((company) => (
                <SelectableCard
                  key={company.id}
                  selected={selectedCompanyId === company.id}
                  title={company.name}
                  description={company.description ?? company.contact_phone}
                  badge={company.tira_ready ? 'TIRAMIS ready' : 'Active'}
                  onClick={() => {
                    setCompanyId(company.id);
                    setProductId(null);
                    setRiskId(null);
                  }}
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-slate-500" />
              Product
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!selectedCompanyId ? (
              <EmptyState title="Select an insurer first" />
            ) : productsQuery.isLoading ? (
              <LoadingState label="Loading products..." />
            ) : productsQuery.isError ? (
              <ErrorState
                description="Products could not be loaded."
                onRetry={() => {
                  void productsQuery.refetch();
                }}
              />
            ) : (productsQuery.data?.length ?? 0) === 0 ? (
              <EmptyState title="No products available" />
            ) : (
              productsQuery.data?.map((product) => (
                <SelectableCard
                  key={product.id}
                  selected={selectedProductId === product.id}
                  title={product.name}
                  description={product.description ?? product.category?.name}
                  badge={product.supports_fleet ? 'Fleet capable' : undefined}
                  onClick={() => {
                    setProductId(product.id);
                    setRiskId(null);
                  }}
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Cover</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!selectedProductId ? (
              <EmptyState title="Select a product first" />
            ) : risksQuery.isLoading ? (
              <LoadingState label="Loading cover options..." />
            ) : risksQuery.isError ? (
              <ErrorState
                description="Cover options could not be loaded."
                onRetry={() => {
                  void risksQuery.refetch();
                }}
              />
            ) : (risksQuery.data?.length ?? 0) === 0 ? (
              <EmptyState title="No cover options available" />
            ) : (
              risksQuery.data?.map((risk) => (
                <SelectableCard
                  key={risk.id}
                  selected={selectedRiskId === risk.id}
                  title={risk.name}
                  description={risk.description}
                  onClick={() => setRiskId(risk.id)}
                />
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-600">
          {isReady
            ? `${selectedCompany?.name} / ${selectedProduct?.name} / ${selectedRisk?.name}`
            : 'Complete the three selections to start your quotation.'}
        </div>
        <Button
          disabled={!isReady || startQuotationMutation.isPending}
          onClick={() => startQuotationMutation.mutate()}
          className="sm:min-w-44"
        >
          {startQuotationMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              Start quotation
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
