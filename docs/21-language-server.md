# Language Server and Tooling API

> This document supports the ClearKrypt Constitution. If it conflicts with
> `/constitution`, the constitution wins. It defines the protocol contract
> between the ClearKrypt toolchain and every IDE shell (Windows C#, macOS
> Swift, and future editors). IDE shells must consume these services instead
> of reimplementing the language (Constitution Document 7 §4).

## Architecture

```text
+---------------------+        +----------------------+
| Windows IDE (C#)    |        | macOS IDE (Swift)    |
|  LSP client         |        |  LSP client          |
+----------+----------+        +-----------+----------+
           |    JSON-RPC over stdio (LSP 3.17 subset)  |
           +----------------+--------------------------+
                            |
              clearkrypt language-server --stdio
                            |
                 @clearkrypt/language-service
                            |
                 @clearkrypt/compiler-core
```

Build actions (check/build/emit) go through the CLI with `--json` output;
language intelligence goes through the language server. Both are backed by
the same compiler-core, so the IDE always shows what the compiler sees.

## Launching

```bash
clearkrypt language-server --stdio
```

The server speaks JSON-RPC 2.0 with LSP `Content-Length` framing on
stdin/stdout. IDEs locate the `clearkrypt` CLI via (in order): explicit
user setting, `CLEARKRYPT_SDK` environment variable, then `PATH`.

## Supported LSP 3.17 methods (MVP)

| Method | Notes |
| ------ | ----- |
| `initialize` / `initialized` / `shutdown` / `exit` | Standard lifecycle. |
| `textDocument/didOpen` | Full text sync. |
| `textDocument/didChange` | `TextDocumentSyncKind.Full` (incremental later). |
| `textDocument/didClose`, `textDocument/didSave` | |
| `textDocument/publishDiagnostics` | Pushed after every open/change. Diagnostic `code` is the stable CKxxxx code; `source` is `clearkrypt`. |
| `textDocument/documentSymbol` | Hierarchical symbols: module, models, fields, enums, cases, errors, functions, screens, components, routes, natives, capabilities. |
| `textDocument/hover` | Declaration signatures and resolved types. |
| `textDocument/completion` | Keywords, primitive types, and project symbols (MVP). |
| `textDocument/formatting` | Formatter output (whitespace normalization today; honest about scope). |
| `textDocument/semanticTokens/full` | See legend below. |

## Semantic token legend

Token types (in legend order — index matters):

```text
namespace, type, enum, enumMember, struct, parameter, variable, property,
function, keyword, string, number, comment, operator,
model, screen, component, route, capability, errorType, nativeTarget
```

The first fourteen are standard LSP token types; the final seven are
ClearKrypt-specific (Constitution Document 8 §8). Clients that do not know
the custom types may fall back to `type`/`keyword` styling, but the two
first-party IDEs must style them distinctly. Token modifiers:
`declaration`, `defaultLibrary`, `generated`, `inferred`, `targetSpecific`.

Color is decided by IDE themes, never by the server (Document 8 §6).

## ClearKrypt extension methods (JSON-RPC, `clearkrypt/` namespace)

### `clearkrypt/projectInfo` (request)

Params: `{ }` (the workspace root was given at `initialize`).
Result:

```json
{
  "name": "hello-world",
  "version": "0.1.0",
  "targets": { "swift": true, "kotlin": true, "react": true },
  "outputDir": "generated",
  "sourceFiles": ["src/main.ck"]
}
```

### `clearkrypt/check` (request)

Runs a full project check. Result: `{ "diagnostics": [Diagnostic...] }`
grouped LSP-style with `uri` per file. The IDE diagnostics panel uses this;
per-document diagnostics still arrive via `publishDiagnostics`.

### `clearkrypt/generatedMap` (request)

Source-to-generated mapping for the output explorer and target comparison
(Constitution Document 3 §9):

```json
{
  "modules": [
    {
      "module": "app.main",
      "sourceFile": "src/main.ck",
      "targets": {
        "swift": ["generated/swift/app/main/Greeting.swift", "generated/swift/app/main/Functions.swift"],
        "kotlin": ["generated/kotlin/app/main/Greeting.kt", "generated/kotlin/app/main/Functions.kt"],
        "react": ["generated/react/app/main.ts"]
      }
    }
  ]
}
```

## CLI JSON contract (build integration)

`clearkrypt check --json` and `clearkrypt build --json` print one JSON
document to stdout:

```json
{
  "ok": false,
  "diagnostics": [
    {
      "code": "CK0003",
      "severity": "error",
      "message": "...",
      "file": "src/main.ck",
      "range": { "startLine": 4, "startColumn": 3, "endLine": 4, "endColumn": 9 },
      "target": "swift"
    }
  ],
  "generatedFiles": ["generated/swift/app/main/Greeting.swift"]
}
```

Exit codes: `0` success, `1` diagnostics with errors, `64` usage error,
`70` internal error. Lines/columns are one-based (LSP conversion: subtract
one).

## Versioning

The server reports `serverInfo.version` equal to the compiler version.
Custom methods are additive; breaking changes require a major version and a
documentation update here first.
