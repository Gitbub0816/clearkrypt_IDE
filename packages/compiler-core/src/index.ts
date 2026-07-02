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

// IR.
export * from './ir/nodes';
export * as irSamples from './ir/testFixtures';

// Emitter contract.
export * from './emit/contract';
