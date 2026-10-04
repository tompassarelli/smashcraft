# Smashcraft development

Smashcraft is a Wurst-authored platform fighter compiled to Lua for Warcraft III.
Read wc3-melee:wurst-toolchain.lock and wc3-melee:wurst.build before changing
patch, compiler, standard library or target. The lock is authoritative; a newer
upstream article does not update it.

## Input guarantee lookup — questions have durable owners

Read the linked issue's current body, latest relevant comments and exact
candidate evidence before answering a Smashcraft performance question.
Use memory only to locate evidence. Do not restart the investigation from a
generic explanation or create duplicate issues.

| User's question | Acceptance issue |
| --- | --- |
| Which original simulation frame owns my press? Can delayed delivery move it by 3–5 frames or change confirmed combat? | [#25](https://github.com/tompassarelli/smashcraft/issues/25) |
| Can a short tap or release be lost, duplicated, reordered or stuck during a hitch? | [#26](https://github.com/tompassarelli/smashcraft/issues/26) |
| Does local action start on the first eligible tick? What visible delay, jitter, pacing and correction should I expect? | [#27](https://github.com/tompassarelli/smashcraft/issues/27) |

These issues refine #17's integrated acceptance under roadmap #16; they do not
replace the existing implementation lane, #18 controller/platform work,
#19 hosting comparison, or #20 full-match acceptance.

Answer with the verdict, issue number, exact build/path, supporting evidence,
limits and next unresolved gate. Distinguish measured support, code-only support,
failed counterexamples, blocked/unverified work and inference. Say “solved in
#N” only when its accepted result supports the exact claim and later changes have
not invalidated it. **#21 closed a timeboxed HOLD decision; input guarantees
remain open.** Closed investigations, merged PRs and passing unit tests do not
by themselves establish native acceptance.

Keep physical capture, helper dequeue, map admission, original frame assignment,
local simulation, visible response, remote delivery and final confirmation
separate. A 60 Hz loop, own-echo timing, retained helper events or matching final
checksums cannot alone prove first-frame physical response or zero lost gameplay
inputs. Keep intentional delay, tick quantization and designed action startup
separate from unexplained jitter. Preserve the advisory status of the 33/50/83 ms
planning targets documented in #17/#20.

For new evidence, update the owning issue with exact candidate/source identity,
independent stimulus/oracle, sample count, uncertainty, raw traces, reproduction,
current conclusion and remaining limitation. Preserve failed/superseded findings
with dates. Close only for an accepted result or an explicit documented
disposition; do not silently convert investigation completion into success.

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

Publish playable pre-release maps as Smashcraft 0.0.N; increment only N.
Internal diagnostics use distinct run IDs and names without advancing the
player release counter. Always identify the current playable artifact separately
from an experimental candidate; a diagnostic pass does not replace that release. Install one
current candidate under Maps/00-Smashcraft. Keep proprietary game assets and
base maps privately outside repository trees. Preserve peer work in owned lanes.
