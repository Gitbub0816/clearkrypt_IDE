import { IrArgument, IrBinaryOperator, IrExpression, IrIf, IrOrigin, IrStatement } from '@clearkrypt/compiler-core';
import { KotlinCtx } from './context';
import { addCrossModuleImport } from './types';
import { unsupportedFeature } from './diagnostics';
import { kotlinIdentifier, pascalCase } from './naming';

const INDENT = '    ';

/** Escapes a ClearKrypt string literal for a Kotlin double-quoted string literal. */
export function escapeStringLiteral(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/\r/g, '\\r');
}

const BINARY_PRECEDENCE: Record<IrBinaryOperator, number> = {
  '*': 6,
  '/': 6,
  '%': 6,
  '+': 5,
  '-': 5,
  '??': 4,
  '<': 3,
  '<=': 3,
  '>': 3,
  '>=': 3,
  '==': 2,
  '!=': 2,
  '&&': 1,
  '||': 0,
};

const ASSOCIATIVE_OPERATORS = new Set<IrBinaryOperator>(['+', '*', '&&', '||', '??']);
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
    case 'fieldAccess': {
      const objectText = renderChild(expr.object, origin, ctx, ATOMIC_PRECEDENCE, undefined, false);
      return `${objectText}${expr.optionalChaining ? '?.' : '.'}${kotlinIdentifier(expr.field)}`;
    }
    case 'interpolatedString': {
      const parts = expr.parts
        .map((part) =>
          part.kind === 'text'
            ? escapeStringLiteral(part.value)
            : '${' + renderExpr(part, origin, ctx) + '}',
        )
        .join('');
      return `"${parts}"`;
    }
    case 'enumValue': {
      addCrossModuleImport(ctx, expr.enumType.module, expr.enumType.name);
      const caseRef = `${expr.enumType.name}.${pascalCase(expr.caseName)}`;
      return expr.args.length > 0 ? `${caseRef}(${renderArgs(expr.args, origin, ctx)})` : caseRef;
    }
    case 'try':
      // Kotlin has no call-site marker; the JVM propagates the exception.
      return renderExpr(expr.expression, origin, ctx);
    case 'match':
      // Handled at statement level (let/return) as a `when` expression.
      ctx.diagnostics.push(
        unsupportedFeature(origin, `A match expression reached an unsupported position`),
      );
      return '/* unsupported match position */';
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
      const operatorText = expr.operator === '??' ? '?:' : expr.operator;
      return `${left} ${operatorText} ${right}`;
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
      const head = `${pad}${keyword} ${kotlinIdentifier(statement.name)} = `;
      if (statement.value.kind === 'match') {
        return renderMatch(statement.value, head, origin, ctx, level);
      }
      return [`${head}${renderExpr(statement.value, origin, ctx)}`];
    }
    case 'return': {
      if (statement.value === undefined) {
        return [`${pad}return`];
      }
      if (statement.value.kind === 'match') {
        return renderMatch(statement.value, `${pad}return `, origin, ctx, level);
      }
      return [`${pad}return ${renderExpr(statement.value, origin, ctx)}`];
    }
    case 'if':
      return renderIf(statement, origin, ctx, level);
    case 'ifLet': {
      // `val x = value` then a null check; Kotlin's smart cast makes `x`
      // non-null inside the then-branch. The checker guarantees the binding
      // name is unique within the function.
      const name = kotlinIdentifier(statement.name);
      const lines = [
        `${pad}val ${name} = ${renderExpr(statement.value, origin, ctx)}`,
        `${pad}if (${name} != null) {`,
        ...renderStatements(statement.then, origin, ctx, level + 1),
      ];
      if (statement.else !== undefined) {
        lines.push(`${pad}} else {`);
        lines.push(...renderStatements(statement.else, origin, ctx, level + 1));
      }
      lines.push(`${pad}}`);
      return lines;
    }
    case 'throw':
      return [`${pad}throw ${renderExpr(statement.value, origin, ctx)}`];
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

/**
 * Renders a match as a Kotlin `when` expression attached to the given head
 * (`val x = ` or `return `). `when (val matched = ...)` evaluates the
 * scrutinee once; payload arms use `is Enum.Case` so `matched` smart-casts
 * and bindings read the case's fields.
 */
function renderMatch(
  match: Extract<IrExpression, { kind: 'match' }>,
  head: string,
  origin: IrOrigin,
  ctx: KotlinCtx,
  level: number,
): string[] {
  const pad = indent(level);
  addCrossModuleImport(ctx, match.enumType.module, match.enumType.name);
  const scrutinee = renderExpr(match.scrutinee, origin, ctx);
  const needsSubjectBinding = match.arms.some((arm) => arm.bindings.length > 0);
  const subject = needsSubjectBinding ? `val matched = ${scrutinee}` : scrutinee;
  const lines = [`${head}when (${subject}) {`];
  for (const arm of match.arms) {
    const caseRef = `${match.enumType.name}.${pascalCase(arm.caseName)}`;
    const body = renderExpr(arm.body, origin, ctx);
    if (arm.bindings.length === 0) {
      lines.push(`${indent(level + 1)}${caseRef} -> ${body}`);
      continue;
    }
    lines.push(`${indent(level + 1)}is ${caseRef} -> {`);
    for (const binding of arm.bindings) {
      lines.push(
        `${indent(level + 2)}val ${kotlinIdentifier(binding.name)} = matched.${kotlinIdentifier(binding.field)}`,
      );
    }
    lines.push(`${indent(level + 2)}${body}`);
    lines.push(`${indent(level + 1)}}`);
  }
  if (match.elseBody !== undefined) {
    lines.push(`${indent(level + 1)}else -> ${renderExpr(match.elseBody, origin, ctx)}`);
  }
  lines.push(`${pad}}`);
  return lines;
}
