# ClearKrypt Constitution — Document 5: Compiler and IR Laws

## 1. Purpose

This document defines the constitutional laws for the ClearKrypt compiler and intermediate representations.

The compiler is the bridge between human-readable source, visual IDE understanding, and generated native output.

## 2. Core compiler thesis

The compiler must preserve intent.

ClearKrypt source describes human architecture. The compiler must transform that source into checked meaning, visualizable structure, and target-specific code without losing traceability.

## 3. Required compiler phases

The compiler should be organized into clear phases:

1. Source loading
2. Lexing
3. Parsing
4. AST construction
5. Symbol resolution
6. Type checking
7. Semantic model construction
8. High-level IR lowering
9. Mid-level IR lowering
10. Target-specific lowering
11. Code emission
12. Formatting
13. Source map generation
14. Diagnostics output

Early MVP may combine some phases internally, but the architecture should not erase the conceptual boundaries.

## 4. Source loading

Source loading should understand projects, modules, file paths, target settings, native folders, generated folders, and config files.

The compiler must know which files are source, generated, handwritten native, config, assets, and docs.

## 5. Lexer law

The lexer must preserve source spans.

Every meaningful token must know:

- file
- start offset
- end offset
- start line
- start column
- end line
- end column

Without spans, diagnostics, visual mapping, and generated-code mapping become weak.

## 6. Parser law

The parser should produce structured syntax and recover from common errors.

The IDE must continue working while the user types incomplete code.

Parser diagnostics should be precise and should not cascade excessively from one mistake.

## 7. AST law

The AST represents source structure, not target code.

AST nodes should preserve enough information for:

- diagnostics
- formatting
- outline
- symbol collection
- semantic checking

Emitters should not depend directly on raw AST except in controlled early prototypes.

## 8. Symbol law

Symbol resolution must be explicit and inspectable.

The compiler should know where every resolved symbol came from.

This enables:

- go to definition
- rename
- find references
- import suggestions
- dependency graphs
- visual diagrams

## 9. Type-checking law

Type checking must produce a trusted semantic model.

The compiler should not emit code from unchecked source.

If a project has errors, the compiler may produce partial IDE data, but build output must be clearly marked invalid or partial.

## 10. Semantic model law

The semantic model is the compiler's resolved understanding of the program.

It should include:

- resolved declarations
- resolved symbols
- resolved types
- module relationships
- route relationships
- component relationships
- model relationships
- function calls
- target requirements
- diagnostics

The semantic model powers the IDE and IR.

## 11. IR purpose

IR exists to prevent target emitters from becoming three separate compilers.

ClearKrypt should lower source into a target-neutral representation before generating Swift, Kotlin, and React/TypeScript.

## 12. HIR and MIR

ClearKrypt should eventually use at least two IR levels.

### HIR

High-level IR preserves language concepts:

- models
- enums
- functions
- screens
- components
- routes
- effects
- services
- capabilities

### MIR

Mid-level IR is closer to code generation:

- resolved control flow
- normalized expressions
- lowered types
- explicit calls
- target capability metadata

MVP can start with one IR, but the architecture should leave room for HIR and MIR.

## 13. Target lowering law

Target lowering converts IR into target-specific forms.

Examples:

- model to Swift struct
- model to Kotlin data class
- model to TypeScript type
- screen to SwiftUI view
- screen to Compose function
- screen to React component

Target lowering must be explicit and testable.

## 14. Emitter law

Emitters write target code. They do not decide language semantics.

Emitters must not invent behavior that was not represented in semantic model or IR.

Emitters own:

- file layout
- imports
- naming adaptation
- target syntax
- generated comments
- formatter handoff

## 15. Diagnostic law

Diagnostics must be structured.

A diagnostic should include:

- code
- severity
- message
- source span
- optional target
- optional related spans
- optional fix

The IDE should render diagnostics in text and visual views.

## 16. Generated-code law

Generated code must be stable, readable, and source-mapped.

Generated code should include a short header identifying ClearKrypt as the generator and the source file where practical.

Generated code should avoid unnecessary churn so diffs remain meaningful.

## 17. Source-map law

The compiler should produce mappings between:

- source declarations and AST nodes
- AST nodes and semantic declarations
- semantic declarations and IR nodes
- IR nodes and generated files
- generated ranges and source ranges where practical

This is essential for the IDE.

## 18. Incrementality law

The compiler should eventually support incremental compilation.

MVP may compile the full project, but data structures should not prevent later incremental work.

## 19. Formatter law

Formatting is part of the compiler toolchain.

The formatter must be deterministic.

The formatter should preserve meaning and reduce style debate.

## 20. Testing law

Each compiler phase requires tests.

Required test types:

- lexer token snapshots
- parser snapshots
- semantic diagnostics
- type checking tests
- IR snapshots
- target emitter snapshots
- CLI integration tests
- generated-code stability tests

## 21. Target honesty law

The compiler must not silently downgrade behavior for a target.

If something cannot compile to Swift, Kotlin, or React/TypeScript correctly, the compiler must say so.

## 22. Runtime law

ClearKrypt should prefer generated native code plus small helper libraries over a heavy universal runtime.

Runtime dependencies must be explicit.

## 23. Compiler API law

Compiler internals should expose APIs useful to the IDE and agents.

Important APIs:

- parse document
- check project
- get symbols
- get diagnostics
- get AST
- get semantic model
- get IR
- emit target
- get generated mapping

## 24. Agent law

Coding agents should work against compiler boundaries.

Separate lanes:

- lexer/parser
- type checker
- IR
- Swift emitter
- Kotlin emitter
- React emitter
- CLI
- IDE
- tests
- docs

Agents must update docs when behavior changes.

## 25. MVP compiler spine

The first compiler spine should support:

- reading `.ck`
- lexing
- parsing modules, imports, models, simple enums, and functions
- basic type checking
- IR lowering
- Swift model output
- Kotlin model output
- TypeScript model output
- CLI command
- snapshot tests

This should happen before advanced syntax or deep IDE work.

## 26. Constitutional test

A compiler design choice should answer:

1. Does it preserve source intent?
2. Does it improve diagnostics?
3. Does it keep target emitters clean?
4. Does it support visual IDE views?
5. Does it preserve generated-code readability?
6. Does it allow testing?
7. Does it avoid hidden semantics?
8. Does it leave room for incremental compilation?

If not, redesign it.
