import { describe, expect, it } from 'vitest';
import {
  Diagnostic,
  IrBinaryOperator,
  IrConstruct,
  IrExpression,
  IrOrigin,
  IrProject,
  irSamples,
} from '@clearkrypt/compiler-core';
import { createContext } from '../src/context';
import { escapeStringLiteral, renderExpr } from '../src/expressions';
import { buildModelIndex } from '../src/modelIndex';

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

function render(expr: IrExpression, project: IrProject = { modules: [] }): string {
  const diagnostics: Diagnostic[] = [];
  const ctx = createContext('app.test', buildModelIndex(project), diagnostics);
  return renderExpr(expr, origin, ctx);
}

describe('escapeStringLiteral', () => {
  it('escapes backslashes, quotes, and whitespace controls', () => {
    expect(escapeStringLiteral('a\\b"c\nd\te\rf')).toBe('a\\\\b\\"c\\nd\\te\\rf');
  });
});

describe('TypeScript precedence-aware parenthesization', () => {
  it('does not parenthesize a left-associative chain of the same operator', () => {
    expect(render(bin('+', bin('+', ref('a'), ref('b')), ref('c')))).toBe('a + b + c');
  });

  it('parenthesizes a lower-precedence child', () => {
    expect(render(bin('*', bin('+', ref('a'), ref('b')), ref('c')))).toBe('(a + b) * c');
  });

  it('parenthesizes a same-precedence right operand for non-associative-safe operators', () => {
    expect(render(bin('-', ref('a'), bin('-', ref('b'), ref('c'))))).toBe('a - (b - c)');
  });
});

describe('TypeScript call rendering', () => {
  it('calls with positional arguments and imports cross-module functions as values', () => {
    const diagnostics: Diagnostic[] = [];
    const ctx = createContext('app.api', buildModelIndex({ modules: [] }), diagnostics);
    const call: IrExpression = {
      kind: 'call',
      function: { name: 'fullName', module: 'app.text' },
      args: [{ name: 'first', value: { kind: 'stringLiteral', value: 'Ada', type: irSamples.primitive('String') } }],
      type: irSamples.primitive('String'),
    };
    expect(renderExpr(call, origin, ctx)).toBe('fullName("Ada")');
    expect(ctx.valueImports.get('app.text')).toEqual(new Set(['fullName']));
  });
});

describe('TypeScript model construction', () => {
  const project: IrProject = {
    modules: [
      {
        name: 'app.models',
        file: 'src/models.ck',
        declarations: [irSamples.sampleHelloWorldModule().modules[0]!.declarations[0]!],
      },
    ],
  };

  function construct(args: IrConstruct['args']): IrConstruct {
    return {
      kind: 'construct',
      model: { name: 'Greeting', module: 'app.models' },
      args,
      type: { kind: 'declared', name: 'Greeting', module: 'app.models', declarationKind: 'model' },
    };
  }

  it('uses a plain object literal when every field (including defaulted ones) is provided', () => {
    const expr = construct([
      { name: 'id', value: { kind: 'stringLiteral', value: 'g1', type: irSamples.primitive('ID') } },
      { name: 'message', value: { kind: 'stringLiteral', value: 'hi', type: irSamples.primitive('String') } },
      { name: 'isFriendly', value: { kind: 'boolLiteral', value: false, type: irSamples.primitive('Bool') } },
    ]);
    expect(render(expr, project)).toBe('{ id: "g1", message: "hi", isFriendly: false }');
  });

  it('calls the createX factory when a defaulted field is omitted', () => {
    const expr = construct([
      { name: 'id', value: { kind: 'stringLiteral', value: 'g1', type: irSamples.primitive('ID') } },
      { name: 'message', value: { kind: 'stringLiteral', value: 'hi', type: irSamples.primitive('String') } },
    ]);
    const diagnostics: Diagnostic[] = [];
    const ctx = createContext('app.api', buildModelIndex(project), diagnostics);
    const text = renderExpr(expr, origin, ctx);
    expect(text).toBe('createGreeting({ id: "g1", message: "hi" })');
    expect(ctx.valueImports.get('app.models')).toEqual(new Set(['createGreeting']));
  });

  it('does not import the factory for a same-module construct', () => {
    const expr = construct([
      { name: 'id', value: { kind: 'stringLiteral', value: 'g1', type: irSamples.primitive('ID') } },
      { name: 'message', value: { kind: 'stringLiteral', value: 'hi', type: irSamples.primitive('String') } },
    ]);
    const diagnostics: Diagnostic[] = [];
    const ctx = createContext('app.models', buildModelIndex(project), diagnostics);
    renderExpr(expr, origin, ctx);
    expect(ctx.valueImports.size).toBe(0);
  });
});

describe('unsupported expression handling', () => {
  it('reports CK0004 instead of throwing on an unrecognized expression kind', () => {
    const diagnostics: Diagnostic[] = [];
    const ctx = createContext('app.test', buildModelIndex({ modules: [] }), diagnostics);
    const bogus = { kind: 'bogus' } as unknown as IrExpression;
    const text = renderExpr(bogus, origin, ctx);
    expect(text).toBeTruthy();
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe('CK0004');
  });
});
