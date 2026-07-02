# ClearKrypt Constitution — Document 2: Human-Readable Syntax

## 1. Purpose of this document

This document defines the constitutional rules for ClearKrypt syntax.

ClearKrypt syntax is not decoration. Syntax is the visible surface of the language. It determines whether the language feels humane, visual, powerful, predictable, and trustworthy.

Every grammar rule, formatter rule, parser rule, code generator rule, and IDE editing feature must respect this document.

## 2. Core syntax thesis

ClearKrypt source should read like executable architecture.

The syntax should make structure obvious:

- what the file owns
- what the module exports
- what data exists
- what states exist
- what screens exist
- what routes exist
- what effects exist
- what targets require native code

A developer should be able to read a ClearKrypt file and understand the shape of the system before understanding every low-level implementation detail.

## 3. Syntax hierarchy

ClearKrypt syntax has four layers:

1. **Architectural syntax** — modules, packages, routes, screens, services, capabilities.
2. **Domain syntax** — models, enums, errors, state machines, validation.
3. **Behavior syntax** — functions, async flows, effects, conditions, pattern matching.
4. **Interop syntax** — target-native code, external files, build configuration.

The language should make the first two layers especially readable because they are the most important for human understanding and visual IDE views.

## 4. Top-level declarations

Top-level declarations should describe architecture and domain concepts directly.

Preferred top-level forms:

```ck
module app.profile

import app.models.User

model User { }
enum UserStatus { }
error LoginError { }
capability Camera
protocol Repository<T> { }
service UserService { }
state LoginFlow { }
component UserCard(user: User) { }
screen ProfileScreen(user: User) { }
route /profile/:id -> ProfileScreen(id: ID)
```

Top-level syntax should be easy for the IDE to visualize.

## 5. Declaration names

Names should carry meaning.

Required style:

- Types use PascalCase.
- Models use PascalCase.
- Protocols use PascalCase.
- Screens use PascalCase and normally end with `Screen`.
- Components use PascalCase.
- Functions use camelCase.
- Fields use camelCase.
- Variables use camelCase.
- Modules use lowercase dotted names.
- Enum cases use camelCase.

The formatter and linter should enforce or warn on these conventions.

## 6. Braces and blocks

ClearKrypt uses braces for declaration bodies and nested UI structure.

```ck
model User {
  id: ID
  name: String
}
```

Braces provide visual shape. They also allow the IDE to map code blocks into diagrams and trees.

Significant indentation should not be the core grammar in the first version. Formatting should matter visually, but braces should define structure.

## 7. Type annotations

Field and parameter types use `name: Type`.

```ck
name: String
user: User
items: List<Item>
```

Functions use arrow return types:

```ck
fn displayName(user: User) -> String
```

This is readable, familiar, and maps well to multiple targets.

## 8. Optional values

Optional values use `?` after the type.

```ck
avatarUrl: URL?
```

The meaning must be explicit in the type system specification. MVP meaning: the value may be absent/null.

The compiler should require safe access to optional values.

## 9. Collections

Collection types should be readable and explicit.

```ck
users: List<User>
lookup: Map<ID, User>
tags: Set<String>
```

Avoid cryptic shorthand in the constitutional grammar. Shorthand can be considered later only if it improves readability.

## 10. Models

Models define serializable value data.

```ck
model Booking {
  id: ID
  customerName: String
  scheduledAt: DateTime
  status: BookingStatus
}
```

A model should be visually obvious in both source and IDE diagrams.

Model fields should be simple declarations, not hidden methods or arbitrary computation.

## 11. Enums

Enums represent named alternatives.

```ck
enum BookingStatus {
  pending
  confirmed
  cancelled(reason: String)
  completed
}
```

Associated data is allowed because it maps well to Swift enums, Kotlin sealed types, and TypeScript discriminated unions.

## 12. Errors

Errors should be declared as first-class domain concepts.

```ck
error AuthError {
  invalidCredentials
  lockedOut(until: DateTime)
  network(message: String)
}
```

Errors should not be invisible strings thrown from random places.

## 13. Functions

Functions should be explicit and readable.

```ck
fn fullName(first: String, last: String) -> String {
  return first + " " + last
}
```

Public functions should always have explicit return types.

Local type inference may be allowed for simple `let` bindings.

## 14. Async and throwing functions

Async and failure behavior should be visible in the signature.

```ck
fn fetchUser(id: ID) async throws NetworkError -> User
```

This syntax makes behavior clear to humans, the compiler, and the IDE.

## 15. Components

Components are reusable visual structure.

