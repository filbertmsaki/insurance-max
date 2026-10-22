import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { useCreateSubjectMatter, useNonMotorCustomers } from '../hooks';
import { SubjectMatterForm } from '../components/SubjectMatterForm';

export function SubjectMatterCreatePage() {
  const navigate = useNavigate();
  const { data: customerOptions = [] } = useNonMotorCustomers();
  const createMutation = useCreateSubjectMatter();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/apps/underwrite/non-motor/risks')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title="Create Subject Matter"
          description="Register a non-motor risk's subject matter"
        />
      </div>

      <SubjectMatterForm
        customers={customerOptions}
        isPending={createMutation.isPending}
        submitLabel="Create Subject Matter"
        onSubmit={(values) =>
          createMutation.mutate(values, {
            onSuccess: () => navigate('/apps/underwrite/non-motor/risks'),
          })
        }
      />
    </div>
  );
}
