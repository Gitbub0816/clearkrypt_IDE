import { describe, expect, it } from 'vitest';
import { Diagnostic, IrOrigin, IrType, irSamples } from '@clearkrypt/compiler-core';
import { createContext } from '../src/context';
import { renderType } from '../src/types';

const origin: IrOrigin = {
  file: 'fixture.ck',
  span: { file: 'fixture.ck', start: 0, end: 0, startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
  module: 'app.test',
};

function render(type: IrType) {
  const diagnostics: Diagnostic[] = [];
  const ctx = createContext('app.test', diagnostics);
  const text = renderType(type, origin, ctx);
  return { text, imports: [...ctx.imports], diagnostics };
}

describe('Kotlin type rendering', () => {
  it('renders every primitive per the mapping table', () => {
    expect(render(irSamples.primitive('String')).text).toBe('String');
    expect(render(irSamples.primitive('Int')).text).toBe('Int');
    expect(render(irSamples.primitive('Float')).text).toBe('Double');
    expect(render(irSamples.primitive('Bool')).text).toBe('Boolean');
    expect(render(irSamples.primitive('Data')).text).toBe('ByteArray');
    expect(render(irSamples.primitive('Void')).text).toBe('Unit');
    expect(render(irSamples.primitive('Never')).text).toBe('Nothing');
  });

  it('imports java.math.BigDecimal for Decimal', () => {
    const result = render(irSamples.primitive('Decimal'));
    expect(result.text).toBe('BigDecimal');
    expect(result.imports).toEqual(['java.math.BigDecimal']);
  });

  it('imports java.time.LocalDate for Date and java.time.Instant for DateTime', () => {
    expect(render(irSamples.primitive('Date'))).toMatchObject({ text: 'LocalDate', imports: ['java.time.LocalDate'] });
    expect(render(irSamples.primitive('DateTime'))).toMatchObject({ text: 'Instant', imports: ['java.time.Instant'] });
  });

  it('imports clearkrypt support aliases for ID, Email, URL', () => {
    expect(render(irSamples.primitive('ID'))).toMatchObject({ text: 'ID', imports: ['clearkrypt.ID'] });
    expect(render(irSamples.primitive('Email'))).toMatchObject({ text: 'Email', imports: ['clearkrypt.Email'] });
    expect(render(irSamples.primitive('URL'))).toMatchObject({ text: 'URL', imports: ['clearkrypt.URL'] });
  });

  it('does not import support aliases when generating the support file itself', () => {
    const diagnostics: Diagnostic[] = [];
    const ctx = createContext('clearkrypt', diagnostics);
    renderType(irSamples.primitive('ID'), origin, ctx);
    expect(ctx.imports.size).toBe(0);
  });

  it('renders collections', () => {
    expect(render({ kind: 'list', element: irSamples.primitive('Int') }).text).toBe('List<Int>');
    expect(
      render({ kind: 'map', key: irSamples.primitive('String'), value: irSamples.primitive('Int') }).text,
    ).toBe('Map<String, Int>');
    expect(render({ kind: 'set', element: irSamples.primitive('String') }).text).toBe('Set<String>');
  });

  it('renders optionals with a trailing ?', () => {
    expect(render({ kind: 'optional', inner: irSamples.primitive('String') }).text).toBe('String?');
  });

  it('imports a cross-module declared type but not a same-module one', () => {
    const cross = render({ kind: 'declared', name: 'User', module: 'app.models', declarationKind: 'model' });
    expect(cross).toMatchObject({ text: 'User', imports: ['app.models.User'] });

    const same = render({ kind: 'declared', name: 'User', module: 'app.test', declarationKind: 'model' });
    expect(same).toMatchObject({ text: 'User', imports: [] });
  });

  it('reports CK0004 instead of throwing on an unrecognized type kind', () => {
    const diagnostics: Diagnostic[] = [];
    const ctx = createContext('app.test', diagnostics);
    const bogus = { kind: 'bogus' } as unknown as IrType;
    const text = renderType(bogus, origin, ctx);
    expect(text).toBeTruthy();
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe('CK0004');
    expect(diagnostics[0]?.span).toBe(origin.span);
  });
});
