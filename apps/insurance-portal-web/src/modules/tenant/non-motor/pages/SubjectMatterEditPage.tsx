import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  useNonMotorCustomers,
  useSubjectMatter,
  useUpdateSubjectMatter,
} from '../hooks';
import { SubjectMatterForm } from '../components/SubjectMatterForm';
import { subjectMatterRecordToFormValues } from '../schemas';

export function SubjectMatterEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: customerOptions = [] } = useNonMotorCustomers();
  const { data: subjectMatter, isLoading } = useSubjectMatter(id);
  const updateMutation = useUpdateSubjectMatter(id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[700px] w-full" />
      </div>
    );
  }

  if (!subjectMatter) {
    return (
      <div className="text-center py-24 text-slate-500">
        <p className="font-medium">Subject matter not found</p>
        <Button
          variant="link"
          onClick={() => navigate('/underwriting/non-motor/subject-matters')}
        >
          Back to Subject Matters
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() =>
            navigate(
              `/underwriting/non-motor/subject-matters/${subjectMatter.id}`,
            )
          }
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title="Edit Subject Matter"
          description={subjectMatter.subject_code ?? subjectMatter.id}
        />
      </div>

      <SubjectMatterForm
        customers={customerOptions}
        isPending={updateMutation.isPending}
        submitLabel="Save Changes"
        defaultValues={subjectMatterRecordToFormValues(subjectMatter)}
        onSubmit={(values) =>
          updateMutation.mutate(values, {
            onSuccess: () =>
              navigate(
                `/underwriting/non-motor/subject-matters/${subjectMatter.id}`,
              ),
          })
        }
      />
    </div>
  );
}
