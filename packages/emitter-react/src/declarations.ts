import { IrEnum, IrEnumCase, IrErrorType, IrFunction, IrModel, IrParam } from '@clearkrypt/compiler-core';
import { TsCtx } from './context';
import { renderExpr, renderStatements } from './expressions';
import { renderSignatureLines } from './signature';
import { renderType } from './types';
import { tsIdentifier } from './naming';

export interface RenderedDecl {
  readonly lines: readonly string[];
}

export function renderModel(model: IrModel, ctx: TsCtx): RenderedDecl {
  const fieldLines = model.fields.map((f) => `  readonly ${f.name}: ${renderType(f.type, f.origin, ctx)};`);
  const lines: string[] = [`export interface ${model.name} {`, ...fieldLines, '}'];

  const hasDefaults = model.fields.some((f) => f.defaultValue !== undefined);
  if (hasDefaults) {
    lines.push('', ...renderFactory(model, ctx));
  }
  return { lines };
}

/**
 * `createX` factory (docs/19: "Models"). Interfaces can't express field
 * defaults, so a model with any default-valued field also gets a factory
 * that makes the default fields optional in `init` and applies them.
 */
function renderFactory(model: IrModel, ctx: TsCtx): string[] {
  const lines: string[] = [`export function create${model.name}(init: {`];
  for (const f of model.fields) {
    const optional = f.defaultValue !== undefined ? '?' : '';
    lines.push(`  readonly ${f.name}${optional}: ${renderType(f.type, f.origin, ctx)};`);
  }
  lines.push(`}): ${model.name} {`);
  lines.push('  return {');
  for (const f of model.fields) {
    if (f.defaultValue !== undefined) {
      lines.push(`    ${f.name}: init.${f.name} ?? ${renderExpr(f.defaultValue, f.origin, ctx)},`);
    } else {
      lines.push(`    ${f.name}: init.${f.name},`);
    }
  }
  lines.push('  };');
  lines.push('}');
  return lines;
}

function renderSimpleEnum(irEnum: IrEnum): RenderedDecl {
  const values = irEnum.cases.map((c) => `'${c.name}'`);
  if (values.length <= 3) {
    return { lines: [`export type ${irEnum.name} = ${values.join(' | ')};`] };
  }
  const lines = [`export type ${irEnum.name} =`];
  values.forEach((value, index) => {
    lines.push(`  | ${value}${index === values.length - 1 ? ';' : ''}`);
  });
  return { lines };
}

function renderCaseMember(enumCase: IrEnumCase, ctx: TsCtx): string {
  if (enumCase.fields.length === 0) {
    return `{ kind: '${enumCase.name}' }`;
  }
  const fields = enumCase.fields.map((f) => `${f.name}: ${renderType(f.type, f.origin, ctx)}`).join('; ');
  return `{ kind: '${enumCase.name}'; ${fields} }`;
}

/** Discriminated union shared by associated enums and error types. */
function renderDiscriminatedUnion(name: string, cases: readonly IrEnumCase[], ctx: TsCtx): RenderedDecl {
  const lines = [`export type ${name} =`];
  cases.forEach((c, index) => {
    lines.push(`  | ${renderCaseMember(c, ctx)}${index === cases.length - 1 ? ';' : ''}`);
  });
  return { lines };
}

export function renderEnum(irEnum: IrEnum, ctx: TsCtx): RenderedDecl {
  if (irEnum.isSimple) {
    return renderSimpleEnum(irEnum);
  }
  return renderDiscriminatedUnion(irEnum.name, irEnum.cases, ctx);
}

export function renderErrorType(error: IrErrorType, ctx: TsCtx): RenderedDecl {
  return renderDiscriminatedUnion(error.name, error.cases, ctx);
}

function renderParam(param: IrParam, ctx: TsCtx): string {
  const type = renderType(param.type, param.origin, ctx);
  const name = tsIdentifier(param.name);
  const defaultText =
    param.defaultValue === undefined ? '' : ` = ${renderExpr(param.defaultValue, param.origin, ctx)}`;
  return `${name}: ${type}${defaultText}`;
}

export function renderFunction(fn: IrFunction, ctx: TsCtx): RenderedDecl {
  const paramTexts = fn.params.map((p) => renderParam(p, ctx));
  const returnType = renderType(fn.returnType, fn.origin, ctx);
  const returnClause = fn.isAsync ? `Promise<${returnType}>` : returnType;
  const prefix = `export ${fn.isAsync ? 'async ' : ''}function ${fn.name}`;

  const lines: string[] = [];
  if (fn.throwsType !== undefined) {
    lines.push('/**', ` * @throws {${fn.throwsType.name}}`, ' */');
  }
  lines.push(...renderSignatureLines('', prefix, paramTexts, `: ${returnClause} {`));
  lines.push(...renderStatements(fn.body, fn.origin, ctx, 1));
  lines.push('}');

  return { lines };
}
