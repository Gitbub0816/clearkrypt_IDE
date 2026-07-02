import { IrEnum, IrEnumCase, IrErrorType, IrField, IrFunction, IrModel, IrParam } from '@clearkrypt/compiler-core';
import { KotlinCtx } from './context';
import { renderExpr, renderStatements } from './expressions';
import { kotlinIdentifier, pascalCase } from './naming';
import { renderSignatureLines } from './signature';
import { renderType } from './types';

export interface RenderedDecl {
  readonly lines: readonly string[];
}

export function renderModel(model: IrModel, ctx: KotlinCtx): RenderedDecl {
  const paramLines = model.fields.map((f) => `    ${renderModelParam(f, ctx)},`);
  const lines = [`data class ${model.name}(`, ...paramLines, ')'];
  return { lines };
}

function renderModelParam(field: IrField, ctx: KotlinCtx): string {
  const type = renderType(field.type, field.origin, ctx);
  const name = kotlinIdentifier(field.name);
  const defaultText =
    field.defaultValue === undefined ? '' : ` = ${renderExpr(field.defaultValue, field.origin, ctx)}`;
  return `val ${name}: ${type}${defaultText}`;
}

function renderCaseTypeHeader(enumCase: IrEnumCase, ctx: KotlinCtx, supertype: string): string {
  const name = pascalCase(enumCase.name);
  if (enumCase.fields.length === 0) {
    return `    data object ${name} : ${supertype}`;
  }
  const params = enumCase.fields
    .map((f) => `val ${kotlinIdentifier(f.name)}: ${renderType(f.type, f.origin, ctx)}`)
    .join(', ');
  return `    data class ${name}(${params}) : ${supertype}`;
}

export function renderEnum(irEnum: IrEnum, ctx: KotlinCtx): RenderedDecl {
  if (irEnum.isSimple) {
    const lines = [
      `enum class ${irEnum.name} {`,
      ...irEnum.cases.map((c) => `    ${pascalCase(c.name)},`),
      '}',
    ];
    return { lines };
  }

  const lines = [
    `sealed interface ${irEnum.name} {`,
    ...irEnum.cases.map((c) => renderCaseTypeHeader(c, ctx, irEnum.name)),
    '}',
  ];
  return { lines };
}

export function renderErrorType(error: IrErrorType, ctx: KotlinCtx): RenderedDecl {
  const lines = [
    `sealed class ${error.name} : Exception() {`,
    ...error.cases.map((c) => renderCaseTypeHeader(c, ctx, `${error.name}()`)),
    '}',
  ];
  return { lines };
}

function renderParam(param: IrParam, ctx: KotlinCtx): string {
  const type = renderType(param.type, param.origin, ctx);
  const name = kotlinIdentifier(param.name);
  const defaultText =
    param.defaultValue === undefined ? '' : ` = ${renderExpr(param.defaultValue, param.origin, ctx)}`;
  return `${name}: ${type}${defaultText}`;
}

export function renderFunction(fn: IrFunction, ctx: KotlinCtx): RenderedDecl {
  const paramTexts = fn.params.map((p) => renderParam(p, ctx));
  const returnType = renderType(fn.returnType, fn.origin, ctx);
  const prefix = fn.isAsync ? 'suspend fun' : 'fun';

  const lines: string[] = [];
  if (fn.throwsType !== undefined) {
    lines.push('/**', ` * @throws ${fn.throwsType.name}`, ' */');
  }
  lines.push(...renderSignatureLines('', `${prefix} ${fn.name}`, paramTexts, `: ${returnType} {`));
  lines.push(...renderStatements(fn.body, fn.origin, ctx, 1));
  lines.push('}');

  return { lines };
}
