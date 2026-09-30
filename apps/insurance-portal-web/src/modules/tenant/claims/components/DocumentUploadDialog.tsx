import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { humanizeCode } from '@/components/shared/detailFormat';
import { CLAIM_DOCUMENT_STAGES } from '../constants';
import type {
  ClaimDocumentRequirementStatus,
  UploadSessionPayload,
} from '../types';
import { ClaimErrorAlert } from './ClaimErrorAlert';

const OTHER = '__other__';

export interface DocumentUpload {
  details: UploadSessionPayload;
  file: File;
}

/**
 * Upload a file for a claim, against one of its required documents or as an
 * additional document. The file goes through the document registry, which
 * checks its size and type and keeps earlier versions.
 */
export function DocumentUploadDialog({
  requirements,
  initialRequirementId,
  pending,
  error,
  onUpload,
  onClose,
}: {
  requirements: ClaimDocumentRequirementStatus[];
  initialRequirementId?: string;
  pending: boolean;
  error: unknown;
  onUpload: (upload: DocumentUpload) => void;
  onClose: () => void;
}) {
  const [requirementId, setRequirementId] = useState(
    initialRequirementId ?? requirements[0]?.id ?? OTHER,
  );
  const [documentType, setDocumentType] = useState('');
  const [title, setTitle] = useState('');
  const [stage, setStage] = useState<string>('NOTIFICATION');
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const requirement = requirements.find((item) => item.id === requirementId);

  const submit = () => {
    const type = requirement?.document_type ?? documentType.trim();
    const name = requirement?.title ?? title.trim();
    if (!type || !name) {
      setProblem('Enter the document type and title');
      return;
    }
    if (!file) {
      setProblem('Choose the file to upload');
      return;
    }
    setProblem(null);
    onUpload({
      file,
      details: {
        document_type: type,
        title: name,
        claim_stage: requirement?.claim_stage ?? stage,
        requirement_code: requirement?.document_type,
      },
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload claim document</DialogTitle>
          <DialogDescription>
            A new upload of a document already on the claim replaces it as the
            current version and needs verifying again.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="claim-document-requirement">Document</Label>
            <Select value={requirementId} onValueChange={setRequirementId}>
              <SelectTrigger id="claim-document-requirement">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {requirements.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.title}
                    {item.is_mandatory ? ' (required)' : ''}
                  </SelectItem>
                ))}
                <SelectItem value={OTHER}>Other document</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {requirement ? null : (
            <>
              <div className="space-y-2">
                <Label htmlFor="claim-document-type" required>
                  Document type
                </Label>
                <Input
                  id="claim-document-type"
                  value={documentType}
                  maxLength={80}
                  placeholder="e.g. REPAIR_ESTIMATE"
                  onChange={(event) =>
                    setDocumentType(event.target.value.toUpperCase())
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="claim-document-title" required>
                  Title
                </Label>
                <Input
                  id="claim-document-title"
                  value={title}
                  maxLength={180}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="claim-document-stage">Stage</Label>
                <Select value={stage} onValueChange={setStage}>
                  <SelectTrigger id="claim-document-stage">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLAIM_DOCUMENT_STAGES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {humanizeCode(value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor="claim-document-file" required>
              File
            </Label>
            <Input
              id="claim-document-file"
              type="file"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>
          {problem ? <p className="text-sm text-red-600">{problem}</p> : null}
        </div>
        <ClaimErrorAlert error={error} title="The document was not uploaded" />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
