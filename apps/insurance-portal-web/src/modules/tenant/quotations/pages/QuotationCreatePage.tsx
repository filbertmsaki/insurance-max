import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { useQuotationCategories, useQuotationCustomers, useQuotationProducts, useCreateQuotation } from '../hooks';
import { QuotationForm } from '../components/QuotationForm';

export function QuotationCreatePage() {
  const navigate = useNavigate();
  const { data: customerOptions = [] } = useQuotationCustomers();
  const { data: categoryOptions = [] } = useQuotationCategories();
  const { data: productOptions = [] } = useQuotationProducts();
  const createMutation = useCreateQuotation();

  if (!customerOptions.length && !categoryOptions.length && !productOptions.length) {
    return <Skeleton className="h-[700px] w-full" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/quotations')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader title="Create Quotation" description="Build a new quotation" />
      </div>

      <QuotationForm
        customerOptions={customerOptions}
        categoryOptions={categoryOptions}
        productOptions={productOptions}
        subClassOptions={[]}
        isPending={createMutation.isPending}
        submitLabel="Create Quotation"
        onSubmit={(values) => createMutation.mutate(values, { onSuccess: (quotation) => navigate(`/quotations/${quotation.id}`) })}
      />
    </div>
  );
}

