import { Span } from '../text/span';

/**
 * Structured diagnostics.
 *
 * Constitution (Document 5, Diagnostic law): a diagnostic includes a code,
 * severity, message, source span, optional target, optional related spans,
 * and an optional fix. Diagnostics are data first so the CLI, language
 * service, and IDE can all render them.
 */
export type DiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint';

/** The first-class compilation targets. */
export type TargetName = 'swift' | 'kotlin' | 'react';

export interface RelatedInformation {
  readonly message: string;
  readonly span: Span;
}

/** A suggested fix. MVP fixes are descriptive; automated edits come later. */
export interface DiagnosticFix {
  readonly title: string;
}

export interface Diagnostic {
  /** Stable diagnostic code, e.g. `CK0001`. See `diagnostics/codes.ts`. */
  readonly code: string;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly span: Span;
  /** Present when the diagnostic only applies to one target. */
  readonly target?: TargetName;
  readonly related?: readonly RelatedInformation[];
  readonly fix?: DiagnosticFix;
}
