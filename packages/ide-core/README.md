# @clearkrypt/ide-core

Reserved package for the target-independent IDE core: project model, editor
services wiring, visual view models, and generated-output exploration.

Per the roadmap, deep IDE work begins only after the compiler can parse,
check, and emit real source (Milestones 8-9). This folder marks the package
boundary so the architecture stays honest; it intentionally contains no code
yet.
