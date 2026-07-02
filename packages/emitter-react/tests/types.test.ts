import { describe, expect, it } from 'vitest';
import { Diagnostic, IrOrigin, IrType, irSamples } from '@clearkrypt/compiler-core';
import { createContext } from '../src/context';
import { buildModelIndex } from '../src/modelIndex';
import { renderType } from '../src/types';

const origin: IrOrigin = {
  file: 'fixture.ck',
  span: { file: 'fixture.ck', start: 0, end: 0, startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
  module: 'app.test',
};

function render(type: IrType) {
  const diagnostics: Diagnostic[] = [];
  const ctx = createContext('app.test', buildModelIndex({ modules: [] }), diagnostics);
  const text = renderType(type, origin, ctx);
  return { text, typeImports: ctx.typeImports, diagnostics };
}

describe('TypeScript type rendering', () => {
  it('renders every primitive per the mapping table', () => {
    expect(render(irSamples.primitive('String')).text).toBe('string');
    expect(render(irSamples.primitive('Int')).text).toBe('number');
    expect(render(irSamples.primitive('Float')).text).toBe('number');
    expect(render(irSamples.primitive('Bool')).text).toBe('boolean');
    expect(render(irSamples.primitive('Data')).text).toBe('Uint8Array');
    expect(render(irSamples.primitive('Void')).text).toBe('void');
    expect(render(irSamples.primitive('Never')).text).toBe('never');
  });

  it('renders Date and DateTime as string (ISO-8601, no native date type)', () => {
    expect(render(irSamples.primitive('Date')).text).toBe('string');
    expect(render(irSamples.primitive('DateTime')).text).toBe('string');
  });

  it('imports ID, Email, URL, and Decimal from the support file', () => {
    expect(render(irSamples.primitive('ID')).typeImports.get('clearkrypt')).toEqual(new Set(['ID']));
    expect(render(irSamples.primitive('Email')).typeImports.get('clearkrypt')).toEqual(new Set(['Email']));
    expect(render(irSamples.primitive('URL')).typeImports.get('clearkrypt')).toEqual(new Set(['URL']));
    expect(render(irSamples.primitive('Decimal')).typeImports.get('clearkrypt')).toEqual(new Set(['Decimal']));
  });

  it('renders List/Map/Set as readonly collections', () => {
    expect(render({ kind: 'list', element: irSamples.primitive('Int') }).text).toBe('readonly number[]');
    expect(
      render({ kind: 'map', key: irSamples.primitive('String'), value: irSamples.primitive('Int') }).text,
    ).toBe('ReadonlyMap<string, number>');
    expect(render({ kind: 'set', element: irSamples.primitive('String') }).text).toBe('ReadonlySet<string>');
  });

  it('renders optionals as `T | null`', () => {
    expect(render({ kind: 'optional', inner: irSamples.primitive('String') }).text).toBe('string | null');
  });

  it('parenthesizes an optional list element: readonly (T | null)[]', () => {
    const type: IrType = { kind: 'list', element: { kind: 'optional', inner: irSamples.primitive('String') } };
    expect(render(type).text).toBe('readonly (string | null)[]');
  });

  it('does not parenthesize a non-optional list element', () => {
    const type: IrType = { kind: 'list', element: irSamples.primitive('String') };
    expect(render(type).text).toBe('readonly string[]');
  });

  it('imports a cross-module declared type but not a same-module one', () => {
    const cross = render({ kind: 'declared', name: 'User', module: 'app.models', declarationKind: 'model' });
    expect(cross.typeImports.get('app.models')).toEqual(new Set(['User']));

    const same = render({ kind: 'declared', name: 'User', module: 'app.test', declarationKind: 'model' });
    expect(same.typeImports.size).toBe(0);
  });

  it('reports CK0004 instead of throwing on an unrecognized type kind', () => {
    const diagnostics: Diagnostic[] = [];
    const ctx = createContext('app.test', buildModelIndex({ modules: [] }), diagnostics);
    const bogus = { kind: 'bogus' } as unknown as IrType;
    const text = renderType(bogus, origin, ctx);
    expect(text).toBeTruthy();
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe('CK0004');
    expect(diagnostics[0]?.span).toBe(origin.span);
  });
});
