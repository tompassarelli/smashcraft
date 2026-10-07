# Terrain, timed hazards, and home stages

Source landed on main `aca8874928c37b97005a41331e1022ce7b57f913`.

- Stratholme (6): sloped main deck, flat middle at 21 world units, ends
  descending to ledges at height 0. Walking, running, landing, floor techs,
  get-ups, and ledge catches/climbs pass eight focused cases.
- Tomb of Sargeras (7): main-floor traction 0.5; all five traction cases
  pass, including run braking, landing slides, ground launch and shield push.
  The stage has its own tide overlay and distant waterfall.
- Blackrock (12): the main floor's outer 190 units at each end deal a 12%
  fire hit with base knockback 100, growth 0, straight up. All victim fields
  equal a scripted ordinary fire hit at 0%, 80% and 250%; 180 match frames
  replay exactly. Invincibility and hazards off prevent the contact.
- Gryphon Aerie (11) and Ahn'Qiraj (13): complete 920/420-frame rides replay
  to the same complete state, retain three stocks at 0%, and stop when the
  stage menu turns hazards off. The toggle itself passes the shared-menu test.
- Items use the centre floor's actual height for pickup, presentation and
  sound. An ordinary attack picks up the speed item at Stratholme's height 21.

The final focused Lua32 bundle passes **21/21** contracts. All-stage recovery
passes after Blackrock's computer steers inward above its molten floor; the
original Warden fixture also passes with the same stage used for decisions
and simulation (the fixture fix belongs to #189's worker).

Three #193 pad scripts ran in one headless session through the real journal
helper: **26 edges, 0 off-frame, 0 written late**. Their comparisons match
**12 confirmed checksums and 590 input rows**. This is headless behavior
acceptance under roadmap #16, not a native graphics capture.

The full map built with **1,660 verified entries**, then its script was rebuilt
with the integrity profile. Type-check and pre-push source checks pass.
Private map, helper logs and captures are retained under
`~/.local/share/smashcraft-build-inputs/terrain193-20261008/`.

Stage assets: `e3e6e06b6833863a2cae774f8c8b9a9a0a545698d5de1edf30734bd371fef6c0`.
Selection assets: `0e3f236ed0bbdfcb83d7768c48fbc12cd1bf1634f57eebec6c48c3f90cd80b44`.
Liquids add two triangles per sheet and no particles or lights. Water uses an
authored scrolling model because the HD water natives configure terrain
water; the arena floats 1,800 units above terrain.

Remaining original checks: native near/far art judgement for stages 6/7,
the waterfall and terrain appearance batch, and the shared performance gate.
The final combined stage artifact belongs to the stage-art worker and native
captures to `native_r3`; full Lua/tape/performance jobs belong to the shared CI
worker. Issues #193, #194 and #195 stay open for those checks.

The later #194 helper batch on the integrated source delivered its View
inputs on frame, but its comparison could not collect a fresh input trace.
Adding normal movement at frames 15/20 reproduced the same failure. The
input worker has the two runs; this comparison remains pending. The four
complete-cycle/replay contracts pass in both Bun and Lua32.
