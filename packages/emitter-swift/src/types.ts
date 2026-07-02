import { Diagnostic, IrOrigin, IrType } from '@clearkrypt/compiler-core';
import { unsupportedFeature } from './diagnostics';

/**
 * Swift type rendering (docs/19-target-mappings.md, "Primitive type mappings"
 * and "Collections"). `needsFoundation` bubbles up so the caller can decide
 * whether the enclosing file needs `import Foundation` (Date, Data, URL, and
 * Decimal all come from Foundation).
 */
export interface SwiftType {
  readonly text: string;
  readonly needsFoundation: boolean;
}

export function renderType(type: IrType, origin: IrOrigin, diagnostics: Diagnostic[]): SwiftType {
  switch (type.kind) {
    case 'primitive': {
      switch (type.name) {
        case 'String':
          return { text: 'String', needsFoundation: false };
        case 'Int':
          return { text: 'Int', needsFoundation: false };
        case 'Float':
          return { text: 'Double', needsFoundation: false };
        case 'Decimal':
          return { text: 'Decimal', needsFoundation: true };
        case 'Bool':
          return { text: 'Bool', needsFoundation: false };
        case 'Date':
          return { text: 'Date', needsFoundation: true };
        case 'DateTime':
          return { text: 'Date', needsFoundation: true };
        case 'ID':
          return { text: 'ID', needsFoundation: false };
        case 'Email':
          return { text: 'Email', needsFoundation: false };
        case 'URL':
          return { text: 'URL', needsFoundation: true };
        case 'Data':
          return { text: 'Data', needsFoundation: true };
        case 'Void':
          return { text: 'Void', needsFoundation: false };
        case 'Never':
          return { text: 'Never', needsFoundation: false };
        default: {
          const unknownName = (type as { name: string }).name;
          diagnostics.push(unsupportedFeature(origin, `Unrecognized primitive type '${unknownName}'`));
          return { text: 'Never', needsFoundation: false };
        }
      }
    }
    case 'declared':
      return { text: type.name, needsFoundation: false };
    case 'optional': {
      const inner = renderType(type.inner, origin, diagnostics);
      return { text: `${inner.text}?`, needsFoundation: inner.needsFoundation };
    }
    case 'list': {
      const element = renderType(type.element, origin, diagnostics);
      return { text: `[${element.text}]`, needsFoundation: element.needsFoundation };
    }
    case 'map': {
      const key = renderType(type.key, origin, diagnostics);
      const value = renderType(type.value, origin, diagnostics);
      return {
        text: `[${key.text}: ${value.text}]`,
        needsFoundation: key.needsFoundation || value.needsFoundation,
      };
    }
    case 'set': {
      const element = renderType(type.element, origin, diagnostics);
      return { text: `Set<${element.text}>`, needsFoundation: element.needsFoundation };
    }
    default: {
      diagnostics.push(
        unsupportedFeature(origin, `Unrecognized IR type kind '${String((type as { kind: string }).kind)}'`),
      );
      return { text: 'Never', needsFoundation: false };
    }
  }
}

/** Renders a return-type clause, honoring Swift's "Void return omits `-> Type`" rule. */
export function renderReturnClause(type: IrType, origin: IrOrigin, diagnostics: Diagnostic[]): {
  clause: string;
  needsFoundation: boolean;
} {
  if (type.kind === 'primitive' && type.name === 'Void') {
    return { clause: '', needsFoundation: false };
  }
  const rendered = renderType(type, origin, diagnostics);
  return { clause: ` -> ${rendered.text}`, needsFoundation: rendered.needsFoundation };
}
