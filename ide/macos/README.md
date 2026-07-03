# ClearKrypt IDE for macOS

A native Swift (SwiftUI + AppKit) IDE for the ClearKrypt language. It is a
thin client over compiler services: language intelligence flows through the
ClearKrypt language server (`clearkrypt language-server --stdio`, protocol
in `docs/21-language-server.md`) and builds flow through the CLI with
`--json` output. No language logic is reimplemented here (Constitution
Document 7 §4).

## Build, run, test

```sh
# Core library tests (Foundation-only, no UI):
swift test

# The app (requires Xcode 16 / macOS 14):
brew install xcodegen
xcodegen --spec project.yml
xcodebuild -project ClearKryptIDE.xcodeproj -scheme ClearKryptIDE build
# or: open ClearKryptIDE.xcodeproj
```

CI (`.github/workflows/ide-macos.yml`) runs the tests, builds the app on
macos-14, and uploads `clearkrypt-ide-macos.zip` as the download artifact.

## Architecture

```text
Sources/IDECore/          Foundation-only, fully unit-tested
  ManifestParser.swift    clearkrypt.toml subset parser
  ClearKryptProject.swift project model + purpose-grouped files
  FramingParser.swift     Content-Length framing (partial/multi chunks)
  LSPClient.swift         JSON-RPC client: lifecycle, sync, requests,
                          publishDiagnostics, clearkrypt/* extensions
  LSPTransport.swift      Process transport + SDK resolution
                          (setting > CLEARKRYPT_SDK > PATH)
  SemanticTokenDecoder    docs/21 legend, delta decoding
  BuildRunner.swift       check/build via CLI JSON, exit-code semantics
  SyntaxHighlighter.swift native fallback highlighter (mirrors the
                          shared TextMate grammar's vocabulary)
  SettingsStore.swift     UserDefaults-backed local preferences

App/                      SwiftUI shell (built via XcodeGen)
  ProjectSession.swift    main-actor state: documents, diagnostics,
                          tokens, outline, build, server lifecycle
  ContentView.swift       sidebar (grouped files + outline), tab strip,
                          editor, diagnostics/build panels, status bar
  EditorView.swift        NSTextView host: fallback + semantic coloring,
                          dotted diagnostic underlines, caret navigation,
                          native completion popup fed by the server
```

## MVP status (docs/04 acceptance)

- [x] Open a ClearKrypt project (validates clearkrypt.toml, recent list)
- [x] Grouped file listing (Source / Generated / Native / Config, badges)
- [x] Edit .ck with highlighting (native fallback + semantic tokens)
- [x] Live diagnostics (underlines, panel, navigation)
- [x] Check/build via CLI JSON
- [x] Target selector (swift/kotlin/react)
- [x] Generated output opens read-only with a banner
- [x] Language server lifecycle (status, crash surface, restart)
- [ ] Hover tooltips in the editor (client API ready; UI wiring pending)
- [ ] Go to definition / references / rename (needs server support)

## Verification note

This project is developed in a Linux container without a Swift toolchain,
so macOS CI is the compile gate. If CI reports errors, they are expected to
be small (API signatures), not architectural.
