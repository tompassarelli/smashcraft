# Integrated playable candidate 0.0.13

Source integration 4c172b2 with build-output path change. Private artifact:
~/.local/share/smashcraft-build-inputs/production-netcode-20261004/build/Smashcraft 0.0.13.w3x
SHA256: 7daec0735a9ed7a895e3e77c71c35febf8841f3bcfd7af444729fc5d6d108cce

Configuration: shadow-d0-r24, pool-predicted, response service probe enabled,
normal scenario, automatic deployment disabled. Compiler completed successfully;
Lua syntax, archive script comparison and packaged asset comparisons passed.
Retained simulation result remains 604/605, with the unresolved tech-roll entry
assertion. This is an evaluation candidate, not physics or competitive acceptance.

Build with WC3_PRIVATE_ASSETS pointing to
~/.local/share/smashcraft-build-inputs/production-netcode-20261004,
WC3_INPUT_PROFILE=shadow-d0-r24, WC3_PRESENTATION=pool-predicted,
WC3_RESPONSE_SERVICE_PROBE=1, WC3_DEPLOY_MAP=0, using
wc3-melee:build.sh and the private physics-base.w3m fixture.
Map staging, output and deployment archive now use the private asset directory's
build subtree outside the checkout. Existing historical outputs are unchanged.

Neither client was restarted, logged in, or moved this turn. Both remain in the
completed 0.0.11 journal probe. Next: archive that installed map privately, install
this exact candidate in both Maps/00-Smashcraft folders, warm leave/rejoin,
then verify controls, combat, stock loss, results and rematch. No human match,
physical-controller response, visible correction or live frame integrity is
claimed from compilation.


## Native online entry and first action trace

Both retained Warcraft III 3.0.0.24268 clients installed the exact hash above,
joined sc-playable-0013, and reached selection, stage selection and the fight.
The lobby displayed four slots under one Players group. Ready markers identify
BUILD 1791057726, shadow-d0-r24 / pool-predicted. HUMANS 3 and FIGHTERS 3 in
those markers are bitmasks (slots 0/1), not counts of three people. Trace reports
two humans: slot 0 Rifleman, slot 1 Illidan, slots 2/3 empty.

After an initial idle trace, a second trace was started using Ctrl+T. The driver
waited for a new native trace-start file before concurrently injecting movement,
attack, jump and shield holds on both private X displays. This is software input,
not physical controller latency or a completed human fight. Both exported traces
have zero dropped rows and agree at all six recorded confirmed frame/checksum
pairs: 5800, 5862, 5923, 5982, 6042 and 6101. Agreement of these bounded hashes
is not a full-state or every-frame equality proof.

Each records 300 callbacks over roughly 4.99 Warcraft timer seconds. Local
corrections occur; maximum replay depth observed is 11 frames on A and 12 on B.
No rejected rows, speculative-step failures or rollback-window blocks appear
in the recorded summary intervals. Do not convert callback ages or Warcraft
clock duration into physical response time or a guaranteed wall-clock bound.
Visible/audio correction, damage exchange, stock loss, results and rematch are
still unaccepted. Evidence: wc3-melee:docs/native-playable-0013-evidence-20261004.

Warm leave returned directly to Custom Games on this iteration; a driver that
expected chat stopped without sending further input. Its predicate must accept
observed Custom Games or chat before selecting the next branch. Neither session
was restarted and no sign-in occurred. Ending state: both retained clients are
in the running 0.0.13 fight. Preserve that state for the next native gate.


## Automated result and rematch flow

An intentional walk-off with Left+Down held for 15 seconds reached RESULT while
3:24 remained on the clock. The result trace identifies phase 3 at frame 12984
on both clients; recorded confirmed checkpoint hashes match. This is a stock-loss
flow exercise, not evidence of a played combat exchange, physical latency or a
human match. Exact individual stock-loss timestamps were not recorded.

Client A's Y changed the visible rematch prompt from 0/2 to 1/2 ready. Client B's
Y returned both to character selection. Both rematch traces identify phase 0,
with two humans and original identities retained. The host could then reach
Stage Select and start a second fight, verified by the native fight HUD.
Original PIDs 2069007 and 1912370 remain live; no restart or authentication.
Ending state is the second 0.0.13 fight. Result/rematch trace files are retained
under wc3-melee:docs/native-playable-0013-evidence-20261004.

Accepted scope: automated online entry, intentional stock-loss result path and
two-party rematch readiness/return/start. Still open: controlled damaging combat,
actual two-person fights, visual/audio correction, physical response, fair live
frame assignment, 3/4-player trials, slot changes and ten human matches.
