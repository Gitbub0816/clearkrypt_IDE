# Native Power Model

## Goal

ClearKrypt should be powerful enough for serious native application development while remaining readable and multi-target.

It should aim toward Swift-level clarity and expressiveness where practical, while compiling into Swift, Kotlin, and React TypeScript.

## Design target

ClearKrypt should support:

- strong static typing
- explicit models
- explicit errors
- async functions
- protocol-style contracts
- generics
- target-aware native bindings
- readable generated code
- visual IDE understanding

## Value model

Models should behave like value data by default.

Target mapping:

- Swift structs
- Kotlin data classes
- TypeScript readonly-friendly object types

Mutable shared state should be explicit.

## Identity model

Use `ID` for stable domain identity.

```ck
model User {
  id: ID
  name: String
}
```

Generated code should not confuse object reference identity with domain identity.

## Protocols

ClearKrypt should eventually support protocol-style contracts.

```ck
protocol Repository<T> {
  fn get(id: ID) async -> T?
  fn save(value: T) async -> Void
}
```

Target mapping:

- Swift protocol
- Kotlin interface
- TypeScript interface

## Generics

Generics should be explicit.

```ck
model Page<T> {
  items: List<T>
  nextCursor: String?
}
```

MVP can defer generics until plain models and functions are stable.

## Async

Async is a first-class language feature.

```ck
fn loadProfile(id: ID) async -> Profile
```

Target mapping:

- Swift async functions
- Kotlin suspend functions
- TypeScript async functions

## Runtime philosophy

ClearKrypt should not require a heavy runtime for basic apps.

Prefer generated native code plus small target-specific helper libraries.

## Performance goals

Generated code should avoid unnecessary wrappers, giant files, runtime reflection as the default strategy, and unnecessary global state.

## MVP target

MVP should include typed models, typed enums, typed functions, basic async parsing, target emitters, good diagnostics, and visual mappings.
