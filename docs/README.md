# Docs Folder Authority

The `/constitution` folder is the highest-authority source for ClearKrypt language philosophy, syntax laws, visual programming model, type-system direction, compiler/IR laws, backend laws, IDE/tooling laws, and syntax-coloring rules.

The `/docs` folder is supporting material. It should explain, expand, implement, or operationalize the constitution. It must not override or compete with the constitution.

## Authority order

1. `/constitution/*`
2. formal specifications derived from the constitution
3. `/docs/*` implementation and planning guides
4. examples and experiments
5. generated output

## How to treat older docs

Some `/docs` files were created before the constitution existed. If a `/docs` file appears to conflict with `/constitution`, the constitution wins.

Agents must either:

- update the `/docs` file to align with the constitution
- mark the section as pre-constitutional or experimental
- propose a constitution amendment if the docs reveal a better rule

## Supporting role of docs

The docs should provide:

- implementation guidance
- examples
- compiler package plans
- IDE architecture details
- roadmap steps
- agent worktree commands
- target emitter notes
- interop details

The docs should not define final language law unless they cite or derive from the constitution.

## Required note for future docs

New docs should include language such as:

> This document supports the ClearKrypt Constitution. If it conflicts with `/constitution`, the constitution wins.

## Current alignment policy

When updating `/docs`, prefer wording like:

- "recommended initial implementation"
- "MVP direction"
- "supporting guidance"
- "experimental syntax"
- "constitution-derived rule"

Avoid wording that makes `/docs` sound more authoritative than `/constitution`.
