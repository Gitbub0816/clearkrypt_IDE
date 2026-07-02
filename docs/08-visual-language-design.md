# Visual Language Design

## Purpose

ClearKrypt should be a powerful visual programming language without becoming a no-code builder.

The source code remains the source of truth, but the IDE should understand enough structure to render visual maps, component trees, state flows, route graphs, data models, target outputs, and compiler internals.

## Visual language principle

Every visual surface must map back to explicit source code.

A developer should be able to move between:

- Text source.
- Visual structure.
- Compiler IR.
- Generated native output.

No visual edit should create hidden behavior.

## Human-readable syntax

ClearKrypt syntax is part of the product. The language should be readable by humans before they know every detail of the compiler.

Preferred style:

- English-like declarations.
- Explicit types.
- Clean nesting.
- Minimal punctuation.
- No symbolic cleverness for common app code.
- Strong naming conventions.

## Visual surfaces

The IDE should eventually include these visual surfaces:

- Project graph.
- Module graph.
- Route graph.
- Screen/component tree.
- Data model diagram.
- State machine diagram.
- Effect graph.
- Dependency graph.
- Build graph.
- Target comparison view.
- AST explorer.
- IR explorer.
- Generated-code mapping.

## Source mapping

Every visual node should link to source spans.

Examples:

- Clicking a model field opens the exact field declaration.
- Clicking a route opens the route declaration.
- Clicking a generated Swift property opens the ClearKrypt source that produced it.
- Clicking a diagnostic highlights both source and visual node.

## Visual editing rules

Visual editing can be allowed later, but only if it produces clean `.ck` source.

Rules:

- Visual edits must round-trip through the formatter.
- Visual edits must never write opaque metadata into source unless explicitly part of the language.
- Visual edits must show diffs before applying large refactors.
- The text editor always remains authoritative.

## Component tree example

ClearKrypt source:

```ck
screen Dashboard(user: User) {
  title "Dashboard"

  VStack {
    Text("Welcome")
    UserCard(user)
  }
}
```

Visual tree:

```text
Dashboard screen
  title: Dashboard
  VStack
    Text: Welcome
    UserCard(user)
```

## Route graph example

Source:

```ck
route / -> HomeScreen
route /users -> UsersScreen
route /users/:id -> UserDetailScreen(id: ID)
```

Visual graph:

```text
HomeScreen
  -> UsersScreen
      -> UserDetailScreen(id)
```

## State machine example

ClearKrypt should eventually support explicit state machines:

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

The IDE should render this as a state diagram and validate impossible transitions.

## Data model diagrams

Models and relationships should be visualized.

Example:

```ck
model Order {
  id: ID
  customer: Customer
  items: List<OrderItem>
}
```

The IDE should show `Order -> Customer` and `Order -> OrderItem` edges.

## Target comparison

The IDE should show how one ClearKrypt feature maps to each target.

Example:

```text
ClearKrypt model User
  Swift: struct User: Codable
  Kotlin: data class User
  React: TypeScript type User
```

This is central to trust. Developers need to see what the compiler did.

## Visual diagnostics

Diagnostics should appear in both text and visual form.

Examples:

- A broken route edge is red in the route graph.
- A missing model type is red in the model diagram.
- A target-only issue appears in the target comparison view.

## Visual language MVP

MVP should include read-only visual views:

- Symbol outline.
- Route graph.
- Component tree.
- Generated-code mapping.
- AST or IR inspection view.

Visual editing can wait until the compiler and formatter are stable.
