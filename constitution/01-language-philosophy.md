# ClearKrypt Constitution — Document 1: Language Philosophy

## 1. Purpose of this document

This document defines the philosophical foundation of ClearKrypt.

Every future syntax rule, compiler phase, IDE feature, backend decision, standard-library addition, package-manager feature, and agent contribution must be measured against this document.

ClearKrypt is not merely a transpiler. ClearKrypt is a human-readable, visual, native-power application language with a compiler and IDE designed as one system.

## 2. The central thesis

ClearKrypt exists to let humans express software architecture clearly, then let the compiler produce serious native code for real platforms.

The compiler should adapt to the human mental model. The human should not be forced to write low-level ceremony only because a backend requires it.

The language should be readable enough that a skilled developer can understand intent quickly, but powerful enough that the output is not toy code.

## 3. The primary promise

A ClearKrypt source file should describe what the developer means in a way that is:

- readable as architecture
- checkable by the compiler
- visualizable by the IDE
- portable across selected targets
- inspectable in generated native code
- refactorable by tools and agents

The language is successful only when source, compiler, visual model, and generated output stay aligned.

## 4. Human readability is not optional

Syntax is a product feature.

ClearKrypt must be designed so code can be read by humans first and machines second. That does not mean the grammar is vague. It means the grammar should make common intent obvious.

Readable syntax should prefer:

- explicit names
- clear declarations
- predictable nesting
- meaningful keywords
- strong formatting rules
- direct relationship between code and generated behavior

Readable syntax should avoid:

- symbolic cleverness for ordinary app code
- hidden behavior
- excessive punctuation
- magical global context
- abbreviations that save typing but obscure meaning
- syntax that only compiler authors enjoy

## 5. Visual does not mean no-code

ClearKrypt should be a visual language, but not a no-code platform.

The source code remains the source of truth. Visual tools are synchronized views of compiler-understood structure.

The IDE may show:

- route graphs
- component trees
- model diagrams
- state machines
- effect graphs
- dependency graphs
- build graphs
- AST views
- IR views
- generated-code maps

But every visual node must map back to source.

If a visual edit is ever allowed, it must produce clean ClearKrypt source. The text form is authoritative.

## 6. Native power is a goal

ClearKrypt should aim toward Swift-like expressive power where practical.

That does not mean cloning Swift syntax or pretending all platforms are identical. It means ClearKrypt should support serious software concepts:

- strong static typing
- value-oriented data
- typed errors
- async workflows
- protocol/interface style contracts
- generics
- modules and packages
- explicit capabilities
- target-specific native escape hatches
- reliable compiler diagnostics
- readable generated output

A cross-platform language becomes weak when it hides platform power. ClearKrypt should expose power explicitly and safely.

## 7. Portability must be honest

ClearKrypt must never lie about portability.

If a feature cannot be represented safely on Swift, Kotlin, and React/TypeScript, the compiler must either:

- reject it for the selected targets
- require a target-specific implementation
- require a fallback
- require the user to narrow the target set

Silent degradation is forbidden.

## 8. Generated code must be respected

Generated code is not garbage output. It is part of the developer experience.

Generated Swift should look like reasonable Swift. Generated Kotlin should look like reasonable Kotlin. Generated React/TypeScript should look like reasonable React/TypeScript.

The generated code should be:

- formatted
- stable across builds
- navigable
- source-mapped
- debuggable
- separated from handwritten native code
- readable enough for platform developers

A language that emits unreadable output cannot earn trust.

## 9. The compiler is a teacher

Compiler diagnostics should not merely say no. They should explain.

A good ClearKrypt diagnostic should answer:

- what failed
- where it failed
- why it failed
- which target is affected
- what the developer can do next

The IDE should surface this both textually and visually.

## 10. The IDE is part of the language

ClearKrypt cannot be fully understood through text alone.

The IDE is not an optional accessory. It is a first-class frontend into the compiler.

The IDE should expose:

- source
- symbols
- diagnostics
- visual structure
- compiler phases
- generated output
- target comparison
- build graph
- package graph

The IDE should help the user see what the compiler sees.

## 11. ClearKrypt should favor explicit architecture

Software should be organized around concepts humans understand:

- models
- screens
- components
- services
- routes
- effects
- states
- capabilities
- packages
- modules

The language should make architecture visible rather than burying it in framework glue.

## 12. Magic must be earned

ClearKrypt may infer repetitive details, but inference must be explainable.

The IDE should be able to show what was inferred and why.

Forbidden magic:

- invisible dependencies
- untraceable generated code
- target behavior that changes silently
- implicit global state
- framework conventions that cannot be inspected

Allowed inference:

- local type inference
- obvious imports suggested by tooling
- generated serializers from declared models
- route parameter binding from explicit routes
- UI mapping from explicit component trees

## 13. The language should be learnable in layers

A beginner should be able to write a model, a function, and a screen without understanding the entire compiler.

An expert should be able to inspect lowering, generated code, target mappings, performance, and interop.

ClearKrypt must support both levels without splitting into two languages.

## 14. The platform model

ClearKrypt should compile to first-class targets:

- Swift for Apple-native code
- Kotlin for Android and JVM-style code
- React/TypeScript for web interfaces

Other targets may be added later, but they must not distort the core language prematurely.

The language should be target-aware, not target-blind.

## 15. The role of native interop

Native interop is not a failure. It is a required feature.

ClearKrypt should make native interop:

- explicit
- typed
- target-gated
- visible in the IDE
- checked by the compiler

Native interop should never be a hidden hole in the type system.

## 16. The standard of seriousness

ClearKrypt should be designed as though real teams will eventually build production software with it.

That means the language must care about:

- testing
- documentation
- versioning
- compatibility
- package management
- refactoring
- CI
- diagnostics
- generated-code stability
- performance
- debugging

A toy language can ignore these. ClearKrypt cannot.

## 17. AI and agent compatibility

ClearKrypt should be excellent for coding agents because its source is structured, explicit, visualizable, and compiler-checkable.

Agents should be able to:

- read docs as source of truth
- inspect compiler diagnostics
- modify isolated packages
- generate tests
- compare target output
- operate in Git worktrees
- update docs when behavior changes

Agent convenience must not override language quality, but agent compatibility is a major design advantage.

## 18. Evolution principle

ClearKrypt must evolve deliberately.

New features should be accepted only when they:

- improve human readability
- preserve compiler clarity
- map honestly to targets
- improve or preserve generated-code quality
- remain visualizable by the IDE
- can be tested
- do not create hidden behavior

## 19. Non-negotiable laws

These laws define the project:

1. Source code is the source of truth.
2. Syntax must serve human understanding.
3. Visual views must map to source.
4. Generated code must be readable.
5. Target differences must be explicit.
6. Diagnostics must be useful.
7. Native power must remain accessible.
8. The compiler must not silently degrade behavior.
9. The IDE is part of the language experience.
10. Every feature must justify itself across source, compiler, IDE, and target output.

## 20. First-pass status

This is the first constitutional pass. It is authoritative enough for early agents to use, but it should evolve as the grammar, type system, IR, and IDE specifications become more formal.
