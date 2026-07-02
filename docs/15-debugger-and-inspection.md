# Debugger and Inspection

## Purpose

ClearKrypt needs excellent inspection tools because the language compiles into multiple targets.

Developers must be able to understand source, compiler state, target lowering, and generated output.

## Compiler inspection

Developer mode should expose:

- tokens
- AST
- symbols
- types
- IR
- target lowering
- emitted files
- diagnostics

## Source mapping

Every emitted file should map back to ClearKrypt source spans.

This enables generated-code navigation, diagnostic explanations, and target comparison.

## Runtime debugging

Full runtime debugging can wait.

MVP should focus on compiler inspection and generated-code mapping.

## Target debugging

Later versions can integrate with:

- Xcode debugging for Swift output
- Android Studio or Gradle debugging for Kotlin output
- browser debugging for React output

## Visual inspection

The IDE should render compiler state visually where useful.

Examples:

- route graph
- component tree
- model graph
- effect graph
- target map

## MVP acceptance

MVP inspection is acceptable when developers can view AST or IR, see diagnostics, and map generated files back to `.ck` source.
