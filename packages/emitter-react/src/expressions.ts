import {
  IrArgument,
  IrBinaryOperator,
  IrConstruct,
  IrExpression,
  IrIf,
  IrOrigin,
  IrStatement,
} from '@clearkrypt/compiler-core';
import { addValueImport, TsCtx } from './context';
import { unsupportedFeature } from './diagnostics';
import { lookupModel } from './modelIndex';
import { tsIdentifier } from './naming';

const INDENT = '  ';

/** Escapes a ClearKrypt string literal for a TypeScript double-quoted string literal. */
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

/**
 * `==`/`!=` render as strict `===`/`!==` — idiomatic TypeScript avoids loose
 * equality's coercion surprises, and since the IR only reaches here after
 * type checking, both operands already have compatible resolved types, so
 * strict comparison is always the correct, more defensive choice.
 */
function renderOperator(operator: IrBinaryOperator): string {
  if (operator === '==') {
    return '===';
  }
  if (operator === '!=') {
    return '!==';
  }
  return operator;
}

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
  ctx: TsCtx,
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

function renderCallArgs(args: readonly IrArgument[], origin: IrOrigin, ctx: TsCtx): string {
  // TS calls are positional (docs/19: "TS positional name(value)").
  return args.map((arg) => renderExpr(arg.value, origin, ctx)).join(', ');
}

function renderObjectArgs(args: readonly IrArgument[], origin: IrOrigin, ctx: TsCtx): string {
  return args
    .map((arg) => {
      const valueText = renderExpr(arg.value, origin, ctx);
      // ES2015 shorthand: `{ id }` instead of the redundant `{ id: id }` when
      // the argument is a bare reference with the same name as the field.
      const isBareRef = arg.value.kind === 'paramRef' || arg.value.kind === 'localRef';
      if (isBareRef && valueText === arg.name) {
        return arg.name;
      }
      return `${arg.name}: ${valueText}`;
    })
    .join(', ');
}

/**
 * Model construction (docs/19: "Model construction"). A plain object literal
 * satisfies the interface structurally when every field is provided. When
 * the model has default-valued fields and the call doesn't supply all of
 * them, the literal alone can't satisfy the interface (interfaces can't
 * express defaults), so the call goes through the generated `createX`
 * factory instead.
 */
function renderConstruct(expr: IrConstruct, origin: IrOrigin, ctx: TsCtx): string {
  const model = lookupModel(ctx.modelIndex, expr.model.module, expr.model.name);
  const defaultedFields = model === undefined ? [] : model.fields.filter((f) => f.defaultValue !== undefined);
  const provided = new Set(expr.args.map((a) => a.name));
  const missingDefaulted = defaultedFields.some((f) => !provided.has(f.name));

  const objectBody = expr.args.length === 0 ? '{}' : `{ ${renderObjectArgs(expr.args, origin, ctx)} }`;

  if (defaultedFields.length > 0 && missingDefaulted) {
    addValueImport(ctx, expr.model.module, `create${expr.model.name}`);
    return `create${expr.model.name}(${objectBody})`;
  }
  return objectBody;
}

export function renderExpr(expr: IrExpression, origin: IrOrigin, ctx: TsCtx): string {
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
      return tsIdentifier(expr.name);
    case 'paramRef':
      return tsIdentifier(expr.name);
    case 'fieldAccess':
      return `${renderChild(expr.object, origin, ctx, ATOMIC_PRECEDENCE, undefined, false)}.${expr.field}`;
    case 'call':
      addValueImport(ctx, expr.function.module, expr.function.name);
      return `${expr.function.name}(${renderCallArgs(expr.args, origin, ctx)})`;
    case 'construct':
      return renderConstruct(expr, origin, ctx);
    case 'binary': {
      const precedence = BINARY_PRECEDENCE[expr.operator];
      const left = renderChild(expr.left, origin, ctx, precedence, expr.operator, false);
      const right = renderChild(expr.right, origin, ctx, precedence, expr.operator, true);
      return `${left} ${renderOperator(expr.operator)} ${right}`;
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
  ctx: TsCtx,
  level: number,
): string[] {
  const lines: string[] = [];
  for (const statement of statements) {
    lines.push(...renderStatement(statement, origin, ctx, level));
  }
  return lines;
}

function renderStatement(statement: IrStatement, origin: IrOrigin, ctx: TsCtx, level: number): string[] {
  const pad = indent(level);
  switch (statement.kind) {
    case 'let': {
      const keyword = statement.mutable ? 'let' : 'const';
      const value = renderExpr(statement.value, origin, ctx);
      return [`${pad}${keyword} ${tsIdentifier(statement.name)} = ${value};`];
    }
    case 'return': {
      if (statement.value === undefined) {
        return [`${pad}return;`];
      }
      return [`${pad}return ${renderExpr(statement.value, origin, ctx)};`];
    }
    case 'if':
      return renderIf(statement, origin, ctx, level);
    case 'expr':
      return [`${pad}${renderExpr(statement.expression, origin, ctx)};`];
    default: {
      const unknownKind = (statement as { kind: string }).kind;
      ctx.diagnostics.push(unsupportedFeature(origin, `Unrecognized IR statement kind '${unknownKind}'`));
      return [`${pad}/* unsupported statement */`];
    }
  }
}

function renderIf(statement: IrIf, origin: IrOrigin, ctx: TsCtx, level: number): string[] {
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
