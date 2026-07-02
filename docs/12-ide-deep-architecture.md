# IDE Deep Architecture

## Goal

ClearKrypt IDE should become a native, visual, compiler-aware development environment.

It should be a language workbench for reading, writing, compiling, visualizing, debugging, and comparing multi-target application code.

## Major subsystems

- native shell
- editor host
- project system
- language server client
- compiler service client
- build runner
- diagnostics engine
- visual graph engine
- generated output explorer
- target comparison engine
- worktree manager
- settings system

## Native shell

The first shell can target macOS. Future shells can target Windows and Linux.

Preferred direction: SwiftUI shell first if the goal is native quality.

## Editor host

For MVP, embed a proven editor engine to avoid spending months on text rendering.

Required features:

- syntax highlighting
- diagnostics
- completion
- hover
- rename
- formatting
- semantic tokens
- source-span mapping

## Project system

The IDE should understand source files, generated files, handwritten native files, config files, assets, tests, docs, and target folders.

## Compiler service

The IDE should not duplicate compiler logic. It should call compiler APIs and the language server.

Compiler service outputs:

- diagnostics
- AST
- semantic model
- IR
- target lowering data
- generated-file map
- build graph

## Visual graph engine

The graph engine renders route graphs, component trees, model relationships, state graphs, effect graphs, dependency graphs, and build graphs.

Every visual node must link back to source spans.

## Generated output explorer

The explorer should show generated Swift, Kotlin, and TypeScript, plus source-to-output links and changed files after rebuild.

Generated files should open read-only by default.

## Target comparison

The target comparison engine shows how one ClearKrypt declaration maps across selected targets.

Example:

```text
User model
  Swift: User.swift
  Kotlin: User.kt
  React: User.ts
```

## Worktree manager

The IDE should eventually manage Git worktrees for parallel agents.

Features:

- create worktree
- assign lane
- show branch
- show changed files
- run checks
- compare output

## Debug views

Developer mode should expose tokens, AST, symbols, types, IR, target lowering, and emitted files.

## MVP acceptance

MVP IDE can be accepted when it can open a project, display files, edit `.ck`, show diagnostics, run check/build, select targets, show generated files, and show a simple visual outline.
