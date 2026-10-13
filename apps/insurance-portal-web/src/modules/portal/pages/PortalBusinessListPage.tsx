import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BadgeDollarSign,
  BriefcaseBusiness,
  ClipboardList,
  Eye,
  FileText,
  FilePenLine,
  HandCoins,
  MessageCircleWarning,
  Paperclip,
  Plus,
  RotateCcw,
  ReceiptText,
  Upload,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  DataTable,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime, statusTone } from '@/modules/tenant/engagement/utils';

import {
  portalApi,
  type PortalAudience,
  type PortalBusinessRecord,
  type PortalPolicyRequestType,
} from '../api';

type PortalResource =
  | 'quotations'
  | 'policies'
  | 'invoices'
  | 'receipts'
  | 'claims'
  | 'complaints'
  | 'requests'
  | 'customers'
  | 'commissions';

const resourceConfig: Record<
  PortalResource,
  {
    title: string;
    description: string;
    icon: typeof FileText;
    columns: Array<{
      label: string;
      render: (record: PortalBusinessRecord) => string | number | null;
    }>;
  }
> = {
  quotations: {
    title: 'Quotations',
    description:
      'Quotation drafts and submitted quotations visible to this portal account.',
    icon: FileText,
    columns: [
      { label: 'Quotation', render: (record) => text(record.quotation_no) },
      { label: 'Product', render: (record) => label(record.product) },
      { label: 'Customer', render: (record) => label(record.customer) },
      { label: 'Premium', render: (record) => money(record.total_premium) },
      { label: 'Created', render: (record) => date(record.created_at) },
    ],
  },
  policies: {
    title: 'Policies',
    description:
      'Issued policies and coverage details linked to the portal account.',
    icon: BriefcaseBusiness,
    columns: [
      { label: 'Policy', render: (record) => text(record.policy_no) },
      { label: 'Cover note', render: (record) => text(record.cover_note_no) },
      { label: 'Product', render: (record) => label(record.product) },
      { label: 'Premium', render: (record) => money(record.total_premium) },
      {
        label: 'Period',
        render: (record) => period(record.start_date, record.end_date),
      },
    ],
  },
  invoices: {
    title: 'Invoices',
    description:
      'Premium invoices issued against portal-visible quotations and policies.',
    icon: ReceiptText,
    columns: [
      { label: 'Invoice', render: (record) => text(record.invoice_no) },
      {
        label: 'Reference',
        render: (record) => label(record.policy) ?? label(record.quotation),
      },
      {
        label: 'Amount',
        render: (record) => money(record.total_amount ?? record.balance_amount),
      },
      { label: 'Balance', render: (record) => money(record.balance_amount) },
      { label: 'Due', render: (record) => date(record.due_date) },
    ],
  },
  receipts: {
    title: 'Receipts',
    description: 'Receipts allocated to portal-visible billing records.',
    icon: HandCoins,
    columns: [
      { label: 'Receipt', render: (record) => text(record.receipt_no) },
      {
        label: 'Reference',
        render: (record) =>
          label(record.invoice) ??
          text(record.policy_no ?? record.quotation_no),
      },
      {
        label: 'Amount',
        render: (record) => money(record.amount ?? record.receipt_amount),
      },
      { label: 'Method', render: (record) => text(record.payment_method) },
      {
        label: 'Received',
        render: (record) => date(record.receipt_date ?? record.created_at),
      },
    ],
  },
  claims: {
    title: 'Claims',
    description:
      'Claim notifications and settlement progress visible to this portal account.',
    icon: ClipboardList,
    columns: [
      {
        label: 'Claim',
        render: (record) =>
          text(record.claim_no) ??
          text(record.claim_notification_number) ??
          text(record.claim_reference_number),
      },
      { label: 'Policy', render: (record) => text(record.policy_no) },
      { label: 'Loss type', render: (record) => text(record.loss_type) },
      {
        label: 'Estimated',
        render: (record) => money(record.estimated_amount),
      },
      {
        label: 'Reported',
        render: (record) => date(record.claim_report_date ?? record.created_at),
      },
    ],
  },
  complaints: {
    title: 'Complaints',
    description:
      'Complaint cases, acknowledgement dates, and resolution status.',
    icon: MessageCircleWarning,
    columns: [
      { label: 'Complaint', render: (record) => text(record.complaint_no) },
      { label: 'Category', render: (record) => text(record.category) },
      { label: 'Subject', render: (record) => text(record.subject) },
      { label: 'Policy', render: (record) => text(record.policy_no) },
      {
        label: 'Created',
        render: (record) => date(record.created_at),
      },
    ],
  },
  requests: {
    title: 'Service Requests',
    description:
      'Policy service, claim notification, quotation assistance, and payment-proof requests.',
    icon: FileText,
    columns: [
      { label: 'Request', render: (record) => text(record.request_no) },
      { label: 'Type', render: (record) => text(record.request_type) },
      {
        label: 'Target',
        render: (record) => text(record.policy_no ?? record.quotation_no),
      },
      {
        label: 'Submitted',
        render: (record) => date(record.submitted_at ?? record.created_at),
      },
    ],
  },
  customers: {
    title: 'Customers',
    description: 'Customer portfolio linked to the intermediary account.',
    icon: Users,
    columns: [
      { label: 'Customer', render: (record) => text(record.customer_no) },
      { label: 'Name', render: (record) => text(record.name) },
      { label: 'Phone', render: (record) => text(record.phone) },
      { label: 'Email', render: (record) => text(record.email) },
      { label: 'KYC', render: (record) => text(record.kyc_status) },
    ],
  },
  commissions: {
    title: 'Commissions',
    description:
      'Commission transactions earned through intermediary portfolio business.',
    icon: BadgeDollarSign,
    columns: [
      { label: 'Policy', render: (record) => text(record.policy_no) },
      { label: 'Type', render: (record) => text(record.commission_type) },
      { label: 'Rate', render: (record) => percent(record.commission_rate) },
      { label: 'Amount', render: (record) => money(record.commission_amount) },
      { label: 'Earned', render: (record) => date(record.earned_at) },
    ],
  },
};

