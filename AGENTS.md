# Smashcraft development

Smashcraft is a Wurst-authored platform fighter compiled to Lua for Warcraft III.
Read wc3-melee:wurst-toolchain.lock and wc3-melee:wurst.build before changing
patch, compiler, standard library or target. The lock is authoritative; a newer
upstream article does not update it.

## Source and workflow

- wc3-melee:wurst/ owns gameplay, deterministic state/replay, selection and UI.
- wc3-melee:companion/ owns the Rust controller/helper boundary.
- wc3-melee:tools/ owns build, native probes and automation.
- wc3-melee:docs/ retains design decisions, measurements and known limitations.
- Use the declared project development shell when available. Preserve pinned
  dependencies; do not repeat ad hoc environment setup as the normal loop.

## Verify the changed behavior

Run `./test.sh TEST_FILTER` for focused Wurst tests; `./test.sh` defaults to
Tests. The optional second argument is the positive test timeout in seconds.
Run `./build.sh /absolute/path/to/base.w3x` for map compilation/packaging. See
wc3-melee:docs/development-loop.md for required local toolchain and base-map setup.
Use current project commands, not unverified `grill` substitutions.

Pure simulation tests establish logical rules, not Warcraft callback timing,
physical-controller latency, UI focus or online fairness. For those claims,
use the native map and retain exact candidate, input path and measured evidence.
Consume the physics agent's published changes without silently overwriting its
work. Include all mutable gameplay state in deterministic snapshots/replay.

## Native testing and UI

Read warcraft3-development-distilled and its off-monitor dependency before
controlling the game. Default automation off-monitor; use the primary display
for a requested hands-on trial. Preserve authenticated clients across map
iterations. Never direct-launch Warcraft as assumed authentication recovery.
Keep A/B in separate prefixes and use distinct online accounts. Credentials
belong in the encrypted machine configuration, never this repository or logs.

For changed custom UI, inspect resolved standard-library/components and consider
Wurst Table Layout before raw positioning or click overlays. Run headless
layout checks where supported, then verify native hit targets, keyboard-focus
release, draw order and widescreen behavior. Keep local presentation separate
from synchronized gameplay and create shared handles consistently.

Publish pre-release maps as Smashcraft 0.0.N; increment only N. Install one
current candidate under Maps/00-Smashcraft. Keep proprietary game assets and
base maps privately outside repository trees. Preserve peer work in owned lanes.
