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