```ck
component UserCard(user: User) {
  VStack {
    Text(user.name)
    Text(user.email)
  }
}
```

The syntax should preserve a direct relationship between source nesting and visual UI nesting.

## 16. Screens

Screens are routable visual units.

```ck
screen ProfileScreen(user: User) {
  title "Profile"

  VStack {
    UserCard(user)
  }
}
```

A screen should be visible in route graphs, navigation maps, and generated target files.

## 17. Routes

Routes should be declarative.

```ck
route /users -> UsersScreen
route /users/:id -> UserDetailScreen(id: ID)
```

Route parameters must be typed.

The route graph must be derivable directly from source.

## 18. State machines

ClearKrypt should eventually support explicit state machines because they are highly visual and human-readable.

```ck
state LoginFlow {
  idle
  submitting
  failed(message: String)
  authenticated(session: Session)

  transition idle -> submitting on Submit
  transition submitting -> authenticated on Success
  transition submitting -> failed on Failure
}
```

State machines are not MVP-critical, but the syntax should leave room for them.

## 19. Capabilities and effects

Capabilities should describe platform powers.

```ck
capability Camera
capability Location

fn scanCode() requires Camera async throws -> ScanResult
```

This allows the IDE to show permissions and effects visually.

## 20. Native interop

Native interop must be explicit.

```ck
native swift fn deviceName() -> String {
  UIDevice.current.name
}
```

Rules:

- target must be named
- function signature must be typed
- native block must be visibly marked
- compiler must validate selected targets
- IDE must show portability impact

## 21. Attributes

Attributes may be allowed, but they must not become a dumping ground for hidden behavior.

Possible syntax:

```ck
@preview
screen DemoScreen { }
```

Attribute rules:

- attributes must be documented
- target-specific attributes must declare target behavior
- attributes must be visible in IDE inspection
- attributes must not silently override core semantics

## 22. Comments and documentation

Comments use standard line and block forms.

```ck
// line comment

/* block comment */
```

Documentation comments should be added with a clear syntax later, likely:

```ck
/// A user account in the application.
model User { }
```

The documentation generator should use these comments.

## 23. Formatting law

The formatter is authoritative.

Base formatting:

- two-space indentation
- one blank line between top-level declarations
- braces on the declaration line
- no trailing whitespace
- final newline
- stable import ordering
- stable generated formatting

Developers may disagree on style, but ClearKrypt should not waste energy on style wars.

## 24. Forbidden syntax patterns

ClearKrypt should avoid:

- excessive operator overloading in application code
- hidden imports
- implicit global variables
- untyped public APIs
- anonymous architecture
- decorators that change semantics invisibly
- magic filename behavior that cannot be explained by the project system
- target-specific code hidden in shared declarations
- syntax that cannot be visualized

## 25. Acceptable inference

Inference is allowed when local, obvious, and inspectable.

Examples:

```ck
let name = "Ada"
let count = 3
```

The IDE should be able to show inferred types.

Inference should not make public APIs vague. Public declarations need explicit types.

## 26. Grammar stability

Syntax should not churn casually.

Once real users and agents depend on a grammar form, changing it requires:

- migration path
- formatter support
- diagnostics
- documentation update
- examples update

## 27. Visual compatibility requirement

A syntax feature should not be accepted unless the IDE can represent it clearly.

Not every feature needs a fancy diagram, but every feature must be inspectable.

If the IDE cannot explain a feature, the feature is probably too magical or too early.

## 28. Target compatibility requirement

A syntax feature should not be accepted unless target behavior is known.

The answer may be:

- portable across all first-class targets
- target-specific with explicit native gates
- unsupported for some targets with diagnostics

The answer cannot be silence.

## 29. First grammar priority

The first implementable grammar should include:

- modules
- imports
- models
- simple enums
- errors
- functions
- optional types
- lists and maps
- screens
- components
- routes
- native function blocks

This is enough to test the core compiler and visual IDE concepts.

## 30. Constitutional test for syntax proposals

Every new syntax proposal must answer:

1. Is it human-readable?
2. Is it visually inspectable?
3. Is it statically checkable?
4. Does it map honestly to Swift, Kotlin, and React/TypeScript?
5. Does it preserve readable generated code?
6. Can the formatter handle it deterministically?
7. Can diagnostics explain it?
8. Does it reduce or increase hidden behavior?
9. Does it belong in the language, or is it library/framework behavior?
10. Does it make ClearKrypt more coherent?

If the answer is weak, the feature should wait.

## 31. First-pass status

This is the first constitutional pass for syntax. It should guide the formal grammar, parser, formatter, linter, examples, and IDE visual views.
