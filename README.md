# ClearKrypt

ClearKrypt is a human-readable, visual, native-power application language
with a compiler, CLI, language server, and native IDEs designed as one
system. ClearKrypt source compiles into:

- Swift for iOS, macOS, watchOS, and Apple-native targets
- Kotlin for Android, JVM, and multiplatform targets
- React/TypeScript for web applications and shared frontend suites

```ck
module app.orders

enum OrderStatus {
  pending
  shipped
  delivered
}

error OrderError {
  notFound
  rejected(reason: String)
}

model Order {
  id: ID
  label: String
  note: String?
  status: OrderStatus
}

fn describe(order: Order) -> String {
  let status = match order.status {
    pending -> "waiting"
    shipped -> "on the way"
    delivered -> "done"
  }
  return "Order \(order.label) (\(status)): \(order.note ?? "no note")"
}

fn checkOrder(order: Order) throws OrderError -> String {
  if order.label == "" {
    throw OrderError.rejected(reason: "missing label")
  }
  return try requireShipped(status: order.status)
}
```

```sh
clearkrypt new hello && cd hello && clearkrypt build
# -> readable Swift, Kotlin, and TypeScript under generated/
```

## What works today

- **Compiler** (`packages/compiler-core`): lexer and error-recovering parser
  with full source spans, project-wide type checker with teacherly CKxxxx
  diagnostics, semantic model, and target-neutral IR — all snapshot-tested.
- **Language power**: string interpolation, `match` expressions with
  compiler-proven exhaustiveness and payload binding, first-class optionals
  (`?.`, `??`, `if let`), enum case constructors, typed `throw`/`try`
  propagation, and nested (local) functions with real lexical capture and
  self-recursion — each emitted idiomatically per target (Swift `switch`
  expressions and local `func`, Kotlin `when` + elvis + smart casts and local
  `fun`, TypeScript exhaustive switches + narrowing and nested `function`).
  See `docs/22-power-roadmap.md` for what's next.
- **Emitters** (`packages/emitter-*`): models, simple and associated enums,
  typed errors, and pure/async functions as idiomatic, deterministic,
  byte-stable Swift, Kotlin, and TypeScript.
- **CLI** (`packages/cli`, published as `clearkrypt`): `new`, `check`,
  `build`, `emit`, `format`, and `language-server`, with human and `--json`
  output. Bundled with esbuild at pack time into one dependency-free file,
  so `npm install -g clearkrypt` / `npx clearkrypt` runs standalone —
  verified by installing the packed tarball in an empty directory with no
  workspace present.
- **Language server** (`packages/language-service`): LSP over stdio —
  diagnostics, outline, hover, completion, semantic tokens, formatting, and
  ClearKrypt extensions (`clearkrypt/projectInfo`, `clearkrypt/check`,
  `clearkrypt/generatedMap`). Contract in `docs/21-language-server.md`.
- **SDK packaging** (`scripts/package-sdk.mjs`): one relocatable directory
  with `clearkrypt` launchers for macOS/Linux/Windows (requires Node 20+).
- **Native IDEs** (`/ide`): a C# (.NET 8, Avalonia) IDE for Windows and a
  Swift (SwiftUI) IDE for macOS — grouped project navigator, editors with
  grammar + semantic-token highlighting, live diagnostics with navigation,
  document outline, check/build with target selection, read-only generated
  output, and language-server lifecycle management. CI publishes the
  Windows win-x64 build and the macOS app zip as download artifacts.

Screens, components, routes, capabilities, and native interop blocks parse
and type-check today; their target lowering ships in later milestones and
the compiler says so honestly (CK0004/CK0005) instead of degrading silently.

## Authority model

The `/constitution` folder is the highest-authority source for ClearKrypt
language philosophy, syntax laws, visual programming model, type-system
direction, compiler/IR laws, backend laws, IDE/tooling laws, and
syntax-coloring rules.

The `/docs` folder supports the constitution. If `/docs` conflicts with
`/constitution`, the constitution wins.

## Repository map

- `constitution/` — the eight constitutional documents. Read these first.
- `docs/` — vision, language spec, compiler architecture, target mappings,
  roadmap, IDE architecture, language-server contract, development guide.
- `skills/clearkrypt-language/SKILL.md` — a complete, AI-consumption-tuned
  language reference (any AI system, not just one vendor's, can point at
  this to learn to write correct, idiomatic ClearKrypt). `llms.txt` at the
  repo root indexes it alongside the rest of the docs.
- `packages/` — the TypeScript toolchain monorepo (compiler, emitters,
  formatter, language service, CLI).
- `ide/windows` — the C#/Avalonia Windows IDE. `ide/macos` — the
  Swift/SwiftUI macOS IDE.
- `editors/` — shared editor assets (TextMate grammar).
- `tests/fixtures/` — `.ck` fixtures shared by package tests.
- `scripts/` — SDK packaging and release tooling.

## Building

```sh
npm install
npm run build   # typecheck + build all packages
npm test        # all package tests (211+)
```

See `docs/20-development.md` for conventions and the testing rules, and
`docs/07-roadmap-milestones.md` for what lands next.
