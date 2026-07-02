# ClearKrypt IDE

ClearKrypt IDE is the native development environment and compiler toolchain for the ClearKrypt programming language.

ClearKrypt is designed as a human-readable, visual, native-power application language that can compile cleanly into:

- Swift for iOS, macOS, watchOS, and Apple-native targets
- Kotlin for Android, JVM, and multiplatform targets
- React/TypeScript for web applications and shared frontend suites

The IDE should also support practical companion languages where real projects need them: TypeScript, JavaScript, Node, JSON, Java, Python, SQL, shell, Markdown, YAML, TOML, Gradle, Swift Package manifests, package manifests, and platform configuration files.

## Authority model

The `/constitution` folder is the highest-authority source for ClearKrypt language philosophy, syntax laws, visual programming model, type-system direction, compiler/IR laws, backend laws, IDE/tooling laws, and syntax-coloring rules.

The `/docs` folder supports the constitution. Docs provide implementation guidance, examples, roadmaps, package plans, target notes, and agent workflow details. If `/docs` conflicts with `/constitution`, the constitution wins.

## Repository map

- `constitution/01-language-philosophy.md` — foundational language philosophy and non-negotiable laws.
- `constitution/02-human-readable-syntax.md` — syntax laws and human-readable grammar direction.
- `constitution/03-visual-programming-model.md` — visual language and source-mapping laws.
- `constitution/04-type-system-and-semantics.md` — type-system and semantic model laws.
- `constitution/05-compiler-and-ir-laws.md` — compiler, IR, source-map, diagnostic, and emitter boundaries.
- `constitution/06-native-target-and-backend-laws.md` — Swift, Kotlin, React/TypeScript backend laws.
- `constitution/07-ide-and-tooling-laws.md` — IDE, CLI, formatter, package, debugger, and agent-tooling laws.
- `constitution/08-syntax-coloring-and-semantic-highlighting.md` — semantic highlighting and visual token laws.
- `docs/README.md` — authority rules for the supporting docs folder.
- `docs/00-product-vision.md` — supporting vision, scope, non-goals, and success criteria.
- `docs/01-language-spec.md` — supporting syntax, types, modules, components, effects, errors, and interop guidance.
- `docs/02-compiler-architecture.md` — compiler pipeline, AST, IR, diagnostics, target emitters, and generated-code guidance.
- `docs/03-targets-swift-kotlin-react.md` — Swift, Kotlin, React/TypeScript compilation guidance.
- `docs/04-native-ide-architecture.md` — IDE architecture, editor UX, project system, previews, debugger, and language service guidance.
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
