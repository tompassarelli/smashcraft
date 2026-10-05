---
name: effect
description: Develop Smashcraft and Wisp with Effect, or maintain their Effect dependency and vendored source. Includes the weekly source-update policy.
---

# Effect in Smashcraft

Use `effect-development-distilled` for general Effect authoring. This skill
owns Smashcraft's source reference and maintenance policy. Read
smashcraft:repos/effect/LLMS.md and the relevant implementation, examples and
tests before writing Effect code; those files match the recorded release.
Use Effect for typed failures, service composition, resource ownership,
structured concurrency, boundary validation and host observability where the
code needs those capabilities. Keep pure calculations as plain functions.

Application imports use installed `effect` and related packages. Never import
from smashcraft:repos/effect/, add it to a workspace, run its install/build
scripts, or modify its files during application work. Its upstream toolchain
does not change Smashcraft's Bun workflow. Preserve upstream licenses and
notices. The exact source identity is in smashcraft:repos/effect.json.

Wisp spans Bun tools and synchronized TSTL/Lua game code. Read
smashcraft:docs/typescript.md and `warcraft-typescript-development-distilled`
before changing that boundary. Establish compiler and runtime compatibility
before moving Effect APIs into map code; host success alone is insufficient.
Preserve deterministic frame ordering, numeric parity, replay snapshots and
reload ownership. Do not replace the installed Effect runtime with a local
imitation to evade an unsupported target.

## Weekly update policy

Check for a newer stable Effect release at least once every **7 days**, on the
first Effect-related work session when smashcraft:repos/effect.json's
`checkedAt` is older than 7 days. Also check whenever the installed Effect
version changes, before deriving a new pattern from a different version, or
when Tom explicitly requests an update. This is an agent maintenance duty;
there is no unattended scheduler or automatic push implied by this policy.

1. Inspect the installed dependency and lockfile. Query the package registry
   with Bun and upstream's `effect@VERSION` release/tag. GitHub's monorepo
   `/releases/latest` can identify another package; it is not the core Effect
   version. Select the latest stable core release, not a prerelease or `main`.
2. Resolve its full commit and read its release/migration notes and license.
   Upgrade the installed Effect packages together and the reference to that
   same release. Before initial runtime adoption, vendor the latest stable
   release and record that exact identity. Never silently advance the reference
   beyond the dependency actually used by the application.
3. In a clean owned worktree, with no local subtree edits, run
   `git subtree pull --prefix=repos/effect https://github.com/Effect-TS/effect.git <FULL_COMMIT> --squash`.
   This fetches the chosen immutable revision. Preserve the subtree merge
   history; do not substitute a copied directory or submodule. Stop at a
   conflict and reconcile it without overwriting peer work.
4. Review relevant API changes, update consumers and any derived pattern
   notes, and check compatibility with the pinned Effect tsgo and TypeScript
   versions. Run the nearest host check and affected behavior tests once;
   emitted Lua/native gates apply only if their code or compiler changed.
   Do not run the upstream monorepo's whole suite.
5. Update smashcraft:repos/effect.json's release, commit and UTC `checkedAt`
   after the check, retaining its source and license information. Commit the
   dependency, lockfile, subtree and relevant guidance as one coherent update
   (the subtree merge and a companion commit), then publish using the normal
   repository workflow. If already current, refresh only `checkedAt` with the
   next related commit. If an upgrade fails, retain the current matching pins
   and put the concrete blocker and next action in the owning GitHub issue.

Do not keep a failure hidden by resetting `checkedAt` as if an upgrade passed.
An unresolved upgrade remains due on the next Effect work session.
