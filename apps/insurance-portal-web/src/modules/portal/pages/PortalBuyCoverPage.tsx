import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Building2, Check, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState, ErrorState } from '@/components/shared/ContentStates';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { portalApi } from '../api';

export function PortalBuyCoverPage() {
  const navigate = useNavigate();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [riskId, setRiskId] = useState<string | null>(null);

  const companiesQuery = useQuery({
    queryKey: ['customer-marketplace', 'companies'],
    queryFn: () => portalApi.listCustomerCompanies(),
  });

  const productsQuery = useQuery({
    queryKey: ['customer-marketplace', companyId, 'products'],
    queryFn: () => portalApi.listCustomerCompanyProducts(companyId!),
    enabled: Boolean(companyId),
  });

  const risksQuery = useQuery({
    queryKey: ['customer-marketplace', companyId, productId, 'risks'],
    queryFn: () =>
      portalApi.listCustomerCompanyProductRisks(companyId!, productId!),
    enabled: Boolean(companyId && productId),
  });

  const contextMutation = useMutation({
    mutationFn: (selectedCompanyId: string) =>
      portalApi.ensureCustomerCompanyContext(selectedCompanyId),
    onSuccess: () => toast.success('Insurance company selected'),
  });

  const selectedCompany = useMemo(
    () => companiesQuery.data?.find((item) => item.id === companyId) ?? null,
    [companiesQuery.data, companyId],
  );

  const selectedProduct = useMemo(
    () => productsQuery.data?.find((item) => item.id === productId) ?? null,
    [productsQuery.data, productId],
  );

  const selectedRisk = useMemo(
    () => risksQuery.data?.find((item) => item.id === riskId) ?? null,
    [risksQuery.data, riskId],
  );

  const startQuotationMutation = useMutation({
    mutationFn: () => {
      if (!selectedCompany || !selectedProduct || !selectedRisk) {
        throw new Error('Select a company, product, and risk first');
      }

      if (!selectedProduct.category) {
        throw new Error(
          'This product has no insurance category configured; contact support',
        );
      }

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
        description="Choose an insurer, product, and risk to start a secure cover request."
      />

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="rounded-xl border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-slate-500" />
              Insurance Company
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {companiesQuery.isError ? (
              <ErrorState
                description="Insurance companies could not be loaded."
                onRetry={() => {
                  void companiesQuery.refetch();
                }}
              />
            ) : (companiesQuery.data?.length ?? 0) === 0 ? (
              <EmptyState
                title="No companies available"
                description="No insurer currently has customer portal sales enabled. Ask an administrator to enable it for at least one active, TIRA-integrated insurance company."
              />
            ) : (
              companiesQuery.data?.map((company) => (
                <button
                  key={company.id}
                  type="button"
                  onClick={() => {
                    setCompanyId(company.id);
                    setProductId(null);
                    setRiskId(null);
                    contextMutation.mutate(company.id);
                  }}
                  className={cn(
                    'w-full rounded-lg border p-4 text-left transition-colors',
                    companyId === company.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-950">
                        {company.name}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {company.description ?? company.contact_phone ?? ''}
                      </div>
                    </div>
                    {companyId === company.id ? (
                      <Check className="h-4 w-4 text-blue-600" />
                    ) : null}
                  </div>
                  <Badge variant="outline" className="mt-3">
                    TIRAMIS ready
                  </Badge>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-slate-500" />
                Product
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!companyId ? (
                <EmptyState
                  title="Select a company"
                  description="Products are loaded from the selected insurer."
                />
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
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => {
                      setProductId(product.id);
                      setRiskId(null);
                    }}
                    className={cn(
                      'w-full rounded-lg border p-4 text-left transition-colors',
                      productId === product.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 bg-white hover:bg-slate-50',
                    )}
                  >
                    <div className="font-medium text-slate-950">
                      {product.name}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {product.description ?? product.category?.name ?? ''}
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Risk</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!productId ? (
                <EmptyState title="Select a product" />
              ) : risksQuery.isError ? (
                <ErrorState
                  description="Risks could not be loaded."
                  onRetry={() => {
                    void risksQuery.refetch();
                  }}
                />
              ) : (risksQuery.data?.length ?? 0) === 0 ? (
                <EmptyState title="No risks available" />
              ) : (
                risksQuery.data?.map((risk) => (
                  <button
                    key={risk.id}
                    type="button"
                    onClick={() => setRiskId(risk.id)}
                    className={cn(
                      'w-full rounded-lg border p-4 text-left transition-colors',
                      riskId === risk.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 bg-white hover:bg-slate-50',
                    )}
                  >
                    <div className="font-medium text-slate-950">
                      {risk.name}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {risk.description ?? ''}
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="flex justify-end">
        <Button
          disabled={
            !selectedCompany ||
            !productId ||
            !riskId ||
            startQuotationMutation.isPending
          }
          onClick={() => startQuotationMutation.mutate()}
        >
          {startQuotationMutation.isPending ? 'Starting...' : 'Continue'}
        </Button>
      </div>
    </div>
  );
}
