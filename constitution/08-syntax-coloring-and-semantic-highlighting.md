# ClearKrypt Constitution — Document 8: Syntax Coloring and Semantic Highlighting

## 1. Purpose

This document defines the constitutional rules for ClearKrypt syntax coloring, semantic highlighting, visual emphasis, and code readability inside the IDE.

ClearKrypt is a human-readable and visual language. Color is not decoration. Color is part of comprehension, navigation, diagnostics, and visual identity.

## 2. Core highlighting thesis

Syntax coloring should help humans understand program structure faster without becoming noisy, dependent on taste, or inaccessible.

ClearKrypt highlighting must distinguish meaning, not merely token categories.

The long-term goal is semantic highlighting powered by compiler understanding.

## 3. Syntax vs semantic highlighting

### Syntax highlighting

Syntax highlighting is based on lexical or parser-level categories.

Examples:

- keywords
- strings
- numbers
- comments
- punctuation
- operators

### Semantic highlighting

Semantic highlighting is based on compiler meaning.

Examples:

- model names
- enum names
- enum cases
- protocol names
- function declarations
- function calls
- fields
- parameters
- local variables
- screens
- components
- routes
- native targets
- capabilities
- errors
- deprecated symbols
- generated/inferred symbols

ClearKrypt should use syntax highlighting for bootstrapping and semantic highlighting for serious IDE work.

## 4. Color must support structure

Color should reveal the architecture of a file.

A developer should be able to visually distinguish:

- declarations from usage
- types from values
- screens from components
- shared code from target-native code
- errors from warnings
- public API from local implementation
- compiler-inferred information from written source

## 5. Color must not be the only signal

No meaning may depend on color alone.

The IDE must also use:

- text labels
- icons
- font weight
- underlines
- gutter markers
- tooltips
- outlines
- diagnostics panels

This protects accessibility and makes themes safe.

## 6. Theme independence law

ClearKrypt semantic categories should be theme-independent.

The compiler or language server should emit semantic token categories. Themes decide actual colors.

Do not hard-code language meaning to a specific color value in the compiler.

## 7. Default theme philosophy

The default ClearKrypt theme should be calm, modern, readable, and visual.

It should avoid extreme rainbow coloring. Too many colors make code harder to scan.

Preferred default behavior:

- keywords are distinct but not overpowering
- types are clearly different from values
- strings and numbers are readable
- comments recede without disappearing
- native target code is visibly different
- diagnostics are impossible to miss
- generated or inferred overlays are subtle but clear

## 8. Semantic token categories

ClearKrypt should define semantic categories including:

- keyword
- module
- import
- type
- primitiveType
- model
- enum
- enumCase
- errorType
- protocol
- capability
- service
- state
- transition
- function
- method
- parameter
- field
- localVariable
- screen
- component
- route
- nativeBlock
- nativeTarget
- attribute
- string
- number
- boolean
- null
- comment
- operator
- punctuation
- deprecated
- unresolved
- generated
- inferred
- targetSpecific

The exact token names may change, but the semantic coverage should remain.

## 9. Declaration versus usage

The IDE should distinguish declarations from usages.

Examples:

- `model User` declaration should be visually stronger than `user: User` usage.
- `fn login` declaration should be distinct from `login(...)` call.
- A field declaration should differ from field access.

This improves navigation and scanning.

## 10. Architectural token emphasis

ClearKrypt should emphasize architectural declarations.

Important architectural tokens:

- module
- model
- enum
- error
- protocol
- service
- state
- component
- screen
- route
- capability
- native target

These tokens are the visual skeleton of a file.

## 11. Native code highlighting

Native interop blocks must be visibly marked.

A developer should never accidentally miss that code is target-specific.

Native blocks should show:

- target name
- boundary start
- boundary end
- portability impact
- missing target implementations

The IDE may embed target-language highlighting inside native blocks later.

## 12. Route highlighting

Routes should have special highlighting because they define navigation structure.

A route should distinguish:

- path literal
- route parameter
- target screen
- parameter type

Example:

```ck
route /users/:id -> UserDetailScreen(id: ID)
```

The route graph should use matching semantic categories.

## 13. UI tree highlighting

Components and screens should support visual nesting clarity.

Highlighting should help distinguish:

- layout containers
- text nodes
- component calls
- parameters
- bindings
- conditional UI branches
- repeated UI lists

This is central to ClearKrypt's visual identity.

## 14. Effects and capability highlighting

Effects and capabilities should be visible.

A function requiring camera, location, network, storage, or notifications should be visually distinguishable in source and graph views.

Capability highlighting helps users understand platform permission impact before build time.

## 15. Diagnostic coloring

Diagnostics should override or augment normal highlighting.

Severity categories:

- error
- warning
- info
- hint

Diagnostics should be visible in:

- underline
- gutter
- overview ruler/minimap if present
- diagnostics panel
- visual graphs

Diagnostic colors must be accessible in light and dark themes.

## 16. Inferred and generated information

The IDE may show inferred types, generated serializers, generated routes, or target imports.

These should be visually distinct from source-authored declarations.

The user must be able to tell the difference between written source and compiler-provided information.

## 17. Accessibility law

Syntax coloring must support:

- light themes
- dark themes
- high-contrast themes
- color-blind users
- reduced-color modes

Color cannot be the only indicator of meaning.

The language server should provide semantic categories; the theme layer should provide accessible palettes.

## 18. Theme extension law

Themes may change colors, but may not change semantic meaning.

A theme can decide how `model` looks. It cannot decide that models and functions are the same semantic category.

## 19. Minimal viable highlighting

The first MVP highlighter should support:

- keywords
- strings
- numbers
- comments
- primitive types
- model names
- enum names
- function names
- fields
- parameters
- screens
- components
- routes
- native targets
- diagnostics

## 20. Long-term semantic highlighting

Long-term highlighting should come from compiler/language-server semantic tokens after type checking.

The editor should gracefully fall back to syntax highlighting while semantic data is loading or code is incomplete.

## 21. Visual consistency law

Color categories used in source should align with visual graph categories.

For example:

- a screen in source and a screen node in route graph should feel related
- a model in source and a model diagram node should feel related
- a native target in source and target comparison view should feel related

This makes the IDE feel unified.

## 22. Constitutional test

A highlighting choice should answer:

1. What meaning does this color communicate?
2. Is the meaning also available without color?
3. Does it reduce visual noise?
4. Does it align with compiler semantics?
5. Does it work in light and dark themes?
6. Does it help source and visual views feel connected?
7. Can it degrade safely before semantic data is ready?

If not, simplify it.
