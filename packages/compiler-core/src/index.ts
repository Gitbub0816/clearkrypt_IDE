/**
 * @clearkrypt/compiler-core public API.
 *
 * Constitution (Document 5, Compiler API law): compiler internals expose
 * APIs useful to the CLI, language service, IDE, and agents. The pipeline
 * grows here stage by stage:
 *
 *   lex(source)          -> tokens + diagnostics
 *   parseSource(source)  -> AST + diagnostics
 *   checkProject(files)  -> semantic model + diagnostics
 *   lowerProject(check)  -> IR + diagnostics
 *
 * Emitters live in @clearkrypt/emitter-* and consume the IR via the
 * emit contract exported here.
 */

export const CLEARKRYPT_VERSION = '0.1.0';

// Text and spans.
export * from './text/span';
export * from './text/sourceFile';

// Diagnostics.
export * from './diagnostics/diagnostic';
export * from './diagnostics/codes';

// Syntax: tokens and AST.
export * from './syntax/tokens';
export * from './syntax/ast';

// Lexer.
export { lex, decodeStringLiteral } from './lex/lexer';
export type { LexOptions, LexResult } from './lex/lexer';

// Parser.
export { parseSource } from './parse/parser';
export type { ParseResult } from './parse/parser';

// Debug printing (tokens and AST outline views).
export { printTokens, printAst } from './syntax/debugPrint';

// Semantic checking.
export { checkProject, checkParsedProject } from './sem/checker';
export type { CheckedProject, CallResolution } from './sem/checker';
export type { SemType } from './sem/types';
export { typeToString, typesAssignable, primitiveType } from './sem/types';
export type {
  DeclarationSymbol,
  ModuleSymbol,
  SemanticModel,
  SymbolInfo,
  SymbolKind,
} from './sem/symbols';

// IR and lowering.
export * from './ir/nodes';
export * as irSamples from './ir/testFixtures';
export { lowerProject } from './lower/lower';
export type { LowerResult, LowerOptions } from './lower/lower';
export { printIr } from './lower/debugPrint';

// Emitter contract.
export * from './emit/contract';

// Project manifest.
export { parseManifest } from './project/manifest';
export type { ProjectManifest, ManifestParseResult } from './project/manifest';
