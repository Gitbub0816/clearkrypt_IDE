# Editor Intelligence

## Purpose

ClearKrypt editor intelligence should make `.ck` files feel first-class in the native IDE.

## Required capabilities

- diagnostics
- completion
- hover
- definition lookup
- references
- rename
- document outline
- workspace symbols
- formatting
- semantic coloring
- quick fixes

## Compiler dependency

Editor intelligence must use compiler-core for parsing, symbol resolution, and type checking.

Do not duplicate compiler logic in the editor layer.

## Diagnostics

Diagnostics should show clear messages, exact ranges, severity, and target information when relevant.

## Completion

Completion should understand keywords, modules, imports, models, enums, functions, components, screens, routes, fields, and native targets.

## Hover

Hover should explain symbol type, declaration kind, documentation, and target support.

## Rename

Rename should be symbol-aware.

## Quick fixes

Useful early quick fixes:

- add import
- create missing model
- create missing function
- create missing target implementation
- format file

## MVP

MVP is complete when the IDE can edit `.ck`, show diagnostics, show outline, and provide basic completion.
