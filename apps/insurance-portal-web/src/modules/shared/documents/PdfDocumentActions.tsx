import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getApiErrorMessage } from '@/lib/api-error';
import { documentFilename, downloadPdf, fetchPdfBlob } from './download-pdf';

/**
 * Actions for one server-rendered PDF: preview, download, print, open in a
 * new tab. Preview and print open the same PDF as the download in a pop-up,
 * so what users see is what they send. Print opens the pop-up and brings up
 * the print dialog once the document has loaded. `base` is an endpoint with
 * `/preview` and `/download` children.
 */
export function PdfDocumentActions({
  base,
  number,
  noun,
  filePrefix,
}: {
  base: string;
  /** Document number, used in titles and the download filename. */
  number: string;
  /** Lower-case kind, e.g. "quotation" or "policy schedule". */
  noun: string;
  /** File name prefix, e.g. "Quotation" gives Quotation_<number>.pdf. */
  filePrefix: string;
}) {
  const [busy, setBusy] = useState<
    'preview' | 'download' | 'print' | 'open' | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const printWhenLoaded = useRef(false);
  const frameLoaded = useRef(false);
  const title = noun.charAt(0).toUpperCase() + noun.slice(1);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const run = async (
    action: NonNullable<typeof busy>,
    task: () => Promise<void>,
  ) => {
    setBusy(action);
    setError(null);
    try {
      await task();
    } catch (cause) {
      setError(getApiErrorMessage(cause));
    } finally {
      setBusy(null);
    }
  };

  const ensurePreviewUrl = async () => {
    if (previewUrl) return previewUrl;
    const url = URL.createObjectURL(await fetchPdfBlob(`${base}/preview`));
    setPreviewUrl(url);
    return url;
  };

  const printFrame = () => {
    try {
      frameRef.current?.contentWindow?.focus();
      frameRef.current?.contentWindow?.print();
    } catch {
      setError(
        'Printing is blocked here. Use Open in new tab and print from there.',
      );
    }
  };

  const openModal = (print: boolean) =>
    run(print ? 'print' : 'preview', async () => {
      await ensurePreviewUrl();
      printWhenLoaded.current = print;
      setModalOpen(true);
      // Reopening keeps the loaded frame only while the dialog is mounted.
      if (print && frameLoaded.current) printFrame();
    });

  const download = () =>
    run('download', () =>
      downloadPdf(
        `${base}/download`,
        documentFilename(`${filePrefix}_${number}`),
      ),
    );

  const openInTab = () =>
    run('open', async () => {
      // Mobile browsers rarely render PDFs inline; open in a new tab.
      window.open(await ensurePreviewUrl(), '_blank', 'noopener');
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label={`${title} document actions`}
      >
        <Button
          size="sm"
          variant="outline"
          disabled={busy !== null}
          aria-haspopup="dialog"
          aria-label={`Preview ${noun}`}
          onClick={() => void openModal(false)}
        >
          {busy === 'preview' ? 'Loading...' : 'Preview'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy !== null}
          aria-label={`Download ${noun} PDF`}
          onClick={download}
        >
          {busy === 'download' ? 'Downloading...' : 'Download PDF'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy !== null}
          aria-haspopup="dialog"
          onClick={() => void openModal(true)}
        >
          {busy === 'print' ? 'Preparing...' : 'Print'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy !== null}
          onClick={openInTab}
        >
          Open in new tab
        </Button>
      </div>
      {error && (
        <p role="alert" className="w-full text-sm text-red-700">
          {error}
        </p>
      )}

      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) {
            printWhenLoaded.current = false;
            frameLoaded.current = false;
          }
        }}
      >
        <DialogContent className="flex h-[92dvh] w-[calc(100%-1rem)] max-w-5xl flex-col gap-3 p-3 sm:p-4">
          <DialogHeader className="pr-8">
            <DialogTitle className="text-base">
              {title} {number}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Preview of the {noun} PDF.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-hidden rounded-md border bg-muted">
            {previewUrl && (
              <iframe
                ref={frameRef}
                title={`${title} ${number} preview`}
                src={previewUrl}
                className="block h-full w-full"
                onLoad={() => {
                  frameLoaded.current = true;
                  if (printWhenLoaded.current) {
                    printWhenLoaded.current = false;
                    printFrame();
                  }
                }}
              />
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              disabled={busy !== null}
              onClick={openInTab}
            >
              Open in new tab
            </Button>
            <Button
              variant="outline"
              disabled={busy !== null}
              onClick={download}
            >
              {busy === 'download' ? 'Downloading...' : 'Download PDF'}
            </Button>
            <Button onClick={printFrame}>Print</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
