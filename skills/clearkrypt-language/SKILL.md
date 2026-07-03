---
name: clearkrypt-language
description: Write, read, review, or explain ClearKrypt (.ck) source code — the language that compiles one source file to idiomatic Swift, Kotlin, and TypeScript/React. Use this whenever a task involves creating or editing .ck files, explaining ClearKrypt syntax, predicting or reviewing generated Swift/Kotlin/TypeScript output, or working anywhere in a ClearKrypt project (compiler, emitters, IDEs, CLI).
---

# ClearKrypt language skill

ClearKrypt is a single source language that compiles to three **idiomatic**,
native targets: Swift (iOS/macOS), Kotlin (Android/JVM), and
TypeScript/React (web). One `.ck` file produces real Swift, real Kotlin, and
real TypeScript — not a lowest-common-denominator subset of any of them. The
compiler type-checks the whole project before emitting anything, and every
diagnostic carries a stable `CKxxxx` code with a plain-English explanation.

This document is the complete, current syntax of the language. If you are
about to write or edit `.ck` source, read this file first — do not guess
syntax from Swift, Kotlin, TypeScript, or Rust habits. ClearKrypt looks
similar to those languages in places and is **deliberately different** in
others (see "Things that look familiar but are NOT the same", below).

## Mental model

- One `.ck` file declares one `module` and any number of top-level
  declarations: `model`, `enum`, `error`, `fn`, `capability`, `screen`,
  `component`, `route`, and `native` blocks.
- The compiler checks types project-wide, then emits Swift, Kotlin, and
  TypeScript from a shared internal representation — never straight
  text-templating from source.
- Everything ClearKrypt emits is meant to be read and committed by humans.
  If a feature can't be emitted as clean, idiomatic target code, the
  compiler refuses (or warns) instead of generating something ugly or
  wrong. This is the "target honesty" law: see the CK0004/CK0005 section
  below.
- Models are immutable value types. There is no class/inheritance model.
  There is no mutation of fields after construction.

## File and project layout

```
myapp/
  clearkrypt.toml       # project manifest
  src/
    main.ck             # one or more .ck files, one `module` each
  generated/            # compiler output — never hand-edit
    swift/...
    kotlin/...
    react/...
```

`clearkrypt.toml`:

```toml
[project]
name = "myapp"
version = "0.1.0"

[targets]
swift = true
kotlin = true
react = true

[output]
dir = "generated"
```

## Comments

Comments are **word-based**, not symbol-based. `comment` is a reserved word;
it can never be used as an identifier, field name, or parameter name.

```ck
comment: this is a single-line comment, like other languages' //

comment
This is a block comment. It can span as many lines as you want.
Nothing in here is parsed as ClearKrypt code.
end comment
```

- Line form: `comment:` runs to the end of the line.
- Block form: a bare `comment` (no colon) opens a block; it closes at the
  next `end comment`, matched as whole words (so prose like "recommend" or
  "weekend comments" inside the block is never mistaken for the closer).

**Do not** write `//` or `/* */` — they are not comments in ClearKrypt and
will either fail to parse or be misread as division/operators.

## Reserved keywords

`module`, `import`, `model`, `enum`, `fn`, `screen`, `component`, `route`,
`effect`, `capability`, `requires`, `error`, `native`, `swift`, `kotlin`,
`typescript`, `react`, `let`, `var`, `if`, `else`, `for`, `in`, `while`,
`match`, `return`, `throw`, `throws`, `try`, `catch`, `async`, `true`,
`false`, `null`, `public`, `private`, `internal`, `comment`.

(`for`, `while`, and `catch` are reserved but not implemented yet — see
"Not yet implemented", below.)

## Modules and imports

```ck
module app.profile

import app.models.User
import platform.permissions.Location
```

One `module` declaration per file. Everything in a module is visible to
other files in the same module without an import. Cross-module references
need an explicit `import`. No wildcard imports.

## Primitive types

`String`, `Int`, `Float`, `Decimal`, `Bool`, `Date`, `DateTime`, `ID`,
`Email`, `URL`, `Data`, `Void` (return position only), `Never` (return
position only).

Collections: `List<T>`, `Map<K, V>`, `Set<T>`. Optionality is a type
modifier: `T?` means "may be absent" (see Optionals, below) — there is no
separate nullable-reference-type syntax.

## Models

Models are immutable value data — think Swift `struct` / Kotlin
`data class` / a TS `interface`, not a class.

```ck
model User {
  id: ID
  name: String
  email: Email
  isActive: Bool = true   comment: default values are allowed
}
```

Construct with named arguments: `User(id: x, name: y, email: z)`. There is
no positional construction and no field mutation after construction.

## Enums and errors

```ck
enum OrderStatus {
  pending
  shipped
  delivered
}

error OrderError {
  notFound
  rejected(reason: String)   comment: cases may carry payload, like Swift
}
```

