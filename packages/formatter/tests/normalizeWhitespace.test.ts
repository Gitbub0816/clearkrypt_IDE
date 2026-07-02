import { describe, expect, it } from 'vitest';
import { normalizeWhitespace } from '@clearkrypt/formatter';

describe('normalizeWhitespace', () => {
  it('strips trailing whitespace and enforces one final newline', () => {
    const result = normalizeWhitespace('model User {  \n  id: ID\t\n}');
    expect(result.text).toBe('model User {\n  id: ID\n}\n');
    expect(result.changed).toBe(true);
  });

  it('leaves already-normalized text unchanged', () => {
    const text = 'module app.main\n';
    const result = normalizeWhitespace(text);
    expect(result.text).toBe(text);
    expect(result.changed).toBe(false);
  });

  it('collapses multiple trailing newlines to one', () => {
    const result = normalizeWhitespace('module app.main\n\n\n');
    expect(result.text).toBe('module app.main\n');
  });
});
