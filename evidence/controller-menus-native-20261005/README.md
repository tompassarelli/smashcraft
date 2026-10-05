# Native controller menus — 5 October 2026

Controller-only game menus passed in two native Warcraft clients with Linux
virtual gamepads. The same persistent journal helpers covered character
selection, gameplay, results and rematch. The keyboard only enabled diagnostic
tracing; it did not select fighters/stages, start fights or confirm rematches.

## Accepted journey

Source `a3b302646416d1dea612f8e705e47461000382e4`, diagnostic
`controller-menus-20261005`. Exact hashes/configuration:
wc3-melee:evidence/controller-menus-native-20261005/candidate.json.

- Both players navigated fighters with the stick and selected with A. Player 2
  used X to recall and A to reselect. Start entered stage selection.
- Player 1 changed stage in both directions, used X to return to fighters,
  then Start to reopen stages and begin the match.
- Two normal three-stock matches completed. Controlled walking off the stage
  supplied the stock losses; these were lifecycle trials, not genuinely played
  human fights or a full combat-moveset test.
- A 5 ms A press at results confirmed player 1's rematch; player 2 used Start.
  Selection/back/return/start then worked again without restarting the helpers.
- All four 5 ms gameplay taps retained their independently calculated original
  frame 19 and applied once per fighter on both clients: eight applications.
  No results-screen action leaked into the next fight.
- Both clients ended both matches at confirmed frame 385/checksum
  `354842:379026`. Zero trace drops, input failures, unexplained frame retargets
  or extra attacks were found. Helper frame streams were contiguous, with
  400 frames/player in match 1 and 397 in match 2; terminal input after combat
  ended was drained without extending combat.

START publication anchors differed between clients by 5.149 ms and 3.159 ms.
Independent anchors differed from the helper's calculation by at most 671 ns
(inside its approximately 1.100 ms reported timestamp uncertainty). These are
local publication grids, not synchronized cross-machine clocks or physical
button-to-pixel measurements.

## Implementation and reproduction

The map publishes a complete menu-phase heartbeat. The helper only sends menu
actions while that permission is current and its exact game window is focused.
Controls must return to neutral after phase/focus changes. Each action emits a
finite directed key pair through the existing keyboard boundary; no menu key is
left held. Results become eligible after all helpers finish the preceding match.
The map explicitly selects the current fighter, removing the former dependence
on mouse-hover placement. Player controls and protocol details are documented
in wc3-melee:companion/README.md.

Run wc3-melee:tools/journal-match-capture.py with `--controller-menus` from
character selection, using the existing two-client session JSON. Then run
wc3-melee:tools/journal-match-result.py on its output. Kernel events, producer
timestamps, helper logs, menu receipts, UI observations and per-match native
traces are retained in wc3-melee:evidence/controller-menus-native-20261005/passed/.
The independent reconciliation result is its `summary.json`.

Checks observed: 28 Rust journal tests, 25 Wurst match-rule tests, helper build,
full map compilation, the native journey and independent reconciliation passed.
Both owned helpers were cleanly stopped and reaped; authenticated clients were
preserved at the second result screen.

This closes the bounded controller-menu transition gap in #18/#17 and extends
#26's rematch evidence. Physical controllers, ordinary full combat, chat,
reconnect/map reload, additional operating systems, common-clock fairness and
physical response remain open. Exact playable 0.0.40 remains preserved; this
diagnostic does not change the player release counter.
