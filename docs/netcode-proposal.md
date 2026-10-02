# Smashcraft netcode proposal — implementation record

Owner-supplied research and implementation brief, 30 September 2026. This is a
condensed record of their decisions and acceptance requirements, not a claim
that the cited APIs have passed native tests. The full gameplay goal remains in
wc3-melee:docs/delivery-goal.md; existing gameplay, controls, visuals and animation requirements
in wc3-melee:docs/development-plan.md, wc3-melee:docs/physics.md and wc3-melee:docs/fighter-animation-work.md remain
in scope. Native observations belong in wc3-melee:docs/native-capability-report.md.

## Decision and sequence

Keep one deterministic Wurst fighting simulation, independent of transport and
rendering. Evaluate a stock Warcraft III 3.0 backend first, using genuinely
early local polling if demonstrated, direct native sync, and numerical replay.
Preserve the playable baseline and combat tuning during infrastructure work.
Do not rewrite in Rust or add a queue after already synchronized key callbacks
and call it early input. A companion requires a demonstrated bidirectional,
low-latency bridge; pad-to-key mapping alone is not such a bridge.

1. Audit exact versions and current state ownership. Build input, traffic,
   pacing and presentation probes. Measure native gates before adopting a backend.
2. Add explicit per-frame input, complete snapshots, canonical serialization,
   deterministic checksums, input-tape replay and field-level mismatch reports.
3. If early input passes, implement bounded scheduled native input with R=0.
4. Run shadow prediction while rendering confirmed state; then enable visible
   prediction only after pose and effect recovery passes.
5. Compare profiles on real clients and select a measured shipping envelope.
6. For a failed native gate, retain the smallest reproducer and name the exact
   missing capability. Assess extensions/Blizzard support explicitly; never
   hide the limitation with smoothing, filesystem polling or an assumed socket.

Start at 60 logical ticks/second with D=3 and compare R=0 against R=6. Also
compare hybrid D=2/R=6 and fixed D=5/R=0 against the unmodified synchronized-key
baseline. Initially retain 64 snapshots and a larger bounded input history,
subject to actual Wurst/Lua array and memory bounds. D is fixed for a match
epoch; offline training uses the same intentional delay. These are experiments,
not proven optimal settings or measured client limits.

## Native evidence required

The research identifies BlzIsKeyPressed, BlzIsMetaKeyPressed and
BlzIsMouseButtonPressed as 3.0.0.24268 additions. Verify both installed headers
and binary; test whether polling precedes synchronized dispatch under actual
network delay. BlzTriggerRegisterPlayerKeyEvent is the synchronized baseline;
GetLocalPlayer around its handler does not undo prior delivery latency.

Use dedicated direct BlzSendSyncData traffic, not one Wurst SyncSimple transfer
per frame. Register receive events with fromServer=false and identify senders
from GetTriggerPlayer. Probe sustained 60 sends/second/competitor below 200 ASCII
bytes and exact two-frame batches at 30 sends/second. Record false send returns,
ordering, duplicates, queue growth and service age. Batching is not free: it can
add a tick of waiting. Native reliability/acknowledgement semantics are unproven;
do not add a second reliability layer without a demonstrated need.

Use one native service driver, measure actual callback cadence and burstiness,
and distinguish game time from wall time. An application wait must return so
native receive events can run. Warcraft's own scheduler may still stop polling
and rendering; application rollback cannot recover that lost responsiveness.
Induced application delivery delay does not reproduce an outer-engine stall.

Test model-only local presentation, the new named effect-animation functions,
blend control, time scale and backward pose restoration. BlzSetSpecialEffectTime
is not assumed to seek animation; establish units and behavior on actual assets.
Precreate native handles and frame lookups in common initialization, including
observers. Local effect transforms/getters cannot become collision truth. Never
move native units differently across clients to fake predicted presentation.

Identify Reforged versus Classic explicitly. The supplied research reports LAN
removed in Reforged 3.0 and retained in a separate Classic client. A same-room
Battle.net session is not LAN; Classic native availability is a separate gate.
Preloader caching makes overwrite/reload of one file an unproven real-time IPC
path. No stock map-owned UDP socket, Rust FFI or analog pad API is established.

## State and frame contract

The core is equivalent to step(state, exact-frame inputs) → state + semantic
events, save, restore, canonical serialization and checksum. No polling, network,
native orders/damage, timers, handles, UI, sound, wall time or engine RNG inside
step/save/replay. Preserve existing numerical behavior first; audit ranges before
introducing fixed point. Float replay needs actual supported-runtime evidence;
JASS/Lua/Rust arithmetic cannot be assumed equivalent.

