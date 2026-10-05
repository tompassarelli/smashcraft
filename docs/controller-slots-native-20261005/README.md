# Native player-slot lifecycle — 5 October 2026

**PASS: a connected player's fighter changes from human to CPU, EMPTY and back
to human across three matches without restarting either controller helper.**
Both clients retain the same connected-player identities, finish every match
and agree on all recorded attack histories and stationary result states.

| Match | Player 2 fighter | Other opponent | Eligible human taps applied, both clients | Final frame / checksum |
| --- | --- | --- | --- | --- |
| 1 | CPU | None | Player 1 at frame 43 | 143 / `294511:550560` |
| 2 | EMPTY | CPU in slot 3 | Player 1 at frame 44 | 130 / `549291:197683` |
| 3 | Restored human | None | Both players at frame 43 | 141 / `526826:534527` |

All eight expected human Attack applications were present, with no extra or
moved human action, native input failure or trace drop. The EMPTY player never
applied an attack. The connected sender continued publishing frames in all
three modes. CPU attack histories also agreed between clients; they are
counted separately from the independently stimulated human actions.

Before every START, player 2 held Attack in the character menu. The helper
routed that press as a menu action and admitted no gameplay edge from it.
Releasing it after START completed neutral rearm; a subsequent 5 ms tap kept
the frame independently calculated from the kernel timestamp and local START
publication. When the fighter was restored, that fresh tap applied once on
each client without leaking the earlier held/menu input into the match.

## Repair and candidate

The production receiver previously returned early when its connected sender's
fighter was CPU or EMPTY. The fix in `0f12471` uses connected-player ownership
for journal service; fighter mode continues to decide which input controls the
simulation. This keeps the sender participating in confirmation and rematch
without assigning its controller to another fighter.

Map source is `e86380a`, whose gameplay sources match `d928d53`. Exact map/helper
hashes and fixture identity are in
wc3-melee:docs/controller-slots-native-20261005/candidate.json. The later capsule
and canonical-motion repairs are not in this native candidate. Compilation
reported zero errors and 27 existing warnings. Playable 0.0.41 remains the
preserved human-session artifact; this named diagnostic does not replace it.

Reproduction starts at initial character selection with the matching map and
helper. Run wc3-melee:tools/journal-match-capture.py with `--controller-menus
--controller-slots`, then wc3-melee:tools/journal-match-result.py on that corpus.
The retained producer/kernel/helper/native data and reconciled summary are in
wc3-melee:docs/controller-slots-native-20261005/passed. Both helpers were reaped;
the authenticated clients remain at the third results screen.

This banks the bounded virtual-Linux-pad slot lifecycle result for #26's newly
combined acceptance run. That larger run remains required; this corpus does not
substitute for its edge count, action coverage or interruptions.

After integration of the canonical-motion repair (`6760488`), the existing
ShadowInputPlaybackTests passed 8/8 with zero errors and nine warnings. They
cover late replay, CPU sender ownership and the CPU/EMPTY slot counterfactual.
The source-check log is
wc3-melee:docs/controller-slots-native-20261005/passed/integration-playback.log;
it does not change the identity of the earlier native candidate. Published text
exports normalize line endings and trailing whitespace only.

## Fixture corrections

The first run completed the CPU match but stopped in the next selection when
the host's click to add slot 3 was not reflected in either client's menu state.
A subsequent click at the same coordinate worked. The fixture now first clicks
the inert widescreen margin, then the mode button; the complete repeated journey
passed every synchronized mode assertion. This establishes the corrected input
procedure, not a diagnosis of why the earlier click was missed. Failed-run
records remain under
wc3-melee:docs/controller-slots-native-20261005/failed-menu-click.

The first reconciliation of the completed corpus incorrectly required the
pre-START character-menu press to have a gameplay-suppression log. The actual
record was a valid `menu_emit` at the independently recorded timestamp. The
reconciler now requires that exact menu route, a suppressed neutral release,
no gameplay admission before neutral, and the same exact expected human attack
history. It additionally rejects attacks from inactive fighters and compares
all CPU/human attack histories between clients. No native rerun was needed for
this observer correction.
