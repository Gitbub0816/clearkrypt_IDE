import {
  CheckedProject,
  Declaration,
  lex,
  parseSource,
  SourceFileInput,
  Span,
  Token,
  TypeRef,
  UiElement,
} from '@clearkrypt/compiler-core';
import { SemanticTokenType, semanticTokenTypes } from './protocol';

/**
 * Semantic tokens for one document (`textDocument/semanticTokens/full`).
 *
 * Keywords, literals, comments, and operators come straight from the lexer;
 * identifiers are classified from the AST and the checker's resolution maps
 * (Constitution Document 8: highlighting reflects compiler meaning). The
 * result uses the LSP delta encoding against the legend in protocol.ts.
 */

const DECLARATION = 1 << 0; // modifier bit: 'declaration'
const DEFAULT_LIBRARY = 1 << 1; // modifier bit: 'defaultLibrary'

interface RawToken {
  line: number; // zero-based
  char: number; // zero-based
  length: number;
  type: number;
  modifiers: number;
}

export function semanticTokensFull(source: SourceFileInput, checked: CheckedProject): number[] {
  const classifier = new IdentifierClassifier(source, checked);
  const { tokens } = lex(source, { includeTrivia: true });
  const raw: RawToken[] = [];

  for (const token of tokens) {
    const classified = classify(token, classifier);
    if (!classified) continue;
    raw.push({
      line: token.span.startLine - 1,
      char: token.span.startColumn - 1,
      length: token.span.end - token.span.start,
      type: tokenIndex(classified.type),
      modifiers: classified.modifiers,
    });
  }
  return encode(raw);
}

function tokenIndex(type: SemanticTokenType): number {
  return semanticTokenTypes.indexOf(type);
}

function classify(
  token: Token,
  classifier: IdentifierClassifier,
): { type: SemanticTokenType; modifiers: number } | undefined {
  const kind = token.kind;
  if (kind === 'KwSwift' || kind === 'KwKotlin' || kind === 'KwTypescript' || kind === 'KwReact') {
    return { type: 'nativeTarget', modifiers: 0 };
  }
  if (kind.startsWith('Kw')) return { type: 'keyword', modifiers: 0 };
  if (
    kind === 'StringLiteral' ||
    kind === 'StringInterpolationHead' ||
    kind === 'StringInterpolationMiddle' ||
    kind === 'StringInterpolationTail'
  ) {
    return { type: 'string', modifiers: 0 };
  }
  if (kind === 'IntLiteral' || kind === 'FloatLiteral') return { type: 'number', modifiers: 0 };
  if (kind === 'LineComment' || kind === 'BlockComment') return { type: 'comment', modifiers: 0 };
  if (isOperator(kind)) return { type: 'operator', modifiers: 0 };
  if (kind === 'Identifier') return classifier.classify(token);
  return undefined;
}

function isOperator(kind: Token['kind']): boolean {
  switch (kind) {
    case 'Arrow':
    case 'Plus':
    case 'Minus':
    case 'Star':
    case 'Slash':
    case 'Percent':
    case 'EqualsEquals':
    case 'BangEquals':
    case 'LessThan':
    case 'LessThanEquals':
    case 'GreaterThan':
    case 'GreaterThanEquals':
    case 'AmpAmp':
    case 'PipePipe':
    case 'Bang':
    case 'Equals':
    case 'Question':
    case 'QuestionDot':
    case 'QuestionQuestion':
      return true;
    default:
      return false;
  }
}

/** Classifies identifier tokens by the span of their first character. */
class IdentifierClassifier {
  private readonly map = new Map<string, { type: SemanticTokenType; modifiers: number }>();

  constructor(source: SourceFileInput, checked: CheckedProject) {
    const { file } = parseSource(source);
    for (const decl of file.declarations) {
      this.addDeclaration(decl, checked);
    }
    // Usages resolved by the checker: locals, params, callee names, fields.
    for (const [expression] of checked.expressionTypes) {
      if (expression.span.file !== source.path) continue;
      if (expression.kind === 'Identifier') {
        const identifierKind = checked.identifierKinds.get(expression);
        if (identifierKind === 'param') this.put(expression.span, 'parameter', 0);
        else if (identifierKind === 'local') this.put(expression.span, 'variable', 0);
      } else if (expression.kind === 'MemberAccess') {
        this.put(expression.member.span, 'property', 0);
      } else if (expression.kind === 'Call') {
        const resolution = checked.callResolutions.get(expression);
        if (resolution && expression.callee.kind === 'Identifier') {
          this.put(
            expression.callee.span,
            resolution.kind === 'construct' ? 'model' : 'function',
            0,
          );
        }
      }
    }
  }

