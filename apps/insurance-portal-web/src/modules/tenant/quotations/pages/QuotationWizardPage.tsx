import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calculator, CheckCircle2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { PageHeader } from '@/components/shared/PageHeader';
import { getCustomerDisplayName } from '@/modules/tenant/customers/types';
import { useRequiredFactorsByRisk } from '@/modules/tenant/product-engine/hooks';
import { quotationsApi } from '../api';
import { useQuotationCategories, useQuotationCustomers, useQuotationProducts, useQuotationRisks, useQuotationSubClasses, useQuotationCurrentCompanyId } from '../hooks';
import { buildQuotationPayload, quotationFormSchema, type QuotationFormSchemaValues } from '../schemas';
import type { QuotationWizardFactorInput } from '../types';
import { tiramisApi } from '@/modules/tenant/tiramis/api';
import { buildQuotationTiramisPayload } from '@/modules/tenant/tiramis/utils';
import { underwritingPaths } from '@/modules/tenant/underwriting/paths';

const EMPTY_REQUIRED_FACTORS: never[] = [];

export function QuotationWizardPage() {
  const navigate = useNavigate();
  const companyId = useQuotationCurrentCompanyId();
  const { data: customerOptions = [] } = useQuotationCustomers();
  const { data: categoryOptions = [] } = useQuotationCategories();
  const [step, setStep] = useState(1);

  const form = useForm<QuotationFormSchemaValues>({
    resolver: zodResolver(quotationFormSchema),
    defaultValues: {
      insurer_company_id: companyId,
      intermediary_company_id: '',
      branch_id: '',
      department_id: '',
      customer_id: '',
      category_id: '',
      product_id: '',
      sub_class_id: '',
      quotation_type: 'NON_MOTOR',
      channel_type: 'DIRECT',
      status: 'DRAFT',
      currency: 'TZS',
      sum_insured: '',
      basic_premium: '',
      total_discount: '',
      total_tax: '',
      total_charges: '',
      total_commission: '',
      total_premium: '',
      net_premium: '',
      valid_from: new Date().toISOString().slice(0, 10),
      valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      rating_version: '',
      rejection_reason: '',
    },
  });

  const categoryId = form.watch('category_id');
  const productId = form.watch('product_id');
  const { data: productOptions = [] } = useQuotationProducts(categoryId);
  const { data: subClassOptions = [] } = useQuotationSubClasses(productId);
  const { data: riskOptions = [] } = useQuotationRisks(productId);
  const selectedRisk = riskOptions[0] ?? null;
  const { data: factorDefinitionsData } = useRequiredFactorsByRisk(selectedRisk?.id ?? '');
  const factorDefinitions = factorDefinitionsData ?? EMPTY_REQUIRED_FACTORS;
  const [factorInputs, setFactorInputs] = useState<QuotationWizardFactorInput[]>([]);
  const [calcResult, setCalcResult] = useState<any>(null);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const nextInputs = factorDefinitions.map((factor) => ({
      factor_id: factor.factor_id,
      label: factor.factor.name,
      data_type: factor.factor.data_type,
      value_text: '',
      value_number: '',
      value_date: '',
      value_boolean: false,
    }));

    setFactorInputs((current) => {
      if (
        current.length === nextInputs.length &&
        current.every((item, index) => item.factor_id === nextInputs[index]?.factor_id)
      ) {
        return current;
      }
      return nextInputs;
    });
  }, [factorDefinitions]);

  const factorValues = useMemo(
    () =>
      factorInputs.reduce<Record<string, string | number | boolean>>((acc, item) => {
        if (item.data_type === 'BOOLEAN') {
          acc[item.factor_id] = item.value_boolean;
          return acc;
        }
        if (item.data_type === 'NUMBER') {
          acc[item.factor_id] = item.value_number || '';
          return acc;
        }
        if (item.data_type === 'DATE') {
          acc[item.factor_id] = item.value_date || '';
          return acc;
        }
        acc[item.factor_id] = item.value_text || '';
        return acc;
      }, {}),
    [factorInputs],
  );

  async function calculate() {
    if (!selectedRisk) return;
    const sumInsured = Number(form.getValues('sum_insured') || 0);
    setCalculating(true);
    try {
      const result = await quotationsApi.calculateSingle({
        risk_id: selectedRisk.id,
        sum_insured: sumInsured,
        factors: factorValues,
      });
      setCalcResult(result);
      form.setValue('basic_premium', String(result.final_premium ?? result.gross_premium ?? 0));
      form.setValue('total_premium', String(result.final_premium ?? result.gross_premium ?? 0));
      form.setValue('net_premium', String(result.final_premium ?? result.gross_premium ?? 0));
    } finally {
      setCalculating(false);
    }
  }

  async function saveQuotation() {
    setSaving(true);
    try {
      const values = form.getValues();
      const payload = buildQuotationPayload(values);
      if (selectedRisk) {
        payload.risks = [
          {
            risk_id: selectedRisk.id,
            sum_insured: Number(values.sum_insured || 0),
            basic_premium: Number(values.basic_premium || 0),
            total_premium: Number(values.total_premium || 0),
            net_premium: Number(values.net_premium || 0),
            rating_result_metadata: calcResult ?? null,
          },
        ];
        payload.factor_values = factorInputs.map((item) => ({
          quotation_risk_id: undefined,
          factor_id: item.factor_id,
          value_text: item.data_type === 'TEXT' ? item.value_text || null : null,
          value_number: item.data_type === 'NUMBER' ? Number(item.value_number || 0) : null,
          value_date: item.data_type === 'DATE' ? item.value_date || null : null,
          value_boolean: item.data_type === 'BOOLEAN' ? item.value_boolean : null,
          value_json: null,
        }));
      }
      const quotation = await quotationsApi.create(payload);
      try {
        const submissionResult = await tiramisApi.submit(buildQuotationTiramisPayload(quotation)) as { submission?: { id: string } };
        if (submissionResult.submission) {
          navigate(underwritingPaths.submissionDetail(submissionResult.submission.id));
          return;
        }
      } catch {
        // If submission fails, keep the created quotation accessible for manual follow-up.
      }
      navigate(underwritingPaths.quotationDetail(quotation.id));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(underwritingPaths.quotations)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader title="Quotation Wizard" description="Guided quotation creation with automatic TIRAMIS submission" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 flex flex-wrap gap-2">
              {['Customer', 'Product', 'Risk', 'Calculate', 'Review', 'Save'].map((label, index) => (
                <Button
                  key={label}
                  type="button"
                  variant={step === index + 1 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStep(index + 1)}
                >
                  {label}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Form {...form}>
            <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
              {step === 1 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Step 1. Customer and Context</CardTitle></CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <FormField control={form.control} name="customer_id" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {customerOptions.map((customer) => (
                              <SelectItem key={customer.id} value={customer.id}>{getCustomerDisplayName(customer)} ({customer.customer_no})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="quotation_type" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quotation Type</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent><SelectItem value="MOTOR">Motor</SelectItem><SelectItem value="NON_MOTOR">Non-Motor</SelectItem></SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="channel_type" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Channel</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {['DIRECT', 'BROKER', 'AGENCY', 'BANCASSURANCE', 'API'].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="currency" render={({ field }) => (
                      <FormItem><FormLabel>Currency</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="valid_from" render={({ field }) => (
                      <FormItem><FormLabel>Valid From</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="valid_until" render={({ field }) => (
                      <FormItem><FormLabel>Valid Until</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                    )} />
                  </CardContent>
                </Card>
              )}

              {step === 2 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Step 2. Product and Risk</CardTitle></CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <FormField control={form.control} name="category_id" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select value={field.value} onValueChange={(value) => { field.onChange(value); form.setValue('product_id', ''); form.setValue('sub_class_id', ''); }}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                          <SelectContent>{categoryOptions.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="product_id" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product</FormLabel>
                        <Select value={field.value} onValueChange={(value) => { field.onChange(value); form.setValue('sub_class_id', ''); }}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger></FormControl>
                          <SelectContent>{productOptions.map((product) => <SelectItem key={product.id} value={product.id}>{product.product_name}</SelectItem>)}</SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="sub_class_id" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sub-Class</FormLabel>
                        <Select value={field.value || 'none'} onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {subClassOptions.map((subClass) => <SelectItem key={subClass.id} value={subClass.id}>{subClass.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="sum_insured" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sum Insured</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                      </FormItem>
                    )} />
                  </CardContent>
                </Card>
              )}

              {step === 3 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Step 3. Risk Factors</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-sm text-slate-500">Selected risk: {selectedRisk ? selectedRisk.risk_name : 'No risk available for the selected product'}</div>
                    {factorInputs.length > 0 ? factorInputs.map((factor, index) => (
                      <div key={factor.factor_id} className="grid gap-3 md:grid-cols-2">
                        <div className="text-sm font-medium">{factor.label}</div>
                        {factor.data_type === 'BOOLEAN' ? (
                          <Checkbox
                            checked={factor.value_boolean}
                            onCheckedChange={(checked) => setFactorInputs((prev) => prev.map((item, i) => i === index ? { ...item, value_boolean: Boolean(checked) } : item))}
                          />
                        ) : factor.data_type === 'DATE' ? (
                          <Input type="date" value={factor.value_date} onChange={(e) => setFactorInputs((prev) => prev.map((item, i) => i === index ? { ...item, value_date: e.target.value } : item))} />
                        ) : factor.data_type === 'NUMBER' ? (
                          <Input type="number" value={factor.value_number} onChange={(e) => setFactorInputs((prev) => prev.map((item, i) => i === index ? { ...item, value_number: e.target.value } : item))} />
                        ) : (
                          <Input value={factor.value_text} onChange={(e) => setFactorInputs((prev) => prev.map((item, i) => i === index ? { ...item, value_text: e.target.value } : item))} />
                        )}
                      </div>
                    )) : (
                      <p className="text-sm text-slate-500">No required factors for this risk.</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {step === 4 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Step 4. Calculate Premium</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <Button type="button" onClick={calculate} disabled={calculating || !selectedRisk}>
                      <Calculator className="mr-2 h-4 w-4" />
                      {calculating ? 'Calculating...' : 'Run Calculation'}
                    </Button>
                    {calcResult && (
                      <div className="rounded-lg border border-slate-200 p-4 text-sm">
                        <div className="flex items-center gap-2 font-medium text-slate-900">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          Premium calculated
                        </div>
                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          <div>Gross: {calcResult.gross_premium ?? calcResult.final_premium}</div>
                          <div>Final: {calcResult.final_premium ?? calcResult.gross_premium}</div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {step === 5 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Step 5. Review</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p>Customer: {customerOptions.find((item) => item.id === form.watch('customer_id'))?.customer_no ?? 'Not selected'}</p>
                    <p>Product: {productOptions.find((item) => item.id === form.watch('product_id'))?.product_name ?? 'Not selected'}</p>
                    <p>Premium: {form.watch('total_premium') || '0'}</p>
                    <p>Risk count: {selectedRisk ? 1 : 0}</p>
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => setStep((current) => Math.max(1, current - 1))} disabled={step === 1}>Back</Button>
                {step < 5 ? (
                  <Button type="button" onClick={() => setStep((current) => Math.min(5, current + 1))}>Next</Button>
                ) : (
                  <Button type="button" onClick={saveQuotation} disabled={saving || !companyId}>
                    {saving ? 'Saving...' : 'Save Quotation'}
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Current company: {companyId || 'Unavailable'}</p>
            <p>Selected category: {form.watch('category_id') || 'None'}</p>
            <p>Selected product: {form.watch('product_id') || 'None'}</p>
            <p>Selected risk: {selectedRisk?.risk_code ?? 'None'}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
