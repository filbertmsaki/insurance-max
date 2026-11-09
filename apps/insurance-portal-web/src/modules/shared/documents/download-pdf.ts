import { apiClient } from '@/modules/shared/api/client';

/** Fetches an authenticated PDF as a Blob (for preview, print or download). */
export async function fetchPdfBlob(path: string): Promise<Blob> {
  const response = await apiClient.get<Blob>(path, { responseType: 'blob' });
  // Re-wrap so viewers always get the PDF type, whatever the response says.
  return new Blob([response.data], { type: 'application/pdf' });
}

export async function downloadPdf(
  path: string,
  filename: string,
): Promise<void> {
  const blobUrl = URL.createObjectURL(await fetchPdfBlob(path));
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

export function documentFilename(reference: string, suffix = ''): string {
  const safe = [...reference]
    .map((character) => {
      const code = character.charCodeAt(0);
      return /[\\/:*?"<>|]/.test(character) || code < 32 || code === 127
        ? '-'
        : character;
    })
    .join('')
    .trim()
    .replace(/\s+/g, '-');
  return `${safe || 'document'}${suffix}.pdf`;
}
