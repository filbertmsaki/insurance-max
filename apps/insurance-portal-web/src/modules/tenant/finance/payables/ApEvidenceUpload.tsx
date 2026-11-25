import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { engagementApi } from '@/modules/tenant/engagement/api';
import { getApiErrorMessage } from '@/lib/api-error';

export function ApEvidenceUpload({
  companyId,
  refresh,
}: {
  companyId: string;
  refresh: () => Promise<unknown>;
}) {
  const [file, setFile] = useState<File>(),
    [version, setVersion] = useState(0);
  const upload = useMutation({
    mutationFn: async (document: File) => {
      const session = await engagementApi.createUploadSession({
        title: document.name.slice(0, 180),
        document_type: 'ACCOUNTS_PAYABLE_EVIDENCE',
        classification: 'INTERNAL',
        resource_type: 'COMPANY',
        resource_id: companyId,
        customer_visible: false,
        intermediary_visible: false,
      });
      await engagementApi.completeUploadSession(session.token, document);
    },
    onSuccess: async () => {
      setFile(undefined);
      setVersion((v) => v + 1);
      await refresh();
    },
  });
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label>
        Attach a new receipt or supporting document{' '}
        <input
          type="file"
          key={version}
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => {
            setFile(e.target.files?.[0]);
            upload.reset();
          }}
        />
      </label>
      <Button
        variant="outline"
        disabled={!file || upload.isPending}
        onClick={() => file && upload.mutate(file)}
      >
        Upload document
      </Button>
      {upload.isError && <p role="alert">{getApiErrorMessage(upload.error)}</p>}
      {upload.isSuccess && (
        <p role="status">Select the uploaded version on the document.</p>
      )}
    </div>
  );
}
