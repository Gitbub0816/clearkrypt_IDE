import { describe, expect, it } from 'vitest';
import { Diagnostic, IrBinaryOperator, IrExpression, IrOrigin, irSamples } from '@clearkrypt/compiler-core';
import { createContext } from '../src/context';
import { escapeStringLiteral, renderExpr } from '../src/expressions';

const origin: IrOrigin = {
  file: 'fixture.ck',
  span: { file: 'fixture.ck', start: 0, end: 0, startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
  module: 'app.test',
};

function ref(name: string): IrExpression {
  return { kind: 'paramRef', name, type: irSamples.primitive('Int') };
}

function bin(operator: IrBinaryOperator, left: IrExpression, right: IrExpression): IrExpression {
  return { kind: 'binary', operator, left, right, type: irSamples.primitive('Int') };
}

function render(expr: IrExpression): string {
  const diagnostics: Diagnostic[] = [];
  const ctx = createContext('app.test', diagnostics);
  return renderExpr(expr, origin, ctx);
}

describe('escapeStringLiteral', () => {
  it('escapes backslashes, quotes, and whitespace controls', () => {
    expect(escapeStringLiteral('a\\b"c\nd\te\rf')).toBe('a\\\\b\\"c\\nd\\te\\rf');
  });
});

describe('Kotlin precedence-aware parenthesization', () => {
  it('does not parenthesize a left-associative chain of the same operator', () => {
    expect(render(bin('+', bin('+', ref('a'), ref('b')), ref('c')))).toBe('a + b + c');
  });

  it('parenthesizes a lower-precedence child', () => {
    expect(render(bin('*', bin('+', ref('a'), ref('b')), ref('c')))).toBe('(a + b) * c');
  });

  it('parenthesizes a same-precedence right operand for non-associative-safe operators', () => {
    expect(render(bin('-', ref('a'), bin('-', ref('b'), ref('c'))))).toBe('a - (b - c)');
  });

  it('drops parens for a same-precedence, same-operator right operand of an associative operator', () => {
    expect(render(bin('+', ref('a'), bin('+', ref('b'), ref('c'))))).toBe('a + b + c');
  });
});

describe('Kotlin call rendering', () => {
  it('uses named arguments and imports cross-module function calls', () => {
    const diagnostics: Diagnostic[] = [];
    const ctx = createContext('app.api', diagnostics);
    const call: IrExpression = {
      kind: 'call',
      function: { name: 'fullName', module: 'app.text' },
      args: [{ name: 'first', value: { kind: 'stringLiteral', value: 'Ada', type: irSamples.primitive('String') } }],
      type: irSamples.primitive('String'),
    };
    expect(renderExpr(call, origin, ctx)).toBe('fullName(first = "Ada")');
    expect([...ctx.imports]).toEqual(['app.text.fullName']);
  });

  it('reports CK0004 instead of throwing on an unrecognized expression kind', () => {
    const diagnostics: Diagnostic[] = [];
    const ctx = createContext('app.test', diagnostics);
    const bogus = { kind: 'bogus' } as unknown as IrExpression;
    const text = renderExpr(bogus, origin, ctx);
    expect(text).toBeTruthy();
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe('CK0004');
  });
});
