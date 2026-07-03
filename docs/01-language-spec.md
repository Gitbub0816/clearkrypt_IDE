# ClearKrypt Language Specification

> This document supports the ClearKrypt Constitution. If this document conflicts with `/constitution`, the constitution wins. This file is implementation guidance and an early syntax specification, not the highest-authority language law.

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

ClearKrypt should feel explicit, readable, typed, visual, and native-powerful. It should avoid clever punctuation when plain structure is clearer.

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

`comment` is a reserved word; it always starts a comment and can never be used
as an identifier. `comment:` runs to the end of the line. A bare `comment`
opens a block that runs until a later `end comment` (matched as whole words):

```ck
comment: Single-line comment

comment
Multi-line comment
end comment
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
- Kotlin: nullable type or target-specific abstraction
- TypeScript: documented nullable union or optional policy

The constitution requires that null/absence semantics be explicit. MVP should use nullable/absent semantics and generate explicit serializers.

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
- Models should generate Codable/Serializable/schema or equivalent target support.

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

### Nested (local) functions

`fn` is valid as a statement inside any block, declaring a function local to
that scope:

```ck
fn triangular(n: Int) -> Int {
  fn sumUpTo(current: Int) -> Int {
    if current <= 0 {
      return 0
    }
    return current + sumUpTo(current: current - 1)
  }
  return sumUpTo(current: n)
}
```

A local function has its own return type and its own `throws` clause, may
call itself (self-recursion), and reads every enclosing parameter and local —
real lexical capture, not a copy — because Swift, Kotlin, and TypeScript all
give nested functions this behavior natively. A local function may itself
declare further nested functions, to any depth. It cannot be referenced as a
value (functions are not values in this version, matching top-level
functions); it can only be called.

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

## Effects and capabilities

The constitution makes effects and capabilities explicit. Capabilities describe platform powers. Effects describe side behavior.

Preferred constitutional direction:

```ck
capability Location
capability Network

fn fetchUser(id: ID) requires Network async throws NetworkError -> User
```

Older `effect FetchUser(id: ID) -> User` examples should be treated as pre-constitutional placeholders, not current preferred syntax.

MVP can parse capability/effect declarations incrementally, but compiler architecture should reserve space for:

- capability declarations
- `requires` clauses
- async behavior
- typed errors
- target permission diagnostics
- visual effect graphs

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
- TypeScript: `Result<T, E>` or documented typed promise policy.

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

## String interpolation

Strings interpolate expressions with `\(...)`:

```ck
fn describe(order: Order) -> String {
  return "Order \(order.label): \(order.note ?? "no note")"
}
```

Only primitive values interpolate; interpolate a specific field of a model
rather than the model itself. Targets: Swift interpolation, Kotlin `${}`
templates, TypeScript template literals.

## Enum case values

Cases are constructed from the type name:

```ck
let status = OrderStatus.pending
throw OrderError.rejected(reason: "missing label")
```

Payload values use named arguments matching the case's declared fields.

## Match expressions

`match` inspects an enum or error value with compiler-checked
exhaustiveness — every case must be covered, or an `else ->` arm provided:

```ck
let label = match status {
  pending -> "waiting"
  shipped -> "on the way"
  delivered -> "done"
}
```

Payload cases bind their values positionally:

```ck
return match error {
  notFound -> "missing"
  rejected(reason) -> "rejected: \(reason)"
}
```

All arms must produce the same type. A match must directly initialize a
binding (`let x = match ...`) or be returned (`return match ...`) so every
target emits it cleanly: Swift switch expressions, Kotlin `when`, and
TypeScript exhaustive switch.

## Working with optionals

Optionals are first-class:

```ck
let note = order.note ?? "no note"        // ?? provides a fallback
let name = order.customer?.name ?? "anon" // ?. chains through absence

if let note = order.note {                 // if let unwraps into a binding
  return lengthOf(text: note)
} else {
  return 0
}
```

Plain `.` on an optional value is a compile error with a fix suggestion —
absence is always handled explicitly.

## Throwing and propagating errors

Functions declared `throws <ErrorType>` may `throw` values of that error
type; calls into them must be marked `try`, and the enclosing function must
declare a compatible throws type (propagation only — `catch` lands with a
later milestone):

```ck
fn checkOrder(order: Order) throws OrderError -> String {
  if order.label == "" {
    throw OrderError.rejected(reason: "missing label")
  }
  return try requireShipped(status: order.status)
}
```

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

`module`, `import`, `model`, `enum`, `fn`, `screen`, `component`, `route`, `effect`, `capability`, `requires`, `error`, `native`, `swift`, `kotlin`, `typescript`, `react`, `let`, `var`, `if`, `else`, `for`, `in`, `while`, `match`, `return`, `throw`, `throws`, `try`, `catch`, `async`, `true`, `false`, `null`, `public`, `private`, `internal`, `comment`.

`comment` is reserved outright (see Comments, above): it is never available as an identifier, field name, or parameter name, because it always opens a comment.

## MVP syntax acceptance

The MVP parser should accept a narrow but real subset:

- Module declaration.
- Imports.
- Models.
- Enums without associated values first.
- Functions with primitive expressions.
- Basic components and screens.
- Native target blocks as raw parsed nodes.
- Capability declarations and `requires` clauses as parsed or reserved forms.

Do not implement the entire language before the compiler spine works.
