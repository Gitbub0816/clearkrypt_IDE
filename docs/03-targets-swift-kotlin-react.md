# Swift, Kotlin, and React Target Rules

## Purpose

ClearKrypt has three first-class output families:

- Swift for Apple-native apps.
- Kotlin for Android and JVM apps.
- React with TypeScript for web apps.

The language should define shared application intent, then emit target code that feels natural on each platform.

## General target rule

A ClearKrypt feature is only considered portable when all selected targets can represent it safely.

If a feature only works on one target, it must be behind an explicit target gate.

## Type mapping

| ClearKrypt | Swift | Kotlin | TypeScript |
|---|---|---|---|
| String | String | String | string |
| Int | Int | Int | number |
| Float | Double | Double | number |
| Decimal | Decimal | BigDecimal | string or Decimal helper |
| Bool | Bool | Boolean | boolean |
| Date | Date | LocalDate | string |
| DateTime | Date | Instant | string |
| ID | String | String | string |
| Email | String wrapper | String wrapper | branded string |
| URL | URL | URI/String | string |
| Data | Data | ByteArray | ArrayBuffer or string |
| T? | T? | T? | T null union |
| List<T> | [T] | List<T> | T[] |
| Map<K,V> | [K: V] | Map<K,V> | Record<K,V> or Map<K,V> |

## Model output

A ClearKrypt model should emit:

- Swift struct with Codable support.
- Kotlin data class with serialization support.
- TypeScript interface or type plus optional schema helpers.

Example source:

```ck
model User {
  id: ID
  name: String
  email: Email
}
```

Swift output should be shaped like:

```swift
struct User: Codable, Equatable {
  let id: String
  let name: String
  let email: String
}
```

Kotlin output should be shaped like:

```kotlin
data class User(
  val id: String,
  val name: String,
  val email: String
)
```

TypeScript output should be shaped like:

```ts
export type User = {
  id: string
  name: string
  email: string
}
```

## Enum output

Simple enums should map directly where possible.

Enums with associated data require target-specific strategies:

- Swift: enum with associated values.
- Kotlin: sealed interface or sealed class.
- TypeScript: discriminated union.

## UI output

ClearKrypt UI declarations should map to:

- SwiftUI for Swift.
- Jetpack Compose for Kotlin.
- React function components for TypeScript.

A `screen` is routable. A `component` is reusable.

Target emitters must preserve component names and parameter names unless there is a naming conflict.

## State

MVP state should be simple and explicit. Advanced state management should be added only after target emitters are stable.

Possible mapping:

- Swift: `@State`, `@Binding`, observable models.
- Kotlin: `remember`, `mutableStateOf`, ViewModel.
- React: `useState`, `useMemo`, context when needed.

## Routing

ClearKrypt routes should emit platform navigation metadata.

- Swift can generate navigation enums and SwiftUI route helpers.
- Kotlin can generate Compose navigation route declarations.
- React can generate React Router route objects.

## Native bindings

Each native binding must declare its target. Shared code may call a native binding only when every selected target has an implementation or fallback.

## Generated folder layout

Recommended output:

```text
generated/
  swift/
  kotlin/
  react/
```

Each target folder should be independently inspectable.

## Emitter tests

Each emitter must have snapshot tests. A change to generated code should be intentional and reviewed.

## MVP emitter scope

Initial emitters should handle:

- Models.
- Simple enums.
- Pure functions with basic expressions.
- Basic screens/components.
- Simple routes.
- Minimal project scaffolding.
