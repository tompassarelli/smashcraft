# Native controller combat — 5 October 2026

Two native clients completed the controller combat sequence, stock loss, results
and rematch with the same Linux journal helpers. Both clients recorded the same
52 combat records in each match and identical stationary result states.

## Observed result

The tested gameplay/helper implementation is `a3b3026`, diagnostic
`controller-menus-20261005`; driver/reconciler `3f5569c`. Hashes and configuration
are in wc3-melee:docs/controller-combat-native-20261005/candidate.json.

| Controller action | Native result in both matches |
| --- | --- |
| A | Each fighter's initial attack applied once at its captured frame |
| X | Both fighters started their special; the exchange produced positive damage and a hit reaction |
| LB + direction + A | The walking modifier selected forward tilt, attack style 6 |
| B, Y, stick-up | Three separately initiated ground jumps |
| RB | Grab initiation, attack style 5; contact with a grabbed opponent was not exercised |
| LT, both triggers, RT alone | Confirmed shield stayed active through all three intervals, including release of LT while RT stayed held |
| Release both triggers | Confirmed shield released |
| Start | Both helpers reached the same pause frontier and resumed |
| Selection, results and rematch | Controller-only menu transitions worked without restarting either helper |

The first pause held confirmed frame 576 on both clients. Final stationary
results agreed at frame 912/checksum `895390:707954` in match 1 and frame
913/checksum `414556:407931` in match 2. There were no extra attacks, unmatched
recorded combat events, journal input failures or dropped trace rows.

Confirmed shield samples per interval (LT / both / RT alone): match 1 was
12/18/24 on each client; match 2 was 15/21/25 on A and 16/19/25 on B. These are
observations of retained shielding, not response-time samples.

The producer log is reconciled with independent kernel events and helper frame
records. Native attacks/specials/jumps, positive damage and the hit reaction
provide game-side evidence. The walking modifier is evidenced by tilt selection;
rightward displacement and walking speed are not established because the attack
can interrupt the rightward hold. Leftward walking supplied ordinary stock loss.
Each recorded gameplay tap/action has the expected application count; the
results-screen A tap caused no extra combat attack in the rematch.

## Scope and reproduction

These are automated virtual-controller fights on two clients on one machine.
They exercise a damaging exchange and the requested controller controls, but
do not count as two of the ten requested genuinely played human matches.
No physical latency, cross-machine clock, in-range grab/throw, complete moveset,
all analog magnitudes, chat/reconnect or Windows/macOS claim follows.

From a fresh character menu, run wc3-melee:tools/journal-match-capture.py with
`--controller-menus --combat-actions` and the existing native session JSON.
Then run wc3-melee:tools/journal-combat-result.py against that capture directory.
The two driver files passed syntax checks and the native reconciliation passed.
No gameplay or input implementation changed for this corpus; earlier relevant
source checks remain banked.

Raw producer/kernel/helper logs, initial combat traces, confirmed-shield probe
pages and stationary result traces are retained in
wc3-melee:docs/controller-combat-native-20261005/passed/.
The result is wc3-melee:docs/controller-combat-native-20261005/passed/combat-summary.json.
Combat exceeded the initial trace window, so a fresh trace at results supplied
the stationary endpoint; the initial combat traces were retained. END names the
input-drain frontier and is not misreported as the combat result frame.

Both helpers were cleanly stopped and reaped. Authenticated clients remained
open at results. This is a delivered bounded #18/#17/#26 checkpoint; the broader
input guarantees and platform/human-play requirements remain open.
