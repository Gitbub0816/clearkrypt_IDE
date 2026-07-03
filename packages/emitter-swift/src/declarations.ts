import {
  Diagnostic,
  IrEnum,
  IrEnumCase,
  IrErrorType,
  IrField,
  IrFunction,
  IrModel,
  IrParam,
  IrStatement,
} from '@clearkrypt/compiler-core';
import { renderExpr, renderStatements } from './expressions';
import { renderSignatureLines } from './signature';
import { renderReturnClause, renderType } from './types';
import { swiftIdentifier } from './naming';

export interface RenderedDecl {
  readonly lines: readonly string[];
  readonly needsFoundation: boolean;
}

function mergeFoundation(...flags: readonly boolean[]): boolean {
  return flags.some(Boolean);
}

export function renderModel(model: IrModel, diagnostics: Diagnostic[]): RenderedDecl {
  let needsFoundation = false;
  const fieldLines: string[] = [];
  const initParams: string[] = [];
  const initAssignments: string[] = [];

  for (const f of model.fields) {
    const type = renderType(f.type, f.origin, diagnostics);
    needsFoundation = mergeFoundation(needsFoundation, type.needsFoundation);
    const name = swiftIdentifier(f.name);
    fieldLines.push(`    public let ${name}: ${type.text}`);
    initParams.push(renderInitParam(f, diagnostics));
    initAssignments.push(`        self.${name} = ${name}`);
  }

  const lines: string[] = [`public struct ${model.name}: Hashable {`, ...fieldLines, ''];
  lines.push(...renderSignatureLines('    ', 'public init', initParams, ' {'));
  lines.push(...initAssignments);
  lines.push('    }');
  lines.push('}');

  return { lines, needsFoundation };
}

function renderInitParam(field: IrField, diagnostics: Diagnostic[]): string {
  const type = renderType(field.type, field.origin, diagnostics);
  const name = swiftIdentifier(field.name);
  if (field.defaultValue === undefined) {
    return `${name}: ${type.text}`;
  }
  const defaultText = renderExpr(field.defaultValue, field.origin, diagnostics);
  return `${name}: ${type.text} = ${defaultText}`;
}

function renderEnumCase(enumCase: IrEnumCase, diagnostics: Diagnostic[]): string {
  const name = swiftIdentifier(enumCase.name);
  if (enumCase.fields.length === 0) {
    return `    case ${name}`;
  }
  const params = enumCase.fields
    .map((f) => `${swiftIdentifier(f.name)}: ${renderType(f.type, f.origin, diagnostics).text}`)
    .join(', ');
  return `    case ${name}(${params})`;
}

export function renderEnum(irEnum: IrEnum, diagnostics: Diagnostic[]): RenderedDecl {
  const conformance = irEnum.isSimple ? 'String, Hashable' : 'Hashable';
  const lines = [
    `public enum ${irEnum.name}: ${conformance} {`,
    ...irEnum.cases.map((c) => renderEnumCase(c, diagnostics)),
    '}',
  ];
  return { lines, needsFoundation: false };
}

export function renderErrorType(error: IrErrorType, diagnostics: Diagnostic[]): RenderedDecl {
  const lines = [
    `public enum ${error.name}: Error, Hashable {`,
    ...error.cases.map((c) => renderEnumCase(c, diagnostics)),
    '}',
  ];
  return { lines, needsFoundation: false };
}

function renderParam(param: IrParam, diagnostics: Diagnostic[]): { text: string; needsFoundation: boolean } {
  const type = renderType(param.type, param.origin, diagnostics);
  const name = swiftIdentifier(param.name);
  const defaultText =
    param.defaultValue === undefined ? '' : ` = ${renderExpr(param.defaultValue, param.origin, diagnostics)}`;
  return { text: `${name}: ${type.text}${defaultText}`, needsFoundation: type.needsFoundation };
}

/**
 * Nested function declarations (Swift local `func`) render their own
 * signatures too, so a local function using `Date`/`Data`/`URL`/`Decimal`
 * must still trigger the enclosing file's `import Foundation` even though
 * its signature is rendered deep inside a statement list, not by this
 * function directly.
 */
function collectLocalFunctions(statements: readonly IrStatement[]): readonly IrFunction[] {
  const result: IrFunction[] = [];
  for (const statement of statements) {
    if (statement.kind === 'localFunction') {
      result.push(statement.function, ...collectLocalFunctions(statement.function.body));
    } else if (statement.kind === 'if' || statement.kind === 'ifLet') {
      result.push(...collectLocalFunctions(statement.then));
      if (statement.else) result.push(...collectLocalFunctions(statement.else));
    }
  }
  return result;
}

export function renderFunction(fn: IrFunction, diagnostics: Diagnostic[]): RenderedDecl {
  let needsFoundation = false;
  const paramTexts: string[] = [];
  for (const param of fn.params) {
    const rendered = renderParam(param, diagnostics);
    needsFoundation = mergeFoundation(needsFoundation, rendered.needsFoundation);
    paramTexts.push(rendered.text);
  }

  const returnClause = renderReturnClause(fn.returnType, fn.origin, diagnostics);
  needsFoundation = mergeFoundation(needsFoundation, returnClause.needsFoundation);

  for (const nested of collectLocalFunctions(fn.body)) {
    for (const param of nested.params) {
      needsFoundation = mergeFoundation(needsFoundation, renderParam(param, diagnostics).needsFoundation);
    }
    needsFoundation = mergeFoundation(
      needsFoundation,
      renderReturnClause(nested.returnType, nested.origin, diagnostics).needsFoundation,
    );
  }

  const modifiers = [fn.isAsync ? 'async' : undefined, fn.throwsType !== undefined ? 'throws' : undefined]
    .filter((m): m is string => m !== undefined)
    .map((m) => ` ${m}`)
    .join('');

  const lines: string[] = [];
  if (fn.throwsType !== undefined) {
    lines.push(`/// - Throws: ${fn.throwsType.name}`);
  }
  lines.push(
    ...renderSignatureLines('', `public func ${fn.name}`, paramTexts, `${modifiers}${returnClause.clause} {`),
  );
  lines.push(...renderStatements(fn.body, fn.origin, diagnostics, 1));
  lines.push('}');

  return { lines, needsFoundation };
}