Snapshot every mutable fact affecting future outcomes: fighter position,
velocity, facing, damage, stocks, actions/frames, shield and resources, hitlag,
hitstun, jumps, DI/motion histories, buffers, charge, tech/lockout, ledge/regrab,
grabs, cooldowns, forms, stage state, clocks, spawn schedules, RNG, entity IDs,
generations and allocation state. Include projectiles/traps/bears, swipe phases,
lifetimes and per-target hit records. Exclude immutable move/geometry tables,
textures, native handles and cosmetic RNG. Future mechanics must extend snapshots
and replay coverage; do not claim tests for mechanics not yet implemented.

Use stable iteration and collect simultaneous interactions before resolving them.
Bake action-frame hit/hurt volumes from authored animation; runtime bone/effect
queries never drive collision. Hitlag freezes the relevant fighter state, not
the global fighting clock, sampling or transport. Preserve DI/buffer semantics.

- F: next fighting frame to execute.
- D: intentional capture-to-execution delay, constant within an epoch.
- I[p,f]: immutable normalized input for participant p and execution frame f.
- K: greatest contiguous frame accepted for every active competitor.
- C: last confirmed simulated frame, never greater than min(K,F−1).
- R: allowed speculative distance beyond K.
- S: native service counter, distinct from F and physical wall-clock time.

At the opportunity to execute F, capture the local competitor's F+D once and
send immediately. Seed rows 0..D−1 with agreed neutral input; define countdown
semantics to prevent hidden pre-entered combat actions. Never overwrite assigned
input, retarget a late row, or poll again during replay. Observers do not supply
required inputs. Opposite digital directions neutralize consistently; preserve
the movement design's diagonal normalization.

Normalize held, fresh-pressed, fresh-released and quantized axes/trigger values.
OS repeat is not a new edge. Define same-frame press+release consumption, focus
and chat behavior, multiple local device assignment and pad mapping. Polling at
60 Hz alone cannot promise to see every shorter physical tap: measure visibility,
then choose an explicit sampler/edge-latching policy. During short waits retain
assigned rows and latch edges only for the next uncaptured row. Prolonged pauses
need agreed resume semantics, not an unbounded macro of accumulated inputs.

Stock-client storage separates replicated accepted input, immutable local pending
own input, and per-client predicted history. The shared F cursor and gate must
depend only on replicated/common information: mayAdvance = F <= K+R. Local
self-echo knowledge cannot advance the common cursor. R=0 consumes complete
accepted rows only. R>0 chooses accepted, then pending own, then conservative
remote prediction; prediction retains holds/axes and creates no press/release
edge. Maintain a separate confirmed simulation, capped at F−1 even if future
inputs have already arrived. Preallocate divergent numerical storage; avoid local
Wurst allocation/freeing through allocators shared with common objects.

## Protocol and rollback

Use version, epoch, assigned first frame, bounded record count/run length and
normalized records in a bounded ASCII encoding, initially below 200 bytes.
Validate all fields and limits before indexing/allocation. Reject stale epochs,
impossible future rows and conflicting duplicates. Identical duplicates are
harmless. Silence must not mean both unchanged input and missing input: complete
rows or explicit completion/run coverage are required. Keep queues/rings bounded.
Do not resend already synchronized UI/key actions through another delay layer.

Record each frame's actual inputs and snapshot immediately before it. For the
earliest mismatching past row r, restore before r and replay through F−1 without
polling, sends, native mutations, rendering or sound. Apply only the final visual
state. Correct predictions cause no corrective rollback. Compare checksums for
equivalent confirmed frames only. An out-of-history correction or confirmed
mismatch requires a visible common error/pause and diagnostics, not silently
choosing one player's state. Retaining 64 snapshots does not permit 64 speculative
frames when R=6.

Journal events with stable epoch/frame/entity-generation/action/kind/target IDs.
Deduplicate sounds and impacts; reconcile invalidated persistent effects.
Confirm irreversible results and persistence. Speculative move/impact cues need
explicit false-confirmation testing: sounds already heard cannot be unplayed.
Do not restart an attack after correction if it misrepresents its current active
frames, smooth bodies through ledges/hitboxes, or mask a native capability gap.

## Acceptance and comparison

Gate A: two actual clients, external physical input/video timing, independent
keys; polling versus synchronized callback versus sync receipt. Exercise holds,
releases, repeats, modifiers, simultaneous keys/rollover, menus/chat, focus loss,
minimization, controller injection and disconnect/reconnect where supported.

Gate B: sustained native traffic with normal effects and other map systems;
real controlled network delay/jitter/asymmetry/burst loss/reordering/outage and
CPU stalls, separately from application fault injection. Measure actual pacing
and outer-engine stalls, not just callback counters.

