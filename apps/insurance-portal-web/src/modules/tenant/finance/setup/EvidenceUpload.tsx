import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { engagementApi } from '@/modules/tenant/engagement/api';
import type { FoundationScope } from '../foundation/api';

export function EvidenceUpload({
  scope,
  identity,
  canUpload,
}: {
  scope: FoundationScope;
  identity: string[];
  canUpload: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const client = useQueryClient();
  const upload = useMutation({
    mutationFn: async (document: File) => {
      const session = await engagementApi.createUploadSession({
        title: document.name.slice(0, 180),
        document_type: 'FINANCE_SETUP_EVIDENCE',
        classification: 'INTERNAL',
        resource_type: 'FINANCE_SETUP',
        resource_id: scope.bookId,
        customer_visible: false,
        intermediary_visible: false,
      });
      return engagementApi.completeUploadSession(session.token, document);
    },
    onSuccess: async () => {
      setFile(null);
      setFileKey((value) => value + 1);
      await client.invalidateQueries({
        queryKey: [
          'finance-setup',
          ...identity,
          scope.tenantId,
          scope.legalEntityId,
          scope.bookId,
          'overview',
        ],
      });
    },
  });
  if (!canUpload)
    return (
      <p className="text-sm">
        Ask a document administrator to upload evidence for this book, then
        refresh setup evidence.
      </p>
    );
  return (
    <div className="space-y-2 rounded border p-3">
      <label className="block text-sm">
        Upload supporting evidence
        <input
          key={fileKey}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
          disabled={upload.isPending}
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            upload.reset();
          }}
          className="mt-1 block w-full text-sm"
        />
      </label>
      <p className="text-sm text-slate-600">
        Use a PDF or image containing the actual source reconciliation. The file
        must pass the document scan.
      </p>
      <Button
        type="button"
        variant="outline"
        disabled={!file || upload.isPending}
        onClick={() => file && upload.mutate(file)}
      >
        {upload.isPending ? 'Uploading…' : 'Upload evidence'}
      </Button>
      {upload.isError && (
        <p role="alert" className="text-sm text-red-700">
          Upload failed. Check the file type, size and document scan, then try
          again.
        </p>
      )}
      {upload.isSuccess && (
        <p role="status" className="text-sm text-green-800">
          Evidence uploaded. Select it above to attach it to this draft.
        </p>
      )}
    </div>
  );
}
