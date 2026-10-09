---
name: effect
description: Develop Smashcraft and Wisp with Effect, or maintain their Effect dependency and vendored source. Upgrades run through effect-kit.
---

# Effect in Smashcraft

Use `effect-development` for general Effect authoring. This skill
owns Smashcraft's source reference and maintenance policy. Read
smashcraft:repos/effect/LLMS.md and the relevant implementation, examples and
tests before writing Effect code; those files match the recorded release.

Application imports use installed `effect` and related packages. Never import
from smashcraft:repos/effect/, add it to a workspace, run its install/build
scripts, or modify its files during application work. Its upstream toolchain
does not change Smashcraft's Bun workflow. Preserve upstream licenses and
notices. The exact source identity is in smashcraft:repos/effect.json.

Read smashcraft:docs/typescript.md and `warcraft-modding` for the host/map boundary.
Map code cannot import Effect; preserve deterministic frame ordering, numeric
parity, replay snapshots and reload ownership. Never replace the installed
Effect runtime with a local imitation to evade an unsupported target.

## Upgrades

`effect-kit` (north:agent-machinery) owns the vendored source and its version
gate; smashcraft:effect-kit.json configures it. CI runs `effect-kit check`,
which fails when repos/effect differs from the locked `effect` version, on any
Effect diagnostic, or on a host-tool rule break. The weekly
smashcraft:.github/workflows/effect-upgrade.yml runs `effect-kit upgrade`
(latest stable `effect` and `@effect/*`, install, sync) and the check, then
hands a clean upgrade to Autoland or reports findings on the open "Weekly
Effect upgrade" issue. To upgrade by hand in an owned worktree: `effect-kit
upgrade`, fix what `effect-kit check` reports, commit, land.
