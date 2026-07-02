import { EmitOptions, GeneratedFile } from '@clearkrypt/compiler-core';
import { normalizeWhitespace } from '@clearkrypt/formatter';
import { supportHeader } from './header';

/**
 * The shared Swift support file (docs/19-target-mappings.md, "Primitive type
 * mappings"): `ID` and `Email` are aliases of `String` defined once here.
 * `URL` and `Decimal` need no alias — Foundation already provides them.
 */
export function buildSupportFile(options: EmitOptions): GeneratedFile {
  const lines = [
    ...supportHeader(options.compilerVersion),
    '',
    'import Foundation',
    '',
    'public typealias ID = String',
    'public typealias Email = String',
  ];
  return {
    path: 'ClearKrypt.swift',
    contents: normalizeWhitespace(lines.join('\n')).text,
    sourceModule: 'clearkrypt',
  };
}
