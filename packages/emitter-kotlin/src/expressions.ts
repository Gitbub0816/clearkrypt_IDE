import { IrArgument, IrBinaryOperator, IrExpression, IrIf, IrOrigin, IrStatement } from '@clearkrypt/compiler-core';
import { KotlinCtx } from './context';
import { addCrossModuleImport } from './types';
import { unsupportedFeature } from './diagnostics';
import { kotlinIdentifier } from './naming';

const INDENT = '    ';

/** Escapes a ClearKrypt string literal for a Kotlin double-quoted string literal. */
export function escapeStringLiteral(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/\r/g, '\\r');
}

const BINARY_PRECEDENCE: Record<IrBinaryOperator, number> = {
  '*': 5,
  '/': 5,
  '%': 5,
  '+': 4,
  '-': 4,
  '<': 3,
  '<=': 3,
  '>': 3,
  '>=': 3,
  '==': 2,
  '!=': 2,
  '&&': 1,
  '||': 0,
};

const ASSOCIATIVE_OPERATORS = new Set<IrBinaryOperator>(['+', '*', '&&', '||']);
const UNARY_PRECEDENCE = 6;
const ATOMIC_PRECEDENCE = 100;

function precedenceOf(expr: IrExpression): number {
  switch (expr.kind) {
    case 'binary':
      return BINARY_PRECEDENCE[expr.operator];
    case 'unary':
      return UNARY_PRECEDENCE;
    default:
      return ATOMIC_PRECEDENCE;
  }
}

function renderChild(
  expr: IrExpression,
  origin: IrOrigin,
  ctx: KotlinCtx,
  parentPrecedence: number,
  parentOperator: IrBinaryOperator | undefined,
  isRightOperand: boolean,
): string {
  const text = renderExpr(expr, origin, ctx);
  const childPrecedence = precedenceOf(expr);
  let needsParens = childPrecedence < parentPrecedence;
  if (!needsParens && isRightOperand && childPrecedence === parentPrecedence) {
    const sameAssociativeOperator =
      expr.kind === 'binary' &&
      parentOperator !== undefined &&
      expr.operator === parentOperator &&
      ASSOCIATIVE_OPERATORS.has(parentOperator);
    needsParens = !sameAssociativeOperator;
  }
  return needsParens ? `(${text})` : text;
}

function renderArgs(args: readonly IrArgument[], origin: IrOrigin, ctx: KotlinCtx): string {
  return args.map((arg) => `${kotlinIdentifier(arg.name)} = ${renderExpr(arg.value, origin, ctx)}`).join(', ');
}

export function renderExpr(expr: IrExpression, origin: IrOrigin, ctx: KotlinCtx): string {
  switch (expr.kind) {
    case 'stringLiteral':
      return `"${escapeStringLiteral(expr.value)}"`;
    case 'intLiteral':
      return expr.text;
    case 'floatLiteral':
      return expr.text;
    case 'boolLiteral':
      return expr.value ? 'true' : 'false';
    case 'nullLiteral':
      return 'null';
    case 'localRef':
      return kotlinIdentifier(expr.name);
    case 'paramRef':
      return kotlinIdentifier(expr.name);
    case 'fieldAccess':
      return `${renderChild(expr.object, origin, ctx, ATOMIC_PRECEDENCE, undefined, false)}.${kotlinIdentifier(expr.field)}`;
    case 'call':
      addCrossModuleImport(ctx, expr.function.module, expr.function.name);
      return `${expr.function.name}(${renderArgs(expr.args, origin, ctx)})`;
    case 'construct':
      addCrossModuleImport(ctx, expr.model.module, expr.model.name);
      return `${expr.model.name}(${renderArgs(expr.args, origin, ctx)})`;
    case 'binary': {
      const precedence = BINARY_PRECEDENCE[expr.operator];
      const left = renderChild(expr.left, origin, ctx, precedence, expr.operator, false);
      const right = renderChild(expr.right, origin, ctx, precedence, expr.operator, true);
      return `${left} ${expr.operator} ${right}`;
    }
    case 'unary': {
      const operandText = renderExpr(expr.operand, origin, ctx);
      const needsParens = expr.operand.kind === 'binary' || expr.operand.kind === 'unary';
      return `${expr.operator}${needsParens ? `(${operandText})` : operandText}`;
    }
    default: {
      const unknownKind = (expr as { kind: string }).kind;
      ctx.diagnostics.push(unsupportedFeature(origin, `Unrecognized IR expression kind '${unknownKind}'`));
      return '/* unsupported expression */';
    }
  }
}

function indent(level: number): string {
  return INDENT.repeat(level);
}

export function renderStatements(
  statements: readonly IrStatement[],
  origin: IrOrigin,
  ctx: KotlinCtx,
  level: number,
): string[] {
  const lines: string[] = [];
  for (const statement of statements) {
    lines.push(...renderStatement(statement, origin, ctx, level));
  }
  return lines;
}

function renderStatement(statement: IrStatement, origin: IrOrigin, ctx: KotlinCtx, level: number): string[] {
  const pad = indent(level);
  switch (statement.kind) {
    case 'let': {
      const keyword = statement.mutable ? 'var' : 'val';
      const value = renderExpr(statement.value, origin, ctx);
      return [`${pad}${keyword} ${kotlinIdentifier(statement.name)} = ${value}`];
    }
    case 'return': {
      if (statement.value === undefined) {
        return [`${pad}return`];
      }
      return [`${pad}return ${renderExpr(statement.value, origin, ctx)}`];
    }
    case 'if':
      return renderIf(statement, origin, ctx, level);
    case 'expr':
      return [`${pad}${renderExpr(statement.expression, origin, ctx)}`];
    default: {
      const unknownKind = (statement as { kind: string }).kind;
      ctx.diagnostics.push(unsupportedFeature(origin, `Unrecognized IR statement kind '${unknownKind}'`));
      return [`${pad}/* unsupported statement */`];
    }
  }
}

function renderIf(statement: IrIf, origin: IrOrigin, ctx: KotlinCtx, level: number): string[] {
  const pad = indent(level);
  const condition = renderExpr(statement.condition, origin, ctx);
  const lines = [`${pad}if (${condition}) {`, ...renderStatements(statement.then, origin, ctx, level + 1)];
  if (statement.else !== undefined) {
    lines.push(`${pad}} else {`);
    lines.push(...renderStatements(statement.else, origin, ctx, level + 1));
    lines.push(`${pad}}`);
  } else {
    lines.push(`${pad}}`);
  }
  return lines;
}
