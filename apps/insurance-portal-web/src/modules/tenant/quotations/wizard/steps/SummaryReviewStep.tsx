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
import { buildQuotationPayloadPreview } from '../utils/quotationPayloadPreview';
import { formatCoverDateLabel } from '../utils/coverNoteDateRange';

interface OptionLike {
  id: string;
  name?: string;
  product_name?: string;
  customer_no?: string;
  product_code?: string;
  tiramis_product_code?: string | null;
}

interface SalePointOptionLike {
  id: string;
  salePointCode?: string;
}

interface Props {
  form: UseFormReturn<QuotationFormSchemaValues>;
  customerOptions: CustomerRecord[];
  categoryOptions: OptionLike[];
  productOptions: OptionLike[];
  branchOptions: OptionLike[];
  salePointOptions?: SalePointOptionLike[];
  riskOptions: InsuranceRisk[];
  riskCount: number;
  onEditStep: (stepId: QuotationWizardStepId) => void;
}

function SectionHeader({
  title,
  onEdit,
}: {
  title: string;
  onEdit?: () => void;
}) {
  return (
    <CardHeader className="flex flex-row items-center justify-between">
      <CardTitle className="text-base">{title}</CardTitle>
      {onEdit ? (
        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
          <Pencil className="mr-2 h-3.5 w-3.5" />
          Edit
        </Button>
      ) : null}
    </CardHeader>
  );
}

