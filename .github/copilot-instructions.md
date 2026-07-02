# Coding Agent Instructions for ClearKrypt IDE

## Project identity

This repository is for ClearKrypt: a programming language, compiler toolchain, and native IDE.

It is not an app project. Do not introduce unrelated product assumptions.

## Primary objective

Build a language toolchain that can parse `.ck` source, type-check it, lower it into target-neutral IR, and emit readable Swift, Kotlin, and React/TypeScript.

Then build a native IDE around that toolchain.

## Architecture rules

- Keep parser, type checker, IR, emitters, CLI, LSP, and IDE as separate packages.
- Do not couple target emitters directly to parser internals.
- Emitters should consume resolved IR.
- Diagnostics must include source spans.
- Generated code must be stable and snapshot tested.
- Platform-specific behavior must be explicit.
- Do not silently drop unsupported features for a target.

## Implementation preference

Start with TypeScript for the compiler, CLI, language server, formatter, and emitters.

Use a native desktop shell for the IDE, beginning with macOS if necessary. The editor engine can be embedded for MVP, but compiler and LSP integration matter more than custom editor rendering.

## First implementation slice

Create the smallest complete compiler path:

1. Read `.ck` file.
2. Tokenize.
3. Parse module, model, enum, and function basics.
4. Type-check primitive model fields.
5. Lower to IR.
6. Emit Swift, Kotlin, and TypeScript model files.
7. Add snapshot tests.
8. Add CLI command to run it.

## Required package layout

Use this shape unless there is a strong reason to change it:

```text
packages/
  compiler-core/
  emitter-swift/
  emitter-kotlin/
  emitter-react/
  cli/
  language-server/
  formatter/
  ide-core/
  ide-native/
examples/
tests/
docs/
```

## Source of truth

The docs in `/docs` are the current product contract. If implementation changes language behavior, update the docs in the same PR.

## Testing rules

Add tests for every syntax feature and every emitter feature.

Use snapshots for generated code. Generated-code diffs should be intentional.

## Agent boundaries

Stay in your assigned package or document lane unless necessary. If you edit shared root files, explain why.

## Do not do these things

- Do not turn this into a no-code builder.
- Do not build an app before the compiler exists.
- Do not add unrelated business-domain files.
- Do not hard-code one target in shared compiler logic.
- Do not generate unreadable code.
- Do not rely on chat history as the only specification.

## Pull request checklist

Every PR should include:

- What changed.
- Why it changed.
- Tests run.
- Known gaps.
- Follow-up tasks.
