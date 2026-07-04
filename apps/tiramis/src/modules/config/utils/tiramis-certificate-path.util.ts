import { existsSync } from 'fs';
import { isAbsolute, normalize, resolve } from 'path';

const projectRoot = process.cwd();

function candidateCertificatePaths(certificatePath: string): string[] {
  const baseDir = process.env.TIRAMIS_CERTIFICATE_BASE_DIR?.trim();

  return [
    ...(baseDir ? [resolve(baseDir, certificatePath)] : []),
    resolve(projectRoot, certificatePath),
    resolve(projectRoot, 'apps', 'tiramis', certificatePath),
    resolve(resolve(projectRoot, '..'), certificatePath),
    resolve(resolve(projectRoot, '..'), 'apps', 'tiramis', certificatePath),
  ];
}

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

  if (isAbsolute(trimmedPath)) {
    return normalize(trimmedPath);
  }

  const resolvedPath =
    candidateCertificatePaths(trimmedPath).find((candidatePath) =>
      existsSync(candidatePath),
    ) ?? resolve(projectRoot, trimmedPath);

  return normalize(resolvedPath);
}
