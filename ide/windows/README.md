# ClearKrypt IDE for Windows

A native C# (.NET 8, Avalonia 11) IDE for the ClearKrypt language. It is a
thin client over compiler services: language intelligence flows through the
ClearKrypt language server (`clearkrypt language-server --stdio`, protocol
in `docs/21-language-server.md`) and builds flow through the CLI with
`--json` output. No language logic is reimplemented here (Constitution
Document 7 §4).

## Build, run, test

```sh
dotnet build ClearKryptIDE.sln          # builds on Windows, macOS, and Linux
dotnet run --project src/ClearKryptIDE  # launch the IDE
dotnet test                             # Core library tests
```

The Windows download is produced by CI (`.github/workflows/ide-windows.yml`)
via `dotnet publish -r win-x64 --self-contained -p:PublishSingleFile=true`.

The end-to-end test suite spawns the real language server from this
repository, so run `npm ci && npm run build` at the repo root first; the
test skips politely when the toolchain is not built.

## Architecture

```text
src/ClearKryptIDE.Core/   UI-free, fully unit-tested
  Toml/                   clearkrypt.toml subset parser
  Project/                project model + purpose-grouped file tree
  Lsp/JsonRpc/            Content-Length framing + request correlation
  Lsp/                    LanguageServerClient, protocol records,
                          semantic token decoder (docs/21 legend)
  Cli/                    check/build runner + CLI JSON contract
  Sdk/                    SDK resolution: setting > CLEARKRYPT_SDK > PATH
  Settings/               local user settings (%APPDATA%/ClearKryptIDE)

src/ClearKryptIDE/        Avalonia app (MVVM, hand-rolled ViewModelBase)
  Views/EditorHost.cs     AvaloniaEdit + shared TextMate grammar fallback,
                          semantic tokens layered on top, diagnostic
                          underlines, hover, Ctrl+Space completion
  Views/MainWindow*       navigator | tabbed editors | outline,
                          diagnostics + build panels, target selector,
                          server status + restart
```

## MVP status (docs/04 acceptance)

- [x] Open a ClearKrypt project (validates clearkrypt.toml, recent list)
- [x] Grouped file tree (Source / Generated / Native / Config, badges)
- [x] Edit .ck with highlighting (TextMate fallback + semantic tokens)
- [x] Live diagnostics (underlines, panel, navigation)
- [x] Check/build via CLI JSON with streaming output
- [x] Target selector (swift/kotlin/react)
- [x] Generated output opens read-only with a banner
- [x] Language server lifecycle (status, crash surface, restart)
- [ ] Go to definition / references / rename (needs server support)
- [ ] Visual graphs (route/component/model views — later milestone)
