import { Diagnostic } from '../diagnostics/diagnostic';
import { DiagnosticCodes } from '../diagnostics/codes';
import { LineMap, SourceFileInput } from '../text/sourceFile';
import { Span, unionSpan } from '../text/span';
import { Token, TokenKind } from '../syntax/tokens';
import { decodeInterpolationSegment, decodeStringLiteral, lex } from '../lex/lexer';
import {
  Argument,
  BinaryOperator,
  Block,
  CapabilityDecl,
  CaseDecl,
  ComponentDecl,
  Declaration,
  EnumDecl,
  ErrorDecl,
  Expression,
  FieldDecl,
  FunctionDecl,
  IfLetStatement,
  IfStatement,
  ImportDecl,
  InterpolatedStringExpression,
  LetStatement,
  MatchArm,
  MatchExpression,
  ModelDecl,
  ModuleDecl,
  NameNode,
  NativeFunctionDecl,
  NativeTarget,
  ParamDecl,
  RawNativeBody,
  ReturnStatement,
  RouteBinding,
  RouteDecl,
  RouteSegment,
  ScreenDecl,
  SourceFileNode,
  Statement,
  StringLiteral,
  StringTextPart,
  ThrowStatement,
  TypeRef,
  UiElement,
  UnaryOperator,
} from '../syntax/ast';

/**
 * The ClearKrypt parser.
 *
 * Constitution (Document 5, Parser law): the parser must never throw. It
 * always returns a (possibly partial) `SourceFileNode` plus diagnostics, so
 * the IDE keeps working while the user is mid-edit. Every recovery path below
 * is built to guarantee forward progress through the token stream — no loop
 * here can spin forever, even on truncated or garbage input.
 */

export interface ParseResult {
  readonly file: SourceFileNode;
  readonly diagnostics: Diagnostic[];
}

export function parseSource(source: SourceFileInput): ParseResult {
  const lexResult = lex(source);
  const parser = new Parser(source, lexResult.tokens);
  const file = parser.parseFile();
  // Diagnostics the plain ClearKrypt lexer raised while scanning *inside* a
  // native raw body (e.g. Swift/Kotlin/TS syntax the ClearKrypt lexer
  // doesn't understand) are artifacts of tokenizing foreign code with our
  // lexer, not real ClearKrypt syntax errors — see `scanRawNativeBody`.
  const lexDiagnostics = lexResult.diagnostics.filter((d) => !parser.isInsideNativeRawBlock(d.span));
  return { file, diagnostics: [...lexDiagnostics, ...parser.diagnostics] };
}

/** Top-level keywords the parser resyncs to after a declaration-level error. */
const TOP_LEVEL_SYNC_KINDS = new Set<TokenKind>([
  'KwModule',
  'KwImport',
  'KwModel',
  'KwEnum',
  'KwError',
  'KwCapability',
  'KwFn',
  'KwComponent',
  'KwScreen',
  'KwRoute',
  'KwNative',
]);

/** Keywords reserved for future milestones; not part of the MVP grammar. */
const RESERVED_FUTURE_KINDS = new Set<TokenKind>([
  'KwEffect',
  'KwFor',
  'KwWhile',
  'KwCatch',
  'KwPublic',
  'KwPrivate',
  'KwInternal',
]);

/** Describes a token for teacherly diagnostic messages. */
function describeToken(token: Token): string {
  if (token.kind === 'EndOfFile') {
    return 'end of file';
  }
  return `'${token.text}'`;
}

class Parser {
  readonly diagnostics: Diagnostic[] = [];

  private readonly path: string;
  private readonly sourceText: string;
  private readonly lineMap: LineMap;
  private readonly eof: Token;
  private readonly nativeRawRanges: Array<{ start: number; end: number }> = [];
  private pos = 0;

  constructor(source: SourceFileInput, private readonly tokens: readonly Token[]) {
    this.path = source.path;
    this.sourceText = source.text;
    this.lineMap = new LineMap(source.text);
    this.eof = tokens[tokens.length - 1] ?? {
      kind: 'EndOfFile',
      text: '',
      span: this.lineMap.span(this.path, source.text.length, source.text.length),
    };
  }

  isInsideNativeRawBlock(span: Span): boolean {
    return this.nativeRawRanges.some((range) => span.start >= range.start && span.end <= range.end);
  }

  // -------------------------------------------------------------------------
  // Token stream primitives
  // -------------------------------------------------------------------------

  private current(): Token {
    return this.tokens[this.pos] ?? this.eof;
  }

  private peek(offset: number): Token {
    return this.tokens[this.pos + offset] ?? this.eof;
  }

  private isAtEnd(): boolean {
    return this.current().kind === 'EndOfFile';
  }

  private advance(): Token {
    const tok = this.current();
    if (tok.kind !== 'EndOfFile') {
      this.pos++;
    }
    return tok;
  }

  private firstToken(): Token {
    return this.tokens[0] ?? this.eof;
  }

  private addDiagnostic(code: string, message: string, span: Span): void {
    this.diagnostics.push({ code, severity: 'error', message, span });
  }

  /** Consumes `kind` if present; otherwise reports and leaves the token unconsumed for recovery. */
  private expect(kind: TokenKind, message: string, code: string = DiagnosticCodes.UnexpectedToken): Token {
    const tok = this.current();
    if (tok.kind === kind) {
      this.advance();
      return tok;
    }
    this.addDiagnostic(code, message, tok.span);
    return tok;
  }

  private expectIdentifier(description: string): Token {
    const tok = this.current();
    if (tok.kind === 'Identifier') {
      this.advance();
      return tok;
    }
    this.addDiagnostic(
      DiagnosticCodes.UnexpectedToken,
      `Expected ${description}, but found ${describeToken(tok)}.`,
      tok.span,
    );
    return tok;
  }

  private nameNode(tok: Token): NameNode {
    return { kind: 'Name', text: tok.text, span: tok.span };
  }

  // -------------------------------------------------------------------------
  // Recovery
  // -------------------------------------------------------------------------

  /** Skips at least one token, then continues until the next likely declaration start or EOF. */
  private recoverToDeclarationStart(): void {
    if (this.isAtEnd()) return;
    this.advance();
    while (!this.isAtEnd() && !TOP_LEVEL_SYNC_KINDS.has(this.current().kind)) {
      this.advance();
    }
  }

