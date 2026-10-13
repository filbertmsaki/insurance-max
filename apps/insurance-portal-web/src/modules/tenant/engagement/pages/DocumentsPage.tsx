import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Files, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DataTable,
  tableFilters,
  useServerTable,
  type Column,
} from '@/components/data-table';

import { engagementApi, type DocumentRecord } from '../api';
import { formatDate, statusTone } from '../utils';

type UploadFormState = {
  title: string;
  document_type: string;
  classification: string;
  resource_type: string;
  resource_id: string;
  customer_visible: boolean;
  intermediary_visible: boolean;
  file: File | null;
};

const initialForm: UploadFormState = {
  title: '',
  document_type: 'GENERAL',
  classification: 'INTERNAL',
  resource_type: 'CLAIM',
  resource_id: '',
  customer_visible: false,
  intermediary_visible: false,
  file: null,
};

const DOCUMENT_FILTER_KEYS = ['status', 'classification'] as const;
type DocumentFilterKey = (typeof DOCUMENT_FILTER_KEYS)[number];

const toOptions = (values: string[]) =>
  values.map((value) => ({ label: value, value }));

const DOCUMENT_STATUS_OPTIONS = toOptions([
  'UPLOAD_PENDING',
  'UPLOADED',
  'SCAN_PENDING',
  'SCANNING',
  'AVAILABLE',
  'QUARANTINED',
  'REJECTED',
  'SUPERSEDED',
  'REVOKED',
  'ARCHIVED',
]);
const CLASSIFICATION_OPTIONS = toOptions([
  'INTERNAL',
  'CONFIDENTIAL',
  'RESTRICTED',
  'PUBLIC',
]);

const columns: Column<DocumentRecord>[] = [
  {
    key: 'document_no',
    header: 'Document',
    sortable: true,
    cell: (document) => (
      <div className="space-y-1">
        <Link
          to={`/documents/${document.id}`}
          className="font-medium text-slate-900 hover:text-blue-700"
        >
          {document.document_no ?? document.title ?? 'Document'}
        </Link>
        <div className="text-xs text-slate-500">{document.title}</div>
      </div>
    ),
  },
  {
    key: 'document_type',
    header: 'Type',
    sortable: true,
    cell: (document) => document.document_type ?? 'GENERAL',
  },
  {
    key: 'owner_type',
    header: 'Linked record',
    hideOnMobile: true,
    cell: (document) => (
      <>
        {document.owner_type}
        {document.owner_id ? (
          <div className="text-xs text-slate-500">{document.owner_id}</div>
        ) : null}
      </>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    cell: (document) => (
      <Badge variant="outline" className={statusTone(document.status)}>
        {document.status}
      </Badge>
    ),
  },
  {
    key: 'version',
    header: 'Version',
    cell: (document) => document.current_version?.version_number ?? '-',
  },
  {
    key: 'visibility',
    header: 'Visibility',
    hideOnMobile: true,
    cell: (document) => (
      <span className="text-xs text-slate-600">
        {document.customer_visible ? 'Customer ' : ''}
        {document.intermediary_visible ? 'Intermediary' : ''}
        {!document.customer_visible && !document.intermediary_visible
          ? 'Internal only'
          : null}
      </span>
    ),
  },
  {
    key: 'retention_until',
    header: 'Retention',
    sortable: true,
    cell: (document) => formatDate(document.retention_until),
  },
];

export function DocumentsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<UploadFormState>(initialForm);

  const { tableProps, state } = useServerTable<
    DocumentRecord,
    DocumentFilterKey
  >({
    queryKey: ['engagement', 'documents'],
    fetcher: (params, signal) => engagementApi.pageDocuments(params, signal),
    filterKeys: DOCUMENT_FILTER_KEYS,
    defaultSortBy: 'created_at',
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!form.file) {
        throw new Error('Choose a file to upload.');
      }

      const session = await engagementApi.createUploadSession({
        title: form.title,
        document_type: form.document_type,
        classification: form.classification,
        resource_type: form.resource_type,
        resource_id: form.resource_id,
        customer_visible: form.customer_visible,
        intermediary_visible: form.intermediary_visible,
      });

      return engagementApi.completeUploadSession(session.token, form.file);
    },
    onSuccess: () => {
      toast.success('Document uploaded');
      setForm(initialForm);
      queryClient.invalidateQueries({ queryKey: ['engagement', 'documents'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Engagement"
        title="Document Centre"
        description="Secure uploads, immutable versions, linked records, and audited downloads."
      />

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="h-4 w-4 text-blue-600" />
            New document upload
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="doc-title">Title</Label>
            <Input
              id="doc-title"
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              placeholder="Claims estimate"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc-type">Document type</Label>
            <Input
              id="doc-type"
              value={form.document_type}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  document_type: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc-classification">Classification</Label>
            <Select
              value={form.classification}
              onValueChange={(value) =>
                setForm((current) => ({ ...current, classification: value }))
              }
            >
              <SelectTrigger id="doc-classification">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED', 'PUBLIC'].map(
                  (item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc-resource-type">Linked record type</Label>
            <Input
              id="doc-resource-type"
              value={form.resource_type}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  resource_type: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc-resource-id">Linked record UUID</Label>
            <Input
              id="doc-resource-id"
              value={form.resource_id}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  resource_id: event.target.value,
                }))
              }
              placeholder="00000000-0000-0000-0000-000000000000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc-file">File</Label>
            <Input
              id="doc-file"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  file: event.target.files?.[0] ?? null,
                }))
              }
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="doc-customer-visible"
              checked={form.customer_visible}
              onCheckedChange={(checked) =>
                setForm((current) => ({
                  ...current,
                  customer_visible: checked === true,
                }))
              }
            />
            <Label htmlFor="doc-customer-visible">Visible to customer</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="doc-intermediary-visible"
              checked={form.intermediary_visible}
              onCheckedChange={(checked) =>
                setForm((current) => ({
                  ...current,
                  intermediary_visible: checked === true,
                }))
              }
            />
            <Label htmlFor="doc-intermediary-visible">
              Visible to intermediary
            </Label>
          </div>
          <div className="flex items-end justify-end">
            <Button
              onClick={() => uploadMutation.mutate()}
              disabled={uploadMutation.isPending}
              className="w-full lg:w-auto"
            >
              {uploadMutation.isPending ? 'Uploading...' : 'Upload document'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Files className="h-4 w-4 text-blue-600" />
            Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            {...tableProps}
            columns={columns}
            searchPlaceholder="Search documents…"
            filters={tableFilters(state.filters, [
              { key: 'status', label: 'Status', options: DOCUMENT_STATUS_OPTIONS },
              {
                key: 'classification',
                label: 'Classification',
                options: CLASSIFICATION_OPTIONS,
              },
            ])}
            emptyMessage="No documents yet"
          />
        </CardContent>
      </Card>
    </div>
  );
}
