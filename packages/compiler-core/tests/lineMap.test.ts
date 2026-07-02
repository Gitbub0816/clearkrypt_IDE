import { describe, expect, it } from 'vitest';
import { LineMap, unionSpan } from '@clearkrypt/compiler-core';

describe('LineMap', () => {
  it('maps offsets to one-based line and column positions', () => {
    const map = new LineMap('module app.main\n\nmodel User {\n}\n');
    expect(map.position(0)).toEqual({ line: 1, column: 1 });
    expect(map.position(7)).toEqual({ line: 1, column: 8 });
    expect(map.position(16)).toEqual({ line: 2, column: 1 });
    expect(map.position(17)).toEqual({ line: 3, column: 1 });
  });

  it('builds spans with file, offsets, lines, and columns', () => {
    const map = new LineMap('model User {\n  id: ID\n}\n');
    const span = map.span('src/main.ck', 15, 17);
    expect(span).toEqual({
      file: 'src/main.ck',
      start: 15,
      end: 17,
      startLine: 2,
      startColumn: 3,
      endLine: 2,
      endColumn: 5,
    });
  });

  it('unions spans across lines', () => {
    const map = new LineMap('model User {\n  id: ID\n}\n');
    const a = map.span('f.ck', 0, 5);
    const b = map.span('f.ck', 22, 23);
    const union = unionSpan(a, b);
    expect(union.start).toBe(0);
    expect(union.end).toBe(23);
    expect(union.startLine).toBe(1);
    expect(union.endLine).toBe(3);
  });
});
