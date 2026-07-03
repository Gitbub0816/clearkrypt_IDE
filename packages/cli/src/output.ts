import { Diagnostic } from '@clearkrypt/compiler-core';

/**
 * Diagnostic rendering: human lines for terminals, and the machine-readable
 * JSON document defined in docs/21-language-server.md.
 */

export function renderHuman(diagnostics: readonly Diagnostic[]): string[] {
  return [...diagnostics]
    .sort(compareDiagnostics)
    .map((d) => {
      const target = d.target ? ` [${d.target}]` : '';
      return (
        `${d.severity}[${d.code}]${target} ` +
        `${d.span.file}:${d.span.startLine}:${d.span.startColumn}: ${d.message.replace(/\n/g, ' ')}`
      );
    });
}

export function renderSummary(diagnostics: readonly Diagnostic[]): string {
  const errors = diagnostics.filter((d) => d.severity === 'error').length;
  const warnings = diagnostics.filter((d) => d.severity === 'warning').length;
  if (errors === 0 && warnings === 0) return 'No problems found.';
  const parts: string[] = [];
  if (errors > 0) parts.push(`${errors} error${errors === 1 ? '' : 's'}`);
  if (warnings > 0) parts.push(`${warnings} warning${warnings === 1 ? '' : 's'}`);
  return parts.join(', ') + '.';
}

export function renderJson(
  diagnostics: readonly Diagnostic[],
  generatedFiles: readonly string[],
): string {
  const ok = !diagnostics.some((d) => d.severity === 'error');
  return JSON.stringify(
    {
      ok,
      diagnostics: [...diagnostics].sort(compareDiagnostics).map((d) => ({
        code: d.code,
        severity: d.severity,
        message: d.message,
        file: d.span.file,
        range: {
          startLine: d.span.startLine,
          startColumn: d.span.startColumn,
          endLine: d.span.endLine,
          endColumn: d.span.endColumn,
        },
        ...(d.target ? { target: d.target } : {}),
      })),
      generatedFiles,
    },
    null,
    2,
  );
}

function compareDiagnostics(a: Diagnostic, b: Diagnostic): number {
  if (a.span.file !== b.span.file) return a.span.file < b.span.file ? -1 : 1;
  if (a.span.startLine !== b.span.startLine) return a.span.startLine - b.span.startLine;
  if (a.span.startColumn !== b.span.startColumn) return a.span.startColumn - b.span.startColumn;
  return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
}
