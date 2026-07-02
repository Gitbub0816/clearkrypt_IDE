# Testing Strategy

## Purpose

ClearKrypt must be tested like a real compiler and IDE project.

The most important tests are compiler snapshots, target output snapshots, and end-to-end fixture tests.

## Test categories

- lexer tests
- parser tests
- type checker tests
- IR tests
- Swift output tests
- Kotlin output tests
- React output tests
- CLI tests
- editor intelligence tests
- IDE smoke tests

## Fixtures

Fixtures should live under `tests/fixtures`.

Recommended early fixtures:

- hello world
- model only
- enum only
- simple function
- simple screen
- route graph
- native binding
- invalid syntax
- invalid type

## Snapshot testing

Generated output should use snapshots.

Snapshot changes should be reviewed carefully because they represent language behavior changes.

## Negative tests

Negative tests are required.

Examples:

- unknown symbol
- duplicate declaration
- invalid type
- missing return
- unsupported target feature
- missing target implementation

## IDE tests

IDE testing can start with smoke tests:

- open project
- open file
- show diagnostics
- run check
- show generated files

## Acceptance

Every language feature needs at least one valid fixture and one invalid fixture.