`error` is syntactically identical to `enum` (cases, optional payload) but
is used in `throws` clauses (below) and maps to each target's native error
type (Swift `Error`, Kotlin `Exception`, a TS discriminated union).

Reference a case as a value: `OrderStatus.pending`, or with payload
`OrderError.rejected(reason: "missing label")`.

## Functions

```ck
fn fullName(first: String, last: String) -> String {
  return first + " " + last
}
```

- Explicit return type after `->`. Omit it only for `Void`.
- `throws ErrorType` before `->` marks a function that can fail (see
  Throwing, below). `async` marks it asynchronous.
- `requires Capability1, Capability2` records required permissions
  (recorded today; not yet enforced/propagated — see "Not yet
  implemented").

### Nested (local) functions

`fn` is also valid as a **statement inside any block** — a function local
to that scope:

```ck
fn triangular(n: Int) -> Int {
  fn sumUpTo(current: Int) -> Int {
    if current <= 0 {
      return 0
    }
    return current + sumUpTo(current: current - 1)   comment: self-recursion works
  }
  return sumUpTo(current: n)
}
```

A local function has its own return type and its own `throws` clause, can
call itself, and can read every enclosing parameter and local (real
lexical capture — Swift, Kotlin, and TypeScript all support this natively,
so it "just works" on every target). It cannot be passed around as a value
— only called by name.

## Control flow and `let`/`var`

```ck
fn classify(score: Int) -> String {
  let passed = score >= 60      comment: 'let' declares an immutable local
  if passed {
    return "pass"
  } else {
    return "fail"
  }
}
```

Two real, current limitations to know about:

- There is no `for`/`while` loop yet (reserved keywords, not implemented).
  Prefer recursion (including a local helper function) for repetition
  today.
- `var` parses (marking a local as mutable in the AST) but there is **no
  reassignment statement yet** — `name = newValue` is not valid syntax
  after a `var` declaration in this version. In practice, prefer `let`
  everywhere until reassignment ships.

## String interpolation

```ck
let message = "Order \(order.label): \(order.total) items"
```

Swift-style `\( ... )` inside a normal double-quoted string. Any expression
is allowed inside the parens, including nested calls and further strings.

## `match` expressions

```ck
let label = match order.status {
  pending -> "waiting"
  shipped -> "on the way"
  delivered -> "done"
}
```

- `match` is an **expression**, valid as a `let` initializer or a `return`
  value (not a general statement).
- The compiler proves exhaustiveness at compile time (`CK0014` if a case is
  missing) — do not add a catch-all case unless you mean it; add `else ->`
  only when you deliberately want a default:

```ck
let label = match order.status {
  shipped -> "on the way"
  else -> "not shipped yet"
}
```

- Cases with payload bind positionally:

```ck
fn errorText(failure: OrderError) -> String {
  return match failure {
    notFound -> "missing"
    rejected(reason) -> "rejected: \(reason)"
  }
}
```

(Note: `error` itself is a reserved word — see Reserved keywords, above —
so it cannot be used as a parameter or variable name; that's why this
parameter is called `failure`.)

## Optionals

```ck
model Order {
  note: String?          comment: may be absent
}

fn noteLength(order: Order) -> Int {
  if let note = order.note {
    return lengthOf(text: note)
  } else {
    return 0
  }
}

fn customerName(order: Order) -> String {
  return order.customer?.name ?? "anonymous"   comment: ?. chains, ?? coalesces
}
```

- `T?` is the optional type. `nil`/`None`/`undefined` are all spelled
  `null` in ClearKrypt source.
- `?.` for optional chaining, `??` for coalescing (right-associative, same
  precedence behavior as Swift), `if let name = expr { } else { }` to
  unwrap.
- You cannot use a value of optional type directly (e.g. pass it where a
  non-optional is expected) without `?.`, `??`, or `if let` first — the
  checker reports `CK0003`.

## Throwing and propagating errors

```ck
fn requireShipped(status: OrderStatus) throws OrderError -> String {
  return match status {
    shipped -> "ok"
    else -> "not shipped yet"
  }
}

fn checkOrder(order: Order) throws OrderError -> String {
  if order.label == "" {
    throw OrderError.rejected(reason: "missing label")   comment: 'throw' is a statement, not an expression
  }
  return try requireShipped(status: order.status)   comment: 'try' is required at the call site
}
```

- Only a function declared `throws ErrorType` may `throw`, and only that
  exact error type (or one assignable to it).
- `throw` is a **statement** — it cannot appear inside a `match` arm body
  or any other expression position (arm bodies are expressions).
- Calling a throwing function requires the `try` keyword at the call site,
  and the *caller* must itself be `throws` with a compatible error type
  (propagation only — there is no `catch` yet; see "Not yet implemented").

## Native interop blocks

```ck
native swift fn deviceName() -> String {
  UIDevice.current.name
}
```

Declares a per-target native implementation. Every selected build target
needs a matching `native <target> fn` block for the same signature, or the
build fails honestly with `CK0005` (missing native implementation) rather
than silently skipping the target. Note the naming mismatch: the native
block keyword for the web target is `typescript` (`native typescript fn`),
while the build target and `--target` flag name is `react` — one target,
two names, by design (see "Native block target names vs. build target
names" in `docs/19-target-mappings.md`).

## Not yet implemented (the compiler is honest about this — CK0004/CK0005)

These parse and type-check, but do not emit yet: `screen`/`component`/
`route` declarations (UI lowering to SwiftUI/Compose/React), `capability`
enforcement/propagation, `for`/`while` loops, `catch` (error handling is
propagation-only today), serialization (`derive json`), and generics.
Writing them is fine for a spec/design doc, but do not expect generated
output for them yet — the compiler reports `CK0004` (warning: type-checks,
not emitted) or `CK0005` (error: missing native implementation for a
selected target), never silent dropping.

## Things that look familiar but are NOT the same

- **No `//` or `/* */` comments.** Use `comment:` / `comment ... end
  comment` (see Comments, above). This is the single most common mistake
  a model makes when writing ClearKrypt from habit.
- **No semicolons.** Statements end at the newline.
  There is no need for a Swift/Rust/Kotlin trailing-`;`.
- **No `class`, no inheritance, no mutation of fields.** Use `model` (an
  immutable value) and free `fn`s. There is no `self`/`this`.
- **`let`/`var` govern mutability of a local binding**, not a field —
  models have no field-level mutability keyword; every field is
  effectively `let`.
- **`match` is an expression, not a statement**, and only valid in `let`/
  `return` position — you cannot use bare `match { }` as a standalone
  statement the way you might reach for `switch` in other languages.
- **No `try`/`catch` blocks.** `try` only marks a call site that
  propagates; there is no `catch` yet (reserved keyword, unimplemented).
- **Nested functions capture by reference to the enclosing scope**, not by
  explicit closure-capture-list syntax — there is no `[weak self]`-style
  capture list because there is no `self`/reference types to capture.
- **`error` is not exceptions-with-`throw`-anywhere.** Only a function
  declared `throws ErrorType` may throw that type, and only in ways the
  checker can trace to a `try` at the call site.
- **Functions are not values.** You cannot pass `someFunction` around as a
  first-class value or assign it to a variable — only call it by name.

## Per-target output cheat sheet

| ClearKrypt | Swift | Kotlin | TypeScript |
| --- | --- | --- | --- |
| `model X { a: String }` | `struct X: Hashable { public let a: String }` | `data class X(val a: String)` | `interface X { readonly a: string }` |
| `enum X { a, b }` | `enum X: String, Hashable` with one `case` per line | `enum class X { A, B }` | `type X = 'a' \| 'b'` |
| `error X { a, b(m: String) }` | `enum X: Error, Hashable` with one `case` per line | `sealed class X : Exception()` | discriminated union `{ kind: 'a' } \| { kind: 'b', m: string }` |
| `"a\(x)"` | `"a\(x)"` | `"a${x}"` | `` `a${x}` `` |
| `a ?? b` | `a ?? b` | `a ?: b` | `a ?? b` |
| `a?.b` | `a?.b` | `a?.b` | `(a?.b ?? null)` |
| `match` | `switch` expression | `when` expression | exhaustive `switch` |
| nested `fn` | local `func` | local `fun` | nested `function` |
| `throws`/`try` | `throws`/`try` | propagation only (no checked exceptions) | propagation only |

Full, authoritative mapping: `docs/19-target-mappings.md` in this
repository.

## CLI quick reference

```sh
clearkrypt new my-app              # scaffold a new project
clearkrypt check [dir]             # parse + type-check, no output written
clearkrypt build [dir]             # check + emit every enabled target
clearkrypt emit [dir] --target swift   # emit exactly one target (repeatable)
clearkrypt format [dir] [--check]  # normalize whitespace
clearkrypt language-server         # run the LSP over stdio
```

Add `--json` to `check`/`build`/`emit` for machine-readable diagnostics
(each has a stable `code`, `severity`, `file`, and `range`).

## Where to look for more detail in this repository

- `constitution/` — the highest-authority design law (read before making
  any judgment call the syntax reference above doesn't cover).
- `docs/01-language-spec.md` — the full language spec.
- `docs/11-grammar-and-syntax.md` — grammar-level detail with more examples.
- `docs/19-target-mappings.md` — the exact, exhaustive per-target mapping.
- `tests/fixtures/syntax/*.ck` — real, compiler-verified example programs
  covering every shipped feature (all snapshot-tested; if you want to see
  a feature actually compile, one of these files uses it).
