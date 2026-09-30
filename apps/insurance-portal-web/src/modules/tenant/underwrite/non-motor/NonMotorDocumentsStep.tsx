import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FileUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/ContentStates';
import { getApiErrorMessage } from '@/lib/api-error';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { engagementApi } from '@/modules/tenant/engagement/api';
import { StepSection } from '@/modules/tenant/quotations/wizard/components/StepSection';
import { nonMotorApi } from '../api';
import {
  quotationDocumentsKey,
  useProductDocumentRequirements,
} from './useNonMotorDocuments';

/**
 * Documents: the product's quotation-stage document requirements, each with
 * an upload that attaches the file to this quotation through the existing
 * document service (virus-scanned, versioned, audited).
 */
export function NonMotorDocumentsStep({
  quotationId,
  productId,
  subClassId,
}: {
  quotationId: string | null;
  productId: string | undefined;
  subClassId?: string;
}) {
  const queryClient = useQueryClient();
  const canUpload = useAuthStore((state) =>
    state.hasPermission('documents:upload'),
  );
  const requirements = useProductDocumentRequirements(productId, subClassId);
  const documents = useQuery({
    queryKey: quotationDocumentsKey(quotationId ?? ''),
    queryFn: () => nonMotorApi.getQuotationDocuments(quotationId!),
    enabled: Boolean(quotationId),
  });
  const [uploading, setUploading] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const upload = async (
    requirement: {
      code: string;
      name: string;
      maximumFileSizeMb: number | null;
    },
    file: File,
  ) => {
    if (!quotationId) return;
    setUploading(requirement.code);
    try {
      const session = await engagementApi.createUploadSession({
        title: requirement.name,
        document_type: requirement.code,
        classification: 'INTERNAL',
        resource_type: 'QUOTATION',
        resource_id: quotationId,
        customer_visible: false,
        intermediary_visible: false,
      });
      await engagementApi.completeUploadSession(session.token, file);
      await queryClient.invalidateQueries({
        queryKey: quotationDocumentsKey(quotationId),
      });
      toast.success(`${requirement.name} uploaded`);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setUploading(null);
    }
  };

  if (!quotationId) {
    return (
      <EmptyState
        title="Save the draft to attach documents"
        description="Documents are attached to the quotation once its first draft is saved."
      />
    );
  }

  const uploaded = documents.data ?? [];
  const items = requirements.data ?? [];

  return (
    <div className="space-y-6">
      <StepSection
        title="Required documents"
        description="Configured for this product. The quotation cannot be completed until every mandatory document is attached."
        first
      >
        {requirements.isLoading ? (
          <p className="text-sm text-slate-500">Loading requirements…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500">
            This product has no quotation document requirements.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {items.map((requirement) => {
              const attached = uploaded.filter(
                (document) => document.document_type === requirement.code,
              );
              return (
                <li
                  key={requirement.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium text-slate-900">
                      {requirement.name}
                      {requirement.isMandatory ? (
                        <Badge variant="outline">Mandatory</Badge>
                      ) : (
                        <Badge variant="muted">Optional</Badge>
                      )}
                    </p>
                    {requirement.description && (
                      <p className="text-sm text-slate-500">
                        {requirement.description}
                      </p>
                    )}
                    {attached.map((document) => (
                      <p
                        key={document.id}
                        className="mt-1 flex items-center gap-1 text-xs text-emerald-700"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {document.file_name} ·{' '}
                        {document.status.replace(/_/g, ' ').toLowerCase()}
                      </p>
                    ))}
                  </div>
                  {canUpload && (
                    <>
                      <input
                        ref={(element) => {
                          inputs.current[requirement.code] = element;
                        }}
                        type="file"
                        className="hidden"
                        accept={
                          requirement.acceptedMimeTypes.join(',') || undefined
                        }
                        aria-label={`Upload ${requirement.name}`}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = '';
                          if (!file) return;
                          const limit = requirement.maximumFileSizeMb;
                          if (limit && file.size > limit * 1024 * 1024) {
                            toast.error(
                              `${requirement.name} must be ${limit} MB or smaller`,
                            );
                            return;
                          }
                          void upload(requirement, file);
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploading !== null}
                        onClick={() =>
                          inputs.current[requirement.code]?.click()
                        }
                      >
                        {uploading === requirement.code ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <FileUp className="mr-2 h-4 w-4" />
                        )}
                        {attached.length ? 'Upload another' : 'Upload'}
                      </Button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </StepSection>
    </div>
  );
}
