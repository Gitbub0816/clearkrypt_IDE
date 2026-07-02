# Native IDE Architecture

## IDE mission

ClearKrypt IDE should be a native development environment for the ClearKrypt language, not just a generic text editor.

It should help developers understand source files, generated targets, diagnostics, project structure, build outputs, and cross-platform differences.

## Recommended IDE strategy

Start with a desktop IDE shell that can run on macOS first, then expand. The most practical initial path is:

- Native shell: SwiftUI on macOS.
- Editor engine: Monaco embedded or CodeMirror embedded for fast MVP, then consider a native editor later.
- Language intelligence: ClearKrypt language server.
- Build integration: CLI-driven compiler commands.

A pure native editor can be built later, but the first milestone should prioritize compiler integration and project understanding.

## Core areas

The IDE should include:

- Project navigator.
- Source editor.
- Diagnostics panel.
- Generated output explorer.
- Target selector.
- Build panel.
- Symbol outline.
- Preview panel.
- Terminal/task output panel.
- Settings panel.

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

## Source editor

Required editor features:

- Syntax highlighting.
- Bracket matching.
- Format on save.
- Diagnostics underlines.
- Hover explanations.
- Go to definition.
- Find references.
- Rename.
- Autocomplete.
- Snippets for model, enum, screen, component, route, and native blocks.

## Language server

The language server should expose:

- Document symbols.
- Workspace symbols.
- Completion.
- Hover.
- Diagnostics.
- Definition.
- References.
- Rename.
- Formatting.
- Semantic tokens.

The IDE should talk to the language server rather than duplicating compiler logic.

## Build integration

The IDE should call the CLI for check/build/emit tasks. Build output should be parsed into structured diagnostics where possible.

Basic actions:

- Check project.
- Build selected targets.
- Emit selected target.
- Clean generated output.
- Open generated output folder.

## Target selector

The target selector controls what the compiler validates.

Examples:

- Swift only.
- Kotlin only.
- React only.
- Swift + Kotlin.
- Swift + Kotlin + React.

Target-specific diagnostics must be clearly marked.

## Generated output explorer

The IDE must let developers inspect generated Swift, Kotlin, and TypeScript without treating generated code as mysterious.

Recommended features:

- Source-to-generated file mapping.
- Generated file search.
- Diff from previous generation.
- Open generated file read-only by default.
- Option to detach a generated file later if the project model supports it.

## Preview panel

Initial previews can be textual and structural:

- Component tree preview.
- Route graph preview.
- Model/schema preview.
- Target output preview.

Later previews can include live SwiftUI/Compose/React rendering where practical.

## Debugging model

Early debugging should focus on compiler and generated output. Full runtime debugging across targets is out of MVP scope.

The IDE should support:

- Compiler trace view.
- AST view.
- IR view.
- Target lowering view.
- Generated file mapping.

## Settings

Project settings should be stored in `clearkrypt.toml` when they are part of the build. User editor settings should be local and not committed by default.

## Native IDE MVP

MVP acceptance:

- Open a ClearKrypt project.
- Show file tree.
- Edit `.ck` files.
- Run check/build.
- Display diagnostics.
- Show generated outputs.
- Select targets.
- Launch language server.

## Future IDE features

Later features:

- Visual route graph.
- UI component inspector.
- Refactor tools.
- Package manager UI.
- Target capability matrix.
- Test runner.
- Integrated formatter settings.
- Generated-code diff viewer.
- Compiler performance profiler.
