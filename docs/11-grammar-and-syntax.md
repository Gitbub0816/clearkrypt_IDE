# Grammar and Syntax Guide

## Syntax philosophy

ClearKrypt syntax should be readable first, powerful second, clever never.

A developer should be able to glance at source code and understand the application structure.

## File structure

Recommended source file shape:

```ck
module app.profile

import app.models.User

model Profile {
  id: ID
  displayName: String
}

fn displayTitle(profile: Profile) -> String {
  return profile.displayName
}
```

## Declaration order

Preferred order inside a file:

1. module
2. imports
3. public models and enums
4. errors and capabilities
5. functions
6. components and screens
7. routes
8. native blocks

The compiler should not require this order unless necessary, but the formatter can encourage it.

## Naming

Recommended naming:

- Models: PascalCase
- Enums: PascalCase
- Enum cases: camelCase
- Functions: camelCase
- Variables: camelCase
- Modules: lowercase dotted paths
- Screens: PascalCase ending with Screen
- Components: PascalCase

## Braces

Declarations use braces.

```ck
model User {
  id: ID
  name: String
}
```

## Type annotation

Fields and parameters use `name: Type`.

```ck
name: String
fn greet(name: String) -> String
```

## Return type

Functions use arrow return types.

```ck
fn count() -> Int
```

## Optional type

Optional types use `?`.

```ck
avatarUrl: URL?
```

## Lists and maps

```ck
users: List<User>
settings: Map<String, String>
```

## Strings

Strings use double quotes.

```ck
Text("Hello")
```

String interpolation can be added later.

## Functions

```ck
fn fullName(first: String, last: String) -> String {
  return first + " " + last
}
```

## Components

```ck
component UserCard(user: User) {
  VStack {
    Text(user.name)
  }
}
```

## Screens

```ck
screen ProfileScreen(user: User) {
  title "Profile"

  VStack {
    UserCard(user)
  }
}
```

## Routes

```ck
route /profile/:id -> ProfileScreen(id: ID)
```

## Native blocks

```ck
native swift fn deviceName() -> String {
  UIDevice.current.name
}
```

Native blocks are target-specific and must be visibly marked by the IDE.

## Formatting

The formatter should use:

- two-space indentation
- stable declaration ordering where safe
- one blank line between top-level declarations
- no trailing whitespace
- final newline

## MVP grammar

MVP grammar should be intentionally small:

- modules
- imports
- models
- simple enums
- functions
- basic expressions
- components
- screens
- routes
- native block placeholders

The syntax can expand after the compiler pipeline is stable.
