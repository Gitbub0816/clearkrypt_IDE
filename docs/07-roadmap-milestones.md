# Roadmap and Milestones

## Status

| Milestone | State |
| --------- | ----- |
| 0 Repo seed | Done |
| 1 Monorepo skeleton | Done |
| 2 Lexer and parser MVP | Done |
| 3 Symbols and types | Done |
| 4 IR | Done |
| 5 Target emitters MVP | Done |
| 6 CLI MVP | Done |
| 7 UI declarations | Not started (parse/check done; lowering pending) |
| 8 Language server | Done (diagnostics, symbols, hover, completion, semantic tokens, formatting) |
| 9 Native IDE shells | In progress (`ide/windows` C#/Avalonia, `ide/macos` Swift/SwiftUI) |
| 10 Interop MVP | Partially done (parse/check/CK0005 done; build inclusion pending) |
| 11 Packaging and examples | Partially done (SDK packaging + release CI done; more examples pending) |
| 12 IDE quality pass | Not started |

## Milestone 0: Repo seed

Deliverables: README, language vision, language spec, target strategy, IDE architecture, interop strategy, agent worktree guide, and coding-agent instructions.

Acceptance: a coding agent can understand the repo goal without needing chat history.

## Milestone 1: Monorepo skeleton

Deliverables: root package setup, TypeScript config, test runner, package folders, exports, and example fixtures.

Acceptance: `npm run build` and `npm run test` run successfully.

## Milestone 2: Lexer and parser MVP

Deliverables: token model, source spans, lexer, parser, AST nodes, syntax diagnostics, and parser fixture tests.

Supported syntax: module declarations, imports, models, simple enums, function signatures, and simple function bodies.

Acceptance: the hello-world fixture parses and bad syntax produces useful diagnostics.

## Milestone 3: Symbols and types

Deliverables: symbol table, module scope, declaration scope, type resolver, primitive type support, model field validation, and function signature validation.

Acceptance: unknown names, duplicate declarations, and bad field types fail; valid fixtures pass.

## Milestone 4: IR

Deliverables: target-neutral IR model, AST-to-IR lowering, IR snapshots, and capability metadata for target emitters.

Acceptance: valid fixtures lower to stable IR snapshots.

## Milestone 5: Target emitters MVP

Deliverables: Swift emitter, Kotlin emitter, React/TypeScript emitter, and snapshot tests for each emitter.

MVP support: models, simple enums, and pure functions.

Acceptance: hello-world emits stable Swift, Kotlin, and TypeScript.

## Milestone 6: CLI MVP

Deliverables: `clearkrypt new`, `clearkrypt check`, `clearkrypt build`, `clearkrypt emit`, target selection, and machine-readable diagnostics.

Acceptance: a user can create, check, and build a project from the command line.

## Milestone 7: UI declarations

Deliverables: component parser, screen parser, basic UI IR, SwiftUI output, Compose output, and React component output.

Acceptance: a basic screen emits across all three targets.

## Milestone 8: Language server

Deliverables: diagnostics, document symbols, completion basics, hover basics, and formatting hook.

Acceptance: an editor client can open `.ck` files and receive diagnostics.

## Milestone 9: Native IDE shell

Deliverables: desktop app shell, project open flow, file tree, editor host, diagnostics panel, build runner, and generated output explorer.

Acceptance: a user can open a project, edit a file, run check/build, and inspect generated output.

## Milestone 10: Interop MVP

Deliverables: target-gated native function blocks, missing-target diagnostics, native folder conventions, and build inclusion rules.

Acceptance: shared code can call native bindings only when selected targets are satisfied.

## Milestone 11: Packaging and examples

Deliverables: example projects, installation docs, release scripts, basic CI, and smoke tests.

Acceptance: contributors can clone, install, test, and build examples.

## Milestone 12: IDE quality pass

Deliverables: stronger autocomplete, rename, find references, generated-code mapping, AST/IR viewer, route graph preview, and target capability matrix.

Acceptance: the IDE feels like a language-specific tool, not a generic editor wrapper.

## Build order

1. Compiler skeleton.
2. Lexer/parser.
3. Types.
4. IR.
5. Emitters.
6. CLI.
7. LSP.
8. IDE.

Do not build the IDE deeply before the compiler can parse, check, and emit real source.
