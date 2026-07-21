import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CustomerRecord } from '@/modules/tenant/customers/types';
import type { InsuranceCategory, InsuranceProduct } from '@/types/product-engine';
import type { QuotationFormSchemaValues } from '../schemas';

interface Props {
  customerOptions: CustomerRecord[];
  categoryOptions: InsuranceCategory[];
  productOptions: InsuranceProduct[];
  isPending: boolean;
  submitLabel: string;
  onSubmit: (values: QuotationFormSchemaValues) => void;
  defaultValues?: Partial<QuotationFormSchemaValues>;
}

export function QuotationForm({
  isPending,
  submitLabel,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quotation Wizard Required</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600">
          The standalone quotation form has been retired. Use the quotation wizard so the frontend matches the current backend quotation flows.
        </p>
        <Button type="button" disabled={isPending}>
          {isPending ? 'Saving...' : submitLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
