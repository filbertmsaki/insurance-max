import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { PolicyStatusBadge } from '../components/PolicyStatusBadge';
import { useDeletePolicy, usePolicyDetail } from '../hooks';
import { useSubmitPolicyToTiramis } from '@/modules/tenant/tiramis/hooks';
import { TiramisSubmissionDialog } from '@/modules/tenant/tiramis/components/TiramisSubmissionDialog';
import { buildPolicyTiramisPayload } from '@/modules/tenant/tiramis/utils';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import {
  useCreateNonMotorPolicyDetail,
  useNonMotorPolicyDetails,
  useNonMotorPolicyRisks,
  useSubjectMatterOptions,
} from '@/modules/tenant/non-motor/hooks';
import { PolicyNonMotorDetailForm } from '@/modules/tenant/non-motor/components/PolicyNonMotorDetailForm';
import type { NonMotorPolicyDetailRecord } from '@/modules/tenant/non-motor/types';
import { underwritingPaths } from '@/modules/tenant/underwriting/paths';

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

export function PolicyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuthStore();
  const canCreate = hasPermission('non-motor:create');
  const { data: policy, isLoading } = usePolicyDetail(id);
  const deleteMutation = useDeletePolicy();
  const submitMutation = useSubmitPolicyToTiramis(policy);
  const { data: nonMotorDetails = [] } = useNonMotorPolicyDetails(policy?.id);
  const { data: policyRisks = [] } = useNonMotorPolicyRisks(policy?.id);
  const { data: subjectMatterOptions = [] } = useSubjectMatterOptions();
  const createNonMotorMutation = useCreateNonMotorPolicyDetail();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [nonMotorOpen, setNonMotorOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const tiramisSubmissionPayload = useMemo(
    () => (policy ? buildPolicyTiramisPayload(policy) : null),
    [policy],
  );

  const nonMotorColumns: Column<NonMotorPolicyDetailRecord>[] = useMemo(
    () => [
      {
        key: 'subject_matter',
        header: 'Subject Matter',
        cell: (row) =>
          row.subject_matter?.subject_code ?? row.subject_matter_id,
      },
      {
        key: 'risk',
        header: 'Policy Risk',
        cell: (row) => row.policy_risk?.risk?.risk_name ?? row.policy_risk_id,
      },
      {
        key: 'insured_value',
        header: 'Insured Value',
        cell: (row) => row.insured_value ?? ' - ',
      },
      {
        key: 'limit',
        header: 'Limit',
        cell: (row) => row.limit_of_liability ?? ' - ',
      },
      {
        key: 'created_at',
        header: 'Created',
        cell: (row) => new Date(row.created_at).toLocaleString(),
      },
    ],
    [],
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="text-center py-24 text-slate-500">
        <p className="font-medium">Policy not found</p>
        <Button
          variant="link"
          onClick={() => navigate(underwritingPaths.policies)}
        >
          Back to Policies
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
            onClick={() => navigate(underwritingPaths.policies)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">
                {policy.policy_no}
              </h1>
              <PolicyStatusBadge status={policy.policy_status} />
            </div>
            <p className="text-sm text-slate-500">
              {policy.customer?.company_name ?? policy.customer_id}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSubmitOpen(true)}
            disabled={submitMutation.isPending}
          >
            <Play className="mr-1.5 h-3.5 w-3.5" />
            Submit to TIRAMIS
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(underwritingPaths.policyEdit(policy.id))}
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

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="risks">Risks</TabsTrigger>
          <TabsTrigger value="breakdown">Premium Breakdown</TabsTrigger>
          <TabsTrigger value="motor">Motor Details</TabsTrigger>
          <TabsTrigger value="nonmotor">Non-Motor Details</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="tiramis">TIRAMIS</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Policy Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Row
                label="Customer"
                value={policy.customer?.company_name ?? policy.customer_id}
              />
              <Row label="Quotation" value={policy.quotation_id} />
              <Row
                label="Category"
                value={policy.category?.name ?? policy.category_id}
              />
              <Row
                label="Product"
                value={policy.product?.product_name ?? policy.product_id}
              />
              <Row label="Channel" value={policy.channel_type} />
              <Row
                label="Dates"
                value={`${policy.start_date} to ${policy.end_date}`}
              />
              <Row
                label="Sum Insured"
                value={`${policy.currency} ${policy.sum_insured}`}
              />
              <Row
                label="Premium"
                value={`${policy.currency} ${policy.total_premium}`}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risks" className="space-y-4">
          {(policy.risks ?? []).map((risk) => (
            <Card key={risk.id}>
              <CardContent className="space-y-2 pt-6">
                <Row
                  label="Risk"
                  value={risk.risk?.risk_name ?? risk.risk_id}
                />
                <Row label="Sum Insured" value={risk.sum_insured} />
                <Row label="Premium" value={risk.total_premium} />
                <Row
                  label="Vehicle"
                  value={
                    risk.motor_vehicle?.registration_no ?? risk.motor_vehicle_id
                  }
                />
              </CardContent>
            </Card>
          ))}
          {(policy.risks ?? []).length === 0 && (
            <p className="text-sm text-slate-500">No policy risks yet.</p>
          )}
        </TabsContent>

        <TabsContent value="breakdown" className="space-y-4">
          {(policy.premium_breakdowns ?? []).map((item) => (
            <Card key={item.id}>
              <CardContent className="space-y-2 pt-6">
                <Row label="Item" value={item.item_name} />
                <Row label="Code" value={item.item_code} />
                <Row label="Amount" value={item.amount} />
              </CardContent>
            </Card>
          ))}
          {(policy.premium_breakdowns ?? []).length === 0 && (
            <p className="text-sm text-slate-500">No breakdown items.</p>
          )}
        </TabsContent>

        <TabsContent value="motor" className="space-y-4">
          <Card>
            <CardContent className="pt-6 text-sm text-slate-500">
              Motor details will surface here once motor-linked policy risks are
              added.
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="nonmotor" className="space-y-4">
          {canCreate && (
            <div className="flex justify-end">
              <Button onClick={() => setNonMotorOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Non-Motor Detail
              </Button>
            </div>
          )}
          <DataTable
            columns={nonMotorColumns}
            data={nonMotorDetails}
            loading={false}
            page={1}
            limit={nonMotorDetails.length || 1}
            total={nonMotorDetails.length}
            totalPages={1}
            onPageChange={() => undefined}
            onLimitChange={() => undefined}
          />
        </TabsContent>
        <TabsContent value="billing" className="space-y-4">
          <Card>
            <CardContent className="pt-6 text-sm text-slate-500">
              Billing data can be connected here later.
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="tiramis" className="space-y-4">
          <Card>
            <CardContent className="pt-6 text-sm text-slate-500">
              TIRAMIS submissions are stored on the policy record and can be
              expanded later.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {(policy.status_history ?? []).map((entry) => (
            <Card key={entry.id}>
              <CardContent className="space-y-2 pt-6">
                <Row label="From" value={entry.old_status} />
                <Row label="To" value={entry.new_status} />
                <Row label="Reason" value={entry.reason} />
                <Row label="Changed At" value={entry.created_at} />
              </CardContent>
            </Card>
          ))}
          {(policy.status_history ?? []).length === 0 && (
            <p className="text-sm text-slate-500">No history yet.</p>
          )}
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardContent className="pt-6 text-sm text-slate-500">
              Document management can be connected here later.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={nonMotorOpen} onOpenChange={setNonMotorOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Non-Motor Detail</DialogTitle>
          </DialogHeader>
          {canCreate && (
            <PolicyNonMotorDetailForm
              policy={policy}
              risks={policyRisks}
              subjectMatters={subjectMatterOptions}
              isPending={createNonMotorMutation.isPending}
              submitLabel="Create Detail"
              onSubmit={(values) => {
                createNonMotorMutation.mutate(values, {
                  onSuccess: () => setNonMotorOpen(false),
                });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <TiramisSubmissionDialog
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        title="Submit Policy to TIRAMIS"
        description="Choose the branch and sale point for this submission. If a unique or default sale point exists, it will be used automatically."
        initialBranchId={policy.branch_id}
        isPending={submitMutation.isPending}
        readiness={
          tiramisSubmissionPayload
            ? {
                requestType: tiramisSubmissionPayload.requestType,
                sourceModule:
                  tiramisSubmissionPayload.source_module || 'policies',
                sourceRecordId:
                  tiramisSubmissionPayload.source_record_id || policy.id,
                payload: tiramisSubmissionPayload.payload,
              }
            : undefined
        }
        onSubmit={(selection) => {
          submitMutation.mutate(selection, {
            onSuccess: (result) => {
              setSubmitOpen(false);
              navigate(
                underwritingPaths.submissionDetail(result.submission.id),
              );
            },
          });
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Policy"
        description="This will soft-delete the policy."
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() =>
          deleteMutation.mutate(policy.id, {
            onSuccess: () => navigate(underwritingPaths.policies),
          })
        }
      />
    </div>
  );
}
