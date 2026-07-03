# Native IDE Architecture

> This document supports the ClearKrypt Constitution. If it conflicts with
> `/constitution`, the constitution wins.

## IDE mission

ClearKrypt IDE should be a native development environment for the ClearKrypt
language, not just a generic text editor.

It should help developers understand source files, generated targets,
diagnostics, project structure, build outputs, and cross-platform
differences.

## Platform strategy

ClearKrypt ships two first-party native IDEs, developed in `/ide`:

- **Windows IDE** — C# (.NET 8, Avalonia UI), in `ide/windows`. Distributed
  as a self-contained Windows download (`dotnet publish -r win-x64`).
  Avalonia keeps the codebase 100% C# and buildable in Linux CI while
  shipping a native Windows desktop app.
- **macOS IDE** — Swift (SwiftUI + AppKit editor host), in `ide/macos`.
  Distributed as a macOS app download, built and verified on macOS CI.

Both shells are thin native frontends over the same brain:

- **Language intelligence**: the ClearKrypt language server
  (`clearkrypt language-server --stdio`), protocol in
  `docs/21-language-server.md`.
- **Build integration**: the ClearKrypt CLI with `--json` diagnostics.
- **Syntax highlighting**: semantic tokens from the language server, with
  the shared TextMate grammar (`editors/clearkrypt.tmLanguage.json`) as the
  instant fallback while the server warms up.

Neither IDE reimplements any part of the language. That is constitutional
law (Document 7 §4): the IDE shows what the compiler sees.

## Core areas

Both IDEs implement the same core surfaces:

- Project navigator.
- Source editor.
- Diagnostics panel.
- Generated output explorer.
- Target selector.
- Build panel.
- Symbol outline.
- Settings panel.

Later: preview panel, visual graphs, terminal/task output.

## Project navigator

The navigator should understand ClearKrypt project structure:

- `clearkrypt.toml`
- `src/`
- `native/`
- `generated/`
- `tests/`
- `assets/`
- `docs/`

It should group files by purpose, not just raw folders, when possible.
Generated files must be visually distinct from source.

## Source editor

Required editor features (MVP → mature):

- Syntax highlighting (TextMate fallback, semantic tokens primary).
- Bracket matching.
- Diagnostics underlines with hover explanations.
- Document outline from `textDocument/documentSymbol`.
- Format on save (`textDocument/formatting`).
- Completion, hover.
- Go to definition, references, rename (as the language server grows).
- Generated files open read-only by default.

Editor hosts: AvaloniaEdit with TextMate support on Windows;
NSTextView-based editor on macOS.

## Language server

See `docs/21-language-server.md` for the full contract: supported LSP
methods, the semantic token legend, ClearKrypt extension methods
(`clearkrypt/projectInfo`, `clearkrypt/check`, `clearkrypt/generatedMap`),
and the CLI JSON schema.

The IDEs locate the ClearKrypt SDK via user setting, then the
`CLEARKRYPT_SDK` environment variable, then `PATH`.

## Build integration

The IDE calls the CLI for check/build/emit tasks and parses `--json` output
into structured diagnostics.

Basic actions:

- Check project.
- Build selected targets.
- Emit selected target.
- Clean generated output.
- Open generated output folder.

## Target selector

The target selector controls what the compiler validates and emits:

- Swift only.
- Kotlin only.
- React only.
- Any combination.

Target-specific diagnostics must be clearly marked with the target name.

## Generated output explorer

The IDE must let developers inspect generated Swift, Kotlin, and TypeScript
without treating generated code as mysterious.

Recommended features:

- Source-to-generated file mapping (`clearkrypt/generatedMap`).
- Generated file search.
- Diff from previous generation.
- Open generated file read-only by default.

## Debugging model

Early debugging focuses on compiler and generated output, not runtime:

- Compiler trace view.
- AST view.
- IR view.
- Target lowering view.
- Generated file mapping.

Full runtime debugging across targets is a later milestone.

## Settings

Project settings that affect builds live in `clearkrypt.toml` (versioned).
User preferences (theme, SDK path, font) are local per IDE and not
committed (Constitution Document 7 §20).

## Worktrees

Both IDEs can list, create, and remove git worktrees of the open project's
repository, and open any of them: a Windows/Avalonia project window per
worktree, or (macOS) switching the current session's project root. This is
a thin wrapper over the real `git worktree` subcommand — no parallel
implementation of git's own logic — so a worktree the IDE creates is
identical to one created from a terminal, and vice versa. Each worktree
keeps fully independent editor and diagnostics state; nothing is shared
between them except the underlying repository.

## Native IDE MVP

MVP acceptance (identical for both platforms):

- Open a ClearKrypt project (folder containing `clearkrypt.toml`).
- Show grouped file tree.
- Edit `.ck` files with highlighting and live diagnostics.
- Run check/build; display structured results.
- Select targets.
- Show generated outputs read-only.
- Launch and monitor the language server.

## Future IDE features

- Visual route graph.
- UI component inspector.
- Refactor tools.
- Package manager UI.
- Target capability matrix.
- Test runner.
- Generated-code diff viewer.
- Compiler performance profiler.
- A board view across worktrees for reviewing several agents' work at
  once (basic worktree list/add/remove/open shipped; the board itself has
  not).
