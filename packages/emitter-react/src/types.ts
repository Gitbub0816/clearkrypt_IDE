import { IrOrigin, IrType } from '@clearkrypt/compiler-core';
import { addTypeImport, TsCtx } from './context';
import { unsupportedFeature } from './diagnostics';

/**
 * TypeScript type rendering (docs/19-target-mappings.md, "Primitive type
 * mappings" and "Collections"). Cross-module and support-file type imports
 * are recorded on `ctx.typeImports` as a side effect.
 */
export function renderType(type: IrType, origin: IrOrigin, ctx: TsCtx): string {
  switch (type.kind) {
    case 'primitive': {
      switch (type.name) {
        case 'String':
          return 'string';
        case 'Int':
          return 'number';
        case 'Float':
          return 'number';
        case 'Decimal':
          addTypeImport(ctx, 'clearkrypt', 'Decimal');
          return 'Decimal';
        case 'Bool':
          return 'boolean';
        case 'Date':
          return 'string';
        case 'DateTime':
          return 'string';
        case 'ID':
          addTypeImport(ctx, 'clearkrypt', 'ID');
          return 'ID';
        case 'Email':
          addTypeImport(ctx, 'clearkrypt', 'Email');
          return 'Email';
        case 'URL':
          addTypeImport(ctx, 'clearkrypt', 'URL');
          return 'URL';
        case 'Data':
          return 'Uint8Array';
        case 'Void':
          return 'void';
        case 'Never':
          return 'never';
        default: {
          const unknownName = (type as { name: string }).name;
          ctx.diagnostics.push(unsupportedFeature(origin, `Unrecognized primitive type '${unknownName}'`));
          return 'never';
        }
      }
    }
    case 'declared':
      addTypeImport(ctx, type.module, type.name);
      return type.name;
    case 'optional':
      return `${renderType(type.inner, origin, ctx)} | null`;
    case 'list':
      return `readonly ${renderCollectionElement(type.element, origin, ctx)}[]`;
    case 'map':
      return `ReadonlyMap<${renderType(type.key, origin, ctx)}, ${renderType(type.value, origin, ctx)}>`;
    case 'set':
      return `ReadonlySet<${renderType(type.element, origin, ctx)}>`;
    default: {
      const unknownKind = (type as { kind: string }).kind;
      ctx.diagnostics.push(unsupportedFeature(origin, `Unrecognized IR type kind '${unknownKind}'`));
      return 'never';
    }
  }
}

/**
 * `readonly (T | null)[]` — a union element embedded in array-postfix syntax
 * needs parentheses, or `T | null[]` would parse as `T | (null[])`.
 */
function renderCollectionElement(element: IrType, origin: IrOrigin, ctx: TsCtx): string {
  const text = renderType(element, origin, ctx);
  return element.kind === 'optional' ? `(${text})` : text;
}
