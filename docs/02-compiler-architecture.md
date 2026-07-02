# Compiler Architecture

ClearKrypt compiler converts `.ck` source into Swift, Kotlin, and React TypeScript output.

## Pipeline

- read source files
- tokenize source
- parse tokens into AST
- build symbol table
- type check declarations and expressions
- lower checked AST into target neutral IR
- lower IR for selected targets
- emit target code
- format output
- write generated files

## Packages

- compiler core
- Swift emitter
- Kotlin emitter
- React emitter
- CLI
- language server
- formatter
- IDE core
- native IDE

## Lexer

The lexer owns tokens and source spans. Every token needs file, offset, line, and column information.

## Parser

The parser owns syntax structure and syntax diagnostics. It should recover from common syntax problems so the IDE can keep working while the user types.

## AST

The AST represents ClearKrypt source intent. It should include modules, imports, models, enums, functions, screens, components, routes, errors, and native blocks.

## Symbol table

The symbol table tracks project, module, declaration, function, screen, component, and local scopes. It powers definition lookup, rename, references, completion, and import suggestions.

## Type checker

The type checker validates names, duplicates, field types, function signatures, return behavior, optional access, route parameters, component arguments, and target constraints.

## IR

The IR is the stable contract between compiler frontend and target emitters. Emitters should consume IR rather than parser structures.

## Emitters

Each target emitter owns file layout, naming, imports, templates, formatting handoff, and snapshot tests. Emitters must report unsupported features instead of generating broken output.

## Diagnostics

Diagnostics need code, severity, message, source span, optional target, and optional fix.

Initial codes: CK0001 unknown symbol, CK0002 duplicate declaration, CK0003 type mismatch, CK0004 unsupported target feature, CK0005 missing native implementation, CK0006 invalid route parameter.

## Testing

Required tests include lexer snapshots, parser snapshots, type diagnostics, IR snapshots, target emitter snapshots, and CLI integration tests.

## MVP acceptance

A sample project must parse, type check, lower to IR, and emit stable Swift, Kotlin, and TypeScript output.
