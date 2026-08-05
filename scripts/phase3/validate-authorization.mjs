import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();

const sourceRoot = path.join(cwd, 'apps/insurance-portal-service/src');

const errors = [];

function walk(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = path.join(directory, entry.name);

      return entry.isDirectory() ? walk(fullPath) : [fullPath];
    });
}

const controllerFiles = walk(sourceRoot).filter((file) =>
  file.endsWith('.controller.ts'),
);

const mutationPattern = /@(Post|Patch|Put|Delete)\s*\(/g;

// Decorators that count as "this route/class has made an explicit,
// reviewable authorization decision" — either a permission/role/scope
// requirement, an intentionally public/service route, or an explicit
// "authenticated only, own-record" marker.
const authorizedDecoratorPattern =
  /@(Permissions|AnyPermissions|Roles|AllRoles|TenantScoped|PlatformScoped|Public|ServiceEndpoint|AuthenticatedAccess|RequireTiramisPermissions)\s*\(/;

for (const file of controllerFiles) {
  const source = fs.readFileSync(file, 'utf8');

  const publicController = /@Public\(\)[\s\S]{0,200}@Controller/.test(
    source,
  );

  const serviceController = /@ServiceEndpoint\(\)[\s\S]{0,200}@Controller/.test(
    source,
  );

  if (publicController || serviceController) {
    continue;
  }

  // Class-level decorators (applied once, above `export class ...`) cover
  // every route in the file — e.g. `@Permissions(...)` or
  // `@RequireTiramisPermissions(...)` applied once instead of repeated on
  // each handler. Capture that block so those routes aren't flagged.
  const classDeclarationIndex = source.indexOf('export class');
  const classLevelBlock =
    classDeclarationIndex === -1
      ? ''
      : source.slice(0, classDeclarationIndex);
  const classLevelAuthorized = authorizedDecoratorPattern.test(
    classLevelBlock,
  );

  if (classLevelAuthorized) {
    continue;
  }

  // Some controllers write the auth decorator *before* the HTTP-verb
  // decorator (e.g. `@RequireTiramisPermissions(...)` then `@Post(...)`)
  // rather than after. To catch that without accidentally matching a
  // decorator that belongs to the *previous* handler, bound the backward
  // scan at the previous HTTP-verb decorator (Get included, since it marks
  // the previous handler's boundary) — everything between that point and
  // the current verb decorator belongs only to the current handler.
  const verbPattern = /@(Get|Post|Patch|Put|Delete)\s*\(/g;
  const verbMatches = [...source.matchAll(verbPattern)];

  for (const match of source.matchAll(mutationPattern)) {
    const matchPosition = verbMatches.findIndex(
      (verbMatch) => verbMatch.index === match.index,
    );

    const previousVerbMatch =
      matchPosition > 0 ? verbMatches[matchPosition - 1] : undefined;

    const backwardBoundary = previousVerbMatch
      ? previousVerbMatch.index + previousVerbMatch[0].length
      : Math.max(0, match.index - 700);

    const surrounding = source.slice(
      Math.max(backwardBoundary, classDeclarationIndex),
      match.index + 700,
    );

    const authorized = authorizedDecoratorPattern.test(surrounding);

    if (!authorized) {
      errors.push(
        `${path.relative(cwd, file)}: ${match[1]} route has no explicit authorization metadata`,
      );
    }
  }
}

if (errors.length) {
  console.error('Authorization validation failed:');

  for (const error of errors) {
    console.error(`- ${error}`);
  }

  process.exit(1);
}

console.log('Authorization validation passed.');
