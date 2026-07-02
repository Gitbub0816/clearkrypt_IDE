# Supported Languages and Interop

## Purpose

ClearKrypt should be the primary source language, but real software projects require surrounding files and companion languages.

The IDE must understand those files well enough to build complete projects without pretending ClearKrypt replaces every platform tool.

## First-class generated targets

The first-class generated targets are:

- Swift
- Kotlin
- React with TypeScript

These are compiler outputs, not just syntax-highlighted companion files.

## Companion languages

The IDE should support these companion languages:

- TypeScript
- JavaScript
- Node package files
- JSON
- Java
- Python
- SQL
- Markdown
- YAML
- TOML
- Gradle files
- Swift Package files
- npm/pnpm/yarn package manifests
- environment template files

## Interop categories

### 1. Target-native interop

Used when shared ClearKrypt code needs platform behavior.

Examples:

- Swift API for Apple device features.
- Kotlin API for Android behavior.
- TypeScript API for browser behavior.

Rules:

- Must declare target.
- Must declare types.
- Must be visible in IDE.
- Must be checked against selected build targets.

### 2. Build-system interop

Used for package managers, build tools, and project config.

Examples:

- `package.json`
- `tsconfig.json`
- Gradle files
- Swift package files
- app manifest files

The IDE should understand these files enough to avoid breaking generated projects.

### 3. Data/schema interop

Used for JSON, SQL, config files, and generated schemas.

ClearKrypt models should be able to emit schemas or serializers for target ecosystems.

### 4. Tooling interop

Used for formatters, linters, test runners, and external build commands.

Tooling integration should be configured and explicit.

## Type safety requirements

Interop must not be arbitrary untracked text pasted into shared code.

Every callable interop block should define:

- Name.
- Target.
- Parameters.
- Return type.
- Error behavior.
- Required imports or dependencies.

## IDE responsibilities

The IDE should:

- Highlight companion languages.
- Show when a companion file affects ClearKrypt builds.
- Warn when generated files are edited directly.
- Surface package/dependency issues.
- Provide target-aware search.
- Show which ClearKrypt source generated which target file.

## Dependency declarations

ClearKrypt should eventually support dependencies in `clearkrypt.toml`.

Example shape:

```toml
[dependencies]
http = "1.0.0"

[target.swift.dependencies]
Alamofire = "latest-compatible"

[target.kotlin.dependencies]
ktor = "latest-compatible"

[target.react.dependencies]
axios = "latest-compatible"
```

MVP can keep dependencies minimal and emitter-owned.

## Native folder proposal

```text
native/
  swift/
  kotlin/
  react/
  shared/
```

The compiler should read these folders as target-specific source supplements.

## Generated folder proposal

```text
generated/
  swift/
  kotlin/
  react/
```

Generated code should remain separate from handwritten native supplements.

## Unsupported interop behavior

The compiler should reject shared ClearKrypt code that calls a target-specific function without an implementation for every selected target.

The IDE should offer fixes:

- Add missing target implementation.
- Restrict build target.
- Add fallback implementation.
- Move call behind target gate.

## MVP scope

MVP interop should include:

- Syntax highlighting for companion files.
- Target-gated native function blocks in `.ck`.
- Basic dependency placeholders.
- Generated folder separation.
- Diagnostics for missing native implementations.
