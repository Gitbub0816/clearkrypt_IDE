/**
 * Wraps a parenthesized parameter list onto one line per parameter once the
 * single-line form would exceed a reasonable column width. Matches the
 * behavior of common Swift formatters (e.g. swift-format's default 100
 * column line length) so generated inits and functions with many parameters
 * stay readable instead of producing one very long line.
 */
const MAX_LINE_LENGTH = 100;

export function renderSignatureLines(
  indent: string,
  prefix: string,
  params: readonly string[],
  suffix: string,
): string[] {
  const oneLine = `${indent}${prefix}(${params.join(', ')})${suffix}`;
  if (params.length <= 1 || oneLine.length <= MAX_LINE_LENGTH) {
    return [oneLine];
  }

  const lines = [`${indent}${prefix}(`];
  params.forEach((param, index) => {
    const comma = index < params.length - 1 ? ',' : '';
    lines.push(`${indent}    ${param}${comma}`);
  });
  lines.push(`${indent})${suffix}`);
  return lines;
}
