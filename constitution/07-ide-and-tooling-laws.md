# ClearKrypt Constitution — Document 7: IDE and Tooling Laws

## 1. Purpose

This document defines the constitutional laws for the ClearKrypt IDE and tooling ecosystem.

ClearKrypt is not only a language. It is a language, compiler, IDE, package system, formatter, linter, debugger, and generated-code inspector designed as one coherent developer experience.

## 2. Core IDE thesis

The IDE is a first-class frontend into the compiler.

It should show what the compiler understands, not merely decorate text.

A ClearKrypt developer should be able to move between:

- source code
- visual diagrams
- compiler diagnostics
- generated code
- target comparison
- build output
- package information
- debugger state

without losing the thread of the program.

## 3. Source authority law

The IDE must preserve source as truth.

Visual tools, refactors, completions, quick fixes, and agent edits must produce valid `.ck` source and normal project files.

No IDE feature may create hidden application behavior that is unavailable in source.

## 4. Compiler dependency law

The IDE must use compiler services for language understanding.

It should not maintain a separate interpretation of the language.

IDE language features should rely on:

- lexer/parser
- AST
- semantic model
- symbol table
- type checker
- IR
- generated mapping
- diagnostics

## 5. Native quality law

The IDE should eventually feel like a real native development environment, not a thin web form around a compiler.

MVP may embed a proven editor engine, but the long-term experience should be fast, visual, stable, and project-aware.

## 6. Core IDE surfaces

The IDE should include:

- project navigator
- source editor
- diagnostics panel
- symbol outline
- visual graph area
- generated output explorer
- target comparison view
- build panel
- terminal/task output
- package/dependency panel
- settings
- compiler debug views

## 7. Project navigator law

The project navigator must understand ClearKrypt project structure.

It should distinguish:

- ClearKrypt source
- generated target code
- handwritten native code
- tests
- assets
- config
- docs
- examples

It should not treat every file as a generic blob.

## 8. Editor law

The editor must support:

- syntax highlighting
- semantic highlighting
- diagnostics
- hover
- completion
- formatting
- go to definition
- references
- rename
- code actions
- source mapping

Editor features should degrade gracefully while code is incomplete.

## 9. Diagnostics law

Diagnostics must be visible, useful, and actionable.

The IDE should show diagnostics in:

- editor gutter
- inline underline
- diagnostics panel
- visual graph overlays
- target comparison view

Diagnostics should link to source and generated output when relevant.

## 10. Generated output law

The IDE must make generated code inspectable.

Generated files should open read-only by default and show their source mapping.

The user should be able to answer:

- why was this file generated?
- which ClearKrypt declaration produced it?
- which target lowering rule was used?
- what changed since the last build?

## 11. Visual view law

Visual views must be synchronized with compiler data.

The IDE should not invent diagrams from untrusted parsing.

Each visual node should map to source, semantic model, IR, or generated output.

## 12. Target comparison law

The IDE must expose target differences clearly.

A developer should be able to select a declaration and see how it maps to Swift, Kotlin, and React/TypeScript.

If a target has limitations, the IDE should show them before build failure where possible.

## 13. Formatter law

The formatter is part of the developer contract.

The IDE should offer:

- format document
- format on save
- stable imports
- stable declaration spacing
- deterministic output

The formatter should reduce style debate and help generated or visual edits produce clean source.

## 14. Linter law

The linter should enforce project quality beyond type correctness.

Examples:

- naming conventions
- unused declarations
- overly large files
- target-specific leakage
- public API without documentation
- confusing visual structure

Lints should be explainable and configurable.

## 15. CLI law

The CLI must be reliable and scriptable.

Core commands should include:

- create project
- check
- build
- emit target
- format
- test
- run language service
- inspect compiler output

CLI output should support both human-readable and machine-readable formats.

## 16. Package manager law

The package manager should understand ClearKrypt packages and target dependencies.

It should manage:

- ClearKrypt libraries
- target helper libraries
- Swift dependencies
- Kotlin dependencies
- TypeScript dependencies
- version constraints
- compatibility metadata

Package behavior must be documented and reproducible.

## 17. Debugger law

ClearKrypt debugging should eventually connect source to generated target behavior.

The debugger should help the user understand:

- ClearKrypt source location
- generated target location
- runtime state
- async flow
- effect/capability behavior

MVP may focus on compiler inspection before runtime debugging.

## 18. Compiler inspection law

The IDE should include developer-mode views for:

- tokens
- AST
- symbols
- types
- semantic model
- IR
- target lowering
- emitted files

These views help language developers and agents debug the compiler.

## 19. Agent orchestration law

The IDE may eventually orchestrate coding agents, but agents must operate through source, tests, compiler diagnostics, and Git.

Agent features should include:

- worktree creation
- lane assignment
- changed-file inspection
- build/test execution
- generated-output comparison
- PR summary generation

Agents must not bypass the language contract.

## 20. Settings law

Project settings that affect builds belong in versioned config.

User interface preferences belong in local user settings.

The IDE must not hide build-critical behavior in local-only settings.

## 21. Accessibility law

Syntax coloring and visual tools must not be the only way to understand code.

The IDE should remain usable with themes, high contrast, screen readers where practical, and text-first workflows.

## 22. MVP tooling

The first tooling milestone should include:

- CLI check/build/emit
- formatter stub
- language intelligence basics
- native IDE shell
- project tree
- editor
- diagnostics panel
- generated output explorer
- simple visual outline

## 23. Constitutional test

A tooling feature should answer:

1. Does it preserve source authority?
2. Does it use compiler data?
3. Does it improve understanding?
4. Does it expose target behavior honestly?
5. Does it help diagnostics or refactoring?
6. Does it avoid hidden project state?
7. Can it be tested?
8. Does it support both humans and agents?

If not, defer it.
