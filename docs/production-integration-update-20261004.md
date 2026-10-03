# Current physics in four-slot rollback

Merged main 71e34cd into integration 62b1a88. Preserved indexed roster APIs,
adapted dash-grab command windows/style 11, separated motion from shield
regeneration at production contact ordering, and carried current freeze-trap,
binary32 and blast-zone rules. New actor-rule/dash-grab/ground-action fields
participate in canonical encoding and snapshot copy/comparison. Incoming
pair-API tests use existing WorldTestSupport fixtures; indexed diagnostic
expectations were migrated. No numerical assertion was removed or relaxed.

Aggregate: **604/605 passed**, with retained failure
PhysicsTests.rollFacingSampledRollsMoveThroughActualEntryFreezeReplayAndRecovery:
Archer profile 6, facing -1, landing-entry x=0 versus expected sampled travel.
This is not a green build or resolved physics discrepancy. Log:
wc3-melee:docs/production-integration-tests-20261004.log.

Reserved map version 0.0.13 after main 0.0.12. No map build/install/native
acceptance. Draft PR #22 remains open; clients retained in completed 0.0.11.


## Exact retained floor-tech entry seam

Code inspection localizes the failure: PhysicsTests.startObservedRoll profile
6/7 enters airborne tumble then calls advance once. finishLanding calls
beginDownState(DOWN_TECH_ROLL), which sets downFrame=1 but applies no roll
travel. The next advanceDownState increments to frame 2 before calling
applyDownRollTravel. Thus the first travel-table sample is not consumed on
that path. The table records one-based frame observations from pinned libmelee;
that alone does not establish whether its first sample belongs on the landing
call or the next animation update. Retained tests assert positive entry travel.

Resolve with an independent tech-roll transition trace including the last
airborne frame, first grounded PassiveStand frame, positions and animation
frame, or equivalent verified engine phase ordering. The existing Slippi
floor-recovery fixture records in-place tech after impact, so it cannot decide
this tech-roll transition. No physics rule or assertion changed in this
inspection. This seam is tracked in #8; numerical rollback/contact evidence
remains separate from original movement fidelity.
