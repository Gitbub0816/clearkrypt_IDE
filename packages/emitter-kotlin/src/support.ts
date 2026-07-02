import { EmitOptions, GeneratedFile } from '@clearkrypt/compiler-core';
import { normalizeWhitespace } from '@clearkrypt/formatter';
import { supportHeader } from './header';

/**
 * The shared Kotlin support file (docs/19-target-mappings.md, "Primitive
 * type mappings"): `ID`, `Email`, and `URL` are aliases of `String` defined
 * once here, in the `clearkrypt` package.
 */
export function buildSupportFile(options: EmitOptions): GeneratedFile {
  const lines = [
    ...supportHeader(options.compilerVersion),
    '',
    'package clearkrypt',
    '',
    'typealias ID = String',
    'typealias Email = String',
    'typealias URL = String',
  ];
  return {
    path: 'clearkrypt/ClearKrypt.kt',
    contents: normalizeWhitespace(lines.join('\n')).text,
    sourceModule: 'clearkrypt',
  };
}