  /** Skips at least one token, then continues until a plausible statement start, '}', or EOF. */
  private recoverInsideBlock(): void {
    if (this.isAtEnd()) return;
    this.advance();
    while (
      !this.isAtEnd() &&
      this.current().kind !== 'RightBrace' &&
      !this.startsStatement(this.current().kind) &&
      !RESERVED_FUTURE_KINDS.has(this.current().kind)
    ) {
      this.advance();
    }
  }

  private reportReservedKeyword(): void {
    const tok = this.current();
    this.addDiagnostic(
      DiagnosticCodes.UnexpectedToken,
      `'${tok.text}' is reserved for a future ClearKrypt milestone and isn't part of the language yet. ` +
        `Remove it or restructure this code without '${tok.text}'.`,
      tok.span,
    );
  }

  // -------------------------------------------------------------------------
  // SourceFile := ModuleDecl? ImportDecl* Declaration* EOF
  // -------------------------------------------------------------------------

  parseFile(): SourceFileNode {
    let module: ModuleDecl | undefined;
    const imports: ImportDecl[] = [];
    const declarations: Declaration[] = [];

    while (!this.isAtEnd()) {
      const before = this.pos;
      const kind = this.current().kind;

      if (kind === 'KwModule') {
        const decl = this.parseModuleDecl();
        if (module) {
          this.addDiagnostic(
            DiagnosticCodes.DuplicateModule,
            `A file can only declare one module. This file already declared module '${module.name}'; ` +
              `the extra 'module ${decl.name}' declaration is ignored.`,
            decl.span,
          );
        } else {
          module = decl;
        }
      } else if (kind === 'KwImport') {
        imports.push(this.parseImportDecl());
      } else {
        const decl = this.tryParseDeclaration();
        if (decl) {
          declarations.push(decl);
        } else if (RESERVED_FUTURE_KINDS.has(kind)) {
          this.reportReservedKeyword();
          this.recoverToDeclarationStart();
        } else {
          this.addDiagnostic(
            DiagnosticCodes.ExpectedDeclaration,
            'Expected a declaration (module, import, model, enum, error, capability, fn, component, screen, ' +
              `route, or native), but found ${describeToken(this.current())}.`,
            this.current().span,
          );
          this.recoverToDeclarationStart();
        }
      }

      if (this.pos === before) {
        this.advance(); // Safety net: guarantee forward progress no matter what.
      }
    }

    return {
      kind: 'SourceFile',
      path: this.path,
      module,
      imports,
      declarations,
      span: unionSpan(this.firstToken().span, this.eof.span),
    };
  }

  private parseDottedName(): { text: string; span: Span } {
    const first = this.expectIdentifier('a name');
    let text = first.text;
    let lastSpan = first.span;
    while (this.current().kind === 'Dot') {
      this.advance();
      const next = this.expectIdentifier('a name segment after .');
      text += `.${next.text}`;
      lastSpan = next.span;
    }
    return { text, span: unionSpan(first.span, lastSpan) };
  }

  private parseModuleDecl(): ModuleDecl {
    const kw = this.advance();
    const { text, span: nameSpan } = this.parseDottedName();
    return { kind: 'ModuleDecl', name: text, span: unionSpan(kw.span, nameSpan) };
  }

  private parseImportDecl(): ImportDecl {
    const kw = this.advance();
    const { text, span: nameSpan } = this.parseDottedName();
    return { kind: 'ImportDecl', path: text, span: unionSpan(kw.span, nameSpan) };
  }

  private tryParseDeclaration(): Declaration | undefined {
    switch (this.current().kind) {
      case 'KwModel':
        return this.parseModelDecl();
      case 'KwEnum':
        return this.parseEnumDecl();
      case 'KwError':
        return this.parseErrorDecl();
      case 'KwCapability':
        return this.parseCapabilityDecl();
      case 'KwFn':
        return this.parseFunctionDecl();
      case 'KwComponent':
        return this.parseComponentDecl();
      case 'KwScreen':
        return this.parseScreenDecl();
      case 'KwRoute':
        return this.parseRouteDecl();
      case 'KwNative':
        return this.parseNativeFunctionDecl();
      default:
        return undefined;
    }
  }

  // -------------------------------------------------------------------------
  // Shared: braced member lists (model fields, enum/error cases)
  // -------------------------------------------------------------------------

  /**
   * Parses `member*` up to (and including) a closing '}'. `isMemberStart`
   * gates entry into `parseMember` so a single unrecognized token produces
   * exactly one diagnostic instead of cascading into `parseMember`'s own
   * internal expectations.
   */
  private parseBracedMembers<T>(
    parseMember: () => T,
    isMemberStart: (kind: TokenKind) => boolean,
    unexpectedMessage: (tok: Token) => string,
  ): { items: T[]; close: Token } {
    const items: T[] = [];
    while (!this.isAtEnd() && this.current().kind !== 'RightBrace') {
      if (!isMemberStart(this.current().kind)) {
        this.addDiagnostic(DiagnosticCodes.UnexpectedToken, unexpectedMessage(this.current()), this.current().span);
        this.advance();
        continue;
      }
      const before = this.pos;
      items.push(parseMember());
      if (this.pos === before) {
        this.advance();
      }
    }
    const close = this.expect('RightBrace', `Expected '}' to close the block, but found ${describeToken(this.current())}.`);
    return { items, close };
  }

  /** Parses a comma-separated list of items until `isEnd()` holds. */
  private parseCommaSeparated<T>(isEnd: () => boolean, parseItem: () => T): T[] {
    const items: T[] = [];
    if (isEnd()) {
      return items;
    }
    items.push(parseItem());
    while (this.current().kind === 'Comma') {
      this.advance();
      items.push(parseItem());
    }
    return items;
  }

  // -------------------------------------------------------------------------
  // ModelDecl := 'model' Identifier '{' FieldDecl* '}'
  // FieldDecl := Identifier ':' Type ('=' Expression)?
  // -------------------------------------------------------------------------

  private parseModelDecl(): ModelDecl {
    const kw = this.advance();
    const nameTok = this.expectIdentifier('a model name');
    this.expect('LeftBrace', `Expected '{' to start the body of model '${nameTok.text}'.`);
    const { items: fields, close } = this.parseBracedMembers(
      () => this.parseFieldDecl(),
      (kind) => kind === 'Identifier',
      (tok) => `Expected a field declaration like 'name: Type', but found ${describeToken(tok)}.`,
    );
    return { kind: 'ModelDecl', name: this.nameNode(nameTok), fields, span: unionSpan(kw.span, close.span) };
  }

