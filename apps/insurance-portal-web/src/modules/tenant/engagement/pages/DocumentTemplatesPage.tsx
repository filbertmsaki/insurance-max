import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { engagementApi } from '../api';
import { formatDateTime, statusTone } from '../utils';
import { Badge } from '@/components/ui/badge';

export function DocumentTemplatesPage() {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [documentType, setDocumentType] = useState('POLICY_DOCUMENT');

  const templatesQuery = useQuery({
    queryKey: ['engagement', 'document-templates'],
    queryFn: engagementApi.listDocumentTemplates,
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead>Document type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(templatesQuery.data ?? []).map((template) => (
                <TableRow key={template.id}>
                  <TableCell>
                    <Link
                      to={`/document-templates/${template.id}`}
                      className="font-medium text-slate-900 hover:text-blue-700"
                    >
                      {template.template_code}
                    </Link>
                    <div className="text-sm text-slate-500">
                      {template.template_name}
                    </div>
                  </TableCell>
                  <TableCell>{template.document_type}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={statusTone(template.status)}
                    >
                      {template.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDateTime(template.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
