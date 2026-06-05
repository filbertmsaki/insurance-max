import { isAbsolute, normalize, resolve } from 'path';

const projectRoot = process.cwd();

export function resolveTiramisCertificatePath(
  certificatePath?: string | null,
): string | null {
  if (!certificatePath) {
    return null;
  }

  const trimmedPath = certificatePath.trim();

  if (!trimmedPath) {
    return null;
  }

  return isAbsolute(trimmedPath)
    ? normalize(trimmedPath)
    : resolve(projectRoot, trimmedPath);
}
