import { Diagnostic } from '@clearkrypt/compiler-core';

/** LSP structures used by the MVP server (LSP 3.17 subset, docs/21). */

export interface LspPosition {
  readonly line: number; // zero-based
  readonly character: number; // zero-based
}

export interface LspRange {
  readonly start: LspPosition;
  readonly end: LspPosition;
}

export interface LspDiagnostic {
  readonly range: LspRange;
  readonly severity: number; // 1 error, 2 warning, 3 info, 4 hint
  readonly code: string;
  readonly source: 'clearkrypt';
  readonly message: string;
}

export interface LspDocumentSymbol {
  readonly name: string;
  readonly detail?: string;
  readonly kind: number;
  readonly range: LspRange;
  readonly selectionRange: LspRange;
  readonly children?: LspDocumentSymbol[];
}

/** Semantic token legend — order is protocol (docs/21); never reorder. */
export const semanticTokenTypes = [
  'namespace',
  'type',
  'enum',
  'enumMember',
  'struct',
  'parameter',
  'variable',
  'property',
  'function',
  'keyword',
  'string',
  'number',
  'comment',
  'operator',
  'model',
  'screen',
  'component',
  'route',
  'capability',
  'errorType',
  'nativeTarget',
] as const;

export const semanticTokenModifiers = [
  'declaration',
  'defaultLibrary',
  'generated',
  'inferred',
  'targetSpecific',
] as const;

export type SemanticTokenType = (typeof semanticTokenTypes)[number];

export function tokenTypeIndex(type: SemanticTokenType): number {
  return semanticTokenTypes.indexOf(type);
}

const severityNumbers = { error: 1, warning: 2, info: 3, hint: 4 } as const;

export function toLspDiagnostic(diagnostic: Diagnostic): LspDiagnostic {
  return {
    range: {
      start: { line: diagnostic.span.startLine - 1, character: diagnostic.span.startColumn - 1 },
      end: { line: diagnostic.span.endLine - 1, character: diagnostic.span.endColumn - 1 },
    },
    severity: severityNumbers[diagnostic.severity],
    code: diagnostic.code,
    source: 'clearkrypt',
    message: diagnostic.message + (diagnostic.target ? ` [target: ${diagnostic.target}]` : ''),
  };
}
