# ClearKrypt IDE

ClearKrypt IDE is the native development environment and compiler toolchain for the ClearKrypt programming language.

ClearKrypt is designed as a high-level application language that can compile cleanly into:

- Swift for iOS, macOS, watchOS, and Apple-native targets
- Kotlin for Android, JVM, and multiplatform targets
- React/TypeScript for web applications and shared frontend suites

The IDE should also support practical companion languages where real projects need them: TypeScript, JavaScript, Node, JSON, Java, Python, SQL, shell, Markdown, YAML, TOML, Gradle, Swift Package manifests, package manifests, and platform configuration files.

This repo starts as a detailed seed specification. The goal is to give Fable/Codex/Claude-style coding agents enough structure to begin implementing a real language IDE without wandering.

## Repository map

- `docs/00-product-vision.md` — vision, scope, non-goals, and success criteria.
- `docs/01-language-spec.md` — language rules, syntax, types, modules, components, effects, errors, and interop syntax.
- `docs/02-compiler-architecture.md` — compiler pipeline, AST, IR, diagnostics, target emitters, and generated-code contracts.
- `docs/03-targets-swift-kotlin-react.md` — Swift, Kotlin, React/TypeScript compilation rules.
- `docs/04-native-ide-architecture.md` — IDE architecture, editor UX, project system, previews, debugger, and language server.
- `docs/05-supported-languages-interop.md` — companion language support and interop boundaries.
- `docs/06-agent-worktrees-commands.md` — worktree commands, branch rules, agent lanes, and merge discipline.
- `docs/07-roadmap-milestones.md` — milestone plan from spec to MVP compiler and IDE.
- `.github/copilot-instructions.md` — coding-agent operating rules for this repo.

## First build target

The first practical implementation should be a minimal monorepo that can:

1. Parse a tiny `.ck` file.
2. Build a typed AST.
3. Lower to a simple target-neutral IR.
4. Emit trivial Swift, Kotlin, and React/TypeScript output.
5. Surface diagnostics through a CLI.
6. Open a project in the native IDE shell.

Do not start with every feature. Start with the compiler spine, then expand the language.
