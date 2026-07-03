import {
  Diagnostic,
  IrArgument,
  IrBinaryOperator,
  IrExpression,
  IrIf,
  IrOrigin,
  IrStatement,
} from '@clearkrypt/compiler-core';
import { unsupportedFeature } from './diagnostics';
import { swiftIdentifier } from './naming';

const INDENT = '    ';

/** Escapes a ClearKrypt string literal for a Swift double-quoted string literal. */
export function escapeStringLiteral(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/\r/g, '\\r');
}

// Lower number binds looser. Matches Swift's actual operator precedence
// groups closely enough for our operator set (arithmetic, comparison,
// logical) that no observable-behavior difference exists.
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

// Operators for which `a op (b op c)` is equivalent to `a op b op c` and so
// the parentheses around a same-operator right operand can be dropped.
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
  diagnostics: Diagnostic[],
  parentPrecedence: number,
  parentOperator: IrBinaryOperator | undefined,
  isRightOperand: boolean,
): string {
  const text = renderExpr(expr, origin, diagnostics);
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

function renderArgs(args: readonly IrArgument[], origin: IrOrigin, diagnostics: Diagnostic[]): string {
  return args
    .map((arg) => `${swiftIdentifier(arg.name)}: ${renderExpr(arg.value, origin, diagnostics)}`)
    .join(', ');
}

export function renderExpr(expr: IrExpression, origin: IrOrigin, diagnostics: Diagnostic[]): string {
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
      return 'nil';
    case 'localRef':
      return swiftIdentifier(expr.name);
    case 'paramRef':
      return swiftIdentifier(expr.name);
    case 'fieldAccess': {
      const objectText = renderChild(expr.object, origin, diagnostics, ATOMIC_PRECEDENCE, undefined, false);
      return `${objectText}${expr.optionalChaining ? '?.' : '.'}${swiftIdentifier(expr.field)}`;
    }
    case 'interpolatedString': {
      const parts = expr.parts
        .map((part) =>
          part.kind === 'text'
            ? escapeStringLiteral(part.value)
            : '\\(' + renderExpr(part, origin, diagnostics) + ')',
        )
        .join('');
      return `"${parts}"`;
    }
    case 'enumValue': {
      const caseRef = `${expr.enumType.name}.${swiftIdentifier(expr.caseName)}`;
      return expr.args.length > 0 ? `${caseRef}(${renderArgs(expr.args, origin, diagnostics)})` : caseRef;
    }
    case 'try':
      return `try ${renderExpr(expr.expression, origin, diagnostics)}`;
    case 'match':
      // The checker restricts match to let-initializers and return values,
      // which renderStatement handles as multi-line switch expressions.
      diagnostics.push(
        unsupportedFeature(origin, `A match expression reached an unsupported position`),
      );
      return '/* unsupported match position */';
    case 'call':
      return `${expr.function.name}(${renderArgs(expr.args, origin, diagnostics)})`;
    case 'construct':
      return `${expr.model.name}(${renderArgs(expr.args, origin, diagnostics)})`;
    case 'binary': {
      const precedence = BINARY_PRECEDENCE[expr.operator];
      const left = renderChild(expr.left, origin, diagnostics, precedence, expr.operator, false);
      const right = renderChild(expr.right, origin, diagnostics, precedence, expr.operator, true);
      return `${left} ${expr.operator} ${right}`;
    }
    case 'unary': {
      const operandText = renderExpr(expr.operand, origin, diagnostics);
      const needsParens = expr.operand.kind === 'binary' || expr.operand.kind === 'unary';
      return `${expr.operator}${needsParens ? `(${operandText})` : operandText}`;
    }
    default: {
      diagnostics.push(
        unsupportedFeature(origin, `Unrecognized IR expression kind '${String((expr as { kind: string }).kind)}'`),
      );
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
  diagnostics: Diagnostic[],
  level: number,
): string[] {
  const lines: string[] = [];
  for (const statement of statements) {
    lines.push(...renderStatement(statement, origin, diagnostics, level));
  }
  return lines;
}

function renderStatement(
  statement: IrStatement,
  origin: IrOrigin,
  diagnostics: Diagnostic[],
  level: number,
): string[] {
  const pad = indent(level);
  switch (statement.kind) {
    case 'let': {
      const keyword = statement.mutable ? 'var' : 'let';
      const head = `${pad}${keyword} ${swiftIdentifier(statement.name)} = `;
      if (statement.value.kind === 'match') {
        return renderMatch(statement.value, head, origin, diagnostics, level);
      }
      return [`${head}${renderExpr(statement.value, origin, diagnostics)}`];
    }
    case 'return': {
      if (statement.value === undefined) {
        return [`${pad}return`];
      }
      if (statement.value.kind === 'match') {
        return renderMatch(statement.value, `${pad}return `, origin, diagnostics, level);
      }
      return [`${pad}return ${renderExpr(statement.value, origin, diagnostics)}`];
    }
    case 'if':
      return renderIf(statement, origin, diagnostics, level);
    case 'ifLet': {
      const value = renderExpr(statement.value, origin, diagnostics);
      const lines = [
        `${pad}if let ${swiftIdentifier(statement.name)} = ${value} {`,
        ...renderStatements(statement.then, origin, diagnostics, level + 1),
      ];
      if (statement.else !== undefined) {
        lines.push(`${pad}} else {`);
        lines.push(...renderStatements(statement.else, origin, diagnostics, level + 1));
      }
      lines.push(`${pad}}`);
      return lines;
    }
    case 'throw':
      return [`${pad}throw ${renderExpr(statement.value, origin, diagnostics)}`];
    case 'expr':
      return [`${pad}${renderExpr(statement.expression, origin, diagnostics)}`];
    default: {
      diagnostics.push(
        unsupportedFeature(origin, `Unrecognized IR statement kind '${String((statement as { kind: string }).kind)}'`),
      );
      return [`${pad}/* unsupported statement */`];
    }
  }
}

function renderIf(statement: IrIf, origin: IrOrigin, diagnostics: Diagnostic[], level: number): string[] {
  const pad = indent(level);
  const condition = renderExpr(statement.condition, origin, diagnostics);
  const lines = [`${pad}if ${condition} {`, ...renderStatements(statement.then, origin, diagnostics, level + 1)];
  if (statement.else !== undefined) {
    lines.push(`${pad}} else {`);
    lines.push(...renderStatements(statement.else, origin, diagnostics, level + 1));
    lines.push(`${pad}}`);
  } else {
    lines.push(`${pad}}`);
  }
  return lines;
}

/**
 * Renders a match as a Swift switch expression (Swift 5.9+), attached to the
 * given head (`let x = ` or `return `). Payload bindings use `case .name(let
 * a, let b)`; the checker already proved exhaustiveness.
 */
function renderMatch(
  match: Extract<IrExpression, { kind: 'match' }>,
  head: string,
  origin: IrOrigin,
  diagnostics: Diagnostic[],
  level: number,
): string[] {
  const pad = indent(level);
  const scrutinee = renderExpr(match.scrutinee, origin, diagnostics);
  const lines = [`${head}switch ${scrutinee} {`];
  for (const arm of match.arms) {
    const bindings =
      arm.bindings.length > 0
        ? `(${arm.bindings.map((b) => `let ${swiftIdentifier(b.name)}`).join(', ')})`
        : '';
    lines.push(`${pad}case .${swiftIdentifier(arm.caseName)}${bindings}:`);
    lines.push(`${indent(level + 1)}${renderExpr(arm.body, origin, diagnostics)}`);
  }
  if (match.elseBody !== undefined) {
    lines.push(`${pad}default:`);
    lines.push(`${indent(level + 1)}${renderExpr(match.elseBody, origin, diagnostics)}`);
  }
  lines.push(`${pad}}`);
  return lines;
}