  private parseFieldDecl(): FieldDecl {
    const nameTok = this.expectIdentifier('a field name');
    this.expect(
      'Colon',
      `Expected ':' followed by a type, like '${nameTok.text}: Type', but found ${describeToken(this.current())}.`,
    );
    const type = this.parseType();
    let defaultValue: Expression | undefined;
    if (this.current().kind === 'Equals') {
      this.advance();
      defaultValue = this.parseExpression();
    }
    return {
      kind: 'FieldDecl',
      name: this.nameNode(nameTok),
      type,
      defaultValue,
      span: unionSpan(nameTok.span, defaultValue?.span ?? type.span),
    };
  }

  // -------------------------------------------------------------------------
  // EnumDecl / ErrorDecl := ('enum'|'error') Identifier '{' CaseDecl* '}'
  // CaseDecl := Identifier ('(' ParamList ')')?
  // -------------------------------------------------------------------------

  private parseEnumDecl(): EnumDecl {
    const kw = this.advance();
    const nameTok = this.expectIdentifier('an enum name');
    this.expect('LeftBrace', `Expected '{' to start the body of enum '${nameTok.text}'.`);
    const { items: cases, close } = this.parseBracedMembers(
      () => this.parseCaseDecl(),
      (kind) => kind === 'Identifier',
      (tok) => `Expected a case name, but found ${describeToken(tok)}.`,
    );
    return { kind: 'EnumDecl', name: this.nameNode(nameTok), cases, span: unionSpan(kw.span, close.span) };
  }

  private parseErrorDecl(): ErrorDecl {
    const kw = this.advance();
    const nameTok = this.expectIdentifier('an error name');
    this.expect('LeftBrace', `Expected '{' to start the body of error '${nameTok.text}'.`);
    const { items: cases, close } = this.parseBracedMembers(
      () => this.parseCaseDecl(),
      (kind) => kind === 'Identifier',
      (tok) => `Expected a case name, but found ${describeToken(tok)}.`,
    );
    return { kind: 'ErrorDecl', name: this.nameNode(nameTok), cases, span: unionSpan(kw.span, close.span) };
  }

  private parseCaseDecl(): CaseDecl {
    const nameTok = this.expectIdentifier('a case name');
    let params: ParamDecl[] = [];
    let endSpan = nameTok.span;
    if (this.current().kind === 'LeftParen') {
      this.advance();
      params = this.parseParamList();
      const close = this.expect(
        'RightParen',
        `Expected ')' to close the parameters for case '${nameTok.text}', but found ${describeToken(this.current())}.`,
      );
      endSpan = close.span;
    }
    return { kind: 'CaseDecl', name: this.nameNode(nameTok), params, span: unionSpan(nameTok.span, endSpan) };
  }

  // -------------------------------------------------------------------------
  // CapabilityDecl := 'capability' Identifier
  // -------------------------------------------------------------------------

  private parseCapabilityDecl(): CapabilityDecl {
    const kw = this.advance();
    const nameTok = this.expectIdentifier('a capability name');
    return { kind: 'CapabilityDecl', name: this.nameNode(nameTok), span: unionSpan(kw.span, nameTok.span) };
  }

  // -------------------------------------------------------------------------
  // Params: ParamList := Param (',' Param)* ; Param := Identifier ':' Type ('=' Expression)?
  // -------------------------------------------------------------------------

  private parseParamList(): ParamDecl[] {
    return this.parseCommaSeparated(
      () => this.current().kind === 'RightParen',
      () => this.parseParam(),
    );
  }

  private parseParam(): ParamDecl {
    if (this.current().kind !== 'Identifier') {
      // Report once and bail without a name/colon/type cascade; the caller's
      // comma/close-paren handling takes it from here.
      const tok = this.current();
      this.addDiagnostic(
        DiagnosticCodes.UnexpectedToken,
        `Expected a parameter like 'name: Type', but found ${describeToken(tok)}.`,
        tok.span,
      );
      return {
        kind: 'ParamDecl',
        name: { kind: 'Name', text: '', span: tok.span },
        type: { kind: 'NamedType', name: '', typeArgs: [], span: tok.span },
        span: tok.span,
      };
    }
    const nameTok = this.advance();
    this.expect(
      'Colon',
      `Expected ':' followed by a type for parameter '${nameTok.text}', but found ${describeToken(this.current())}.`,
    );
    const type = this.parseType();
    let defaultValue: Expression | undefined;
    if (this.current().kind === 'Equals') {
      this.advance();
      defaultValue = this.parseExpression();
    }
    return {
      kind: 'ParamDecl',
      name: this.nameNode(nameTok),
      type,
      defaultValue,
      span: unionSpan(nameTok.span, defaultValue?.span ?? type.span),
    };
  }

  // -------------------------------------------------------------------------
  // Types: Type := PrimaryType '?'*  ;  PrimaryType := Identifier ('<' Type (',' Type)* '>')?
  // -------------------------------------------------------------------------

  private parseType(): TypeRef {
    let type = this.parsePrimaryType();
    while (this.current().kind === 'Question') {
      const q = this.advance();
      type = { kind: 'OptionalType', inner: type, span: unionSpan(type.span, q.span) };
    }
    return type;
  }

  private parsePrimaryType(): TypeRef {
    const nameTok = this.current();
    if (nameTok.kind !== 'Identifier') {
      this.addDiagnostic(
        DiagnosticCodes.ExpectedType,
        `Expected a type, but found ${describeToken(nameTok)}. Types look like 'String', 'User', or 'List<Item>'.`,
        nameTok.span,
      );
      return { kind: 'NamedType', name: '', typeArgs: [], span: nameTok.span };
    }
    this.advance();
    let typeArgs: TypeRef[] = [];
    let endSpan = nameTok.span;
    if (this.current().kind === 'LessThan') {
      this.advance();
      typeArgs = this.parseCommaSeparated(
        () => this.current().kind === 'GreaterThan',
        () => this.parseType(),
      );
      const close = this.expect(
        'GreaterThan',
        `Expected '>' to close the type arguments for '${nameTok.text}', but found ${describeToken(this.current())}.`,
      );
      endSpan = close.span;
    }
    return { kind: 'NamedType', name: nameTok.text, typeArgs, span: unionSpan(nameTok.span, endSpan) };
  }

  // -------------------------------------------------------------------------
  // FunctionDecl := 'fn' Identifier '(' ParamList? ')' Requires? 'async'? ('throws' Type)? ('->' Type)? Block
  // -------------------------------------------------------------------------

