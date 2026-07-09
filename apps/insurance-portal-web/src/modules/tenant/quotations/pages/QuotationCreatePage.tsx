import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  useQuotationCategories,
  useQuotationCustomers,
  useQuotationProducts,
  useCreateQuotationAndSubmitToTiramis,
} from '../hooks';
import { QuotationForm } from '../components/QuotationForm';
import { underwritingPaths } from '@/modules/tenant/underwriting/paths';

export function QuotationCreatePage() {
  const navigate = useNavigate();
  const { data: customerOptions = [] } = useQuotationCustomers();
  const { data: categoryOptions = [] } = useQuotationCategories();
  const { data: productOptions = [] } = useQuotationProducts();
  const createMutation = useCreateQuotationAndSubmitToTiramis();

  if (
    !customerOptions.length &&
    !categoryOptions.length &&
    !productOptions.length
  ) {
    return <Skeleton className="h-[700px] w-full" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(underwritingPaths.quotations)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title="Create Quotation"
          description="Build a quotation and submit it to TIRAMIS right away"
        />
      </div>

      <QuotationForm
        customerOptions={customerOptions}
        categoryOptions={categoryOptions}
        productOptions={productOptions}
        isPending={createMutation.isPending}
        submitLabel="Create and Submit"
        onSubmit={(values) =>
          createMutation.mutate(values, {
            onSuccess: (result) => {
              if (result.submission) {
                navigate(
                  underwritingPaths.submissionDetail(result.submission.id),
                );
                return;
              }
              navigate(underwritingPaths.quotationDetail(result.quotation.id));
            },
          })
        }
      />
    </div>
  );
}
