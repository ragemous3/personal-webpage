import { createHash } from 'node:crypto';
import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import ts from 'typescript';

const requireCondition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const { values } = parseArgs({
  options: {
    site: { type: 'string', default: 'public' },
    assets: { type: 'string', default: 'assets' },
    'base-url': { type: 'string', default: '/' },
  },
});
const base = new URL(values['base-url'], 'https://build.invalid');
const files = globSync('**/*', { cwd: values.site, exclude: ['**/node_modules/**'] });
const assetFile = (url) => {
  const resolved = new URL(url, base);
  requireCondition(
    resolved.origin === base.origin && resolved.pathname.startsWith(base.pathname),
    `Incorrect deployment base path: ${url}`,
  );
  const relative = decodeURIComponent(resolved.pathname.slice(base.pathname.length));
  requireCondition(files.includes(relative), `Missing asset: ${url}`);
  return path.join(values.site, relative);
};
const imports = (file) => {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const found = [];
  const visit = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier)
      found.push(node.moduleSpecifier.text);
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      ts.isStringLiteral(node.arguments[0])
    )
      found.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
};

try {
  requireCondition(base.pathname.endsWith('/'), 'Base URL must end with /');
  const manifest = JSON.parse(readFileSync(path.join(values.site, 'data/workers.json'), 'utf8'));
  requireCondition(
    new URL(manifest.baseURL, base).href === base.href,
    'Manifest base URL differs from requested deployment base',
  );
  const sources = globSync('**/*.ts', { cwd: values.assets })
    .filter((file) => /\.(?:shared-)?worker\.ts$/.test(file))
    .map((file) => path.basename(file))
    .toSorted();
  requireCondition(
    sources.length > 0 && new Set(sources).size === sources.length,
    'Worker source names must be nonempty and unique',
  );
  requireCondition(
    JSON.stringify(Object.keys(manifest.workers).toSorted()) === JSON.stringify(sources),
    'Worker map differs from source entries',
  );
  const speechAssets =
    globSync('**/talking-head.component.ts', { cwd: values.assets }).length > 0
      ? ['avatars/mpfb.glb', 'avatars/third-party-notices.txt']
      : [];
  for (const resource of speechAssets) assetFile(new URL(resource, base).href);
  const scripts = files.filter((file) => file.endsWith('.js'));
  const bundled = scripts
    .map((file) => readFileSync(path.join(values.site, file), 'utf8'))
    .join('\n');
  for (const [name, url] of Object.entries(manifest.workers)) {
    const file = assetFile(url);
    const digest = createHash('sha256').update(readFileSync(file)).digest('hex');
    requireCondition(
      path.basename(file) === `${name.slice(0, -3)}.${digest}.js`,
      `Invalid fingerprint: ${name}`,
    );
    requireCondition(bundled.includes(url), `Worker URL absent from application bundles: ${name}`);
  }
  const moduleUrls = scripts.flatMap((file) =>
    imports(path.join(values.site, file))
      .filter((entry) => entry.startsWith('.') || entry.startsWith('/'))
      .map((specifier) => new URL(specifier, new URL(file, base)).href),
  );
  for (const url of moduleUrls) assetFile(url);
  const moduleScripts = files
    .filter((file) => file.endsWith('.html'))
    .flatMap((file) =>
      [
        ...readFileSync(path.join(values.site, file), 'utf8').matchAll(
          /<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g,
        ),
      ].map((match) => new URL(match[1], new URL(file, base)).href),
    );
  requireCondition(moduleScripts.length > 0, 'No application script references');
  for (const url of moduleScripts) assetFile(url);
  console.info(
    `Verified ${sources.length} workers and ${scripts.length} JavaScript assets at ${base.pathname}`,
  );
} catch (error) {
  console.error(`Production assets: ${error.message}`);
  process.exitCode = 1;
}
