import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { PageHeader } from '@/components/shared/PageHeader';
import {
  DataTable,
  tableFilters,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { engagementApi, type DocumentTemplateRecord } from '../api';
import { formatDateTime, statusTone } from '../utils';
import { Badge } from '@/components/ui/badge';

const TEMPLATE_FILTER_KEYS = ['status'] as const;
type TemplateFilterKey = (typeof TEMPLATE_FILTER_KEYS)[number];

const TEMPLATE_STATUS_OPTIONS = ['DRAFT', 'ACTIVE', 'RETIRED'].map(
  (value) => ({ label: value, value }),
);

const columns: Column<DocumentTemplateRecord>[] = [
  {
    key: 'template_code',
    header: 'Template',
    sortable: true,
    cell: (template) => (
      <>
        <Link
          to={`/document-templates/${template.id}`}
          className="font-medium text-slate-900 hover:text-blue-700"
        >
          {template.template_code}
        </Link>
        <div className="text-sm text-slate-500">{template.template_name}</div>
      </>
    ),
  },
  {
    key: 'document_type',
    header: 'Document type',
    sortable: true,
    cell: (template) => template.document_type,
  },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    cell: (template) => (
      <Badge variant="outline" className={statusTone(template.status)}>
        {template.status}
      </Badge>
    ),
  },
  {
    key: 'created_at',
    header: 'Created',
    sortable: true,
    cell: (template) => formatDateTime(template.created_at),
  },
];

export function DocumentTemplatesPage() {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [documentType, setDocumentType] = useState('POLICY_DOCUMENT');

  const { tableProps, state } = useServerTable<
    DocumentTemplateRecord,
    TemplateFilterKey
  >({
    queryKey: ['engagement', 'document-templates'],
    fetcher: (params, signal) =>
      engagementApi.pageDocumentTemplates(params, signal),
    filterKeys: TEMPLATE_FILTER_KEYS,
    defaultSortBy: 'template_name',
    defaultSortOrder: 'ASC',
  });

  const createMutation = useMutation({
    mutationFn: () =>
      engagementApi.createDocumentTemplate({
        template_code: code,
        template_name: name,
        document_type: documentType,
      }),
    onSuccess: () => {
      toast.success('Template created');
      setCode('');
      setName('');
      queryClient.invalidateQueries({
        queryKey: ['engagement', 'document-templates'],
      });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Engagement"
        title="Document Templates"
        description="Template registry and publishable versions for generated documents."
      />

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">New template</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="template-code">Code</Label>
            <Input
              id="template-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="template-name">Name</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="template-document-type">Document type</Label>
            <Input
              id="template-document-type"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              Create template
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardContent className="pt-6">
          <DataTable
            {...tableProps}
            columns={columns}
            searchPlaceholder="Search templates…"
            filters={tableFilters(state.filters, [
              {
                key: 'status',
                label: 'Status',
                options: TEMPLATE_STATUS_OPTIONS,
              },
            ])}
            emptyMessage="No templates yet"
          />
        </CardContent>
      </Card>
    </div>
  );
}
