import { Diagnostic } from '@clearkrypt/compiler-core';

/**
 * Per-file render context.
 *
 * Kotlin imports are collected by side effect while rendering a file's body
 * (types, expressions, declarations all share one `imports` set) and turned
 * into sorted `import` lines once rendering finishes. `diagnostics`
 * accumulates across the whole project emission; `imports` resets per file.
 */
export interface KotlinCtx {
  readonly diagnostics: Diagnostic[];
  /** The ClearKrypt module this file is being generated for (== Kotlin package). */
  readonly currentModule: string;
  /** Fully-qualified names to import, e.g. `java.math.BigDecimal`, `app.models.User`. */
  readonly imports: Set<string>;
}

export function createContext(currentModule: string, diagnostics: Diagnostic[]): KotlinCtx {
  return { diagnostics, currentModule, imports: new Set<string>() };
}
