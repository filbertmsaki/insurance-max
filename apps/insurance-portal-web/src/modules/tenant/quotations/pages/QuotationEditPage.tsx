import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { useQuotationCategories, useQuotationCustomers, useQuotationDetail, useQuotationProducts, useUpdateQuotation } from '../hooks';
import { QuotationForm } from '../components/QuotationForm';
import { quotationRecordToFormValues } from '../schemas';
import { underwritingPaths } from '@/modules/tenant/underwriting/paths';

export function QuotationEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: customerOptions = [] } = useQuotationCustomers();
  const { data: categoryOptions = [] } = useQuotationCategories();
  const { data: productOptions = [] } = useQuotationProducts();
  const { data: quotation, isLoading } = useQuotationDetail(id);
  const updateMutation = useUpdateQuotation(id);

  if (isLoading) {
    return <Skeleton className="h-[700px] w-full" />;
  }

  if (!quotation) {
    return (
      <div className="text-center py-24 text-slate-500">
        <p className="font-medium">Quotation not found</p>
        <Button variant="link" onClick={() => navigate(underwritingPaths.quotations)}>Back to Quotations</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(underwritingPaths.quotationDetail(quotation.id))}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader title="Edit Quotation" description={quotation.quotation_no} />
      </div>

      <QuotationForm
        customerOptions={customerOptions}
        categoryOptions={categoryOptions}
        productOptions={productOptions}
        subClassOptions={[]}
        isPending={updateMutation.isPending}
        submitLabel="Save Changes"
        defaultValues={quotationRecordToFormValues(quotation)}
        onSubmit={(values) => updateMutation.mutate(values, { onSuccess: () => navigate(underwritingPaths.quotationDetail(quotation.id)) })}
      />
    </div>
  );
}
