import { Pencil } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getCustomerDisplayName,
  type CustomerRecord,
} from '@/modules/tenant/customers/types';
import type { InsuranceRisk } from '@/types/product-engine';
import { computeAddonAmounts } from '../utils/addonCalculations';
import type { QuotationFormSchemaValues } from '../../schemas';
import type { QuotationWizardStepId } from '../types';

interface OptionLike {
  id: string;
  name?: string;
  product_name?: string;
  customer_no?: string;
}

interface Props {
  form: UseFormReturn<QuotationFormSchemaValues>;
  customerOptions: CustomerRecord[];
  categoryOptions: OptionLike[];
  productOptions: OptionLike[];
  branchOptions: OptionLike[];
  riskOptions: InsuranceRisk[];
  riskCount: number;
  onEditStep: (stepId: QuotationWizardStepId) => void;
}

function SectionHeader({
  title,
  onEdit,
}: {
  title: string;
  onEdit: () => void;
}) {
  return (
    <CardHeader className="flex flex-row items-center justify-between">
      <CardTitle className="text-base">{title}</CardTitle>
      <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
        <Pencil className="mr-2 h-3.5 w-3.5" />
        Edit
      </Button>
    </CardHeader>
  );
}

export function SummaryReviewStep({
  form,
  customerOptions,
  categoryOptions,
  productOptions,
  branchOptions,
  riskOptions,
  riskCount,
  onEditStep,
}: Props) {
  const values = form.watch();
  const category = categoryOptions.find(
    (item) => item.id === values.category_id,
  );
  const product = productOptions.find((item) => item.id === values.product_id);
  const branch = branchOptions.find((item) => item.id === values.branch_id);
  const existingCustomer = customerOptions.find(
    (item) => item.id === values.customer_id,
  );
  const currency = values.currency?.trim().toUpperCase();
  const exchangeRate =
    currency && currency !== 'TZS' ? Number(values.exchange_rate) || 1 : 1;
  const enabledAddons = values.addons.filter((addon) => addon.enabled);
  const addonsTotal = enabledAddons.reduce(
    (sum, addon) =>
      sum + computeAddonAmounts(addon, exchangeRate).premiumIncludingTax,
    0,
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Step 7. Summary &amp; Review
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <Badge variant="outline">{values.quotation_type}</Badge>
          {values.is_fleet && <Badge variant="outline">Fleet</Badge>}
          <Badge>{values.status}</Badge>
        </CardContent>
      </Card>

      <Card>
        <SectionHeader
          title="Cover Note Setup"
          onEdit={() => onEditStep('cover-note')}
        />
        <CardContent className="grid gap-1 text-sm md:grid-cols-2">
          <p>Category: {category?.name ?? 'Not selected'}</p>
          <p>Product: {product?.product_name ?? 'Not selected'}</p>
          <p>Channel: {values.channel_type}</p>
          <p>Branch: {branch?.name ?? '—'}</p>
          <p>
            Currency: {values.currency}{' '}
            {currency !== 'TZS' && `(rate: ${values.exchange_rate || '—'})`}
          </p>
          <p>
            Cover period: {values.valid_from || '—'} to{' '}
            {values.valid_until || '—'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <SectionHeader
          title="Policyholder"
          onEdit={() => onEditStep('policyholder')}
        />
        <CardContent className="text-sm">
          {values.policyholder_mode === 'existing' ? (
            <p>
              {existingCustomer
                ? getCustomerDisplayName(existingCustomer)
                : 'Not selected'}{' '}
              {existingCustomer?.customer_no
                ? `(${existingCustomer.customer_no})`
                : ''}
            </p>
          ) : (
            <p>
              {values.policyholder.full_name ||
                (values.policyholder.customer_type === 'CORPORATE'
                  ? values.policyholder.company_name || 'New corporate customer'
                  : [
                      values.policyholder.first_name,
                      values.policyholder.last_name,
                    ]
                      .filter(Boolean)
                      .join(' ') || 'New individual customer')}
              {' — '}
              {values.policyholder.phone || 'no phone'}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <SectionHeader
          title="Risk & Premium"
          onEdit={() => onEditStep('risk-premium')}
        />
        <CardContent className="space-y-2 text-sm">
          {values.risks.map((risk, index) => {
            const riskDef = riskOptions.find((r) => r.id === risk.risk_id);
            return (
              <div
                key={index}
                className="flex items-center justify-between border-b border-slate-100 py-1 last:border-0"
              >
                <span>
                  {riskDef
                    ? `${riskDef.risk_name} (${riskDef.risk_code})`
                    : `Risk #${index + 1}`}
                </span>
                <span className="text-slate-500">
                  SI {risk.sum_insured || '0'} · Premium{' '}
                  {risk.total_premium || '0'}
                </span>
              </div>
            );
          })}
          <p className="pt-1 font-medium text-slate-900">{riskCount} risk(s)</p>
        </CardContent>
      </Card>

      {enabledAddons.length > 0 && (
        <Card>
          <SectionHeader title="Add-ons" onEdit={() => onEditStep('addons')} />
          <CardContent className="space-y-2 text-sm">
            {enabledAddons.map((addon, index) => (
              <div
                key={index}
                className="flex items-center justify-between border-b border-slate-100 py-1 last:border-0"
              >
                <span>
                  {addon.addon_reference || `Add-on #${index + 1}`} —{' '}
                  {addon.addon_desc}
                </span>
                <span className="text-slate-500">
                  {computeAddonAmounts(
                    addon,
                    exchangeRate,
                  ).premiumIncludingTax.toFixed(2)}
                </span>
              </div>
            ))}
            <p className="pt-1 font-medium text-slate-900">
              Total: {addonsTotal.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      )}

      {values.quotation_type === 'MOTOR' && !values.is_fleet && (
        <Card>
          <SectionHeader
            title="Motor Details"
            onEdit={() => onEditStep('motor')}
          />
          <CardContent className="text-sm">
            <p>
              {values.motor.registration_no ||
                values.motor.chassis_no ||
                'Vehicle not yet identified'}
            </p>
            <p className="text-slate-500">
              {values.motor.make} {values.motor.model} · Value{' '}
              {values.motor.vehicle_value || '—'}
            </p>
          </CardContent>
        </Card>
      )}

      {values.quotation_type === 'MOTOR' && values.is_fleet && (
        <Card>
          <SectionHeader
            title="Motor Fleet Details"
            onEdit={() => onEditStep('motor-fleet')}
          />
          <CardContent className="text-sm">
            <p>
              Fleet {values.fleet.header.fleet_no || '(no number yet)'} —{' '}
              {values.fleet.items.length} vehicle(s)
            </p>
            <p className="text-slate-500">
              Total sum insured:{' '}
              {values.fleet.items
                .reduce((sum, item) => sum + (Number(item.sum_insured) || 0), 0)
                .toFixed(2)}
              {' · '}
              Total premium:{' '}
              {values.fleet.items
                .reduce((sum, item) => sum + (Number(item.premium) || 0), 0)
                .toFixed(2)}
            </p>
          </CardContent>
        </Card>
      )}

      {values.quotation_type === 'NON_MOTOR' && (
        <Card>
          <SectionHeader
            title="Non-Motor Details"
            onEdit={() => onEditStep('non-motor')}
          />
          <CardContent className="space-y-1 text-sm">
            {values.nonMotor.items.length === 0 ? (
              <p className="text-slate-500">No subject matters added</p>
            ) : (
              values.nonMotor.items.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between border-b border-slate-100 py-1 last:border-0"
                >
                  <span>
                    {item.subject_code || `Subject matter #${index + 1}`} —{' '}
                    {item.description}
                  </span>
                  <span className="text-slate-500">
                    Insured: {item.insured_value || '—'}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Premium Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1 text-sm md:grid-cols-2">
          <p>Sum insured: {values.sum_insured || '0'}</p>
          <p>Basic premium: {values.basic_premium || '0'}</p>
          <p>Discount: {values.total_discount || '0'}</p>
          <p>Tax: {values.total_tax || '0'}</p>
          <p>Charges: {values.total_charges || '0'}</p>
          <p>Commission: {values.total_commission || '0'}</p>
          <p>Add-ons: {addonsTotal.toFixed(2)}</p>
          <p className="font-medium text-slate-900">
            Total premium: {values.total_premium || '0'}
          </p>
          <p className="font-medium text-slate-900">
            Net premium: {values.net_premium || '0'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
