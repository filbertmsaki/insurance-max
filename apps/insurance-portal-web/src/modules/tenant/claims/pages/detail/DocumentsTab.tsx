import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Circle, Download, Upload, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ClaimsPermissions } from '@insurance-max/contracts';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState, SectionCard } from '@/components/shared/DetailSections';
import { humanizeCode } from '@/components/shared/detailFormat';
import { engagementApi } from '@/modules/tenant/engagement/api';
import { claimsApi } from '../../api';
import { userName } from '../../claim-records';
import { ClaimErrorAlert } from '../../components/ClaimErrorAlert';
import {
  DocumentUploadDialog,
  type DocumentUpload,
} from '../../components/DocumentUploadDialog';
import { ReasonDialog } from '../../components/ReasonDialog';
import { DOCUMENT_STATUS_META } from '../../constants';
import {
  useClaimAction,
  useClaimDocuments,
  useInvalidateClaim,
} from '../../hooks';
import type { ClaimDetail, ClaimDocumentRecord } from '../../types';
import { formatClaimDateTime } from '../../utils';

/**
 * Upload runs in three steps: a registry session scoped to the claim, the
 * file itself, then linking the stored document to the claim.
 */
async function uploadClaimDocument(claimId: string, upload: DocumentUpload) {
  const session = await claimsApi.createDocumentUploadSession(
    claimId,
    upload.details,
  );
  const stored = await engagementApi.completeUploadSession(
    session.token,
    upload.file,
  );
  return claimsApi.linkDocument(claimId, {
    ...upload.details,
    document_id: stored.id,
  });
}

/** Claim documents and the checklist the product requires per stage. */
export function DocumentsTab({ claim }: { claim: ClaimDetail }) {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canUpload = hasPermission(ClaimsPermissions.DOCUMENT_UPLOAD);
  const canVerify = hasPermission(ClaimsPermissions.DOCUMENT_VERIFY);
  const view = useClaimDocuments(claim.id);
  const invalidate = useInvalidateClaim();

  const [uploading, setUploading] = useState<{ requirementId?: string } | null>(
    null,
  );
  const [rejecting, setRejecting] = useState<ClaimDocumentRecord | null>(null);

  const upload = useMutation({
    mutationFn: (value: DocumentUpload) => uploadClaimDocument(claim.id, value),
    onSuccess: (document) => {
      toast.success(`${document.title ?? 'Document'} uploaded`);
      setUploading(null);
    },
    onSettled: () => invalidate(claim.id),
  });
  const verify = useClaimAction(
    claim.id,
    ({
      document,
      decision,
      reason,
    }: {
      document: ClaimDocumentRecord;
      decision: 'VERIFIED' | 'REJECTED';
      reason?: string;
    }) =>
      claimsApi.verifyDocument(document.id, {
        decision,
        rejection_reason: reason,
      }),
    (result) =>
      result.status === 'VERIFIED' ? 'Document verified' : 'Document rejected',
  );

  if (view.isLoading) return <Skeleton className="h-40 w-full" />;
  if (view.isError) {
    return (
      <ClaimErrorAlert
        error={view.error}
        title="The documents could not be loaded"
      />
    );
  }

  const documents = view.data?.documents ?? [];
  const requirements = view.data?.requirements ?? [];
  const missing = requirements.filter(
    (requirement) => requirement.is_mandatory && !requirement.satisfied,
  );

  const download = (document: ClaimDocumentRecord) =>
    document.document_id
      ? void engagementApi
          .downloadDocument(
            document.document_id,
            document.file_name ?? document.title ?? 'document',
          )
          .catch(() => toast.error('The document could not be downloaded'))
      : undefined;

  return (
    <div className="space-y-4">
      <ClaimErrorAlert
        error={verify.error}
        title="The document was not updated"
      />

      <SectionCard
        title="Required documents"
        description={
          missing.length
            ? `${missing.length} required document${missing.length === 1 ? ' is' : 's are'} still missing. A stage cannot be submitted until its required documents are uploaded.`
            : 'Documents the product requires, by claim stage.'
        }
        action={
          canUpload ? (
            <Button onClick={() => setUploading({})}>
              <Upload className="mr-1.5 h-4 w-4" />
              Upload document
            </Button>
          ) : undefined
        }
      >
        {requirements.length === 0 ? (
          <EmptyState text="No document requirements are configured for this product." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {requirements.map((requirement) => (
              <li
                key={requirement.id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div className="flex items-center gap-2 text-sm">
                  {requirement.verified ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : requirement.satisfied ? (
                    <CheckCircle2 className="h-4 w-4 text-amber-500" />
                  ) : (
                    <Circle className="h-4 w-4 text-slate-300" />
                  )}
                  <span>{requirement.title}</span>
                  <span className="text-xs text-slate-500">
                    {humanizeCode(requirement.claim_stage)}
                    {requirement.is_mandatory ? ' · required' : ' · optional'}
                  </span>
                </div>
                {!requirement.satisfied && canUpload ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setUploading({ requirementId: requirement.id })
                    }
                  >
                    Upload
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Documents on the claim">
        {documents.length === 0 ? (
          <EmptyState text="No documents uploaded yet." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((document) => {
                const meta = DOCUMENT_STATUS_META[document.status];
                return (
                  <TableRow key={document.id}>
                    <TableCell>
                      <div className="font-medium">
                        {document.title ?? humanizeCode(document.document_type)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {document.file_name ?? '-'}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatClaimDateTime(document.uploaded_at)}
                      <div className="text-xs text-slate-500">
                        {userName(claim, document.uploaded_by)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={meta?.tone ?? 'muted'}>
                        {meta?.label ?? humanizeCode(document.status)}
                      </Badge>
                      {document.rejection_reason ? (
                        <div className="mt-1 text-xs text-red-600">
                          {document.rejection_reason}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {document.document_id ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Download ${document.title ?? 'document'}`}
                            onClick={() => download(document)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        ) : null}
                        {canVerify && document.status === 'UPLOADED' ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={verify.isPending}
                              onClick={() =>
                                verify.mutate({
                                  document,
                                  decision: 'VERIFIED',
                                })
                              }
                            >
                              <CheckCircle2 className="mr-1 h-4 w-4" />
                              Verify
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setRejecting(document)}
                            >
                              <XCircle className="mr-1 h-4 w-4" />
                              Reject
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      {uploading ? (
        <DocumentUploadDialog
          requirements={requirements}
          initialRequirementId={uploading.requirementId}
          pending={upload.isPending}
          error={upload.error}
          onClose={() => {
            upload.reset();
            setUploading(null);
          }}
          onUpload={(value) => upload.mutate(value)}
        />
      ) : null}

      {rejecting ? (
        <ReasonDialog
          title={`Reject ${rejecting.title ?? 'document'}`}
          description="The uploader is asked for a replacement. The reason is kept on the claim."
          label="Why the document is rejected"
          confirmLabel="Reject document"
          destructive
          pending={verify.isPending}
          error={verify.error}
          onClose={() => {
            verify.reset();
            setRejecting(null);
          }}
          onConfirm={(reason) =>
            verify.mutate(
              { document: rejecting, decision: 'REJECTED', reason },
              { onSuccess: () => setRejecting(null) },
            )
          }
        />
      ) : null}
    </div>
  );
}
