import { Calculator, CalendarDays, Car, FileText, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { UseFormReturn } from 'react-hook-form';
import type { CustomerRecord } from '@/modules/tenant/customers/types';
import type { QuotationFormSchemaValues } from '../../schemas';

interface OptionLike { id: string; name?: string; product_name?: string; }
interface Props {
  form: UseFormReturn<QuotationFormSchemaValues>;
  customerOptions: CustomerRecord[];
  categoryOptions: OptionLike[];
  productOptions: OptionLike[];
  riskCount: number;
}

function Metric({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: string }) {
  return <div className="flex items-start gap-2"><Icon className="mt-0.5 h-4 w-4 text-slate-400" aria-hidden="true" /><div><div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div><div className="truncate text-sm font-medium text-slate-800">{value}</div></div></div>;
}

export function QuotationSummary({ form, customerOptions, categoryOptions, productOptions, riskCount }: Props) {
  const values = form.watch();
  const customer = customerOptions.find((item) => item.id === values.customer_id);
  const category = categoryOptions.find((item) => item.id === values.category_id);
  const product = productOptions.find((item) => item.id === values.product_id);
  const customerName = customer?.full_name || customer?.company_name || values.policyholder.full_name || values.policyholder.company_name || 'Not selected';
  const flow = values.quotation_flow === 'NON_MOTOR' ? 'Non-motor' : values.is_fleet ? 'Motor fleet' : 'Motor single';
  const total = values.total_premium || values.net_premium || '0.00';
  const status = values.status.replace(/_/g, ' ').toLowerCase();

  return <Card className="quotation-summary-card border-slate-200 shadow-sm lg:sticky lg:top-4">
    <CardHeader className="border-b border-slate-100 pb-3"><div className="flex items-center justify-between gap-2"><CardTitle className="text-base">Quotation summary</CardTitle><Badge variant="muted">{status}</Badge></div><p className="text-xs text-slate-500">Updates as you complete the quotation.</p></CardHeader>
    <CardContent className="space-y-4 pt-4">
      <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Current quotation</div><div className="mt-1 text-lg font-semibold text-slate-900">{flow}</div><div className="mt-1 text-xs text-slate-500">{values.currency || 'TZS'} � {values.valid_from || 'Start date'} to {values.valid_until || 'End date'}</div></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <Metric icon={UserRound} label="Policyholder" value={customerName} />
        <Metric icon={FileText} label="Product" value={product?.product_name || 'Not selected'} />
        <Metric icon={FileText} label="Category" value={category?.name || 'Not selected'} />
        <Metric icon={Car} label="Risks" value={String(riskCount)} />
        <Metric icon={CalendarDays} label="Cover period" value={values.valid_from && values.valid_until ? `${values.valid_from}+�u���T ${values.valid_until}` : 'Not set'} />
      </div>
      <div className="border-t border-slate-100 pt-3"><div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500"><Calculator className="h-4 w-4" aria-hidden="true" />Premium</div><div className="mt-2 flex items-end justify-between gap-3"><span className="text-sm text-slate-500">Total including taxes</span><span className="text-xl font-bold text-slate-900">{values.currency || 'TZS'} {total}</span></div><div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-500"><span>Before tax <strong className="block text-slate-700">{values.basic_premium || '0.00'}</strong></span><span>Tax <strong className="block text-slate-700">{values.total_tax || '0.00'}</strong></span><span>Discount <strong className="block text-slate-700">{values.total_discount || '0.00'}</strong></span><span>Payment <strong className="block text-slate-700">{values.payment_mode_tira || 'Not set'}</strong></span></div></div>
    </CardContent>
  </Card>;
}
