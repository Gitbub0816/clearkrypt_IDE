import {
  Declaration,
  NativeFunctionDecl,
  NativeTarget,
  RouteDecl,
  SourceFileNode,
} from '../syntax/ast';
import { Span } from '../text/span';

/**
 * Symbols: the compiler's record of what is declared where.
 *
 * Constitution (Document 5, Symbol law): symbol resolution must be explicit
 * and inspectable — the compiler knows where every resolved symbol came
 * from. This powers diagnostics, the language service, and lowering.
 */

export type SymbolKind =
  | 'model'
  | 'enum'
  | 'error'
  | 'capability'
  | 'function'
  | 'screen'
  | 'component'
  | 'native';

export interface DeclarationSymbol {
  readonly name: string;
  readonly kind: SymbolKind;
  readonly module: string;
  /** Span of the declared name, for diagnostics and go-to-definition. */
  readonly nameSpan: Span;
  /** The declaring AST node. For native groups this is the first implementation. */
  readonly node: Declaration;
  /** Per-target implementations; present only for `kind: 'native'`. */
  readonly nativeImplementations?: ReadonlyMap<NativeTarget, NativeFunctionDecl>;
}

export interface ModuleSymbol {
  readonly name: string;
  /** The file that declared the module. */
  readonly file: string;
  readonly fileNode: SourceFileNode;
  /** Named declarations, keyed by name. */
  readonly declarations: ReadonlyMap<string, DeclarationSymbol>;
  /** Routes are unnamed; kept in source order. */
  readonly routes: readonly RouteDecl[];
}

/** A language-service-friendly projection of one symbol. */
export interface SymbolInfo {
  readonly name: string;
  readonly kind: SymbolKind;
  readonly module: string;
  readonly span: Span;
  /** Rendered signature, e.g. `fn fullName(first: String, last: String) -> String`. */
  readonly signature: string;
}

/** The semantic model exposed to the IDE and language service. */
export interface SemanticModel {
  readonly modules: readonly {
    readonly name: string;
    readonly file: string;
    readonly symbols: readonly SymbolInfo[];
  }[];
}
