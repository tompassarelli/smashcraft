# Playable rollback integration: current next gate

Inspected main 71e34cd against draft PR #22 integration 62b1a88 on 4 October
2026. The native 0.0.11 journal probe remains separate from playable acceptance.

Main has advanced by 490 insertions/108 deletions across Simulation, MatchStep
and ReplayState since the integration base ac7fee2. New dashGrabTiming,
dashGrabWindow and dashGrabAttack fields are copied/compared on main but absent
from the draft's snapshot implementation. Ground-action and dash-grab ordering,
advanceFighterMotion versus final movement, binary32 integration, freeze-trap
shield handling and blast-zone rules also changed. A merge must carry these
rules into the four-slot roster path and its canonical state encoding; choosing
either complete conflict side loses required behavior.

A bounded merge attempt exposed conflicts in map-version, MatchStep,
PhysicsTests and Simulation; it was aborted, leaving the integration lane at
its original tracked state. The pre-existing untracked animation dependency
symlink was preserved. Neither client was restarted or changed this turn.

The recorded integration-only test
rollFacingSampledRollsMoveThroughActualEntryFreezeReplayAndRecovery is absent
from current main. A focused main-only invocation reported no matching test;
that is neither a passing result nor evidence the retained physics conflict was
fixed. The moderate resource scope released. Preserve the integration test and
resolve its expectation from independent physics evidence during the merge.

Next delivery action: update draft #22 to exact current production physics,
including per-slot action ordering and every new mutable replay field; run the
retained roll case plus the existing focused rollback/state checks. Then build
a newly versioned playable candidate and exercise the retained online clients
through combat/results/rematch. SDL cold capture timing remains a separate open
source boundary; do not market this candidate as competitive acceptance.
