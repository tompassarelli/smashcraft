# Smashcraft development

Smashcraft is a Wurst-authored platform fighter compiled to Lua for Warcraft III.
Read wc3-melee:wurst-toolchain.lock and wc3-melee:wurst.build before changing
patch, compiler, standard library or target. The lock is authoritative; a newer
upstream article does not update it.

## Issues define the scope — finish them

Roadmap [#16](https://github.com/tompassarelli/smashcraft/issues/16) lists the
open work in order. Each issue's **Done when** and **Not required** lists are its
complete scope, and its "Rules for whoever picks this up" govern the work.

- Close an issue when its boxes pass, with one short comment (build, result,
  link). Don't add boxes or keep it open for guarantees it doesn't list.
- A problem that doesn't block a box goes in a new `priority:later` issue, not
  into the current one.
- Don't re-run a passing check unless the code it covers changed.
- Boxes marked (Tom) need Tom: prepare everything, ask once, keep working on
  other boxes. Never build automated stand-ins for a human playtest.
- After two failed fixes on the same box, or about a day without progress, stop
  and tell Tom what fails, one recommended fix and its cost.
- Keep each issue's Status section to 5 lines, edited in place, with at most
  one line of residual risk. Comment only to close or to ask Tom for a decision.

Answer "what can we claim about input timing?" from #26's integrity table, or
its Status until the table exists. A status question never starts a new
investigation.

## Source and workflow

- wc3-melee:wurst/ owns gameplay, deterministic state/replay, selection and UI.
- wc3-melee:companion/ owns the Rust controller/helper boundary.
- wc3-melee:tools/ owns build, native probes and automation.
- wc3-melee:docs/ holds durable knowledge only: how systems work, design
  decisions, reference data and procedures. Status, progress, plans and claim
  tables live in the owning issue. A dated trial's raw record goes in
  wc3-melee:evidence/ and is never edited afterwards. When a trial teaches
  something durable, add that fact to the relevant doc, with its build.
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

Publish playable pre-release maps as Smashcraft 0.0.N; increment only N.
Internal diagnostics use distinct run IDs and names without advancing the
player release counter. Always identify the current playable artifact separately
from an experimental candidate; a diagnostic pass does not replace that release. Install one
current candidate under Maps/00-Smashcraft. Keep proprietary game assets and
base maps privately outside repository trees. Preserve peer work in owned lanes.
