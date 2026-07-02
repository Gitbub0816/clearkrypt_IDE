# ClearKrypt Constitution — Document 4: Type System and Semantics

## 1. Purpose

This document defines the constitutional direction for ClearKrypt's type system and semantic model.

The type system is the contract between human-readable source, compiler correctness, IDE intelligence, and generated native output.

## 2. Core type-system thesis

ClearKrypt should be strongly and statically typed.

The language should make intent explicit enough for the compiler to generate reliable Swift, Kotlin, and React/TypeScript code, while still allowing ergonomic local inference where it improves readability.

## 3. Type system goals

The type system should provide:

- clear domain modeling
- early error detection
- useful IDE completion
- safe target generation
- reliable refactoring
- readable function signatures
- honest portability checks
- visual model generation

## 4. Explicit public surfaces

Public declarations should have explicit types.

This includes:

- model fields
- function parameters
- function return types
- component parameters
- screen parameters
- service methods
- protocol requirements
- native interop signatures

Local inference is allowed when the type is obvious and inspectable.

## 5. Primitive types

Initial primitive types:

- String
- Int
- Float
- Decimal
- Bool
- Date
- DateTime
- ID
- Email
- URL
- Data
- Void
- Never

These types should have known target mappings.

## 6. Domain types

Domain types include:

- models
- enums
- errors
- protocols
- state types
- capability declarations
- service contracts

Domain types are important because they make architecture visible.

## 7. Optionals

Optional types use `T?`.

An optional means a value may be absent.

The compiler should prevent unsafe optional access.

Target mapping:

- Swift: optional
- Kotlin: nullable type
- TypeScript: nullable union or documented optional policy

The exact serialization policy must be explicit.

## 8. Collections

Core collection types:

- List<T>
- Map<K, V>
- Set<T>

Collections should map to platform-native collections where practical.

The type checker should enforce element types.

## 9. Models

Models are value-oriented structured data.

A model should compile to:

- Swift struct where possible
- Kotlin data class
- TypeScript type or interface

Model fields should be typed, serializable where possible, and visible to IDE diagrams.

## 10. Enums

Enums should support simple cases and eventually associated data.

Associated data is important because it maps to powerful native patterns:

- Swift enum associated values
- Kotlin sealed class/interface
- TypeScript discriminated unions

The compiler must preserve exhaustiveness information when possible.

## 11. Errors

Errors should be typed domain concepts.

A function that can fail should expose that in the signature.

```ck
fn loadUser(id: ID) async throws NetworkError -> User
```

Target strategies may differ, but source semantics must remain explicit.

## 12. Functions

Functions have typed parameters and return values.

The semantic checker should validate:

- argument count
- argument names if named calls are used
- argument types
- return type
- missing return paths
- async use
- throwing use

## 13. Generics

Generics should exist because reusable architecture requires them.

```ck
model Page<T> {
  items: List<T>
  nextCursor: String?
}
```

Generics must remain readable and target-mappable.

Advanced generic features should wait until the base compiler is stable.

## 14. Protocols and interfaces

ClearKrypt should support protocol-style contracts.

These are necessary for testability, service abstraction, dependency injection, generated clients, and architecture diagrams.

Target mapping:

- Swift protocol
- Kotlin interface
- TypeScript interface

## 15. State semantics

State should be explicit.

UI state, domain state, and state machines should not be hidden in arbitrary mutable globals.

Future state-machine syntax should be type-checked for valid transitions.

## 16. Effects and capabilities

Effects describe side behavior. Capabilities describe platform powers.

Examples:

- network
- storage
- camera
- location
- notifications
- file access

A function requiring a capability should expose that in its signature or declaration metadata.

## 17. Target-specific types

Target-specific types are allowed only behind explicit target boundaries.

A Swift-only type cannot leak into shared code unless the selected target set is Swift-only.

The compiler must catch target leakage.

## 18. Native interop typing

Native functions must declare typed inputs and outputs.

Native blocks must not be untyped holes.

If shared source calls a native function, every selected target must have a compatible implementation or fallback.

## 19. Type inference

Allowed inference:

- local variable from literal
- local variable from function return
- generic inference for obvious calls

Restricted inference:

- public declarations
- model fields
- route parameters
- native boundaries
- service APIs

The IDE must be able to show inferred types.

## 20. Semantic model

The compiler should produce a semantic model after type checking.

The semantic model should include:

- resolved symbols
- resolved types
- declaration relationships
- call relationships
- route relationships
- component relationships
- target capability requirements
- diagnostics

This model powers IDE features and IR lowering.

## 21. Exhaustiveness

Pattern matching and enum handling should eventually support exhaustiveness checking.

This is important for correctness and native-quality output.

## 22. Null and absence policy

ClearKrypt must define null/absence clearly.

The language should avoid three different meanings for absent data.

The first pass should treat optional as nullable/absent and make serialization policy explicit in target docs.

## 23. Compatibility law

A type-system feature must not be accepted unless target behavior is known.

If Swift, Kotlin, and TypeScript differ, the compiler must document and expose those differences.

## 24. Visual law

Every declared type should be inspectable in the IDE.

Models, enums, protocols, errors, states, and capabilities should all be visible in architecture or type views.

## 25. MVP type system

MVP should include:

- primitive types
- model types
- simple enum types
- optional types
- list/map types
- function signatures
- basic function return checking
- native signature checking
- selected target compatibility checks

Generics, protocols, and advanced effects can follow.

## 26. Constitutional test

A type-system feature should answer:

1. Is it readable in source?
2. Can it be checked statically?
3. Can it be visualized?
4. Can it map honestly to each target?
5. Does it improve generated code?
6. Does it preserve refactor safety?
7. Does it avoid hidden runtime behavior?

If not, defer it.
