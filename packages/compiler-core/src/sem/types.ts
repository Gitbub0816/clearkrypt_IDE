import { IrPrimitiveName } from '../ir/nodes';

/**
 * The semantic type model used by the checker.
 *
 * Shapes deliberately mirror `IrType` so lowering is mechanical. The extra
 * members are checker-internal: `error` poisons subexpressions after a
 * diagnostic so one mistake produces one message, and `null` is the type of
 * the `null` literal before it is matched against an optional.
 */
export type SemType =
  | { readonly kind: 'primitive'; readonly name: IrPrimitiveName }
  | {
      readonly kind: 'declared';
      readonly name: string;
      readonly module: string;
      readonly declarationKind: 'model' | 'enum' | 'error';
    }
  | { readonly kind: 'optional'; readonly inner: SemType }
  | { readonly kind: 'list'; readonly element: SemType }
  | { readonly kind: 'map'; readonly key: SemType; readonly value: SemType }
  | { readonly kind: 'set'; readonly element: SemType }
  | { readonly kind: 'null' }
  | { readonly kind: 'error' };

export function primitiveType(name: IrPrimitiveName): SemType {
  return { kind: 'primitive', name };
}

export const errorType: SemType = { kind: 'error' };

export const primitiveNames: readonly IrPrimitiveName[] = [
  'String',
  'Int',
  'Float',
  'Decimal',
  'Bool',
  'Date',
  'DateTime',
  'ID',
  'Email',
  'URL',
  'Data',
  'Void',
  'Never',
];

/** Renders a type the way a developer would write it, for diagnostics. */
export function typeToString(type: SemType): string {
  switch (type.kind) {
    case 'primitive':
      return type.name;
    case 'declared':
      return type.name;
    case 'optional':
      return `${typeToString(type.inner)}?`;
    case 'list':
      return `List<${typeToString(type.element)}>`;
    case 'map':
      return `Map<${typeToString(type.key)}, ${typeToString(type.value)}>`;
    case 'set':
      return `Set<${typeToString(type.element)}>`;
    case 'null':
      return 'null';
    case 'error':
      return '<error>';
  }
}

/** String and its semantic aliases are mutually assignable (docs/19). */
const stringLike: ReadonlySet<string> = new Set(['String', 'ID', 'Email', 'URL']);

function isStringLike(type: SemType): boolean {
  return type.kind === 'primitive' && stringLike.has(type.name);
}

function sameType(a: SemType, b: SemType): boolean {
  switch (a.kind) {
    case 'primitive':
      return b.kind === 'primitive' && a.name === b.name;
    case 'declared':
      return b.kind === 'declared' && a.name === b.name && a.module === b.module;
    case 'optional':
      return b.kind === 'optional' && sameType(a.inner, b.inner);
    case 'list':
      return b.kind === 'list' && sameType(a.element, b.element);
    case 'map':
      return b.kind === 'map' && sameType(a.key, b.key) && sameType(a.value, b.value);
    case 'set':
      return b.kind === 'set' && sameType(a.element, b.element);
    case 'null':
      return b.kind === 'null';
    case 'error':
      return b.kind === 'error';
  }
}

/**
 * Whether a value of `from` can be used where `to` is expected.
 *
 * Rules: exact match; String <-> ID/Email/URL (documented alias policy);
 * `null` into any optional; T into T?; the poisoned `error` type into and
 * from anything (cascade suppression).
 */
export function typesAssignable(from: SemType, to: SemType): boolean {
  if (from.kind === 'error' || to.kind === 'error') {
    return true;
  }
  if (sameType(from, to)) {
    return true;
  }
  if (isStringLike(from) && isStringLike(to)) {
    return true;
  }
  if (to.kind === 'optional') {
    if (from.kind === 'null') {
      return true;
    }
    return typesAssignable(from, to.inner);
  }
  return false;
}