export function PortalBusinessListPage({
  audience,
  resource,
}: {
  audience: PortalAudience;
  resource: PortalResource;
}) {
  const [selectedQuotationIds, setSelectedQuotationIds] = useState<string[]>(
    [],
  );
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [paymentRecord, setPaymentRecord] =
    useState<PortalBusinessRecord | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_date: new Date().toISOString().slice(0, 10),
    payment_reference: '',
    description: '',
  });
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [attachmentRecord, setAttachmentRecord] =
    useState<PortalBusinessRecord | null>(null);
  const [attachmentType, setAttachmentType] = useState('supporting_document');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [complaintDialogOpen, setComplaintDialogOpen] = useState(false);
  const [policyRequestRecord, setPolicyRequestRecord] =
    useState<PortalBusinessRecord | null>(null);
  const [policyRequestForm, setPolicyRequestForm] = useState<{
    request_type: PortalPolicyRequestType;
    subject: string;
    description: string;
  }>({
    request_type: 'ENDORSEMENT',
    subject: '',
    description: '',
  });
  const [claimForm, setClaimForm] = useState({
    policy_id: '',
    loss_date: new Date().toISOString().slice(0, 10),
    loss_location: '',
    loss_description: '',
    police_reference: '',
    estimated_loss_amount: '',
  });
  const [complaintForm, setComplaintForm] = useState({
    policy_id: '',
    category: '',
    subject: '',
    description: '',
    priority: 'MEDIUM',
  });
  const config = resourceConfig[resource];
  const Icon = config.icon;
  const queryClient = useQueryClient();
  // Base key: every mutation below invalidates all pages of this list.
  const recordsKey = useMemo(
    () => ['portal', audience, resource] as const,
    [audience, resource],
  );
  const { tableProps } = useServerTable<PortalBusinessRecord>({
    queryKey: recordsKey,
    fetcher: (params, signal) =>
      portalApi.pageBusinessRecords(audience, resource, params, signal),
    defaultLimit: 25,
  });
  const policiesQuery = useQuery({
    queryKey: ['portal', audience, 'policies', 'selector'],
    enabled: resource === 'claims' || resource === 'complaints',
    queryFn: () =>
      portalApi.listBusinessRecords(audience, 'policies', { limit: 100 }),
  });
  const policies = policiesQuery.data?.items ?? [];
  const canOpenDetail = supportsDetail(resource);
  const hasActions =
    canOpenDetail || resource === 'invoices' || resource === 'requests';
  const canCompare = audience === 'intermediary' && resource === 'quotations';

  const compareMutation = useMutation({
    mutationFn: () =>
      portalApi.compareIntermediaryQuotations(selectedQuotationIds),
    onSuccess: () => setComparisonOpen(true),
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : 'Quotation comparison failed',
      ),
  });
  const comparison = compareMutation.data ?? [];

  const paymentMutation = useMutation({
    mutationFn: async () => {
      if (!paymentRecord) {
        throw new Error('Invoice is required');
      }

      if (!paymentProofFile) {
        throw new Error('Select a payment proof file');
      }

      const result = await portalApi.createPaymentProof({
        invoice_id: paymentRecord.id,
        amount: Number(paymentForm.amount),
        payment_date: paymentForm.payment_date,
        payment_reference: paymentForm.payment_reference.trim() || undefined,
        description: paymentForm.description.trim(),
      });

      await portalApi.uploadRequestAttachment(result.request.id, {
        document_type: result.required_document_type,
        file: paymentProofFile,
      });

      return result;
    },
    onSuccess: async () => {
      toast.success('Payment proof submitted');
      setPaymentRecord(null);
      setPaymentProofFile(null);
      setPaymentForm({
        amount: '',
        payment_date: new Date().toISOString().slice(0, 10),
        payment_reference: '',
        description: '',
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: recordsKey }),
        queryClient.invalidateQueries({
          queryKey: ['portal', audience, 'requests'],
        }),
      ]);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Payment proof failed',
      );
    },
  });

  const attachmentMutation = useMutation({
    mutationFn: () => {
      if (!attachmentRecord || !attachmentFile) {
        throw new Error('Select a request and attachment');
      }

      return portalApi.uploadRequestAttachment(attachmentRecord.id, {
        document_type: attachmentType.trim() || 'supporting_document',
        file: attachmentFile,
      });
    },
    onSuccess: async () => {
      toast.success('Attachment uploaded');
      setAttachmentRecord(null);
      setAttachmentFile(null);
      setAttachmentType('supporting_document');
      await queryClient.invalidateQueries({ queryKey: recordsKey });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    },
  });

  const requestActionMutation = useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: string;
      action: 'cancel' | 'resubmit';
    }) =>
      action === 'cancel'
        ? portalApi.cancelRequest(id)
        : portalApi.resubmitRequest(id),
    onSuccess: async (_, variables) => {
      toast.success(
        variables.action === 'cancel'
          ? 'Request cancelled'
          : 'Request resubmitted',
      );
      await queryClient.invalidateQueries({ queryKey: recordsKey });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Request failed');
    },
  });

  const claimMutation = useMutation({
    mutationFn: () =>
      portalApi.createClaimNotification({
        policy_id: claimForm.policy_id,
        loss_date: claimForm.loss_date,
        loss_location: claimForm.loss_location.trim(),
        loss_description: claimForm.loss_description.trim(),
        police_reference: claimForm.police_reference.trim() || undefined,
        estimated_loss_amount: claimForm.estimated_loss_amount
          ? Number(claimForm.estimated_loss_amount)
          : undefined,
      }),
    onSuccess: async () => {
      toast.success('Claim notification submitted');
      setClaimDialogOpen(false);
      setClaimForm({
        policy_id: '',
        loss_date: new Date().toISOString().slice(0, 10),
        loss_location: '',
        loss_description: '',
        police_reference: '',
        estimated_loss_amount: '',
      });
      await queryClient.invalidateQueries({
        queryKey: ['portal', audience, 'requests'],
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Claim failed');
    },
  });

  const complaintMutation = useMutation({
    mutationFn: () =>
      portalApi.createComplaint({
        policy_id: complaintForm.policy_id || undefined,
        category: complaintForm.category.trim(),
        subject: complaintForm.subject.trim(),
        description: complaintForm.description.trim(),
        priority: complaintForm.priority,
      }),
    onSuccess: async () => {
      toast.success('Complaint submitted');
      setComplaintDialogOpen(false);
      setComplaintForm({
        policy_id: '',
        category: '',
        subject: '',
        description: '',
        priority: 'MEDIUM',
      });
      await queryClient.invalidateQueries({ queryKey: recordsKey });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Complaint failed');
    },
  });

  const policyRequestMutation = useMutation({
    mutationFn: () => {
      if (!policyRequestRecord) {
        throw new Error('Policy is required');
      }

      return portalApi.createPolicyRequest({
        policy_id: policyRequestRecord.id,
        request_type: policyRequestForm.request_type,
        subject: policyRequestForm.subject.trim(),
        description: policyRequestForm.description.trim(),
      });
    },
    onSuccess: async () => {
      toast.success('Policy request submitted');
      setPolicyRequestRecord(null);
      setPolicyRequestForm({
        request_type: 'ENDORSEMENT',
        subject: '',
        description: '',
      });
      await queryClient.invalidateQueries({
        queryKey: ['portal', audience, 'requests'],
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Policy request failed',
      );
    },
  });

  const openPaymentProof = (record: PortalBusinessRecord) => {
    setPaymentRecord(record);
    setPaymentForm((current) => ({
      ...current,
      amount: String(record.balance_amount ?? record.total_amount ?? ''),
      description: '',
    }));
  };

  const submitPaymentProof = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    paymentMutation.mutate();
  };

  const submitAttachment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    attachmentMutation.mutate();
  };

  const submitClaim = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    claimMutation.mutate();
  };

  const submitComplaint = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    complaintMutation.mutate();
  };

  const submitPolicyRequest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    policyRequestMutation.mutate();
  };

  const columns: Column<PortalBusinessRecord>[] = [
    ...config.columns.map((column) => ({
      key: column.label,
      header: column.label,
      cell: (record: PortalBusinessRecord) => column.render(record) ?? '-',
    })),
    {
      key: 'status',
      header: 'Status',
      cell: (record: PortalBusinessRecord) => (
        <Badge variant="outline" className={statusTone(status(record))}>
          {status(record)}
        </Badge>
      ),
    },
    ...(hasActions
      ? [
          {
            key: 'actions',
            header: 'Actions',
            className: 'w-[1%] text-right',
            cell: (record: PortalBusinessRecord) => (
              <div className="flex justify-end gap-2">
                {canOpenDetail ? (
                  <Button asChild size="sm" variant="outline">
                    <Link
                      to={`/${audience}/${resource}/${record.id}`}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </Link>
                  </Button>
                ) : null}
                {resource === 'invoices' ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => openPaymentProof(record)}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Proof
                  </Button>
                ) : null}
                {resource === 'requests' ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setAttachmentRecord(record)}
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      File
                    </Button>
                    {canResubmit(record) ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={requestActionMutation.isPending}
                        onClick={() =>
                          requestActionMutation.mutate({
                            id: record.id,
                            action: 'resubmit',
                          })
                        }
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Resubmit
                      </Button>
                    ) : null}
                    {canCancel(record) ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={requestActionMutation.isPending}
                        onClick={() =>
                          requestActionMutation.mutate({
                            id: record.id,
                            action: 'cancel',
                          })
                        }
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </>
                ) : null}
                {audience === 'intermediary' &&
                resource === 'customers' ? (
                  <Button asChild size="sm" variant="outline">
                    <Link
                      to={`/intermediary/customers/${record.id}/edit`}
                    >
                      <FilePenLine className="h-3.5 w-3.5" />
                      Edit
                    </Link>
                  </Button>
                ) : null}
                {audience === 'intermediary' &&
                resource === 'quotations' &&
                canEditQuotation(record) ? (
                  <Button asChild size="sm" variant="outline">
                    <Link
                      to={`/intermediary/quotations/${record.id}/edit`}
                    >
                      <FilePenLine className="h-3.5 w-3.5" />
                      Edit
                    </Link>
                  </Button>
                ) : null}
                {resource === 'policies' ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setPolicyRequestRecord(record);
                      setPolicyRequestForm({
                        request_type: 'ENDORSEMENT',
                        subject: `Service request for ${policyLabel(record)}`,
                        description: '',
                      });
                    }}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Request
                  </Button>
                ) : null}
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          audience === 'customer' ? 'Customer Portal' : 'Intermediary Portal'
        }
        title={config.title}
        description={config.description}
      />

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="h-4 w-4 text-slate-500" />
            Records
          </CardTitle>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {audience === 'intermediary' && resource === 'customers' ? (
              <Button asChild>
                <Link to="/intermediary/customers/new">
                  <Plus className="h-4 w-4" />
                  New customer
                </Link>
              </Button>
            ) : null}
            {audience === 'intermediary' && resource === 'quotations' ? (
              <>
                {selectedQuotationIds.length >= 2 ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={compareMutation.isPending}
                    onClick={() => compareMutation.mutate()}
                  >
                    Compare ({selectedQuotationIds.length})
                  </Button>
                ) : null}
                <Button asChild>
                  <Link to="/intermediary/quotations/new">
                    <Plus className="h-4 w-4" />
                    New quotation
                  </Link>
                </Button>
              </>
            ) : null}
            {resource === 'claims' ? (
              <Button type="button" onClick={() => setClaimDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Notify claim
              </Button>
            ) : null}
            {resource === 'complaints' ? (
              <Button
                type="button"
                onClick={() => setComplaintDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
                New complaint
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            {...tableProps}
            columns={columns}
            searchPlaceholder="Search"
            emptyMessage={`No ${config.title.toLowerCase()}. Records will appear here when they are available to this portal account.`}
            enableRowSelection={canCompare}
            selectedRowKeys={canCompare ? selectedQuotationIds : undefined}
            onSelectionChange={
              canCompare
                ? (keys) =>
                    // The comparison endpoint accepts at most 10 quotations.
                    setSelectedQuotationIds(keys.slice(0, 10).map(String))
                : undefined
            }
          />
        </CardContent>
      </Card>

      <Dialog open={comparisonOpen} onOpenChange={setComparisonOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Quotation comparison</DialogTitle>
            <DialogDescription>
              Review authorized offers for this customer. Premiums and cover
              dates come from each insurer’s saved quotation.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Insurer</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Quotation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Premium before tax</TableHead>
                  <TableHead>Premium with tax</TableHead>
                  <TableHead>Cover period</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparison.map((offer) => (
                  <TableRow key={offer.id}>
                    <TableCell>
                      {offer.insurer_name ?? offer.insurer_company_id}
                    </TableCell>
                    <TableCell>
                      {offer.product_name ?? offer.product_id}
                    </TableCell>
                    <TableCell>{offer.quotation_no}</TableCell>
                    <TableCell>{offer.status}</TableCell>
                    <TableCell>
                      {offer.currency ?? ''}{' '}
                      {offer.premium_excluding_tax ?? '—'}
                    </TableCell>
                    <TableCell>
                      {offer.currency ?? ''}{' '}
                      {offer.premium_including_tax ?? '—'}
                    </TableCell>
                    <TableCell>
                      {date(offer.cover_note_start_date)} –{' '}
                      {date(offer.cover_note_end_date)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComparisonOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(paymentRecord)}
        onOpenChange={(open) => {
          if (!open) {
            setPaymentRecord(null);
            setPaymentProofFile(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload payment proof</DialogTitle>
            <DialogDescription>
              Submit proof for{' '}
              {text(paymentRecord?.invoice_no) ?? 'this invoice'}.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitPaymentProof}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="portal-payment-amount">Amount</Label>
                <Input
                  id="portal-payment-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={paymentForm.amount}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      amount: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="portal-payment-date">Payment date</Label>
                <Input
                  id="portal-payment-date"
                  type="date"
                  required
                  value={paymentForm.payment_date}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      payment_date: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="portal-payment-reference">Reference</Label>
              <Input
                id="portal-payment-reference"
                value={paymentForm.payment_reference}
                onChange={(event) =>
                  setPaymentForm((current) => ({
                    ...current,
                    payment_reference: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="portal-payment-description">Description</Label>
              <Textarea
                id="portal-payment-description"
                required
                value={paymentForm.description}
                onChange={(event) =>
                  setPaymentForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="portal-payment-proof-file">Proof file</Label>
              <Input
                id="portal-payment-proof-file"
                type="file"
                required
                onChange={(event) =>
                  setPaymentProofFile(event.target.files?.[0] ?? null)
                }
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPaymentRecord(null);
                  setPaymentProofFile(null);
                }}
              >
                Close
              </Button>
              <Button type="submit" disabled={paymentMutation.isPending}>
                Submit proof
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(attachmentRecord)}
        onOpenChange={(open) => {
          if (!open) {
            setAttachmentRecord(null);
            setAttachmentFile(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload request attachment</DialogTitle>
            <DialogDescription>
              Add a supporting document to{' '}
              {text(attachmentRecord?.request_no) ?? 'this request'}.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitAttachment}>
            <div className="space-y-2">
              <Label htmlFor="portal-attachment-type">Document type</Label>
              <Input
                id="portal-attachment-type"
                required
                value={attachmentType}
                onChange={(event) => setAttachmentType(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="portal-attachment-file">File</Label>
              <Input
                id="portal-attachment-file"
                type="file"
                required
                onChange={(event) =>
                  setAttachmentFile(event.target.files?.[0] ?? null)
                }
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAttachmentRecord(null)}
              >
                Close
              </Button>
              <Button type="submit" disabled={attachmentMutation.isPending}>
                Upload file
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={claimDialogOpen} onOpenChange={setClaimDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notify claim</DialogTitle>
            <DialogDescription>
              Submit a first notice of loss against an active portal policy.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitClaim}>
            <div className="space-y-2">
              <Label>Policy</Label>
              <Select
                value={claimForm.policy_id}
                onValueChange={(value) =>
                  setClaimForm((current) => ({
                    ...current,
                    policy_id: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select policy" />
                </SelectTrigger>
                <SelectContent>
                  {policies.map((policy) => (
                    <SelectItem key={policy.id} value={policy.id}>
                      {policyLabel(policy)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="portal-claim-loss-date">Loss date</Label>
                <Input
                  id="portal-claim-loss-date"
                  type="date"
                  required
                  value={claimForm.loss_date}
                  onChange={(event) =>
                    setClaimForm((current) => ({
                      ...current,
                      loss_date: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="portal-claim-estimate">Estimated loss</Label>
                <Input
                  id="portal-claim-estimate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={claimForm.estimated_loss_amount}
                  onChange={(event) =>
                    setClaimForm((current) => ({
                      ...current,
                      estimated_loss_amount: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="portal-claim-location">Loss location</Label>
              <Input
                id="portal-claim-location"
                required
                value={claimForm.loss_location}
                onChange={(event) =>
                  setClaimForm((current) => ({
                    ...current,
                    loss_location: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="portal-claim-police">Police reference</Label>
              <Input
                id="portal-claim-police"
                value={claimForm.police_reference}
                onChange={(event) =>
                  setClaimForm((current) => ({
                    ...current,
                    police_reference: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="portal-claim-description">Description</Label>
              <Textarea
                id="portal-claim-description"
                required
                value={claimForm.loss_description}
                onChange={(event) =>
                  setClaimForm((current) => ({
                    ...current,
                    loss_description: event.target.value,
                  }))
                }
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setClaimDialogOpen(false)}
              >
                Close
              </Button>
              <Button
                type="submit"
                disabled={claimMutation.isPending || !claimForm.policy_id}
              >
                Submit claim
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={complaintDialogOpen} onOpenChange={setComplaintDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New complaint</DialogTitle>
            <DialogDescription>
              Send a complaint to the servicing company for acknowledgement and
              resolution.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitComplaint}>
            <div className="space-y-2">
              <Label>Related policy</Label>
              <Select
                value={complaintForm.policy_id || 'none'}
                onValueChange={(value) =>
                  setComplaintForm((current) => ({
                    ...current,
                    policy_id: value === 'none' ? '' : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No policy</SelectItem>
                  {policies.map((policy) => (
                    <SelectItem key={policy.id} value={policy.id}>
                      {policyLabel(policy)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="portal-complaint-category">Category</Label>
                <Input
                  id="portal-complaint-category"
                  required
                  value={complaintForm.category}
                  onChange={(event) =>
                    setComplaintForm((current) => ({
                      ...current,
                      category: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={complaintForm.priority}
                  onValueChange={(value) =>
                    setComplaintForm((current) => ({
                      ...current,
                      priority: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="portal-complaint-subject">Subject</Label>
              <Input
                id="portal-complaint-subject"
                required
                value={complaintForm.subject}
                onChange={(event) =>
                  setComplaintForm((current) => ({
                    ...current,
                    subject: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="portal-complaint-description">Description</Label>
              <Textarea
                id="portal-complaint-description"
                required
                value={complaintForm.description}
                onChange={(event) =>
                  setComplaintForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setComplaintDialogOpen(false)}
              >
                Close
              </Button>
              <Button type="submit" disabled={complaintMutation.isPending}>
                Submit complaint
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(policyRequestRecord)}
        onOpenChange={(open) => {
          if (!open) {
            setPolicyRequestRecord(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit policy request</DialogTitle>
            <DialogDescription>
              Create an endorsement, cancellation, or renewal request for{' '}
              {policyLabel(policyRequestRecord ?? {})}.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitPolicyRequest}>
            <div className="space-y-2">
              <Label>Request type</Label>
              <Select
                value={policyRequestForm.request_type}
                onValueChange={(value) =>
                  setPolicyRequestForm((current) => ({
                    ...current,
                    request_type: value as PortalPolicyRequestType,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENDORSEMENT">Endorsement</SelectItem>
                  <SelectItem value="CANCELLATION">Cancellation</SelectItem>
                  <SelectItem value="RENEWAL">Renewal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="portal-policy-request-subject">Subject</Label>
              <Input
                id="portal-policy-request-subject"
                required
                value={policyRequestForm.subject}
                onChange={(event) =>
                  setPolicyRequestForm((current) => ({
                    ...current,
                    subject: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="portal-policy-request-description">
                Description
              </Label>
              <Textarea
                id="portal-policy-request-description"
                required
                value={policyRequestForm.description}
                onChange={(event) =>
                  setPolicyRequestForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPolicyRequestRecord(null)}
              >
                Close
              </Button>
              <Button type="submit" disabled={policyRequestMutation.isPending}>
                Submit request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function text(value: unknown) {
  const result = typeof value === 'string' ? value.trim() : value?.toString();
  return result || null;
}

function label(value: unknown) {
  if (!value || typeof value !== 'object') {
    return text(value);
  }

  const record = value as Record<string, unknown>;
  return (
    text(record.name) ??
    text(record.policy_no) ??
    text(record.quotation_no) ??
    text(record.invoice_no) ??
    text(record.customer_no) ??
    text(record.id)
  );
}

function status(record: PortalBusinessRecord) {
  return (
    text(record.status) ??
    text(record.policy_status) ??
    text(record.quotation_status) ??
    'UNKNOWN'
  );
}

function canCancel(record: PortalBusinessRecord) {
  return ['DRAFT', 'OPEN', 'SUBMITTED', 'RETURNED'].includes(
    status(record).toUpperCase(),
  );
}

function canResubmit(record: PortalBusinessRecord) {
  return ['RETURNED', 'REJECTED', 'CANCELLED'].includes(
    status(record).toUpperCase(),
  );
}

function canEditQuotation(record: PortalBusinessRecord) {
  return ['DRAFT', 'INCOMPLETE', 'RETURNED'].includes(
    status(record).toUpperCase(),
  );
}

function supportsDetail(resource: PortalResource) {
  return [
    'quotations',
    'policies',
    'invoices',
    'claims',
    'complaints',
    'requests',
    'customers',
  ].includes(resource);
}

function policyLabel(policy: Partial<PortalBusinessRecord>) {
  return (
    text(policy.policy_no) ??
    text(policy.cover_note_no) ??
    text(policy.id) ??
    'Policy'
  );
}

function money(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? numeric.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : text(value);
}

function percent(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${numeric.toFixed(2)}%` : text(value);
}

function date(value: unknown) {
  return value ? formatDateTime(String(value)) : null;
}

function period(start: unknown, end: unknown) {
  const from = start ? String(start).slice(0, 10) : null;
  const to = end ? String(end).slice(0, 10) : null;

  return from && to ? `${from} - ${to}` : (from ?? to);
}