  private parseFunctionDecl(): FunctionDecl {
    const kw = this.advance();
    const nameTok = this.expectIdentifier('a function name');
    this.expect('LeftParen', `Expected '(' to start the parameters of function '${nameTok.text}'.`);
    const params = this.parseParamList();
    this.expect(
      'RightParen',
      `Expected ')' to close the parameters of function '${nameTok.text}', but found ${describeToken(this.current())}.`,
    );
    const requiresCapabilities = this.parseOptionalRequires();
    const isAsync = this.consumeOptional('KwAsync');
    const throwsType = this.parseOptionalThrows();
    const returnType = this.parseOptionalReturnType();
    const body = this.parseBlock();
    return {
      kind: 'FunctionDecl',
      name: this.nameNode(nameTok),
      params,
      returnType,
      isAsync,
      throwsType,
      requiresCapabilities,
      body,
      span: unionSpan(kw.span, body.span),
    };
  }

  private consumeOptional(kind: TokenKind): boolean {
    if (this.current().kind === kind) {
      this.advance();
      return true;
    }
    return false;
  }

  private parseOptionalRequires(): NameNode[] {
    if (this.current().kind !== 'KwRequires') {
      return [];
    }
    this.advance();
    const names: NameNode[] = [this.nameNode(this.expectIdentifier('a capability name'))];
    while (this.current().kind === 'Comma') {
      this.advance();
      names.push(this.nameNode(this.expectIdentifier('a capability name')));
    }
    return names;
  }

  private parseOptionalThrows(): TypeRef | undefined {
    if (this.current().kind !== 'KwThrows') {
      return undefined;
    }
    this.advance();
    return this.parseType();
  }

  private parseOptionalReturnType(): TypeRef | undefined {
    if (this.current().kind !== 'Arrow') {
      return undefined;
    }
    this.advance();
    return this.parseType();
  }

  // -------------------------------------------------------------------------
  // Block := '{' Statement* '}'
  // -------------------------------------------------------------------------

  private parseBlock(): Block {
    const open = this.expect('LeftBrace', `Expected '{' to start a block, but found ${describeToken(this.current())}.`);
    const statements: Statement[] = [];
    while (!this.isAtEnd() && this.current().kind !== 'RightBrace') {
      const kind = this.current().kind;
      if (RESERVED_FUTURE_KINDS.has(kind)) {
        this.reportReservedKeyword();
        this.recoverInsideBlock();
        continue;
      }
      if (!this.startsStatement(kind)) {
        this.addDiagnostic(
          DiagnosticCodes.UnexpectedToken,
          `Expected a statement, but found ${describeToken(this.current())}.`,
          this.current().span,
        );
        this.recoverInsideBlock();
        continue;
      }
      const before = this.pos;
      statements.push(this.parseStatement());
      if (this.pos === before) {
        this.advance(); // Safety net: guarantee forward progress no matter what.
      }
    }
    const close = this.expect('RightBrace', `Expected '}' to close the block, but found ${describeToken(this.current())}.`);
    return { kind: 'Block', statements, span: unionSpan(open.span, close.span) };
  }

  private startsStatement(kind: TokenKind): boolean {
    return (
      kind === 'KwLet' ||
      kind === 'KwVar' ||
      kind === 'KwReturn' ||
      kind === 'KwIf' ||
      kind === 'KwThrow' ||
      kind === 'KwFn' ||
      this.startsExpression(kind)
    );
  }

  private parseStatement(): Statement {
    const kind = this.current().kind;
    if (kind === 'KwLet' || kind === 'KwVar') return this.parseLetStatement();
    if (kind === 'KwReturn') return this.parseReturnStatement();
    if (kind === 'KwIf') return this.parseIfLike();
    if (kind === 'KwThrow') return this.parseThrowStatement();
    if (kind === 'KwFn') return this.parseFunctionDecl();
    const expression = this.parseExpression();
    return { kind: 'ExpressionStatement', expression, span: expression.span };
  }

  // LetStatement := ('let'|'var') Identifier (':' Type)? '=' Expression
  private parseLetStatement(): LetStatement {
    const kw = this.advance();
    const mutable = kw.kind === 'KwVar';
    const nameTok = this.expectIdentifier('a variable name');
    let declaredType: TypeRef | undefined;
    if (this.current().kind === 'Colon') {
      this.advance();
      declaredType = this.parseType();
    }
    this.expect('Equals', `Expected '=' followed by a value for '${nameTok.text}', but found ${describeToken(this.current())}.`);
    const initializer = this.parseExpression();
    return {
      kind: 'LetStatement',
      name: this.nameNode(nameTok),
      mutable,
      declaredType,
      initializer,
      span: unionSpan(kw.span, initializer.span),
    };
  }

  /**
   * ReturnStatement := 'return' Expression?
   *
   * Bare-return rule: `return` only consumes a following expression when one
   * is actually there *on the same source line*. Without the line check,
   * `return\nfoo()` would wrongly swallow the next statement as the return
   * value; comparing `startLine` keeps a bare `return` on its own line inert.
   */
  private parseReturnStatement(): ReturnStatement {
    const kw = this.advance();
    const next = this.current();
    let value: Expression | undefined;
    if (this.startsExpression(next.kind) && next.span.startLine === kw.span.startLine) {
      value = this.parseExpression();
    }
    return { kind: 'ReturnStatement', value, span: value ? unionSpan(kw.span, value.span) : kw.span };
  }

  // IfStatement   := 'if' Expression Block ('else' (IfLike | Block))?
  // IfLetStatement := 'if' 'let' Identifier '=' Expression Block ('else' ...)?
  private parseIfLike(): IfStatement | IfLetStatement {
    const kw = this.advance();
    if (this.current().kind === 'KwLet') {
      this.advance();
      const nameTok = this.expectIdentifier('a binding name after if let');
      this.expect(
        'Equals',
        `Expected '=' followed by an optional value to unwrap into '${nameTok.text}'.`,
      );
      const value = this.parseExpression();
      const thenBlock = this.parseBlock();
      const elseBlock = this.parseElseClause();
      return {
        kind: 'IfLetStatement',
        name: this.nameNode(nameTok),
        value,
        thenBlock,
        elseBlock,
        span: unionSpan(kw.span, elseBlock?.span ?? thenBlock.span),
      };
    }
    const condition = this.parseExpression();
    const thenBlock = this.parseBlock();
    const elseBlock = this.parseElseClause();
    return {
      kind: 'IfStatement',
      condition,
      thenBlock,
      elseBlock,
      span: unionSpan(kw.span, elseBlock?.span ?? thenBlock.span),
    };
  }

