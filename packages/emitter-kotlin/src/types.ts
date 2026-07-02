import { IrOrigin, IrType } from '@clearkrypt/compiler-core';
import { KotlinCtx } from './context';
import { unsupportedFeature } from './diagnostics';

/**
 * Kotlin type rendering (docs/19-target-mappings.md, "Primitive type
 * mappings" and "Collections"). Cross-module and stdlib imports are recorded
 * on `ctx.imports` as a side effect so the caller can emit a sorted import
 * block once the whole file body has been rendered.
 */
export function renderType(type: IrType, origin: IrOrigin, ctx: KotlinCtx): string {
  switch (type.kind) {
    case 'primitive': {
      switch (type.name) {
        case 'String':
          return 'String';
        case 'Int':
          return 'Int';
        case 'Float':
          return 'Double';
        case 'Decimal':
          ctx.imports.add('java.math.BigDecimal');
          return 'BigDecimal';
        case 'Bool':
          return 'Boolean';
        case 'Date':
          ctx.imports.add('java.time.LocalDate');
          return 'LocalDate';
        case 'DateTime':
          ctx.imports.add('java.time.Instant');
          return 'Instant';
        case 'ID':
          addSupportImport(ctx, 'ID');
          return 'ID';
        case 'Email':
          addSupportImport(ctx, 'Email');
          return 'Email';
        case 'URL':
          addSupportImport(ctx, 'URL');
          return 'URL';
        case 'Data':
          return 'ByteArray';
        case 'Void':
          return 'Unit';
        case 'Never':
          return 'Nothing';
        default: {
          const unknownName = (type as { name: string }).name;
          ctx.diagnostics.push(unsupportedFeature(origin, `Unrecognized primitive type '${unknownName}'`));
          return 'Nothing';
        }
      }
    }
    case 'declared':
      addCrossModuleImport(ctx, type.module, type.name);
      return type.name;
    case 'optional':
      return `${renderType(type.inner, origin, ctx)}?`;
    case 'list':
      return `List<${renderType(type.element, origin, ctx)}>`;
    case 'map':
      return `Map<${renderType(type.key, origin, ctx)}, ${renderType(type.value, origin, ctx)}>`;
    case 'set':
      return `Set<${renderType(type.element, origin, ctx)}>`;
    default: {
      const unknownKind = (type as { kind: string }).kind;
      ctx.diagnostics.push(unsupportedFeature(origin, `Unrecognized IR type kind '${unknownKind}'`));
      return 'Nothing';
    }
  }
}

function addSupportImport(ctx: KotlinCtx, name: 'ID' | 'Email' | 'URL'): void {
  if (ctx.currentModule !== 'clearkrypt') {
    ctx.imports.add(`clearkrypt.${name}`);
  }
}

export function addCrossModuleImport(ctx: KotlinCtx, module: string, name: string): void {
  if (module !== ctx.currentModule) {
    ctx.imports.add(`${module}.${name}`);
  }
}
