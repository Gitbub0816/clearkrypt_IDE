import { describe, expect, it } from 'vitest';
import { Diagnostic, IrBinaryOperator, IrExpression, IrOrigin, irSamples } from '@clearkrypt/compiler-core';
import { escapeStringLiteral, renderExpr } from '../src/expressions';

const origin: IrOrigin = {
  file: 'fixture.ck',
  span: { file: 'fixture.ck', start: 0, end: 0, startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
  module: 'app.test',
};

function num(text: string): IrExpression {
  return { kind: 'intLiteral', text, type: irSamples.primitive('Int') };
}

function ref(name: string): IrExpression {
  return { kind: 'paramRef', name, type: irSamples.primitive('Int') };
}

function bin(operator: IrBinaryOperator, left: IrExpression, right: IrExpression): IrExpression {
  return { kind: 'binary', operator, left, right, type: irSamples.primitive('Int') };
}

function render(expr: IrExpression): string {
  const diagnostics: Diagnostic[] = [];
  return renderExpr(expr, origin, diagnostics);
}

describe('escapeStringLiteral', () => {
  it('escapes backslashes, quotes, and whitespace controls', () => {
    expect(escapeStringLiteral('a\\b"c\nd\te\rf')).toBe('a\\\\b\\"c\\nd\\te\\rf');
  });

  it('leaves plain text untouched', () => {
    expect(escapeStringLiteral('hello world')).toBe('hello world');
  });
});

describe('Swift precedence-aware parenthesization', () => {
  it('does not parenthesize a left-associative chain of the same operator', () => {
    // (a + b) + c -> "a + b + c"
    expect(render(bin('+', bin('+', ref('a'), ref('b')), ref('c')))).toBe('a + b + c');
  });

  it('parenthesizes a lower-precedence child', () => {
    // (a + b) * c -> "(a + b) * c"
    expect(render(bin('*', bin('+', ref('a'), ref('b')), ref('c')))).toBe('(a + b) * c');
  });

  it('does not parenthesize a higher-precedence child', () => {
    // a + (b * c) -> "a + b * c"
    expect(render(bin('+', ref('a'), bin('*', ref('b'), ref('c'))))).toBe('a + b * c');
  });

  it('parenthesizes a same-precedence right operand for non-associative-safe operators', () => {
    // a - (b - c) must keep parens; dropping them would change the result.
    expect(render(bin('-', ref('a'), bin('-', ref('b'), ref('c'))))).toBe('a - (b - c)');
    // a - (b + c) must also keep parens even though '+' differs from '-'.
    expect(render(bin('-', ref('a'), bin('+', ref('b'), ref('c'))))).toBe('a - (b + c)');
  });

  it('drops parens for a same-precedence, same-operator right operand of an associative operator', () => {
    // a + (b + c) is equivalent to a + b + c for associative '+'.
    expect(render(bin('+', ref('a'), bin('+', ref('b'), ref('c'))))).toBe('a + b + c');
  });

  it('parenthesizes a binary operand under unary minus', () => {
    const expr: IrExpression = { kind: 'unary', operator: '-', operand: bin('+', ref('a'), ref('b')), type: irSamples.primitive('Int') };
    expect(render(expr)).toBe('-(a + b)');
  });

  it('does not parenthesize an atomic operand under unary minus', () => {
    const expr: IrExpression = { kind: 'unary', operator: '-', operand: ref('a'), type: irSamples.primitive('Int') };
    expect(render(expr)).toBe('-a');
  });
});

describe('literal rendering', () => {
  it('renders int and float literal text verbatim', () => {
    expect(render(num('42'))).toBe('42');
    expect(render({ kind: 'floatLiteral', text: '3.14', type: irSamples.primitive('Float') })).toBe('3.14');
  });

  it('renders bool and null literals', () => {
    expect(render({ kind: 'boolLiteral', value: true, type: irSamples.primitive('Bool') })).toBe('true');
    expect(render({ kind: 'nullLiteral', type: { kind: 'optional', inner: irSamples.primitive('Int') } })).toBe(
      'nil',
    );
  });

  it('reports CK0004 instead of throwing on an unrecognized expression kind', () => {
    const diagnostics: Diagnostic[] = [];
    const bogus = { kind: 'bogus' } as unknown as IrExpression;
    const text = renderExpr(bogus, origin, diagnostics);
    expect(text).toBeTruthy();
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe('CK0004');
  });
});
