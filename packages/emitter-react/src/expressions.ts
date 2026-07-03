import {
  IrArgument,
  IrBinaryOperator,
  IrConstruct,
  IrEnumValue,
  IrExpression,
  IrIf,
  IrMatch,
  IrOrigin,
  IrStatement,
} from '@clearkrypt/compiler-core';
import { addValueImport, TsCtx } from './context';
import { unsupportedFeature } from './diagnostics';
import { lookupEnum, lookupModel } from './modelIndex';
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

/** Escapes literal text for a TypeScript template literal. */
export function escapeTemplateText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${')
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
  // TypeScript refuses `a ?? b || c` outright: ?? may not mix with && or ||
  // without explicit parentheses.
  const logicalOps: readonly string[] = ['&&', '||', '??'];
  if (
    !needsParens &&
    expr.kind === 'binary' &&
    parentOperator !== undefined &&
    parentOperator !== expr.operator &&
    logicalOps.includes(parentOperator) &&
    logicalOps.includes(expr.operator) &&
    (parentOperator === '??' || expr.operator === '??')
  ) {
    needsParens = true;
  }
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

/**
 * Case values per docs/19: simple enums are string-literal unions, so the
 * value is just `'pending'`; associated enums are discriminated unions, so
 * the value is `{ kind: 'server', message: ... }`.
 */
function renderEnumValue(expr: IrEnumValue, origin: IrOrigin, ctx: TsCtx): string {
  const declaration = lookupEnum(ctx.enumIndex, expr.enumType.module, expr.enumType.name);
  const isSimple = declaration?.isSimple ?? expr.args.length === 0;
  if (declaration?.isSimple) {
    return `"${escapeStringLiteral(expr.caseName)}"`;
  }
  if (expr.args.length === 0) {
    return `{ kind: "${escapeStringLiteral(expr.caseName)}" }`;
  }
  void isSimple;
  return `{ kind: "${escapeStringLiteral(expr.caseName)}", ${renderObjectArgs(expr.args, origin, ctx)} }`;
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
    case 'fieldAccess': {
      const objectText = renderChild(expr.object, origin, ctx, ATOMIC_PRECEDENCE, undefined, false);
      if (!expr.optionalChaining) {
        return `${objectText}.${expr.field}`;
      }
      // `?.` yields undefined for absent values, but ClearKrypt optionals
      // are `T | null` (docs/19); normalize so the null policy stays exact.
      return `(${objectText}?.${expr.field} ?? null)`;
    }
    case 'interpolatedString': {
      const parts = expr.parts
        .map((part) =>
          part.kind === 'text'
            ? escapeTemplateText(part.value)
            : '${' + renderExpr(part, origin, ctx) + '}',
        )
        .join('');
      return '`' + parts + '`';
    }
    case 'enumValue':
      return renderEnumValue(expr, origin, ctx);
    case 'try':
      // TS has no call-site marker; the thrown value propagates.
      return renderExpr(expr.expression, origin, ctx);
    case 'match':
      // Handled at statement level (let/return); see renderMatch*.
      ctx.diagnostics.push(
        unsupportedFeature(origin, `A match expression reached an unsupported position`),
      );
      return '/* unsupported match position */';
    case 'call':
      addValueImport(ctx, expr.function.module, expr.function.name);
      return `${expr.function.name}(${renderCallArgs(expr.args, origin, ctx)})`;
    case 'construct':
      return renderConstruct(expr, origin, ctx);
    case 'binary': {
      const precedence = BINARY_PRECEDENCE[expr.operator];
      // `a?.b ?? fallback` needs no `?? null` normalization on the left:
      // the outer ?? treats undefined and null identically.
      const left =
        expr.operator === '??' &&
        expr.left.kind === 'fieldAccess' &&
        expr.left.optionalChaining
          ? `${renderChild(expr.left.object, origin, ctx, ATOMIC_PRECEDENCE, undefined, false)}?.${expr.left.field}`
          : renderChild(expr.left, origin, ctx, precedence, expr.operator, false);
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
      if (statement.value.kind === 'match') {
        // `const x = (() => { switch ... })();` keeps const-ness while the
        // switch runs statement-style.
        const lines = [`${pad}${keyword} ${tsIdentifier(statement.name)} = (() => {`];
        lines.push(...renderMatchAsReturningSwitch(statement.value, origin, ctx, level + 1));
        lines.push(`${pad}})();`);
        return lines;
      }
      const value = renderExpr(statement.value, origin, ctx);
      return [`${pad}${keyword} ${tsIdentifier(statement.name)} = ${value};`];
    }
    case 'return': {
      if (statement.value === undefined) {
        return [`${pad}return;`];
      }
      if (statement.value.kind === 'match') {
        // Return position: the switch returns directly, no wrapper needed.
        return renderMatchAsReturningSwitch(statement.value, origin, ctx, level);
      }
      return [`${pad}return ${renderExpr(statement.value, origin, ctx)};`];
    }
    case 'if':
      return renderIf(statement, origin, ctx, level);
    case 'ifLet': {
      const name = tsIdentifier(statement.name);
      const lines = [
        `${pad}const ${name} = ${renderExpr(statement.value, origin, ctx)};`,
        `${pad}if (${name} !== null) {`,
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
      return [`${pad}throw ${renderExpr(statement.value, origin, ctx)};`];
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

/**
 * Renders a match as a returning switch. Simple enums switch on the string
 * value; associated enums switch on `.kind` with payload bindings pulled off
 * the narrowed value. The checker proved exhaustiveness, so the trailing
 * throw is genuinely unreachable — it exists to keep the generated function
 * total under any tsconfig.
 */
function renderMatchAsReturningSwitch(
  match: IrMatch,
  origin: IrOrigin,
  ctx: TsCtx,
  level: number,
): string[] {
  const pad = indent(level);
  const declaration = lookupEnum(ctx.enumIndex, match.enumType.module, match.enumType.name);
  const isSimple = declaration?.isSimple ?? false;

  const lines = [`${pad}const matched = ${renderExpr(match.scrutinee, origin, ctx)};`];
  lines.push(`${pad}switch (${isSimple ? 'matched' : 'matched.kind'}) {`);
  for (const arm of match.arms) {
    const caseLabel = `case "${escapeStringLiteral(arm.caseName)}":`;
    const body = renderExpr(arm.body, origin, ctx);
    if (arm.bindings.length === 0) {
      lines.push(`${indent(level + 1)}${caseLabel}`);
      lines.push(`${indent(level + 2)}return ${body};`);
      continue;
    }
    lines.push(`${indent(level + 1)}${caseLabel} {`);
    for (const binding of arm.bindings) {
      lines.push(
        `${indent(level + 2)}const ${tsIdentifier(binding.name)} = matched.${binding.field};`,
      );
    }
    lines.push(`${indent(level + 2)}return ${body};`);
    lines.push(`${indent(level + 1)}}`);
  }
  if (match.elseBody !== undefined) {
    lines.push(`${indent(level + 1)}default:`);
    lines.push(`${indent(level + 2)}return ${renderExpr(match.elseBody, origin, ctx)};`);
  }
  lines.push(`${pad}}`);
  if (match.elseBody === undefined) {
    lines.push(`${pad}throw new Error("unreachable match");`);
  }
  return lines;
}