  classify(token: Token): { type: SemanticTokenType; modifiers: number } | undefined {
    return this.map.get(keyOf(token.span));
  }

  private addDeclaration(decl: Declaration, checked: CheckedProject): void {
    switch (decl.kind) {
      case 'ModelDecl':
        this.put(decl.name.span, 'model', DECLARATION);
        for (const field of decl.fields) {
          this.put(field.name.span, 'property', DECLARATION);
          this.addTypeRef(field.type, checked);
        }
        break;
      case 'EnumDecl':
      case 'ErrorDecl':
        this.put(decl.name.span, decl.kind === 'EnumDecl' ? 'enum' : 'errorType', DECLARATION);
        for (const c of decl.cases) {
          this.put(c.name.span, 'enumMember', DECLARATION);
          for (const param of c.params) {
            this.put(param.name.span, 'property', DECLARATION);
            this.addTypeRef(param.type, checked);
          }
        }
        break;
      case 'CapabilityDecl':
        this.put(decl.name.span, 'capability', DECLARATION);
        break;
      case 'FunctionDecl':
      case 'NativeFunctionDecl':
        this.put(decl.name.span, 'function', DECLARATION);
        for (const param of decl.params) {
          this.put(param.name.span, 'parameter', DECLARATION);
          this.addTypeRef(param.type, checked);
        }
        if (decl.returnType) this.addTypeRef(decl.returnType, checked);
        if (decl.throwsType) this.addTypeRef(decl.throwsType, checked);
        if (decl.kind === 'FunctionDecl') {
          for (const capability of decl.requiresCapabilities) {
            this.put(capability.span, 'capability', 0);
          }
        }
        break;
      case 'ScreenDecl':
      case 'ComponentDecl':
        this.put(decl.name.span, decl.kind === 'ScreenDecl' ? 'screen' : 'component', DECLARATION);
        for (const param of decl.params) {
          this.put(param.name.span, 'parameter', DECLARATION);
          this.addTypeRef(param.type, checked);
        }
        for (const element of decl.body) {
          this.addUiElement(element);
        }
        break;
      case 'RouteDecl':
        this.put(decl.screen.span, 'screen', 0);
        for (const segment of decl.segments) {
          this.put(segment.span, 'route', 0);
        }
        for (const binding of decl.bindings) {
          this.put(binding.name.span, 'parameter', 0);
          this.addTypeRef(binding.type, checked);
        }
        break;
    }
  }

  private addUiElement(element: UiElement): void {
    this.put(element.name.span, 'component', 0);
    for (const child of element.children) {
      this.addUiElement(child);
    }
  }

  private addTypeRef(ref: TypeRef, checked: CheckedProject): void {
    if (ref.kind === 'OptionalType') {
      this.addTypeRef(ref.inner, checked);
      return;
    }
    const resolved = checked.typeRefTypes.get(ref);
    if (resolved && resolved.kind === 'declared') {
      const type: SemanticTokenType =
        resolved.declarationKind === 'model'
          ? 'model'
          : resolved.declarationKind === 'enum'
            ? 'enum'
            : 'errorType';
      this.put(nameSpanOf(ref.span, ref.name), type, 0);
    } else {
      this.put(nameSpanOf(ref.span, ref.name), 'type', DEFAULT_LIBRARY);
    }
    for (const arg of ref.typeArgs) {
      this.addTypeRef(arg, checked);
    }
  }

  private put(span: Span, type: SemanticTokenType, modifiers: number): void {
    this.map.set(keyOf(span), { type, modifiers });
  }
}

/** A NamedTypeRef span covers its type arguments; key by the name token only. */
function nameSpanOf(span: Span, name: string): Span {
  return { ...span, end: span.start + name.length };
}

function keyOf(span: Span): string {
  return `${span.startLine}:${span.startColumn}`;
}

function encode(tokens: RawToken[]): number[] {
  tokens.sort((a, b) => a.line - b.line || a.char - b.char);
  const data: number[] = [];
  let prevLine = 0;
  let prevChar = 0;
  for (const token of tokens) {
    const deltaLine = token.line - prevLine;
    const deltaChar = deltaLine === 0 ? token.char - prevChar : token.char;
    data.push(deltaLine, deltaChar, token.length, token.type, token.modifiers);
    prevLine = token.line;
    prevChar = token.char;
  }
  return data;
}