Gate C: canonical offline tape versus fixed/hybrid playback; at least 100,000
frames per principal scenario initially. Test delayed/reordered/duplicated and
missing-then-recovered rows, batches, malformed packets, epochs, counter/ring wrap,
focus/controller release and correction depths. Compare every confirmed checksum
and report the first differing field. Exercise supported native runtime/builds,
not only headless Wurst. Include trades, hitlag/DI, shields, techs, ledges,
projectiles, traps, bear multihits, forms, KOs/respawns and final results as those
mechanics exist. No replay side effects or local/shared allocator contamination.

Gate D: forced pose/effect corrections through startup/active/recovery, ledges,
shield contact, hitlag, techs, recoil, traps, bear swipes, projectile lifecycle,
KO and transformations. No uncorrectable phase error, repeated impact effect,
material body/collision mismatch, leak or native desync.

Gate E: same builds/moves/stages/players/network traces for the baseline and all
profiles; offline delay parity; blind comparisons when practical. Exercise
short-hop aerials, shield punishes, edgeguards, DI and trap/bear pressure. Swap
slots, machines and network conditions; test observers, rematches, long sessions,
mixed refresh rates and an overloaded client. Record readability and control
return as well as response time.

Hard requirements: no unexplained confirmed mismatch, silently dropped/reassigned
input, unbounded queues/pools/history, duplicate fresh presses, or slot-dependent
schedule. Fixed and hybrid agree without corrections when all rows arrive in D.
Measure per-side p50/p95/p99 physical response, callback bursts, correction depth,
stalls and CPU cost. Investigate p95 corrections >2 frames and p99 >4; these are
proposed quality targets, not perceptual laws. Initially budget netcode plus
worst-case replay around 25% of 16.67 ms on supported minimum hardware, subject
to real profiling. Constant maximum-window corrections do not pass merely
because the session survives.

The fairness promise is an equal measured schedule for conforming clients in a
documented connection envelope. Equal logical frames do not prove identical
wall-clock pixels, physical device latency or adversarial commitment timing.
Do not claim cryptographic fairness from sequence numbers. Delay changes require
an agreed epoch/profile transition; never alter one fighter's physics for pacing.

## Supplied research sources (implementation must verify applicability)

- S1: https://github.com/lep/jassdoc/blob/master/common.j and annotation commit
  https://github.com/lep/jassdoc/commit/0b9461260ee54a7c224291121c53a63cf822464c
  (reviewed blob e77b06465278c68848eff09f647c4ced72f20835).
- S2: https://us.forums.blizzard.com/en/warcraft3/t/warcraft-iii-reforged-forsaken-kingdom-patch-notes/38400
- S3: https://lep.nrw/jassbot/doc/BlzTriggerRegisterPlayerKeyEvent
- S4: https://lep.nrw/jassbot/doc/BlzSendSyncData
- S5: https://github.com/wurstscript/WurstStdlib2/blob/c79452908e20c96f71cf976cc356dc951ab8cd0c/wurst/file/SyncSimple.wurst
- S6: Preloader caching documentation in S1; build-specific observations.
- S7: https://lep.nrw/jassbot/doc/BlzSetSpecialEffectTime
- S8: https://github.com/pond3r/ggpo/blob/master/doc/DeveloperGuide.md
- S9: https://news.capcomusa.com/mr2nique/blog/2010/04/16/final_fight%3A_double_impact_-_ggpo_netcode
- S10: https://slippi.gg/ and
  https://github.com/project-slippi/Ishiiruka/blob/60f7b63496fb6ec7b9180a04f16f3edc0ad89fe2/Source/Core/Core/Slippi/SlippiNetplay.cpp
  plus SlippiNetplay.h at the same revision (seven-frame limit there, not a
  Warcraft recommendation).
- S11: https://docs.rs/ggrs/0.13.0/ggrs/
- S12: https://github.com/erfg12/Blizzard_Controller_Support/blob/master/readme.md
- S13: https://github.com/niceqwer55555/flo/blob/develop/README.md
  (historical hosting prior art; current Reforged compatibility unproven).
- S14: https://github.com/VoidSpaceTime/CSharpWar3Frame/blob/065bfba6697bb923a3567816fa51541f1a1d95d4/War3Frame/Library/Api/DzApi.cs
  (extension APIs are not stock Blz natives).
- S15: https://lep.nrw/jassbot/doc/BlzGetLocalSpecialEffectX

These references guide independent implementation; they grant no blanket code
reuse rights. Report implemented, measured, inferred, failed and untested
separately. Native API existence is not a latency measurement.
