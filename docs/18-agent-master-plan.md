# Agent Master Plan

## Purpose

This document gives Fable and other coding agents a direct execution plan for turning the specification into working code.

## Rule one

Do not begin with the IDE UI.

Begin with the smallest working compiler path, then attach the IDE to it.

## Phase 1: repo skeleton

Create:

- root package setup
- TypeScript config
- test runner
- package folders
- example fixtures
- basic exports

Packages:

- compiler-core
- emitter-swift
- emitter-kotlin
- emitter-react
- cli
- formatter
- language-service
- ide-core
- ide-native

## Phase 2: compiler frontend

Build:

- source file reader
- token model
- lexer
- parser
- AST
- syntax diagnostics

Support:

- module
- import
- model
- enum
- function

## Phase 3: semantic model

Build:

- symbol table
- primitive types
- type resolver
- model validation
- function validation
- semantic diagnostics

## Phase 4: IR

Build:

- IR node model
- AST to IR lowering
- IR snapshots
- target capability metadata

## Phase 5: target output

Build:

- Swift model output
- Kotlin model output
- TypeScript model output
- simple enum output
- simple function output

## Phase 6: CLI

Build commands:

- new
- check
- emit
- format

## Phase 7: editor intelligence

Build:

- diagnostics service
- document outline
- completion basics
- hover basics
- formatting hook

## Phase 8: native IDE shell

Build:

- open project
- file tree
- editor host
- diagnostics panel
- target selector
- generated output explorer
- visual outline panel

## Phase 9: visual language

Build read-only visual views:

- route graph
- component tree
- model graph
- source to generated mapping

## Phase 10: expansion

Add:

- async
- typed errors
- effects
- native bindings
- generic models
- protocols
- package dependencies
- debugger views

## Agent acceptance standard

Every agent should leave the repo more buildable, more tested, and better documented than it found it.

Do not add features without tests. Do not change semantics without docs.