  private parseElseClause(): Block | IfStatement | IfLetStatement | undefined {
    if (this.current().kind !== 'KwElse') {
      return undefined;
    }
    this.advance();
    return this.current().kind === 'KwIf' ? this.parseIfLike() : this.parseBlock();
  }

  // ThrowStatement := 'throw' Expression
  private parseThrowStatement(): ThrowStatement {
    const kw = this.advance();
    const value = this.parseExpression();
    return { kind: 'ThrowStatement', value, span: unionSpan(kw.span, value.span) };
  }

  // -------------------------------------------------------------------------
  // Expressions (low to high precedence, all binary operators left-associative)
  // -------------------------------------------------------------------------

  private startsExpression(kind: TokenKind): boolean {
    switch (kind) {
      case 'StringLiteral':
      case 'StringInterpolationHead':
      case 'IntLiteral':
      case 'FloatLiteral':
      case 'KwTrue':
      case 'KwFalse':
      case 'KwNull':
      case 'KwMatch':
      case 'KwTry':
      case 'Identifier':
      case 'LeftParen':
      case 'Minus':
      case 'Bang':
        return true;
      default:
        return false;
    }
  }

  private parseExpression(): Expression {
    return this.parseOr();
  }

  private parseOr(): Expression {
    let left = this.parseAnd();
    while (this.current().kind === 'PipePipe') {
      this.advance();
      const right = this.parseAnd();
      left = { kind: 'Binary', operator: '||', left, right, span: unionSpan(left.span, right.span) };
    }
    return left;
  }

  private parseAnd(): Expression {
    let left = this.parseEquality();
    while (this.current().kind === 'AmpAmp') {
      this.advance();
      const right = this.parseEquality();
      left = { kind: 'Binary', operator: '&&', left, right, span: unionSpan(left.span, right.span) };
    }
    return left;
  }

  private parseEquality(): Expression {
    let left = this.parseRelational();
    for (;;) {
      const operator = equalityOperatorFor(this.current().kind);
      if (!operator) break;
      this.advance();
      const right = this.parseRelational();
      left = { kind: 'Binary', operator, left, right, span: unionSpan(left.span, right.span) };
    }
    return left;
  }

  private parseRelational(): Expression {
    let left = this.parseCoalesce();
    for (;;) {
      const operator = relationalOperatorFor(this.current().kind);
      if (!operator) break;
      this.advance();
      const right = this.parseCoalesce();
      left = { kind: 'Binary', operator, left, right, span: unionSpan(left.span, right.span) };
    }
    return left;
  }

  /**
   * `??` binds tighter than comparisons and looser than arithmetic (matching
   * Swift, so the same expression reads identically in generated output),
   * and is right-associative: `a ?? b ?? c` is `a ?? (b ?? c)`.
   */
  private parseCoalesce(): Expression {
    const left = this.parseAdditive();
    if (this.current().kind === 'QuestionQuestion') {
      this.advance();
      const right = this.parseCoalesce();
      return { kind: 'Binary', operator: '??', left, right, span: unionSpan(left.span, right.span) };
    }
    return left;
  }

  private parseAdditive(): Expression {
    let left = this.parseMultiplicative();
    for (;;) {
      const operator = additiveOperatorFor(this.current().kind);
      if (!operator) break;
      this.advance();
      const right = this.parseMultiplicative();
      left = { kind: 'Binary', operator, left, right, span: unionSpan(left.span, right.span) };
    }
    return left;
  }

  private parseMultiplicative(): Expression {
    let left = this.parseUnary();
    for (;;) {
      const operator = multiplicativeOperatorFor(this.current().kind);
      if (!operator) break;
      this.advance();
      const right = this.parseUnary();
      left = { kind: 'Binary', operator, left, right, span: unionSpan(left.span, right.span) };
    }
    return left;
  }

