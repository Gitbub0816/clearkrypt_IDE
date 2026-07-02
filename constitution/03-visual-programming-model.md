# ClearKrypt Constitution — Document 3: Visual Programming Model

## 1. Purpose

This document defines what ClearKrypt means by visual programming.

ClearKrypt is a visual language because the compiler understands enough structure to render the program as graphs, trees, flows, maps, and target comparisons. It is not visual because code is replaced by boxes.

The source file remains authoritative.

## 2. Core visual thesis

ClearKrypt code should have multiple synchronized representations:

- source code
- symbol outline
- route graph
- component tree
- model graph
- state graph
- effect graph
- build graph
- AST view
- IR view
- generated target output

All views must describe the same program.

## 3. Source is the source of truth

The text source is the legal program.

Visual views are projections of compiler-understood meaning. They may help edit the source later, but they must never create hidden behavior.

Any visual edit must produce readable `.ck` source and be reviewable as a text diff.

## 4. Required source mapping

Every visual node must map to source spans whenever possible.

Examples:

- a model box maps to its model declaration
- a field maps to the field line
- a route edge maps to the route declaration
- a component node maps to the component call
- a diagnostic maps to both source and visual node
- a generated Swift field maps back to the original ClearKrypt field

If a node cannot be mapped, the IDE must mark it as generated, inferred, or external.

## 5. Visual views are compiler views

Visual views must come from compiler data, not hand-written IDE guesses.

Allowed inputs:

- tokens
- AST
- semantic model
- IR
- target lowering data
- build graph
- generated source map

The IDE should not separately parse the language unless using compiler APIs.

## 6. First-class visual surfaces

ClearKrypt should eventually define these visual surfaces as first-class IDE modes.

### Architecture view

Shows modules, packages, services, screens, routes, models, and dependencies.

### Route view

Shows navigable screens and route parameters.

### Component view

Shows UI trees from screens and components.

### Data model view

Shows models, fields, enums, relationships, and serializers.

### State view

Shows state machines and valid transitions.

### Effect view

Shows async work, capabilities, permissions, and platform requirements.

### Target view

Shows how declarations compile to Swift, Kotlin, and React/TypeScript.

### Compiler view

Shows tokens, AST, semantic model, IR, and lowering.

### Build view

Shows source files, generated files, cache nodes, dependencies, and target outputs.

## 7. Visual editing law

Visual editing must obey these laws:

1. The edit must produce valid ClearKrypt source.
2. The generated source must pass the formatter.
3. The IDE must show what changed.
4. The edit must not hide metadata outside source unless explicitly configured.
5. The compiler must validate the result.

Visual editing is not required for MVP. Read-only visual understanding comes first.

## 8. Visual diagnostics

Diagnostics must appear in source and visual views.

Examples:

- missing route target appears on the route graph
- invalid field type appears on the model diagram
- missing native implementation appears in target view
- unsupported target feature appears in target comparison

## 9. Visual target comparison

A core ClearKrypt feature is seeing what one source declaration becomes across targets.

Example:

```text
ClearKrypt: model User
Swift: User.swift struct User
Kotlin: User.kt data class User
React: User.ts type User
```

The IDE should make this mapping immediate and trustworthy.

## 10. Inference visibility

If the compiler infers something, the IDE must be able to reveal it.

Examples:

- inferred local type
- generated serializer
- route binding
- effect requirement
- target import

Hidden inference is not allowed.

## 11. Visual complexity rule

A visual view should reduce complexity, not add more.

If a visual mode becomes noisier than the source, it should support filtering, grouping, collapsing, and search.

## 12. MVP visual model

The first visual implementation should include:

- symbol outline
- component tree
- route graph
- model relationship view
- generated output mapping
- diagnostics overlay

These are enough to prove that ClearKrypt is genuinely visual while keeping source authoritative.

## 13. Future visual model

Later versions may add:

- visual state-machine editor
- route editor
- model diagram editor
- capability/effect map
- build graph explorer
- compiler phase explorer
- target diff viewer
- agent worktree board

## 14. Constitutional test

A visual feature should be accepted only if it answers:

1. What compiler data powers it?
2. What source does it map to?
3. What user question does it answer?
4. Can it show diagnostics?
5. Can it stay synchronized after edits?
6. Does it preserve text source as truth?

If not, it should wait.
