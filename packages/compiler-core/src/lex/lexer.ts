import { Diagnostic } from '../diagnostics/diagnostic';
import { DiagnosticCodes } from '../diagnostics/codes';
import { LineMap, SourceFileInput } from '../text/sourceFile';
import { Span } from '../text/span';
import { Token, TokenKind, keywordKinds } from '../syntax/tokens';

/**
 * The ClearKrypt lexer.
 *
 * Constitution (Document 5, Lexer law): every meaningful token carries a full
 * span (file, offsets, line, column), so diagnostics and visual mapping never
 * have to guess where source text came from. The lexer never throws: invalid
 * input becomes an `Unknown` token plus a diagnostic, and scanning continues
 * so the IDE keeps working on broken code (Document 5 §6).
 */

export interface LexOptions {
  /** When true, comments are emitted as `LineComment`/`BlockComment` tokens instead of being skipped. */
  readonly includeTrivia?: boolean;
}

export interface LexResult {
  readonly tokens: Token[];
  readonly diagnostics: Diagnostic[];
}

const TWO_CHAR_OPERATORS: Readonly<Record<string, TokenKind>> = {
  '->': 'Arrow',
  '<=': 'LessThanEquals',
  '>=': 'GreaterThanEquals',
  '==': 'EqualsEquals',
  '!=': 'BangEquals',
  '&&': 'AmpAmp',
  '||': 'PipePipe',
  '?.': 'QuestionDot',
  '??': 'QuestionQuestion',
};

const ONE_CHAR_OPERATORS: Readonly<Record<string, TokenKind>> = {
  '{': 'LeftBrace',
  '}': 'RightBrace',
  '(': 'LeftParen',
  ')': 'RightParen',
  '<': 'LessThan',
  '>': 'GreaterThan',
  '!': 'Bang',
  ':': 'Colon',
  ',': 'Comma',
  '.': 'Dot',
  '?': 'Question',
  '=': 'Equals',
  '+': 'Plus',
  '-': 'Minus',
  '*': 'Star',
  '/': 'Slash',
  '%': 'Percent',
  '@': 'At',
};

function isIdentifierStart(code: number): boolean {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95; // A-Z, a-z, _
}

function isIdentifierPart(code: number): boolean {
  return isIdentifierStart(code) || (code >= 48 && code <= 57); // ...0-9
}

function isDigit(code: number): boolean {
  return code >= 48 && code <= 57;
}

/**
 * Decodes a raw `StringLiteral` token's source text into its runtime value,
 * resolving `\" \\ \n \t \r` escapes. Shares the lexer's escape rules so a
 * string's decoded value always matches how the lexer scanned it, including
 * when the string was left unterminated (the AST still gets the best-effort
 * decoded prefix so parsing, and the IDE, can carry on).
 */
export function decodeStringLiteral(raw: string): string {
  let body = raw;
  if (body.startsWith('"')) {
    body = body.slice(1);
  }
  if (body.endsWith('"')) {
    body = body.slice(0, -1);
  }
  return decodeEscapes(body);
}

/**
 * Decodes one segment of an interpolated string. Raw segment shapes:
 * head `"text\(`, middle `)text\(`, tail `)text"`.
 */
export function decodeInterpolationSegment(raw: string): string {
  let body = raw;
  if (body.startsWith('"') || body.startsWith(')')) {
    body = body.slice(1);
  }
  if (body.endsWith('\\(')) {
    body = body.slice(0, -2);
  } else if (body.endsWith('"')) {
    body = body.slice(0, -1);
  }
  return decodeEscapes(body);
}

function decodeEscapes(body: string): string {
  let value = '';
  let i = 0;
  while (i < body.length) {
    const ch = body[i];
    if (ch === '\\' && i + 1 < body.length) {
      const next = body[i + 1];
      switch (next) {
        case '"':
          value += '"';
          break;
        case '\\':
          value += '\\';
          break;
        case 'n':
          value += '\n';
          break;
        case 't':
          value += '\t';
          break;
        case 'r':
          value += '\r';
          break;
        default:
          value += next ?? '';
          break;
      }
      i += 2;
      continue;
    }
    value += ch ?? '';
    i += 1;
  }
  return value;
}

