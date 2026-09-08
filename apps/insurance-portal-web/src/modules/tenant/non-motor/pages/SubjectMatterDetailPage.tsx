import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { SubjectMatterStatusBadge } from '../components/SubjectMatterStatusBadge';
import { useDeleteSubjectMatter, useSubjectMatter } from '../hooks';
import { getCustomerDisplayName } from '@/modules/tenant/customers/types';

function Row({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="min-w-36 text-sm text-slate-500">{label}</span>
      <span className="text-sm text-slate-900">{value ?? ' - '}</span>
    </div>
  );
}

export function SubjectMatterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: subjectMatter, isLoading } = useSubjectMatter(id);
  const deleteMutation = useDeleteSubjectMatter();
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[500px] w-full" />
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/underwriting/non-motor/subject-matters')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">
                {subjectMatter.subject_code ?? subjectMatter.id}
              </h1>
              <SubjectMatterStatusBadge status={subjectMatter.status} />
            </div>
            <p className="text-sm text-slate-500">
              {subjectMatter.customer
                ? getCustomerDisplayName(subjectMatter.customer)
                : subjectMatter.customer_id}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              navigate(
                `/underwriting/non-motor/subject-matters/${subjectMatter.id}/edit`,
              )
            }
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Subject Matter Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Row
            label="Customer"
            value={
              subjectMatter.customer
                ? getCustomerDisplayName(subjectMatter.customer)
                : subjectMatter.customer_id
            }
          />
          <Row label="Subject Type" value={subjectMatter.subject_type} />
          <Row label="Subject Code" value={subjectMatter.subject_code} />
          <Row label="Description" value={subjectMatter.description} />
          <Row label="Location" value={subjectMatter.location} />
          <Row
            label="Region"
            value={[
              subjectMatter.country,
              subjectMatter.region,
              subjectMatter.district,
              subjectMatter.ward,
            ]
              .filter(Boolean)
              .join(' / ')}
          />
          <Row
            label="Value"
            value={`${subjectMatter.currency} ${subjectMatter.value}`}
          />
          <Row label="Status" value={subjectMatter.status} />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Subject Matter"
        description="This will soft-delete the subject matter."
        confirmLabel="Delete Subject Matter"
        loading={deleteMutation.isPending}
        onConfirm={() =>
          deleteMutation.mutate(subjectMatter.id, {
            onSuccess: () =>
              navigate('/underwriting/non-motor/subject-matters'),
          })
        }
      />
    </div>
  );
}
