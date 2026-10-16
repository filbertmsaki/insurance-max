import { apiClient } from '@/modules/shared/api/client';

export async function downloadPdf(
  path: string,
  filename: string,
): Promise<void> {
  const response = await apiClient.get<Blob>(path, { responseType: 'blob' });
  const blobUrl = URL.createObjectURL(
    response.data instanceof Blob
      ? response.data
      : new Blob([response.data], { type: 'application/pdf' }),
  );
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
