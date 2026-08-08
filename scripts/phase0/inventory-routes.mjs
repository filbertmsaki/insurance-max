import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();

const outputFile = path.join(cwd, 'docs/generated/phase0-route-inventory.json');

const checkOnly = process.argv.includes('--check');

function walk(directory, predicate) {
  const results = [];

  for (const entry of fs.readdirSync(directory, {
    withFileTypes: true,
  })) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      results.push(...walk(absolutePath, predicate));
    } else if (predicate(absolutePath)) {
      results.push(absolutePath);
    }
  }

  return results;
}

function decoratorPath(argument = '') {
  const match = /['"`]([^'"`]*)['"`]/.exec(argument);

  return match?.[1] ?? '';
}

function backendInventory(root) {
  const controllerFiles = walk(path.join(cwd, root), (file) =>
    file.endsWith('.controller.ts'),
  );

  return controllerFiles
    .flatMap((file) => {
      const source = fs.readFileSync(file, 'utf8');

      const controllerMatch = /@Controller\s*\(([^)]*)\)/m.exec(source);

      const controllerPath = decoratorPath(controllerMatch?.[1]);

      const routes = [];

      const routeRegex =
        /@(Get|Post|Put|Patch|Delete|Options|Head|All)\s*\(([^)]*)\)[\s\S]{0,500}?\n\s*(?:public\s+|private\s+|protected\s+)?(?:async\s+)?([A-Za-z0-9_]+)\s*\(/g;

      for (const match of source.matchAll(routeRegex)) {
        routes.push({
          httpMethod: match[1].toUpperCase(),
          controllerPath,
          routePath: decoratorPath(match[2]),
          handler: match[3],
          file: path.relative(cwd, file).replaceAll('\\', '/'),
        });
      }

      return routes;
    })
    .sort((left, right) => {
      const leftKey = `${left.controllerPath}/${left.routePath}/${left.httpMethod}`;

      const rightKey = `${right.controllerPath}/${right.routePath}/${right.httpMethod}`;

      return leftKey.localeCompare(rightKey);
    });
}

function frontendInventory() {
  const appFile = path.join(cwd, 'apps/insurance-portal-web/src/App.tsx');

  const source = fs.readFileSync(appFile, 'utf8');

  const routes = [];

  const routeRegex = /<Route\b[^>]*\bpath=(?:"([^"]+)"|\{([^}]+)\})/g;

  for (const match of source.matchAll(routeRegex)) {
    routes.push(match[1] ?? `{${match[2].trim()}}`);
  }

  return [...new Set(routes)].sort();
}

const inventory = {
  generatedAt: 'GENERATED',

  services: {
    insurancePortalService: backendInventory(
      'apps/insurance-portal-service/src',
    ),

    tiramis: backendInventory('apps/tiramis/src'),

    insurancePortalWeb: frontendInventory(),
  },
};

const serialized = `${JSON.stringify(inventory, null, 2)}\n`;

if (checkOnly) {
  if (!fs.existsSync(outputFile)) {
    console.error(
      'Route snapshot is missing. Run npm run phase0:routes:update.',
    );
    process.exit(1);
  }

  const current = fs.readFileSync(outputFile, 'utf8');

  if (current !== serialized) {
    console.error(
      'Route inventory changed. Review the changes and run npm run phase0:routes:update.',
    );
    process.exit(1);
  }

  console.log('Route inventory matches the committed baseline.');
} else {
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });

  fs.writeFileSync(outputFile, serialized);

  console.log(`Route inventory written to ${path.relative(cwd, outputFile)}`);
}
