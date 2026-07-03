import { describe, expect, it } from 'vitest';
import { decodeStringLiteral, lex, printTokens } from '@clearkrypt/compiler-core';

describe('lex', () => {
  it('produces a token snapshot for a representative source file', () => {
    const text = [
      'module app.text',
      '',
      'fn fullName(first: String, last: String) -> String {',
      '  return first + " " + last',
      '}',
      '',
    ].join('\n');
    const { tokens, diagnostics } = lex({ path: 'sample.ck', text });
    expect(diagnostics).toEqual([]);
    expect(printTokens(tokens)).toMatchSnapshot();
  });

  it('gives every token a full file/line/column span', () => {
    const text = 'module app.main\n\nmodel User {\n}\n';
    const { tokens } = lex({ path: 'src/main.ck', text });

    expect(tokens[0]).toMatchObject({
      kind: 'KwModule',
      text: 'module',
      span: { file: 'src/main.ck', start: 0, end: 6, startLine: 1, startColumn: 1, endLine: 1, endColumn: 7 },
    });

    const modelToken = tokens.find((t) => t.kind === 'KwModel');
    expect(modelToken).toMatchObject({
      text: 'model',
      span: { startLine: 3, startColumn: 1, endLine: 3, endColumn: 6 },
    });

    const last = tokens[tokens.length - 1];
    expect(last?.kind).toBe('EndOfFile');
    expect(last?.span.start).toBe(text.length);
  });

  it('always ends with a single EndOfFile token, even for empty input', () => {
    const { tokens } = lex({ path: 'empty.ck', text: '' });
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.kind).toBe('EndOfFile');
  });

  it('recognizes -> before falling back to Minus', () => {
    const { tokens } = lex({ path: 't.ck', text: 'a -> b - c' });
    expect(tokens.map((t) => t.kind)).toEqual(['Identifier', 'Arrow', 'Identifier', 'Minus', 'Identifier', 'EndOfFile']);
  });

  it('recognizes every multi-character operator', () => {
    const { tokens, diagnostics } = lex({ path: 't.ck', text: '<= >= == != && ||' });
    expect(diagnostics).toEqual([]);
    expect(tokens.map((t) => t.kind)).toEqual([
      'LessThanEquals',
      'GreaterThanEquals',
      'EqualsEquals',
      'BangEquals',
      'AmpAmp',
      'PipePipe',
      'EndOfFile',
    ]);
  });

  it('lexes keywords distinctly from identifiers', () => {
    const { tokens } = lex({ path: 't.ck', text: 'model title fn' });
    // 'title' is a contextual identifier, not a keyword.
    expect(tokens.map((t) => t.kind)).toEqual(['KwModel', 'Identifier', 'KwFn', 'EndOfFile']);
  });

  it('lexes ints and floats, with no leading-dot floats', () => {
    const { tokens } = lex({ path: 't.ck', text: '42 3.14 5.' });
    expect(tokens[0]).toMatchObject({ kind: 'IntLiteral', text: '42' });
    expect(tokens[1]).toMatchObject({ kind: 'FloatLiteral', text: '3.14' });
    // '5.' has no digit after the dot, so it's an IntLiteral followed by a Dot.
    expect(tokens[2]).toMatchObject({ kind: 'IntLiteral', text: '5' });
    expect(tokens[3]).toMatchObject({ kind: 'Dot' });
  });

  describe('string escapes', () => {
    it('decodes \\" \\\\ \\n \\t \\r', () => {
      const raw = String.raw`"a\"b\\c\nd\te\rf"`;
      const { tokens, diagnostics } = lex({ path: 't.ck', text: raw });
      expect(diagnostics).toEqual([]);
      expect(tokens[0]?.kind).toBe('StringLiteral');
      expect(tokens[0]?.text).toBe(raw);
      expect(decodeStringLiteral(tokens[0]!.text)).toBe('a"b\\c\nd\te\rf');
    });

    it('does not end the string early on an escaped quote', () => {
      const raw = String.raw`"a\"b"`;
      const { tokens, diagnostics } = lex({ path: 't.ck', text: raw });
      expect(diagnostics).toEqual([]);
      expect(tokens).toHaveLength(2); // StringLiteral + EndOfFile
      expect(tokens[0]?.text).toBe(raw);
    });

    it('does not let a backslash escape a real newline', () => {
      const text = '"abc\\\ndef';
      const { tokens, diagnostics } = lex({ path: 't.ck', text });
      expect(diagnostics.map((d) => d.code)).toEqual(['CK1002']);
      expect(tokens[0]?.kind).toBe('StringLiteral');
      expect(tokens[0]?.span.startLine).toBe(1);
      expect(tokens[0]?.span.endLine).toBe(1);
    });
  });

  describe('diagnostics', () => {
    it('CK1002: reports an unterminated string ended by a newline', () => {
      const { tokens, diagnostics } = lex({ path: 't.ck', text: '"oops\nmore' });
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.code).toBe('CK1002');
      expect(diagnostics[0]?.span.startLine).toBe(1);
      expect(tokens[0]?.kind).toBe('StringLiteral');
      expect(tokens[0]?.text).toBe('"oops');
    });

    it('CK1002: reports an unterminated string ended by EOF', () => {
      const { diagnostics } = lex({ path: 't.ck', text: '"oops' });
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.code).toBe('CK1002');
    });

    it('CK1003: reports an invalid character and keeps scanning', () => {
      const { tokens, diagnostics } = lex({ path: 't.ck', text: 'let x = 1 & 2' });
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.code).toBe('CK1003');
      // Scanning continues past the bad character.
      expect(tokens.map((t) => t.kind)).toEqual([
        'KwLet',
        'Identifier',
        'Equals',
        'IntLiteral',
        'Unknown',
        'IntLiteral',
        'EndOfFile',
      ]);
    });

    it('CK1003: a lone | is invalid (only || is a valid operator)', () => {
      const { diagnostics } = lex({ path: 't.ck', text: 'a | b' });
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.code).toBe('CK1003');
    });

    it('CK1005: reports an unterminated block comment', () => {
      const { diagnostics } = lex({ path: 't.ck', text: 'comment\nnever closed\nstill going' });
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.code).toBe('CK1005');
    });
  });

  describe('trivia', () => {
    it('skips comments by default', () => {
      const { tokens } = lex({ path: 't.ck', text: 'comment: hello\nmodel comment mid end comment Foo' });
      expect(tokens.map((t) => t.kind)).toEqual(['KwModel', 'Identifier', 'EndOfFile']);
    });

    it('emits LineComment and BlockComment tokens when includeTrivia is set', () => {
      const { tokens } = lex(
        { path: 't.ck', text: 'comment: hello\ncomment\nworld\nend comment\nmodel' },
        { includeTrivia: true },
      );
      expect(tokens.map((t) => t.kind)).toEqual(['LineComment', 'BlockComment', 'KwModel', 'EndOfFile']);
      expect(tokens[0]?.text).toBe('comment: hello');
      expect(tokens[1]?.text).toBe('comment\nworld\nend comment');
    });

    it('never treats "comment" as an ordinary identifier, even mid-expression', () => {
      const { tokens } = lex({ path: 't.ck', text: 'let x = 1 comment: trailing note' });
      expect(tokens.map((t) => t.kind)).toEqual([
        'KwLet',
        'Identifier',
        'Equals',
        'IntLiteral',
        'EndOfFile',
      ]);
    });

    it('does not treat "commenting" or "recommend end comment" as comment keywords', () => {
      const { tokens } = lex({ path: 't.ck', text: 'let commenting = recommend' });
      expect(tokens.map((t) => t.kind)).toEqual([
        'KwLet',
        'Identifier',
        'Equals',
        'Identifier',
        'EndOfFile',
      ]);
    });
  });
});
