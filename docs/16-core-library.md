# Core Library

## Purpose

ClearKrypt needs a small shared library that works across Swift, Kotlin, and React TypeScript.

It should define common types, helpers, and abstractions that make emitted code consistent.

## Core types

Initial shared types:

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
- List
- Map
- Set
- Result

## Validation helpers

Useful validators:

- email
- URL
- non-empty string
- min length
- max length
- number range
- date range

## Platform modules

Platform modules should be explicit.

Potential modules:

- Network
- Storage
- Files
- Camera
- Location
- Notifications
- Device

## UI primitives

Initial UI primitives:

- Text
- Button
- Image
- VStack
- HStack
- List
- Form
- TextField
- Toggle

## Serialization

Models should support predictable serialization across targets.

The core library should define naming and optional-value behavior.

## MVP acceptance

MVP is acceptable when basic types, model helpers, and UI primitive names are defined enough for emitters to work.