export function SummaryReviewStep({
  form,
  customerOptions,
  categoryOptions,
  productOptions,
  branchOptions,
  salePointOptions = [],
  riskOptions,
  riskCount,
  onEditStep,
}: Props) {
  const values = form.watch();
  const category = categoryOptions.find((item) => item.id === values.category_id);
  const product = productOptions.find((item) => item.id === values.product_id);
  const branch = branchOptions.find((item) => item.id === values.branch_id);
  const existingCustomer = customerOptions.find((item) => item.id === values.customer_id);
  const salePoint = salePointOptions.find((item) => item.id === values.sale_point_id);
  const currency = values.currency?.trim().toUpperCase();
  const exchangeRate =
    currency && currency !== 'TZS' ? Number(values.exchange_rate) || 1 : 1;
  const enabledAddons = values.addons.filter((addon) => addon.enabled);
  const addonsTotal = enabledAddons.reduce(
    (sum, addon) =>
      sum + computeAddonAmounts(addon, exchangeRate).premiumIncludingTax,
    0,
  );
  const fleetTotalSumInsured = values.fleet.items.reduce(
    (sum, item) =>
      sum +
      item.risks_covered.reduce(
        (riskSum, risk) => riskSum + (Number(risk.sum_insured) || 0),
        0,
      ),
    0,
  );
  const fleetTotalPremium = values.fleet.items.reduce(
    (sum, item) =>
      sum +
      item.risks_covered.reduce(
        (riskSum, risk) =>
          riskSum + (Number(risk.premium_including_tax) || 0),
        0,
      ),
    0,
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Final Review</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <Badge variant="outline">{values.quotation_type}</Badge>
          {values.is_fleet ? <Badge variant="outline">Fleet</Badge> : null}
          <Badge>{values.status}</Badge>
        </CardContent>
      </Card>

      <Card>
        <SectionHeader
          title={values.is_fleet ? 'Fleet & Cover Note Setup' : 'Cover Note Setup'}
          onEdit={() => onEditStep(values.is_fleet ? 'fleet-setup' : 'cover-note')}
        />
        <CardContent className="grid gap-1 text-sm md:grid-cols-2">
          <p>Category: {category?.name ?? 'Not selected'}</p>
          <p>Product: {product?.product_name ?? 'Not selected'}</p>
          <p>Channel: {values.channel_type}</p>
          <p>Branch: {branch?.name ?? '-'}</p>
          <p>Sale point: {salePoint?.salePointCode ?? '-'}</p>
          <p>
            Currency: {values.currency}{' '}
            {currency !== 'TZS' ? `(rate: ${values.exchange_rate || '-'})` : ''}
          </p>
          <p>
            Cover period: {formatCoverDateLabel(values.valid_from)} to{' '}
            {formatCoverDateLabel(values.valid_until)}
          </p>
          <p>Commission paid: {values.commission_paid || values.total_commission || '0'}</p>
          <p>Commission rate: {values.commission_rate || '0'}</p>
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
              {existingCustomer ? getCustomerDisplayName(existingCustomer) : 'Not selected'}{' '}
              {existingCustomer?.customer_no ? `(${existingCustomer.customer_no})` : ''}
            </p>
          ) : (
            <p>
              {values.policyholder.full_name ||
                (values.policyholder.customer_type === 'CORPORATE'
                  ? values.policyholder.company_name || 'New corporate customer'
                  : [values.policyholder.first_name, values.policyholder.last_name]
                      .filter(Boolean)
                      .join(' ') || 'New individual customer')}
              {' - '}
              {values.policyholder.phone || 'no phone'}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <SectionHeader
          title="Risk & Premium"
          onEdit={() => onEditStep(values.is_fleet ? 'fleet-vehicles' : 'risk-premium')}
        />
        <CardContent className="space-y-2 text-sm">
          {values.risks.map((risk, index) => {
            const riskDef = riskOptions.find((item) => item.id === risk.risk_id);
            return (
              <div
                key={`${risk.client_ref}-${index}`}
                className="flex items-center justify-between border-b border-slate-100 py-1 last:border-0"
              >
                <span>
                  {riskDef
                    ? `${riskDef.risk_name} (${riskDef.risk_code})`
                    : risk.risk_code || `Risk #${index + 1}`}
                </span>
                <span className="text-slate-500">
                  SI {risk.sum_insured || '0'} - Premium {risk.total_premium || risk.premium_including_tax || '0'}
                </span>
              </div>
            );
          })}
          <p className="pt-1 font-medium text-slate-900">{riskCount} risk(s)</p>
        </CardContent>
      </Card>

      {values.quotation_type === 'NON_MOTOR' ? (
        <Card>
          <SectionHeader title="Subject Matters" onEdit={() => onEditStep('risk-premium')} />
          <CardContent className="space-y-2 text-sm">
            {values.nonMotor.items.map((subject, index) => (
              <div
                key={`${subject.subject_matter_reference}-${index}`}
                className="flex items-center justify-between border-b border-slate-100 py-1 last:border-0"
              >
                <span>{subject.subject_matter_reference || `Subject #${index + 1}`}</span>
                <span className="text-slate-500">{subject.subject_matter_desc || '-'}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {enabledAddons.length > 0 ? (
        <Card>
          <SectionHeader title="Add-ons" onEdit={() => onEditStep('addons')} />
          <CardContent className="space-y-2 text-sm">
            {enabledAddons.map((addon, index) => (
              <div
                key={`${addon.addon_reference}-${index}`}
                className="flex items-center justify-between border-b border-slate-100 py-1 last:border-0"
              >
                <span>
                  {addon.addon_reference || `Add-on #${index + 1}`} - {addon.addon_desc}
                </span>
                <span className="text-slate-500">
                  {computeAddonAmounts(addon, exchangeRate).premiumIncludingTax.toFixed(2)}
                </span>
              </div>
            ))}
            <p className="pt-1 font-medium text-slate-900">
              Total: {addonsTotal.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {values.quotation_type === 'MOTOR' && !values.is_fleet ? (
        <Card>
          <SectionHeader title="Motor Details" onEdit={() => onEditStep('motor')} />
          <CardContent className="text-sm">
            <p>{values.motor.registration_no || values.motor.chassis_no || 'Vehicle not yet identified'}</p>
            <p className="text-slate-500">
              {values.motor.make} {values.motor.model} - Value {values.motor.vehicle_value || '-'}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {values.quotation_type === 'MOTOR' && values.is_fleet ? (
        <>
          <Card>
            <SectionHeader
              title="Fleet Vehicles"
              onEdit={() => onEditStep('fleet-vehicles')}
            />
            <CardContent className="text-sm">
              <p>
                Fleet {values.fleet.header.fleet_id || values.fleet.header.fleet_no || '(no number yet)'} -{' '}
                {values.fleet.items.length} vehicle(s)
              </p>
              <p className="text-slate-500">
                Total sum insured: {fleetTotalSumInsured.toFixed(2)} - Total premium:{' '}
                {fleetTotalPremium.toFixed(2)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <SectionHeader
              title="Fleet Summary"
              onEdit={() => onEditStep('fleet-vehicles')}
            />
            <CardContent className="grid gap-1 text-sm md:grid-cols-2">
              <p>Expected fleet size: {values.fleet.header.fleet_size || values.fleet.items.length}</p>
              <p>Vehicles entered: {values.fleet.items.length}</p>
              <p>
                Comprehensively insured vehicles: {values.fleet.header.comprehensive_insured || '0'}
              </p>
              <p>Fleet type: {values.fleet.header.fleet_type === '2' ? 'Fleet Addition' : 'New Fleet'}</p>
            </CardContent>
          </Card>
        </>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prepared Submission Payload</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1 text-sm md:grid-cols-2">
          <div className="md:col-span-2">
            <p className="mb-3 text-slate-500">
              This preview follows the flow-specific payload shape that will be submitted to TIRAMIS.
            </p>
            <pre className="max-h-[36rem] overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
              {JSON.stringify(
                buildQuotationPayloadPreview(values, {
                  salePointCode: salePoint?.salePointCode ?? null,
                  productCode:
                    product?.tiramis_product_code || product?.product_code || null,
                  productName: product?.product_name || null,
                  existingCustomer,
                }),
                null,
                2,
              )}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
