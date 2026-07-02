import { Diagnostic } from '@clearkrypt/compiler-core';
import { ModelIndex } from './modelIndex';

/**
 * Per-file render context.
 *
 * TypeScript needs two independent import buckets: `import type { ... }` for
 * cross-module types (interfaces, unions) used only in type positions, and a
 * plain `import { ... }` for cross-module *values* (function calls, and
 * `createX` factory calls). Both are keyed by module name, with the special
 * key `'clearkrypt'` standing for the shared support file.
 */
export interface TsCtx {
  readonly diagnostics: Diagnostic[];
  readonly currentModule: string;
  readonly modelIndex: ModelIndex;
  readonly typeImports: Map<string, Set<string>>;
  readonly valueImports: Map<string, Set<string>>;
}

export function createContext(currentModule: string, modelIndex: ModelIndex, diagnostics: Diagnostic[]): TsCtx {
  return { diagnostics, currentModule, modelIndex, typeImports: new Map(), valueImports: new Map() };
}

function addImport(map: Map<string, Set<string>>, currentModule: string, moduleKey: string, name: string): void {
  if (moduleKey === currentModule) {
    return;
  }
  const existing = map.get(moduleKey);
  if (existing !== undefined) {
    existing.add(name);
  } else {
    map.set(moduleKey, new Set([name]));
  }
}

export function addTypeImport(ctx: TsCtx, moduleKey: string, name: string): void {
  addImport(ctx.typeImports, ctx.currentModule, moduleKey, name);
}

export function addValueImport(ctx: TsCtx, moduleKey: string, name: string): void {
  addImport(ctx.valueImports, ctx.currentModule, moduleKey, name);
}
