# Agent Worktrees and Commands

## Purpose

This repo is intended to support multiple coding agents working in parallel. Agents should use isolated branches and worktrees, with clear ownership boundaries.

Do not let one agent rewrite the whole repo while another agent is building a subsystem.

## Branch naming

Use this format:

```text
agent/<lane>/<short-task>
```

Examples:

```text
agent/compiler/lexer-parser
agent/compiler/typechecker
agent/emitter/swift
agent/emitter/kotlin
agent/emitter/react
agent/ide/native-shell
agent/lsp/language-server
agent/docs/spec-cleanup
agent/tests/fixtures
```

## Local setup

```bash
git clone https://github.com/Gitbub0816/clearkrypt_IDE.git
cd clearkrypt_IDE
```

Create a worktree for each agent lane:

```bash
git fetch origin

git worktree add ../ck-compiler-lexer -b agent/compiler/lexer-parser main
git worktree add ../ck-typechecker -b agent/compiler/typechecker main
git worktree add ../ck-emitter-swift -b agent/emitter/swift main
git worktree add ../ck-emitter-kotlin -b agent/emitter/kotlin main
git worktree add ../ck-emitter-react -b agent/emitter/react main
git worktree add ../ck-ide-native -b agent/ide/native-shell main
git worktree add ../ck-lsp -b agent/lsp/language-server main
```

## Agent lanes

### Compiler frontend agent

Owns:

- `packages/compiler-core/src/lexer/`
- `packages/compiler-core/src/parser/`
- `packages/compiler-core/src/ast/`
- lexer/parser tests

Initial task:

- Create tokens.
- Parse module/import/model/enum/function basics.
- Preserve source spans.
- Produce useful syntax diagnostics.

### Type system agent

Owns:

- `packages/compiler-core/src/symbols/`
- `packages/compiler-core/src/types/`
- semantic diagnostics

Initial task:

- Build symbol table.
- Resolve imports.
- Validate primitive types.
- Validate model field types.
- Validate function signatures.

### IR agent

Owns:

- `packages/compiler-core/src/ir/`
- lowering tests

Initial task:

- Define neutral IR.
- Lower typed AST into IR.
- Snapshot IR for fixtures.

### Swift emitter agent

Owns:

- `packages/emitter-swift/`
- Swift output snapshots

Initial task:

- Emit models.
- Emit simple enums.
- Emit pure functions.
- Emit minimal SwiftUI screen stubs.

### Kotlin emitter agent

Owns:

- `packages/emitter-kotlin/`
- Kotlin output snapshots

Initial task:

- Emit data classes.
- Emit simple enums.
- Emit pure functions.
- Emit minimal Compose screen stubs.

### React emitter agent

Owns:

- `packages/emitter-react/`
- React output snapshots

Initial task:

- Emit TypeScript types.
- Emit simple enums.
- Emit pure functions.
- Emit minimal React component stubs.

### CLI agent

Owns:

- `packages/cli/`

Initial task:

- `clearkrypt new`
- `clearkrypt check`
- `clearkrypt build`
- `clearkrypt emit`

### Language server agent

Owns:

- `packages/language-server/`

Initial task:

- LSP startup.
- Open document.
- Publish diagnostics.
- Document symbols.
- Basic completions.

### IDE agent

Owns:

- `packages/ide-native/`
- `packages/ide-core/`

Initial task:

- Native shell.
- Project navigator.
- Editor host.
- Diagnostics panel.
- Build command runner.
- Generated output explorer.

### Docs agent

Owns:

- `docs/`
- examples documentation

Initial task:

- Keep docs synchronized with actual implementation.
- Add examples for every supported syntax feature.

## Merge discipline

Before opening a PR:

```bash
npm install
npm run check
npm run test
npm run build
```

If scripts do not exist yet, the agent that creates the monorepo must add them.

Each PR should include:

- Summary.
- Files changed.
- Tests run.
- Known gaps.
- Follow-up tasks.

## Protected boundaries

Agents should not edit files outside their lane unless necessary. If necessary, explain it in the PR.

Core shared files likely to create conflicts:

- root `package.json`
- root `tsconfig.json`
- `packages/compiler-core/src/index.ts`
- fixture files
- snapshot files

Coordinate changes to shared files.

## Initial repo bootstrap command

The first implementation agent should create the monorepo skeleton:

```bash
npm init -y
npm pkg set type="module"
npm pkg set scripts.check="tsc -b"
npm pkg set scripts.test="vitest run"
npm pkg set scripts.build="tsc -b"
npm install -D typescript vitest tsx @types/node
```

Then create packages and TypeScript project references.

## Suggested package manager

Use npm at first for simplicity. Move to pnpm only when workspace complexity requires it.

## First fixture

Create:

```text
tests/fixtures/hello-world/src/main.ck
```

With:

```ck
module app

model User {
  id: ID
  name: String
}

fn greet(user: User) -> String {
  return "Hello, " + user.name
}
```

## First acceptance command

```bash
npm run build
npm run test
node packages/cli/dist/index.js build tests/fixtures/hello-world --targets swift,kotlin,react
```

## Agent behavior rules

- Prefer small complete slices over huge partial rewrites.
- Keep generated snapshots stable.
- Add tests for every syntax feature.
- Do not invent final language semantics without updating docs.
- Do not couple emitters directly to parser internals.
- Keep all target-specific behavior behind lowering/emitter boundaries.
