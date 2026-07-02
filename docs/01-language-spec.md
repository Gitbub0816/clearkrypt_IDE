# ClearKrypt Language Specification

## File extension

ClearKrypt source files use `.ck`.

Example:

```ck
module app.profile

model User {
  id: ID
  name: String
  email: Email
  isActive: Bool = true
}

screen ProfileScreen(user: User) {
  title "Profile"

  VStack {
    Text(user.name)
    Text(user.email)
  }
}
```

## Language character

ClearKrypt should feel explicit, readable, typed, and product-oriented. It should avoid clever punctuation when plain structure is clearer.

The language should be strict enough to generate reliable code, but ergonomic enough that a developer can write real app flows without drowning in platform boilerplate.

## Modules

Every `.ck` file may declare one module.

```ck
module app.auth
```

Imports are explicit:

```ck
import app.models.User
import platform.permissions.Location
```

Wildcard imports should be avoided in MVP. They can be added later if tooling can explain symbol origins clearly.

## Comments

```ck
// Single-line comment

/*
Multi-line comment
*/
```

## Primitive types

Initial primitive types:

- `String`
- `Int`
- `Float`
- `Decimal`
- `Bool`
- `Date`
- `DateTime`
- `ID`
- `Email`
- `URL`
- `Data`
- `Void`
- `Never`

## Optional values

Use `?` for optional values.

```ck
model Profile {
  avatarUrl: URL?
}
```

Generated targets:

- Swift: `URL?`
- Kotlin: `String?` or target-specific URL abstraction
- TypeScript: `string | null`

The compiler must define whether optional means nullable, absent, or both. MVP should use nullable semantics and generate explicit serializers.

## Collections

```ck
names: List<String>
usersById: Map<ID, User>
tags: Set<String>
```

## Models

Models define serializable domain data.

```ck
model Booking {
  id: ID
  customerName: String
  scheduledAt: DateTime
  status: BookingStatus
}
```

Rules:

- Fields are immutable by default in generated data models.
- Default values are allowed.
- Validation annotations may be added later.
- Models should generate Codable/Serializable/Zod or equivalent target support.

## Enums

```ck
enum BookingStatus {
  pending
  confirmed
  cancelled(reason: String)
  completed
}
```

ClearKrypt enums should support both simple cases and associated data. Emitters must map associated data carefully:

- Swift: native enum with associated values.
- Kotlin: sealed interface/class hierarchy.
- TypeScript: discriminated union.

## Functions

```ck
fn fullName(first: String, last: String) -> String {
  return first + " " + last
}
```

MVP functions should support:

- Typed parameters.
- Explicit return type.
- `return`.
- Local `let` bindings.
- Basic expressions.
- Calls to other functions.

## Mutability

Use `let` for immutable bindings and `var` for mutable bindings.

```ck
let name = "Ada"
var count = 0
```

Mutability should be intentionally limited in shared code because it affects UI state generation and concurrency.

## Components and screens

A `component` is reusable UI. A `screen` is routable UI.

```ck
component UserCard(user: User) {
  VStack {
    Text(user.name)
    Text(user.email)
  }
}

screen UsersScreen(users: List<User>) {
  title "Users"

  List(users) { user in
    UserCard(user)
  }
}
```

The UI grammar should be declarative. It should compile into SwiftUI, Jetpack Compose, and React components.

## Routes

```ck
route /users -> UsersScreen
route /users/:id -> UserDetailScreen(id: ID)
```

Route parameters must be typed.

## Effects

ClearKrypt needs a controlled effect model for async work, permissions, network calls, file access, and platform APIs.

Possible syntax:

```ck
effect FetchUser(id: ID) -> User
```

MVP can defer a full effect system, but the compiler architecture should leave room for one.

## Errors

Use typed error declarations.

```ck
error AuthError {
  invalidCredentials
  networkUnavailable
  server(message: String)
}
```

Functions that can fail should say so explicitly.

```ck
fn login(email: Email, password: String) throws AuthError -> Session
```

Generated targets:

- Swift: `throws` or result type depending on target profile.
- Kotlin: sealed result or exception wrapper.
- TypeScript: `Result<T, E>` preferred for typed clarity.

## Interop blocks

Interop blocks are target-gated and typed.

```ck
native swift fn currentDeviceName() -> String {
  UIDevice.current.name
}

native kotlin fn currentDeviceName() -> String {
  android.os.Build.MODEL
}

native typescript fn currentDeviceName() -> String {
  return navigator.userAgent
}
```

Rules:

- Interop must declare the target.
- Interop must declare typed inputs and outputs.
- Interop cannot be used in shared code unless every requested target has an implementation or a fallback.
- The IDE must visibly mark target-specific code.

## Package manifest

A ClearKrypt project should include `clearkrypt.toml`.

```toml
[project]
name = "hello-world"
version = "0.1.0"

[targets]
swift = true
kotlin = true
react = true

[output]
dir = "generated"
```

## Formatting rules

- Two spaces indentation.
- Braces on the same line as declarations.
- Explicit return types for public functions.
- One top-level declaration group per file when possible.
- Formatter is authoritative.

## Reserved keywords

Initial reserved words:

`module`, `import`, `model`, `enum`, `fn`, `screen`, `component`, `route`, `effect`, `error`, `native`, `swift`, `kotlin`, `typescript`, `react`, `let`, `var`, `if`, `else`, `for`, `in`, `while`, `return`, `throws`, `try`, `catch`, `true`, `false`, `null`, `public`, `private`, `internal`.

## MVP syntax acceptance

The MVP parser should accept a narrow but real subset:

- Module declaration.
- Imports.
- Models.
- Enums without associated values first.
- Functions with primitive expressions.
- Basic components and screens.
- Native target blocks as raw parsed nodes.

Do not implement the entire language before the compiler spine works.
