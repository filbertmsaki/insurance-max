import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

import { engagementApi } from '../api';
import { formatDateTime, statusTone } from '../utils';

export function DocumentTemplateDetailPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const [content, setContent] = useState(
    'Policy Number: {{policy.number}}\nCustomer: {{customer.name}}',
  );
  const [schema, setSchema] = useState(
    '{\n  "required": ["policy", "customer"],\n  "properties": {\n    "policy": { "required": ["number"] },\n    "customer": { "required": ["name"] }\n  }\n}',
  );
  const [sampleData, setSampleData] = useState(
    '{\n  "policy": { "number": "POL-2026-0001" },\n  "customer": { "name": "Amina Juma" }\n}',
  );
  const [previewVersionId, setPreviewVersionId] = useState<string | null>(null);

  const templateQuery = useQuery({
    queryKey: ['engagement', 'document-template', id],
    queryFn: () => engagementApi.getDocumentTemplate(id),
    enabled: Boolean(id),
  });

  const previewQuery = useQuery({
    queryKey: ['engagement', 'document-template-preview', previewVersionId],
    queryFn: () =>
      engagementApi.previewDocumentTemplateVersion(previewVersionId!),
    enabled: Boolean(previewVersionId),
  });

  const createVersionMutation = useMutation({
    mutationFn: () =>
      engagementApi.createDocumentTemplateVersion(id, {
        template_content: content,
        variable_schema: JSON.parse(schema),
        sample_data: JSON.parse(sampleData),
      }),
    onSuccess: () => {
      toast.success('Template version created');
      queryClient.invalidateQueries({
        queryKey: ['engagement', 'document-template', id],
      });
    },
  });

  const versionActionMutation = useMutation({
    mutationFn: async (params: { action: string; versionId: string }) => {
      if (params.action === 'submit') {
        return engagementApi.submitDocumentTemplateVersion(params.versionId);
      }
      if (params.action === 'approve') {
        return engagementApi.approveDocumentTemplateVersion(params.versionId);
      }
      if (params.action === 'publish') {
        return engagementApi.publishDocumentTemplateVersion(params.versionId);
      }
      return engagementApi.retireDocumentTemplateVersion(params.versionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['engagement', 'document-template', id],
      });
    },
  });

  const template = templateQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Phase 17"
        title={template?.template_code ?? 'Template detail'}
        description={template?.template_name ?? 'Template versions and preview'}
      />

      <Tabs defaultValue="versions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="versions">Versions</TabsTrigger>
          <TabsTrigger value="new">New Version</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="versions">
          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardContent className="space-y-4 pt-6">
              {(template?.versions ?? []).map((version) => (
                <div
                  key={version.id}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900">
                        Version {version.version_number}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatDateTime(version.created_at)}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={statusTone(version.status)}
                    >
                      {version.status}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPreviewVersionId(version.id)}
                    >
                      Preview
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        versionActionMutation.mutate({
                          action: 'submit',
                          versionId: version.id,
                        })
                      }
                    >
                      Submit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        versionActionMutation.mutate({
                          action: 'approve',
                          versionId: version.id,
                        })
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        versionActionMutation.mutate({
                          action: 'publish',
                          versionId: version.id,
                        })
                      }
                    >
                      Publish
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        versionActionMutation.mutate({
                          action: 'retire',
                          versionId: version.id,
                        })
                      }
                    >
                      Retire
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="new">
          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Create version</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="template-content">Template content</Label>
                <Textarea
                  id="template-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-schema">Variable schema (JSON)</Label>
                <Textarea
                  id="template-schema"
                  value={schema}
                  onChange={(e) => setSchema(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-sample">Sample data (JSON)</Label>
                <Textarea
                  id="template-sample"
                  value={sampleData}
                  onChange={(e) => setSampleData(e.target.value)}
                />
              </div>
              <Button
                onClick={() => createVersionMutation.mutate()}
                disabled={createVersionMutation.isPending}
              >
                Save version
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview">
          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardContent className="pt-6">
              {previewQuery.data ? (
                <pre className="whitespace-pre-wrap rounded-lg bg-slate-950 p-4 text-sm text-slate-100">
                  {previewQuery.data.rendered}
                </pre>
              ) : (
                <div className="text-sm text-slate-500">
                  Select a version from the Versions tab to preview it.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
