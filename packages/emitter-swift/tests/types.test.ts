import { describe, expect, it } from 'vitest';
import { Diagnostic, IrOrigin, IrType, irSamples } from '@clearkrypt/compiler-core';
import { renderReturnClause, renderType } from '../src/types';

const origin: IrOrigin = {
  file: 'fixture.ck',
  span: { file: 'fixture.ck', start: 0, end: 0, startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
  module: 'app.test',
};

function render(type: IrType): { text: string; needsFoundation: boolean; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const result = renderType(type, origin, diagnostics);
  return { ...result, diagnostics };
}

describe('Swift type rendering', () => {
  it('renders every primitive per the mapping table', () => {
    expect(render(irSamples.primitive('String')).text).toBe('String');
    expect(render(irSamples.primitive('Int')).text).toBe('Int');
    expect(render(irSamples.primitive('Float')).text).toBe('Double');
    expect(render(irSamples.primitive('Bool')).text).toBe('Bool');
    expect(render(irSamples.primitive('ID')).text).toBe('ID');
    expect(render(irSamples.primitive('Email')).text).toBe('Email');
    expect(render(irSamples.primitive('Never')).text).toBe('Never');
  });

  it('maps Date and DateTime to Foundation Date, needing Foundation', () => {
    expect(render(irSamples.primitive('Date'))).toMatchObject({ text: 'Date', needsFoundation: true });
    expect(render(irSamples.primitive('DateTime'))).toMatchObject({ text: 'Date', needsFoundation: true });
  });

  it('maps Decimal, URL, and Data to Foundation types', () => {
    expect(render(irSamples.primitive('Decimal'))).toMatchObject({ text: 'Decimal', needsFoundation: true });
    expect(render(irSamples.primitive('URL'))).toMatchObject({ text: 'URL', needsFoundation: true });
    expect(render(irSamples.primitive('Data'))).toMatchObject({ text: 'Data', needsFoundation: true });
  });

  it('does not need Foundation for plain primitives', () => {
    expect(render(irSamples.primitive('String')).needsFoundation).toBe(false);
    expect(render(irSamples.primitive('Int')).needsFoundation).toBe(false);
  });

  it('renders collections', () => {
    expect(render({ kind: 'list', element: irSamples.primitive('Int') }).text).toBe('[Int]');
    expect(
      render({ kind: 'map', key: irSamples.primitive('String'), value: irSamples.primitive('Int') }).text,
    ).toBe('[String: Int]');
    expect(render({ kind: 'set', element: irSamples.primitive('String') }).text).toBe('Set<String>');
  });

  it('renders optionals with a trailing ?', () => {
    expect(render({ kind: 'optional', inner: irSamples.primitive('URL') })).toMatchObject({
      text: 'URL?',
      needsFoundation: true,
    });
  });

  it('propagates needsFoundation through nested collections', () => {
    const type: IrType = { kind: 'list', element: { kind: 'optional', inner: irSamples.primitive('Date') } };
    expect(render(type)).toMatchObject({ text: '[Date?]', needsFoundation: true });
  });

  it('omits the return clause entirely for Void', () => {
    const diagnostics: Diagnostic[] = [];
    expect(renderReturnClause(irSamples.primitive('Void'), origin, diagnostics)).toMatchObject({ clause: '' });
    expect(renderReturnClause(irSamples.primitive('String'), origin, diagnostics)).toMatchObject({
      clause: ' -> String',
    });
  });

  it('reports CK0004 instead of throwing on an unrecognized type kind', () => {
    const diagnostics: Diagnostic[] = [];
    const bogus = { kind: 'bogus' } as unknown as IrType;
    const result = renderType(bogus, origin, diagnostics);
    expect(result.text).toBeTruthy();
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe('CK0004');
    expect(diagnostics[0]?.span).toBe(origin.span);
  });
});
