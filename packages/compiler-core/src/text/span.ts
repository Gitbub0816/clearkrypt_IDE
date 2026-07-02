/**
 * Source spans.
 *
 * Constitution (Document 5, Lexer law): every meaningful token must know its
 * file, start/end offsets, and start/end line and column. Spans power
 * diagnostics, visual mapping, and generated-code mapping, so they appear on
 * every token, AST node, diagnostic, and IR origin.
 *
 * Offsets are zero-based UTF-16 code unit offsets into the file text.
 * Lines and columns are one-based, matching editor conventions.
 */
export interface Span {
  readonly file: string;
  readonly start: number;
  readonly end: number;
  readonly startLine: number;
  readonly startColumn: number;
  readonly endLine: number;
  readonly endColumn: number;
}

/** Builds a span that covers `first` through `last` (inclusive). */
export function unionSpan(first: Span, last: Span): Span {
  return {
    file: first.file,
    start: first.start,
    end: last.end,
    startLine: first.startLine,
    startColumn: first.startColumn,
    endLine: last.endLine,
    endColumn: last.endColumn,
  };
}

/** Formats a span as `file:line:column` for human-readable diagnostics. */
export function formatSpanStart(span: Span): string {
  return `${span.file}:${span.startLine}:${span.startColumn}`;
}
