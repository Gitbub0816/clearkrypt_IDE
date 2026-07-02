import { EmitOptions, GeneratedFile } from '@clearkrypt/compiler-core';
import { normalizeWhitespace } from '@clearkrypt/formatter';
import { supportHeader } from './header';

/**
 * The shared TypeScript support file (docs/19-target-mappings.md, "Primitive
 * type mappings"): `ID`, `Email`, `URL`, and `Decimal` are all aliases of
 * `string`, defined once here. TypeScript has no native decimal type; the
 * `Decimal` alias documents intent rather than adding precision.
 */
export function buildSupportFile(options: EmitOptions): GeneratedFile {
  const lines = [
    ...supportHeader(options.compilerVersion),
    '',
    'export type ID = string;',
    'export type Email = string;',
    'export type URL = string;',
    'export type Decimal = string;',
  ];
  return {
    path: 'clearkrypt.ts',
    contents: normalizeWhitespace(lines.join('\n')).text,
    sourceModule: 'clearkrypt',
  };
}
