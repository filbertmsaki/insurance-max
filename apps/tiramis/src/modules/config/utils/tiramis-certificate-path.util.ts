import { existsSync } from 'fs';
import { isAbsolute, normalize, resolve } from 'path';
import { environment } from '@insurance-max/shared-config';

const projectRoot = process.cwd();
const parentProjectRoot = resolve(projectRoot, '..');

function buildPathSuffixes(certificatePath: string): string[] {
  const segments = certificatePath
    .trim()
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean);

  const suffixes = new Set<string>([certificatePath.trim()]);

  for (let index = 1; index <= Math.min(4, segments.length); index += 1) {
    suffixes.add(segments.slice(-index).join('/'));
  }

  return Array.from(suffixes).filter(Boolean);
}

function candidateCertificatePaths(certificatePath: string): string[] {
  const baseDir = environment.TIRAMIS_CERTIFICATE_BASE_DIR?.trim();
  const suffixes = buildPathSuffixes(certificatePath);
  const bundledAssetRoots = [
    resolve(projectRoot, 'apps', 'tiramis', 'src', 'assets', 'certificaties'),
    resolve(projectRoot, 'apps', 'tiramis', 'src', 'assets', 'certificates'),
    resolve(
      parentProjectRoot,
      'apps',
      'tiramis',
      'src',
      'assets',
      'certificaties',
    ),
    resolve(
      parentProjectRoot,
      'apps',
      'tiramis',
      'src',
      'assets',
      'certificates',
    ),
  ];

  return Array.from(
    new Set([
      ...(baseDir
        ? suffixes.flatMap((suffix) => [
            resolve(baseDir, certificatePath),
            resolve(baseDir, suffix),
          ])
        : []),
      ...suffixes.flatMap((suffix) => [
        resolve(projectRoot, suffix),
        resolve(projectRoot, 'apps', 'tiramis', suffix),
        resolve(parentProjectRoot, suffix),
        resolve(parentProjectRoot, 'apps', 'tiramis', suffix),
        ...bundledAssetRoots.map((rootPath) => resolve(rootPath, suffix)),
      ]),
    ]),
  );
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

  if (isAbsolute(trimmedPath) && existsSync(trimmedPath)) {
    return normalize(trimmedPath);
  }

  const resolvedPath =
    candidateCertificatePaths(trimmedPath).find((candidatePath) =>
      existsSync(candidatePath),
    ) ??
    (isAbsolute(trimmedPath) ? trimmedPath : resolve(projectRoot, trimmedPath));

  return normalize(resolvedPath);
}
