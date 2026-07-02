/**
 * @clearkrypt/formatter — deterministic formatting for .ck source.
 *
 * Current status: whitespace normalization only. Full AST-based formatting
 * (indentation, brace placement, import ordering) is a later milestone and
 * requires comment-preserving parse data. The CLI reports this honestly.
 */

export interface FormatResult {
  readonly text: string;
  readonly changed: boolean;
}

/**
 * Normalizes trailing whitespace and the final newline. This is the
 * deterministic subset of the formatting law that is safe without an AST.
 */
export function normalizeWhitespace(text: string): FormatResult {
  const lines = text.split('\n').map((line) => line.replace(/[ \t]+$/u, ''));
  let normalized = lines.join('\n');
  if (!normalized.endsWith('\n')) {
    normalized += '\n';
  }
  // Collapse multiple trailing newlines to exactly one.
  normalized = normalized.replace(/\n+$/u, '\n');
  return { text: normalized, changed: normalized !== text };
}
