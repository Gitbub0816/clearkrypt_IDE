# Development Guide

> This document supports the ClearKrypt Constitution. If it conflicts with
> `/constitution`, the constitution wins.

## Repository layout

```text
constitution/   Highest authority. Every change is measured against it.
docs/           Specifications and guides. Support the constitution.
packages/       The monorepo packages (npm workspaces).
tests/fixtures/ Shared .ck fixtures used by package tests.
```

### Packages

| Package | Role |
| ------- | ---- |
| `@clearkrypt/compiler-core` | Compiler frontend: spans, tokens, lexer, parser, AST, diagnostics, semantic model, type checker, IR. |
| `@clearkrypt/emitter-swift` | Lowers IR to readable Swift. |
| `@clearkrypt/emitter-kotlin` | Lowers IR to readable Kotlin. |
| `@clearkrypt/emitter-react` | Lowers IR to readable TypeScript. |
| `@clearkrypt/formatter` | Deterministic `.ck` formatting (whitespace normalization today). |
| `@clearkrypt/language-service` | Editor intelligence (Milestone 8). |
| `@clearkrypt/cli` | The `clearkrypt` command: new, check, build, emit, format. |
| `ide-core`, `ide-native` | Reserved for the IDE milestones; intentionally empty. |

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer

## Commands

```bash
npm install        # install workspace dependencies
npm run build      # typecheck and build all packages (tsc project references)
npm test           # run all package tests (vitest)
npm run test:watch # watch mode
```

Tests import packages through the `@clearkrypt/*` aliases defined in
`vitest.config.ts`, which resolve to package sources — no build step is
needed before running tests.

## Testing rules

Per the testing strategy (`docs/17-testing-strategy.md`) and the compiler
laws (Constitution Document 5 §20):

- Every language feature needs at least one valid fixture and one invalid
  fixture under `tests/fixtures/`.
- Compiler phases are snapshot-tested (tokens, AST, IR, generated output).
  Review snapshot diffs carefully: they are language behavior changes.
- Emitter output is snapshot-tested per target and must stay byte-stable.

## Conventions

- TypeScript strict mode, `noUncheckedIndexedAccess` enabled.
- Two-space indentation in TypeScript sources.
- Prefer readability over cleverness; small, composable modules.
- Diagnostics carry stable codes (`CK0xxx` semantic, `CK1xxx` syntax) from
  `compiler-core/src/diagnostics/codes.ts`. Never reuse or renumber a code.
- Update the relevant document in `docs/` whenever implementation changes
  behavior. If a change touches language law, it must satisfy the
  constitution first.
