# The Power Roadmap

> This document supports the ClearKrypt Constitution. If it conflicts with
> `/constitution`, the constitution wins. It is the design direction for the
> features that take ClearKrypt from "solid" to "better than anything else
> on the market" — each one filtered through the constitutional tests
> (readable, checkable, visualizable, honestly portable, testable).

## Where the language stands

Shipped and snapshot-tested across Swift, Kotlin, and TypeScript:

- models, enums with payloads, typed errors, functions
- nested (local) functions with real lexical capture and self-recursion
- string interpolation
- `match` with compiler-proven exhaustiveness and payload binding
- first-class optionals: `?.`, `??`, `if let`
- typed `throw` + `try` propagation
- honest diagnostics with stable codes; a language server; two native IDEs

## The thesis

Most languages make you choose: expressive but single-platform (Swift),
portable but lowest-common-denominator (most transpilers), or powerful but
unreadable. ClearKrypt's bet is that **one readable source of truth can
compile to genuinely idiomatic code on every platform that matters** — and
that the compiler, not convention, guarantees it. Every feature below
exists to widen that gap.

## Wave 1 — completing the core (next)

**`catch` and error conversion.** `try { } catch e { match e { ... } }`
with the existing exhaustive-match machinery; error-type conversion between
throws clauses. TS gains generated type-guard helpers (`isOrderError`).

**`await` and structured async.** Async call sites (`await try f()`),
async propagation checking (the missing half of today's `async`
signatures), lowering to Swift async/await, Kotlin coroutines, and JS
promises — the three best async runtimes in the industry, driven from one
syntax.

**UI lowering (Milestone 7).** Screens, components, and routes — already
parsed and checked — emit SwiftUI views, Compose composables, and React
components with a routing adapter. This is the product's soul: one screen
definition, three native UIs, with the route graph visible in the IDE.

**Guards and nested patterns.** `cancelled(reason) if reason == "" ->` and
matching through nested enums/models, still exhaustiveness-checked.

## Wave 2 — the differentiators

**State machines as declarations.** The constitution reserved `state`
syntax from day one. Transitions become compiler-checked: illegal
transitions are compile errors, the IDE renders the state graph, and
targets get exhaustive transition functions for free.

**Capabilities as a checked effect system.** `requires Camera` today is
recorded; tomorrow it propagates: a function calling a Camera-requiring
function must itself require Camera, entry points surface the full
permission set per platform (Info.plist, AndroidManifest, browser APIs),
and the IDE shows the effect graph before anything builds.

**Refinement constraints on data.** `model Booking { partySize: Int where
partySize > 0 }` — validated constructors on every target, constraint
listed in the IDE's model view, honest runtime checks where static proof is
impossible.

**Derived serialization.** `derive json` on a model emits Codable
conformance, kotlinx.serialization, and TS codecs with one wire format —
round-trip tested across all three targets in CI, which is a guarantee no
hand-rolled stack gives you.

**Generics + protocols.** `model Page<T>`, protocol contracts for services
and dependency injection — designed to map to Swift generics/protocols,
Kotlin generics/interfaces, and TS generics/interfaces without erasure
surprises.

## Wave 3 — the moonshots (design sketches, constitution-gated)

- **Snapshot-typed native interop**: native blocks type-checked against
  recorded platform SDK surface files, so `UIDevice.current.name` is
  verified at ClearKrypt-compile time, not Xcode time.
- **Time-travel value inspection** in the IDE: because models are immutable
  values on every target, generated code can (opt-in) journal them; the
  debugger scrubs through state history.
- **Provable UI states**: match-style exhaustiveness for screen states —
  a screen declaring `state: LoadState` must render every case.

## What ClearKrypt will not do

Per the constitution: no hidden runtime magic, no silent target
degradation, no macro system that makes source unreadable, no feature that
the IDE cannot explain. Power that cannot be inspected is not power.