  private parseUnary(): Expression {
    const kind = this.current().kind;
    if (kind === 'KwTry') {
      const kw = this.advance();
      const expression = this.parseUnary();
      return { kind: 'Try', expression, span: unionSpan(kw.span, expression.span) };
    }
    const operator: UnaryOperator | undefined = kind === 'Minus' ? '-' : kind === 'Bang' ? '!' : undefined;
    if (operator) {
      const opTok = this.advance();
      const operand = this.parseUnary();
      return { kind: 'Unary', operator, operand, span: unionSpan(opTok.span, operand.span) };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Expression {
    let expr = this.parsePrimary();
    for (;;) {
      if (this.current().kind === 'Dot' || this.current().kind === 'QuestionDot') {
        const optionalChaining = this.advance().kind === 'QuestionDot';
        const memberTok = this.expectIdentifier(
          optionalChaining ? 'a member name after ?.' : 'a member name after .',
        );
        expr = {
          kind: 'MemberAccess',
          object: expr,
          member: this.nameNode(memberTok),
          optionalChaining,
          span: unionSpan(expr.span, memberTok.span),
        };
        continue;
      }
      if (this.current().kind === 'LeftParen') {
        this.advance();
        const args = this.parseArgs();
        const close = this.expect(
          'RightParen',
          `Expected ')' to close the call arguments, but found ${describeToken(this.current())}.`,
        );
        expr = { kind: 'Call', callee: expr, args, span: unionSpan(expr.span, close.span) };
        continue;
      }
      break;
    }
    return expr;
  }

  private parsePrimary(): Expression {
    const tok = this.current();
    switch (tok.kind) {
      case 'StringLiteral':
        this.advance();
        return { kind: 'StringLiteral', value: decodeStringLiteral(tok.text), span: tok.span };
      case 'StringInterpolationHead':
        return this.parseInterpolatedString();
      case 'KwMatch':
        return this.parseMatchExpression();
      case 'IntLiteral':
        this.advance();
        return { kind: 'IntLiteral', text: tok.text, span: tok.span };
      case 'FloatLiteral':
        this.advance();
        return { kind: 'FloatLiteral', text: tok.text, span: tok.span };
      case 'KwTrue':
        this.advance();
        return { kind: 'BoolLiteral', value: true, span: tok.span };
      case 'KwFalse':
        this.advance();
        return { kind: 'BoolLiteral', value: false, span: tok.span };
      case 'KwNull':
        this.advance();
        return { kind: 'NullLiteral', span: tok.span };
      case 'Identifier':
        this.advance();
        return { kind: 'Identifier', name: tok.text, span: tok.span };
      case 'LeftParen': {
        this.advance();
        const inner = this.parseExpression();
        this.expect('RightParen', `Expected ')' to close the expression, but found ${describeToken(this.current())}.`);
        return inner; // Parenthesized expressions return the inner node; there is no wrapper AST kind.
      }
      default:
        this.addDiagnostic(
          DiagnosticCodes.UnexpectedToken,
          `Expected an expression, but found ${describeToken(tok)}.`,
          tok.span,
        );
        // Do not consume: callers only reach parsePrimary after confirming
        // `startsExpression`, except in nested recursive calls where the
        // enclosing expression has already consumed at least one token, so
        // leaving this token in place cannot stall the parser.
        return { kind: 'NullLiteral', span: tok.span };
    }
  }

  // InterpolatedString := Head Expression (Middle Expression)* Tail
  private parseInterpolatedString(): InterpolatedStringExpression {
    const head = this.advance();
    const parts: (StringTextPart | Expression)[] = [
      { kind: 'StringTextPart', value: decodeInterpolationSegment(head.text), span: head.span },
    ];
    let endSpan = head.span;
    for (;;) {
      parts.push(this.parseExpression());
      const segment = this.current();
      if (segment.kind === 'StringInterpolationMiddle' || segment.kind === 'StringInterpolationTail') {
        this.advance();
        parts.push({
          kind: 'StringTextPart',
          value: decodeInterpolationSegment(segment.text),
          span: segment.span,
        });
        endSpan = segment.span;
        if (segment.kind === 'StringInterpolationTail') {
          break;
        }
        continue;
      }
      this.addDiagnostic(
        DiagnosticCodes.UnexpectedToken,
        `Expected ')' to continue this interpolated string, but found ${describeToken(segment)}.`,
        segment.span,
      );
      break;
    }
    return { kind: 'InterpolatedString', parts, span: unionSpan(head.span, endSpan) };
  }

  /**
   * MatchExpression := 'match' Expression '{' MatchArm* '}'
   * MatchArm := (Identifier ('(' Identifier (',' Identifier)* ')')? | 'else') '->' Expression
   */
  private parseMatchExpression(): MatchExpression {
    const kw = this.advance();
    const scrutinee = this.parseExpression();
    this.expect('LeftBrace', `Expected '{' to open the match arms, but found ${describeToken(this.current())}.`);
    const arms: MatchArm[] = [];
    let elseArm: Expression | undefined;
    while (this.current().kind !== 'RightBrace' && this.current().kind !== 'EndOfFile') {
      if (this.current().kind === 'KwElse') {
        const elseTok = this.advance();
        this.expect('Arrow', `Expected '->' after 'else' in this match.`);
        const body = this.parseExpression();
        if (elseArm) {
          this.addDiagnostic(
            DiagnosticCodes.InvalidMatch,
            `This match already has an 'else' arm; remove the duplicate.`,
            elseTok.span,
          );
        } else {
          elseArm = body;
        }
        continue;
      }
      if (this.current().kind !== 'Identifier') {
        this.addDiagnostic(
          DiagnosticCodes.UnexpectedToken,
          `Expected a case name or 'else' in this match, but found ${describeToken(this.current())}.`,
          this.current().span,
        );
        this.advance(); // Guarantee progress, then resync on the next arm.
        continue;
      }
      const caseTok = this.advance();
      const bindings: NameNode[] = [];
      if (this.current().kind === 'LeftParen') {
        this.advance();
        while (this.current().kind !== 'RightParen' && this.current().kind !== 'EndOfFile') {
          const bindingTok = this.expectIdentifier('a binding name for the case payload');
          bindings.push(this.nameNode(bindingTok));
          if (this.current().kind === 'Comma') {
            this.advance();
          } else {
            break;
          }
        }
        this.expect('RightParen', `Expected ')' to close the case bindings.`);
      }
      this.expect('Arrow', `Expected '->' after case '${caseTok.text}' in this match.`);
      const body = this.parseExpression();
      arms.push({
        kind: 'MatchArm',
        caseName: this.nameNode(caseTok),
        bindings,
        body,
        span: unionSpan(caseTok.span, body.span),
      });
    }
    const close = this.expect(
      'RightBrace',
      `Expected '}' to close the match, but found ${describeToken(this.current())}.`,
    );
    return { kind: 'Match', scrutinee, arms, elseArm, span: unionSpan(kw.span, close.span) };
  }

  // Args := (Argument (',' Argument)*)? ; Argument := (Identifier ':')? Expression
  private parseArgs(): Argument[] {
    return this.parseCommaSeparated(
      () => this.current().kind === 'RightParen',
      () => this.parseArgument(),
    );
  }

  private parseArgument(): Argument {
    if (this.current().kind === 'Identifier' && this.peek(1).kind === 'Colon') {
      const nameTok = this.advance();
      this.advance(); // ':'
      const value = this.parseExpression();
      return { kind: 'Argument', name: this.nameNode(nameTok), value, span: unionSpan(nameTok.span, value.span) };
    }
    const value = this.parseExpression();
    return { kind: 'Argument', value, span: value.span };
  }

  // -------------------------------------------------------------------------
  // ComponentDecl := 'component' Identifier '(' ParamList? ')' '{' UiElement* '}'
  // -------------------------------------------------------------------------

  private parseComponentDecl(): ComponentDecl {
    const kw = this.advance();
    const nameTok = this.expectIdentifier('a component name');
    this.expect('LeftParen', `Expected '(' to start the parameters of component '${nameTok.text}'.`);
    const params = this.parseParamList();
    this.expect(
      'RightParen',
      `Expected ')' to close the parameters of component '${nameTok.text}', but found ${describeToken(this.current())}.`,
    );
    this.expect('LeftBrace', `Expected '{' to start the body of component '${nameTok.text}'.`);
    const body = this.parseUiElements();
    const close = this.expect(
      'RightBrace',
      `Expected '}' to close component '${nameTok.text}', but found ${describeToken(this.current())}.`,
    );
    return { kind: 'ComponentDecl', name: this.nameNode(nameTok), params, body, span: unionSpan(kw.span, close.span) };
  }

  private parseUiElements(): UiElement[] {
    const elements: UiElement[] = [];
    while (!this.isAtEnd() && this.current().kind !== 'RightBrace') {
      if (this.current().kind !== 'Identifier') {
        this.addDiagnostic(
          DiagnosticCodes.UnexpectedToken,
          `Expected a UI element name, but found ${describeToken(this.current())}.`,
          this.current().span,
        );
        this.advance();
        continue;
      }
      elements.push(this.parseUiElement());
    }
    return elements;
  }

  // UiElement := Identifier ('(' Args ')')? ('{' UiElement* '}')?
  private parseUiElement(): UiElement {
    const nameTok = this.advance(); // caller confirmed this is an Identifier
    let args: Argument[] = [];
    let endSpan = nameTok.span;
    if (this.current().kind === 'LeftParen') {
      this.advance();
      args = this.parseArgs();
      const close = this.expect(
        'RightParen',
        `Expected ')' to close arguments for '${nameTok.text}', but found ${describeToken(this.current())}.`,
      );
      endSpan = close.span;
    }
    let children: UiElement[] = [];
    if (this.current().kind === 'LeftBrace') {
      this.advance();
      children = this.parseUiElements();
      const close = this.expect(
        'RightBrace',
        `Expected '}' to close '${nameTok.text}', but found ${describeToken(this.current())}.`,
      );
      endSpan = close.span;
    }
    return { kind: 'UiElement', name: this.nameNode(nameTok), args, children, span: unionSpan(nameTok.span, endSpan) };
  }

  // -------------------------------------------------------------------------
  // ScreenDecl := 'screen' Identifier '(' ParamList? ')' '{' TitleLine? UiElement* '}'
  // TitleLine := 'title' StringLiteral (a contextual identifier, only at the start of the body)
  // -------------------------------------------------------------------------

  private parseScreenDecl(): ScreenDecl {
    const kw = this.advance();
    const nameTok = this.expectIdentifier('a screen name');
    this.expect('LeftParen', `Expected '(' to start the parameters of screen '${nameTok.text}'.`);
    const params = this.parseParamList();
    this.expect(
      'RightParen',
      `Expected ')' to close the parameters of screen '${nameTok.text}', but found ${describeToken(this.current())}.`,
    );
    this.expect('LeftBrace', `Expected '{' to start the body of screen '${nameTok.text}'.`);

    let title: StringLiteral | undefined;
    const maybeTitle = this.current();
    if (maybeTitle.kind === 'Identifier' && maybeTitle.text === 'title' && this.peek(1).kind === 'StringLiteral') {
      this.advance(); // 'title'
      const strTok = this.advance(); // the string literal
      title = { kind: 'StringLiteral', value: decodeStringLiteral(strTok.text), span: strTok.span };
    }

    const body = this.parseUiElements();
    const close = this.expect(
      'RightBrace',
      `Expected '}' to close screen '${nameTok.text}', but found ${describeToken(this.current())}.`,
    );
    return {
      kind: 'ScreenDecl',
      name: this.nameNode(nameTok),
      params,
      title,
      body,
      span: unionSpan(kw.span, close.span),
    };
  }

  // -------------------------------------------------------------------------
  // RouteDecl := 'route' RoutePath '->' Identifier ('(' RouteBinding (',' RouteBinding)* ')')?
  // RoutePath := ('/' (Identifier | ':' Identifier))+
  // -------------------------------------------------------------------------

  private parseRouteDecl(): RouteDecl {
    const kw = this.advance();
    const segments: RouteSegment[] = [];
    while (this.current().kind === 'Slash') {
      const slash = this.advance();
      if (this.current().kind === 'Colon') {
        this.advance();
        const nameTok = this.expectIdentifier('a route parameter name after :');
        segments.push({ kind: 'ParamRouteSegment', name: nameTok.text, span: unionSpan(slash.span, nameTok.span) });
      } else {
        const nameTok = this.expectIdentifier('a route segment name after /');
        segments.push({ kind: 'StaticRouteSegment', text: nameTok.text, span: unionSpan(slash.span, nameTok.span) });
      }
    }
    if (segments.length === 0) {
      this.addDiagnostic(
        DiagnosticCodes.UnexpectedToken,
        `Expected a route path starting with '/', but found ${describeToken(this.current())}.`,
        this.current().span,
      );
    }
    this.expect('Arrow', `Expected '->' followed by the screen this route renders, but found ${describeToken(this.current())}.`);
    const screenTok = this.expectIdentifier('a screen name');

    let bindings: RouteBinding[] = [];
    let endSpan = screenTok.span;
    if (this.current().kind === 'LeftParen') {
      this.advance();
      bindings = this.parseCommaSeparated(
        () => this.current().kind === 'RightParen',
        () => this.parseRouteBinding(),
      );
      const close = this.expect(
        'RightParen',
        `Expected ')' to close the route bindings, but found ${describeToken(this.current())}.`,
      );
      endSpan = close.span;
    }
    return {
      kind: 'RouteDecl',
      segments,
      screen: this.nameNode(screenTok),
      bindings,
      span: unionSpan(kw.span, endSpan),
    };
  }

  private parseRouteBinding(): RouteBinding {
    if (this.current().kind !== 'Identifier') {
      const tok = this.current();
      this.addDiagnostic(
        DiagnosticCodes.UnexpectedToken,
        `Expected a route binding like 'name: Type', but found ${describeToken(tok)}.`,
        tok.span,
      );
      return {
        kind: 'RouteBinding',
        name: { kind: 'Name', text: '', span: tok.span },
        type: { kind: 'NamedType', name: '', typeArgs: [], span: tok.span },
        span: tok.span,
      };
    }
    const nameTok = this.advance();
    this.expect(
      'Colon',
      `Expected ':' followed by a type for route binding '${nameTok.text}', but found ${describeToken(this.current())}.`,
    );
    const type = this.parseType();
    return { kind: 'RouteBinding', name: this.nameNode(nameTok), type, span: unionSpan(nameTok.span, type.span) };
  }

  // -------------------------------------------------------------------------
  // NativeFunctionDecl :=
  //   'native' ('swift'|'kotlin'|'typescript') 'fn' Identifier '(' ParamList? ')'
  //   'async'? ('throws' Type)? ('->' Type)? RawBlock
  // -------------------------------------------------------------------------

  private parseNativeFunctionDecl(): NativeFunctionDecl {
    const kw = this.advance(); // 'native'
    const targetTok = this.current();
    let target: NativeTarget = 'swift';
    if (targetTok.kind === 'KwSwift' || targetTok.kind === 'KwKotlin' || targetTok.kind === 'KwTypescript') {
      this.advance();
      target = targetTok.kind === 'KwSwift' ? 'swift' : targetTok.kind === 'KwKotlin' ? 'kotlin' : 'typescript';
    } else {
      this.addDiagnostic(
        DiagnosticCodes.UnexpectedToken,
        `Expected a native target ('swift', 'kotlin', or 'typescript'), but found ${describeToken(targetTok)}.`,
        targetTok.span,
      );
    }
    this.expect('KwFn', `Expected 'fn' after the native target, but found ${describeToken(this.current())}.`);
    const nameTok = this.expectIdentifier('a native function name');
    this.expect('LeftParen', `Expected '(' to start the parameters of native function '${nameTok.text}'.`);
    const params = this.parseParamList();
    this.expect(
      'RightParen',
      `Expected ')' to close the parameters of native function '${nameTok.text}', but found ${describeToken(this.current())}.`,
    );
    const isAsync = this.consumeOptional('KwAsync');
    const throwsType = this.parseOptionalThrows();
    const returnType = this.parseOptionalReturnType();
    const rawBody = this.parseRawNativeBody(nameTok.text, target);
    return {
      kind: 'NativeFunctionDecl',
      target,
      name: this.nameNode(nameTok),
      params,
      returnType,
      isAsync,
      throwsType,
      rawBody,
      span: unionSpan(kw.span, rawBody.span),
    };
  }

  /**
   * Scans the native function's body as verbatim target-language text rather
   * than parsing it as ClearKrypt. The whole file was already lexed with the
   * ordinary ClearKrypt lexer (`parseSource` -> `lex`), so instead of parsing
   * token-by-token here, we re-scan the *original source text* from the
   * opening '{' with a small brace-depth counter (see `scanRawNativeBody`)
   * that understands strings and comments well enough not to be fooled by
   * braces inside them. Once we know where the matching '}' is, we fast
   * forward the token cursor past every token whose span falls inside that
   * range — those tokens belong to the raw body, not to ClearKrypt syntax,
   * and must not be parsed as ClearKrypt statements. Any lexer diagnostics
   * that landed inside the range are filtered out in `parseSource`, since
   * they're just artifacts of running the ClearKrypt lexer over foreign code.
   */
  private parseRawNativeBody(functionName: string, target: NativeTarget): RawNativeBody {
    const openTok = this.current();
    if (openTok.kind !== 'LeftBrace') {
      this.addDiagnostic(
        DiagnosticCodes.UnexpectedToken,
        `Expected '{' to start the native body for '${functionName}', but found ${describeToken(openTok)}.`,
        openTok.span,
      );
      return { kind: 'RawNativeBody', text: '', span: openTok.span };
    }

    const scan = scanRawNativeBody(this.sourceText, openTok.span.start);
    const bodySpan = this.lineMap.span(this.path, openTok.span.start, scan.endOffset);
    if (!scan.terminated) {
      this.addDiagnostic(
        DiagnosticCodes.UnterminatedNativeBlock,
        `Unterminated native ${target} block for '${functionName}'. Add a closing '}' to end the native function body.`,
        bodySpan,
      );
    }
    this.nativeRawRanges.push({ start: openTok.span.start, end: scan.endOffset });

    while (!this.isAtEnd() && this.current().span.start < scan.endOffset) {
      this.advance();
    }

    return { kind: 'RawNativeBody', text: scan.innerText, span: bodySpan };
  }
}

// ---------------------------------------------------------------------------
// Operator lookup helpers (switch-based so TypeScript can narrow exactly)
// ---------------------------------------------------------------------------

function equalityOperatorFor(kind: TokenKind): BinaryOperator | undefined {
  switch (kind) {
    case 'EqualsEquals':
      return '==';
    case 'BangEquals':
      return '!=';
    default:
      return undefined;
  }
}

function relationalOperatorFor(kind: TokenKind): BinaryOperator | undefined {
  switch (kind) {
    case 'LessThan':
      return '<';
    case 'LessThanEquals':
      return '<=';
    case 'GreaterThan':
      return '>';
    case 'GreaterThanEquals':
      return '>=';
    default:
      return undefined;
  }
}

function additiveOperatorFor(kind: TokenKind): BinaryOperator | undefined {
  switch (kind) {
    case 'Plus':
      return '+';
    case 'Minus':
      return '-';
    default:
      return undefined;
  }
}

function multiplicativeOperatorFor(kind: TokenKind): BinaryOperator | undefined {
  switch (kind) {
    case 'Star':
      return '*';
    case 'Slash':
      return '/';
    case 'Percent':
      return '%';
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Raw native body scanning
// ---------------------------------------------------------------------------

interface RawScanResult {
  /** Verbatim text strictly between the outer '{' and matching '}'. */
  readonly innerText: string;
  /** Offset just past the matching '}' (or end of source, if unterminated). */
  readonly endOffset: number;
  readonly terminated: boolean;
}

/**
 * Brace-depth scanner over raw source text starting at a '{' offset. Skips
 * over double-quoted strings (with backslash escapes), `//` line comments,
 * and `/* *\/` block comments so braces inside them never affect the depth
 * count — this is what lets a native body contain target-language syntax
 * ClearKrypt itself doesn't understand.
 */
function scanRawNativeBody(text: string, openBraceOffset: number): RawScanResult {
  const length = text.length;
  let i = openBraceOffset + 1;
  const innerStart = i;
  let depth = 1;

  while (i < length) {
    const code = text.charCodeAt(i);
    if (code === 34 /* " */) {
      i++;
      while (i < length && text.charCodeAt(i) !== 34) {
        if (text.charCodeAt(i) === 92 /* \ */ && i + 1 < length) {
          i += 2;
        } else {
          i++;
        }
      }
      i++; // Consume the closing quote (or step past end of input).
      continue;
    }
    if (code === 47 /* / */ && text.charCodeAt(i + 1) === 47) {
      i += 2;
      while (i < length && text.charCodeAt(i) !== 10) {
        i++;
      }
      continue;
    }
    if (code === 47 && text.charCodeAt(i + 1) === 42 /* * */) {
      i += 2;
      while (i < length && !(text.charCodeAt(i) === 42 && text.charCodeAt(i + 1) === 47)) {
        i++;
      }
      i += 2;
      continue;
    }
    if (code === 123 /* { */) {
      depth++;
      i++;
      continue;
    }
    if (code === 125 /* } */) {
      depth--;
      if (depth === 0) {
        return { innerText: text.slice(innerStart, i), endOffset: i + 1, terminated: true };
      }
      i++;
      continue;
    }
    i++;
  }

  return { innerText: text.slice(innerStart, length), endOffset: length, terminated: false };
}
