# ClearKrypt Product Vision

## Purpose

ClearKrypt is a programming language and native IDE for describing application structure once and compiling it into production-grade platform code for Swift, Kotlin, and React/TypeScript.

The goal is not to erase platform differences. The goal is to make shared intent, domain logic, UI structure, data contracts, validation, and workflows portable while still allowing platform-specific implementation where needed.

## Primary audience

ClearKrypt is for builders who want one source of truth for application structure without giving up native targets.

It should support solo developers, small engineering teams, and coding-agent workflows where multiple agents can work on compiler, IDE, docs, emitters, and examples in parallel.

## Core design principles

### Source of truth over abstraction theater

ClearKrypt should define shared intent and compile into platform-appropriate implementations. A model, screen, route, service, and validation rule can be shared. Platform lifecycle and package behavior may differ.

### Generated code must be readable

Generated code is part of the product. It must be structured, named, formatted, and documented enough that a real developer can debug it.

### Explicit interop

ClearKrypt must support native Swift, Kotlin, TypeScript, JavaScript, Java, Python, JSON, SQL, and platform files where needed. Interop must be typed and bounded. It must not silently break portability.

### Diagnostics first

The IDE and compiler should explain what failed, where it failed, why it failed, which targets are affected, and how to fix it.

### Project system before syntax cleverness

ClearKrypt must define packages, modules, targets, generated folders, native bindings, assets, environment configuration, tests, and build profiles early.

### Agent-friendly development

This repo should be organized so multiple coding agents can work independently without trampling each other. Each agent lane should have a clear file boundary, branch, and acceptance criteria.

## What ClearKrypt should compile

ClearKrypt should eventually compile data models, enums, validation rules, screens, components, routes, forms, services, local persistence declarations, auth flow declarations, permission requirements, platform feature declarations, tests, build profiles, and typed interop blocks.

## Non-goals

ClearKrypt is not initially a full systems language, a replacement for Swift/Kotlin/TypeScript/Python/Java, a no-code platform, or a black-box code generator.

The native IDE can include visual aids and previews, but the core product is a programming language and compiler.

## Definition of success

ClearKrypt is successful when a developer can write a small app in `.ck`, run one command, and receive working output for an iOS Swift project, Android Kotlin project, and React/TypeScript web project.

Generated projects should build with normal platform tools and remain understandable to platform developers.

## MVP scope

The first MVP should include a parser, basic modules/imports, primitive types, structs, enums, functions, basic expressions, simple screen/component declarations, a target-neutral IR, Swift/Kotlin/React emitters, a CLI compile command, and an IDE shell that opens a project and shows diagnostics.

## North-star command

```bash
clearkrypt new hello-world
cd hello-world
clearkrypt build --targets swift,kotlin,react
clearkrypt ide .
```