export function lex(source: SourceFileInput, options: LexOptions = {}): LexResult {
  const { path, text } = source;
  const includeTrivia = options.includeTrivia ?? false;
  const lineMap = new LineMap(text);
  const tokens: Token[] = [];
  const diagnostics: Diagnostic[] = [];
  const length = text.length;
  let pos = 0;

  const spanOf = (start: number, end: number): Span => lineMap.span(path, start, end);

  const report = (code: string, message: string, span: Span): void => {
    diagnostics.push({ code, severity: 'error', message, span });
  };

  const push = (kind: TokenKind, start: number, end: number): void => {
    tokens.push({ kind, text: text.slice(start, end), span: spanOf(start, end) });
  };

  // Interpolated strings: `"a\(x)b"` lexes as Head `"a\(`, the expression's
  // normal tokens, then Tail `)b"` (or Middle `)b\(` when more parts follow).
  // Each entry tracks unclosed '(' inside the current interpolation so a
  // nested call's ')' doesn't end it. Nested strings nest naturally.
  const interpolationParens: number[] = [];

  /**
   * Scans string text starting at `start` (at the opening '"' or at the ')'
   * that resumed the string) and emits the right segment token. Returns the
   * position after the segment.
   */
  const scanStringSegment = (start: number): number => {
    let cursor = start + 1; // skip the '"' or ')'
    for (;;) {
      if (cursor >= length || text.charCodeAt(cursor) === 10) {
        report(
          DiagnosticCodes.UnterminatedString,
          'Unterminated string literal. Add a closing \'"\' before the end of the line.',
          spanOf(start, cursor),
        );
        push(
          text.charCodeAt(start) === 34 ? 'StringLiteral' : 'StringInterpolationTail',
          start,
          cursor,
        );
        return cursor;
      }
      const c = text.charCodeAt(cursor);
      if (c === 34 /* " */) {
        cursor++;
        push(text.charCodeAt(start) === 34 ? 'StringLiteral' : 'StringInterpolationTail', start, cursor);
        return cursor;
      }
      if (c === 92 /* \ */ && text.charCodeAt(cursor + 1) === 40 /* ( */) {
        cursor += 2;
        push(
          text.charCodeAt(start) === 34 ? 'StringInterpolationHead' : 'StringInterpolationMiddle',
          start,
          cursor,
        );
        interpolationParens.push(0);
        return cursor;
      }
      if (c === 92 && cursor + 1 < length && text.charCodeAt(cursor + 1) !== 10) {
        cursor += 2; // ordinary escape; an escaped quote can't end the string
        continue;
      }
      cursor++;
    }
  };

  while (pos < length) {
    const start = pos;
    const code = text.charCodeAt(pos);

    // Whitespace, including newlines. Newlines are not tokens; the parser
    // consults a token's `span.startLine` where the grammar needs it (the
    // bare-return rule).
    if (code === 32 || code === 9 || code === 13 || code === 10) {
      pos++;
      continue;
    }

    // Line comment.
    if (code === 47 /* / */ && text.charCodeAt(pos + 1) === 47) {
      pos += 2;
      while (pos < length && text.charCodeAt(pos) !== 10) {
        pos++;
      }
      if (includeTrivia) {
        push('LineComment', start, pos);
      }
      continue;
    }

    // Block comment (non-nesting).
    if (code === 47 && text.charCodeAt(pos + 1) === 42 /* * */) {
      pos += 2;
      let terminated = false;
      while (pos < length) {
        if (text.charCodeAt(pos) === 42 && text.charCodeAt(pos + 1) === 47) {
          pos += 2;
          terminated = true;
          break;
        }
        pos++;
      }
      if (!terminated) {
        report(
          DiagnosticCodes.UnterminatedBlockComment,
          "Unterminated block comment. Add a closing '*/' to end the comment that starts here.",
          spanOf(start, pos),
        );
      }
      if (includeTrivia) {
        push('BlockComment', start, pos);
      }
      continue;
    }

    // String literal, plain or interpolated.
    if (code === 34 /* " */) {
      pos = scanStringSegment(pos);
      continue;
    }

    // Parentheses inside an active interpolation: balance them so the ')'
    // that ends the interpolation is recognized, then resume string mode.
    if (interpolationParens.length > 0 && code === 40 /* ( */) {
      interpolationParens[interpolationParens.length - 1]!++;
      push('LeftParen', pos, pos + 1);
      pos += 1;
      continue;
    }
    if (interpolationParens.length > 0 && code === 41 /* ) */) {
      const depth = interpolationParens[interpolationParens.length - 1]!;
      if (depth > 0) {
        interpolationParens[interpolationParens.length - 1] = depth - 1;
        push('RightParen', pos, pos + 1);
        pos += 1;
        continue;
      }
      interpolationParens.pop();
      pos = scanStringSegment(pos);
      continue;
    }

    // Numbers: digits, or digits '.' digits for a float. No exponents, no leading dots (future work).
    if (isDigit(code)) {
      pos++;
      while (pos < length && isDigit(text.charCodeAt(pos))) {
        pos++;
      }
      let kind: TokenKind = 'IntLiteral';
      if (text.charCodeAt(pos) === 46 /* . */ && isDigit(text.charCodeAt(pos + 1))) {
        kind = 'FloatLiteral';
        pos++; // consume '.'
        while (pos < length && isDigit(text.charCodeAt(pos))) {
          pos++;
        }
      }
      push(kind, start, pos);
      continue;
    }

    // Identifiers and keywords.
    if (isIdentifierStart(code)) {
      pos++;
      while (pos < length && isIdentifierPart(text.charCodeAt(pos))) {
        pos++;
      }
      const word = text.slice(start, pos);
      push(keywordKinds[word] ?? 'Identifier', start, pos);
      continue;
    }

    // Two-character operators (checked before their one-character prefixes, e.g. '->' before '-').
    const twoChar = text.slice(pos, pos + 2);
    const twoCharKind = TWO_CHAR_OPERATORS[twoChar];
    if (twoCharKind !== undefined) {
      push(twoCharKind, pos, pos + 2);
      pos += 2;
      continue;
    }

    // Single-character punctuation and operators.
    const oneChar = text[pos] ?? '';
    const oneCharKind = ONE_CHAR_OPERATORS[oneChar];
    if (oneCharKind !== undefined) {
      push(oneCharKind, pos, pos + 1);
      pos += 1;
      continue;
    }

    // Anything else (a lone '&' or '|', or a genuinely unrecognized character) is invalid.
    report(
      DiagnosticCodes.InvalidCharacter,
      `Invalid character '${oneChar}'. ClearKrypt doesn't recognize this character here; remove it or replace it with valid syntax.`,
      spanOf(pos, pos + 1),
    );
    push('Unknown', pos, pos + 1);
    pos += 1;
  }

  tokens.push({ kind: 'EndOfFile', text: '', span: spanOf(length, length) });
  return { tokens, diagnostics };
}
