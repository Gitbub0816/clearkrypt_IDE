import {
  CheckedProject,
  Declaration,
  parseSource,
  SemanticModel,
  SourceFileInput,
  Span,
  typeToString,
} from '@clearkrypt/compiler-core';
import { LspDocumentSymbol, LspPosition, LspRange } from './protocol';

/** LSP SymbolKind subset used by the outline. */
const SymbolKinds = {
  Module: 2,
  Class: 5,
  Field: 8,
  Enum: 10,
  Interface: 11,
  Function: 12,
  Key: 20,
  EnumMember: 22,
  Struct: 23,
} as const;

export function documentSymbols(source: SourceFileInput): LspDocumentSymbol[] {
  const { file } = parseSource(source);
  const symbols: LspDocumentSymbol[] = [];
  if (file.module) {
    symbols.push(leaf(file.module.name, SymbolKinds.Module, file.module.span, 'module'));
  }
  for (const decl of file.declarations) {
    const symbol = declarationSymbol(decl);
    if (symbol) symbols.push(symbol);
  }
  return symbols;
}

function declarationSymbol(decl: Declaration): LspDocumentSymbol | undefined {
  switch (decl.kind) {
    case 'ModelDecl':
      return {
        ...leaf(decl.name.text, SymbolKinds.Struct, decl.span, 'model', decl.name.span),
        children: decl.fields.map((f) =>
          leaf(f.name.text, SymbolKinds.Field, f.span, undefined, f.name.span),
        ),
      };
    case 'EnumDecl':
    case 'ErrorDecl':
      return {
        ...leaf(
          decl.name.text,
          SymbolKinds.Enum,
          decl.span,
          decl.kind === 'EnumDecl' ? 'enum' : 'error',
          decl.name.span,
        ),
        children: decl.cases.map((c) =>
          leaf(c.name.text, SymbolKinds.EnumMember, c.span, undefined, c.name.span),
        ),
      };
    case 'CapabilityDecl':
      return leaf(decl.name.text, SymbolKinds.Interface, decl.span, 'capability', decl.name.span);
    case 'FunctionDecl':
      return leaf(decl.name.text, SymbolKinds.Function, decl.span, 'fn', decl.name.span);
    case 'NativeFunctionDecl':
      return leaf(
        decl.name.text,
        SymbolKinds.Function,
        decl.span,
        `native ${decl.target}`,
        decl.name.span,
      );
    case 'ScreenDecl':
      return leaf(decl.name.text, SymbolKinds.Class, decl.span, 'screen', decl.name.span);
    case 'ComponentDecl':
      return leaf(decl.name.text, SymbolKinds.Class, decl.span, 'component', decl.name.span);
    case 'RouteDecl': {
      const routePath = decl.segments
        .map((s) => (s.kind === 'StaticRouteSegment' ? `/${s.text}` : `/:${s.name}`))
        .join('');
      return leaf(routePath, SymbolKinds.Key, decl.span, `route -> ${decl.screen.text}`);
    }
  }
}

function leaf(
  name: string,
  kind: number,
  span: Span,
  detail?: string,
  selectionSpan?: Span,
): LspDocumentSymbol {
  return {
    name,
    detail,
    kind,
    range: toRange(span),
    selectionRange: toRange(selectionSpan ?? span),
  };
}

export function toRange(span: Span): LspRange {
  return {
    start: { line: span.startLine - 1, character: span.startColumn - 1 },
    end: { line: span.endLine - 1, character: span.endColumn - 1 },
  };
}

// ---------------------------------------------------------------------------
// Hover
// ---------------------------------------------------------------------------

export function hover(
  checked: CheckedProject,
  relativePath: string,
  position: LspPosition,
): { contents: { kind: 'markdown'; value: string }; range: LspRange } | null {
  // Declaration names first: they carry rendered signatures.
  for (const module of checked.semanticModel.modules) {
    for (const symbol of module.symbols) {
      if (symbol.span.file === relativePath && contains(symbol.span, position)) {
        return {
          contents: { kind: 'markdown', value: codeBlock(symbol.signature) },
          range: toRange(symbol.span),
        };
      }
    }
  }
  // Otherwise the smallest checked expression containing the position.
  let best: { span: Span; text: string } | undefined;
  for (const [expression, type] of checked.expressionTypes) {
    const span = expression.span;
    if (span.file !== relativePath || !contains(span, position)) continue;
    if (!best || spanSize(span) < spanSize(best.span)) {
      best = { span, text: typeToString(type) };
    }
  }
  if (best) {
    return {
      contents: { kind: 'markdown', value: codeBlock(best.text) },
      range: toRange(best.span),
    };
  }
  return null;
}

function codeBlock(text: string): string {
  return '```ck\n' + text + '\n```';
}

function contains(span: Span, position: LspPosition): boolean {
  const line = position.line + 1;
  const column = position.character + 1;
  if (line < span.startLine || line > span.endLine) return false;
  if (line === span.startLine && column < span.startColumn) return false;
  if (line === span.endLine && column >= span.endColumn) return false;
  return true;
}

function spanSize(span: Span): number {
  return span.end - span.start;
}

// ---------------------------------------------------------------------------
// Completion
// ---------------------------------------------------------------------------

const CompletionKinds = {
  Function: 3,
  Class: 7,
  Interface: 8,
  Enum: 13,
  Keyword: 14,
  Struct: 22,
} as const;

const keywordCompletions = [
  'module', 'import', 'model', 'enum', 'error', 'capability', 'fn', 'screen',
  'component', 'route', 'native', 'requires', 'async', 'throws', 'let', 'var',
  'if', 'else', 'return', 'true', 'false', 'null',
];

const primitiveCompletions = [
  'String', 'Int', 'Float', 'Decimal', 'Bool', 'Date', 'DateTime', 'ID',
  'Email', 'URL', 'Data', 'Void', 'Never', 'List', 'Map', 'Set',
];

export function completions(semanticModel: SemanticModel): {
  label: string;
  kind: number;
  detail?: string;
}[] {
  const items: { label: string; kind: number; detail?: string }[] = [];
  for (const keyword of keywordCompletions) {
    items.push({ label: keyword, kind: CompletionKinds.Keyword });
  }
  for (const primitive of primitiveCompletions) {
    items.push({ label: primitive, kind: CompletionKinds.Class, detail: 'built-in type' });
  }
  for (const module of semanticModel.modules) {
    for (const symbol of module.symbols) {
      const kind =
        symbol.kind === 'model'
          ? CompletionKinds.Struct
          : symbol.kind === 'enum' || symbol.kind === 'error'
            ? CompletionKinds.Enum
            : symbol.kind === 'capability'
              ? CompletionKinds.Interface
              : symbol.kind === 'function' || symbol.kind === 'native'
                ? CompletionKinds.Function
                : CompletionKinds.Class;
      items.push({ label: symbol.name, kind, detail: symbol.signature });
    }
  }
  return items;
}
