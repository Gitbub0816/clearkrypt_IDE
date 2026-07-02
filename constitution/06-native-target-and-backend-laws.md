# ClearKrypt Constitution — Document 6: Native Target and Backend Laws

## 1. Purpose

This document defines the constitutional laws for ClearKrypt's native targets and backend emitters.

ClearKrypt's credibility depends on whether it can produce serious Swift, Kotlin, and React/TypeScript output without hiding target differences or generating unreadable code.

## 2. Core backend thesis

ClearKrypt is not a lowest-common-denominator transpiler.

It is a source language that expresses shared intent and then lowers that intent into platform-appropriate target code.

The backend system must respect both sides:

- ClearKrypt source remains the source of truth.
- Target output must feel natural enough for real platform developers.

## 3. First-class targets

The initial first-class targets are:

- Swift for Apple platforms.
- Kotlin for Android and JVM-oriented platforms.
- React with TypeScript for web applications.

Additional targets may be added later only if they do not distort the core language prematurely.

## 4. Target honesty law

The compiler must never claim a feature is portable when it is not.

If behavior differs across targets, the compiler and IDE must expose the difference.

Possible outcomes:

- compile successfully for all selected targets
- compile with documented target-specific lowering
- require native implementations
- require a fallback
- reject for selected targets
- require narrowing the selected target set

Silent degradation is forbidden.

## 5. Generated-code quality law

Generated code is part of ClearKrypt's public interface.

Generated target code must be:

- readable
- formatted
- stable
- source-mapped
- debuggable
- reasonably idiomatic
- separated from handwritten native code
- testable by normal target tooling

A backend that emits unreadable code is not complete.

## 6. Backend responsibility boundary

Backends emit target code. They do not define language semantics.

Language semantics belong to:

- parser
- semantic model
- type checker
- IR
- target lowering

Emitters own:

- target file layout
- target imports
- naming adaptation
- target syntax
- target helper calls
- generated comments
- formatter handoff

## 7. Swift backend law

Swift output should favor native Swift patterns.

Expected mappings:

- model -> struct where possible
- enum -> enum where possible
- associated enum -> enum with associated values
- protocol -> protocol
- async function -> async function
- typed failure -> documented throwing/result policy
- screen -> SwiftUI View
- component -> SwiftUI View or function-style view helper

Swift output should not look like TypeScript translated into Swift.

## 8. Kotlin backend law

Kotlin output should favor native Kotlin patterns.

Expected mappings:

- model -> data class
- enum -> enum class when simple
- associated enum -> sealed interface/class hierarchy
- protocol -> interface
- async function -> suspend function
- screen -> Jetpack Compose composable
- component -> composable function

Kotlin output should not look like Swift translated into Kotlin.

## 9. React TypeScript backend law

React output should favor modern TypeScript and React patterns.

Expected mappings:

- model -> type/interface
- enum -> literal union or discriminated union
- protocol -> interface/type contract
- async function -> async function returning Promise or result policy
- screen -> React component
- component -> React component
- route -> route object or framework-specific route adapter

React output should not require a heavy runtime for simple apps.

## 10. Target helper libraries

Small target helper libraries are allowed.

They should be:

- modular
- documented
- versioned
- optional where possible
- stable across generated output
- small enough to inspect

A heavy universal runtime should not be required for basic projects.

## 11. File layout law

Generated target files should have stable paths.

Recommended structure:

```text
generated/
  swift/
  kotlin/
  react/
```

Handwritten target supplements should live separately:

```text
native/
  swift/
  kotlin/
  react/
```

Generated and handwritten files must not be mixed casually.

## 12. Source mapping law

Backends must preserve mapping from generated output to ClearKrypt declarations wherever practical.

The IDE should answer:

- which `.ck` declaration produced this file
- which `.ck` line produced this generated member
- which target lowering rule was used
- which helper library is required

## 13. Target naming law

Backends may adapt names to target conventions, but the mapping must remain traceable.

Examples:

- ClearKrypt model `UserProfile` remains recognizable in every target.
- Field names should not be arbitrarily renamed.
- Reserved target keywords may be escaped or adapted predictably.

## 14. Unsupported feature law

If a backend cannot emit a feature correctly, it must fail with a diagnostic.

Bad behavior:

- emitting broken code
- dropping a field
- replacing typed errors with strings silently
- ignoring capability requirements
- omitting route parameters

Correct behavior:

- clear diagnostic
- target name
- source span
- suggested fix

## 15. Target capability law

Each backend should declare target capabilities.

Examples:

- supports native associated enums
- supports nullable types
- supports async/await
- supports declarative UI
- supports typed thrown errors
- supports package dependency emission

The compiler should use capability declarations during target lowering.

## 16. Formatting law

Generated code should be passed through target formatters or deterministic internal formatters.

Preferred direction:

- Swift: Swift formatter strategy
- Kotlin: Kotlin formatter strategy
- TypeScript: Prettier-compatible strategy

Formatting must be stable enough for snapshot tests.

## 17. Snapshot law

Every backend feature must have generated-code snapshots.

A backend change is not trustworthy until snapshots show exactly what changed.

## 18. Native interop law

Native code is allowed, but must be explicit, typed, target-gated, and visible.

A shared ClearKrypt declaration may call native behavior only if selected targets are satisfied.

## 19. Build integration law

Backends should eventually emit target project scaffolding that can be opened by normal platform tools.

Examples:

- Xcode-compatible Swift output
- Android Studio-compatible Kotlin output
- Vite or framework-compatible React output

MVP may emit files before full projects.

## 20. Constitutional test

A backend design choice should answer:

1. Is the generated code readable?
2. Is the target behavior honest?
3. Is the output source-mapped?
4. Does it use native target patterns?
5. Is it snapshot-tested?
6. Does it avoid unnecessary runtime dependency?
7. Does the IDE understand the mapping?
8. Does it preserve ClearKrypt semantics?

If not, redesign it.
