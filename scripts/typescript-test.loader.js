import { existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';

import ts from 'typescript';

const assets = new URL('../assets/', import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    let url;
    if (specifier.startsWith('@/')) {
      url = new URL(specifier.slice(2), assets);
    } else if (specifier.startsWith('.') && context.parentURL?.startsWith(assets.href)) {
      url = new URL(specifier, context.parentURL);
    }
    if (url) {
      for (const extension of ['.ts', '.js', '/index.ts', '/index.js']) {
        const candidate = new URL(`${url.href}${extension}`);
        if (existsSync(candidate)) {
          return nextResolve(candidate.href, context);
        }
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.ts')) {
      const result = ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          experimentalDecorators: true,
          useDefineForClassFields: false,
        },
      });
      return { format: 'module', source: result.outputText, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
