# Error, Async, and Effect Model

## Purpose

ClearKrypt needs a clear execution model for failures, asynchronous work, and platform capabilities.

These features should be readable in source, visible in the IDE, and portable across Swift, Kotlin, and React TypeScript.

## Typed errors

ClearKrypt should prefer typed errors instead of unstructured failures.

```ck
error NetworkError {
  offline
  timeout
  server(message: String)
}
```

Functions that can fail should declare that behavior.

```ck
fn fetchUser(id: ID) async throws NetworkError -> User
```

## Target strategy

Possible target mapping:

- Swift: native throwing functions where practical.
- Kotlin: sealed result or declared result wrapper.
- TypeScript: result wrapper or typed promise policy.

The exact target policy should be documented and consistent.

## Async

Async should be explicit.

```ck
fn refresh() async -> Void
```

Target mapping:

- Swift async await
- Kotlin suspend
- TypeScript async Promise

## Effects

Effects describe platform capabilities and side effects.

Potential capabilities:

- Network
- Storage
- Camera
- Location
- Notifications
- Files
- Contacts
- Bluetooth

Possible syntax:

```ck
capability Location

fn getCurrentLocation() requires Location async throws -> Coordinate
```

## IDE behavior

The IDE should show capability requirements visually.

Examples:

- A screen that requires camera access should show a camera capability badge.
- A function that calls network code should show a network effect.
- A missing platform permission should become a diagnostic.

## MVP scope

MVP should parse async and throws syntax even if target behavior is basic.

Effects can start as declarations and diagnostics before becoming a full type-level feature.
