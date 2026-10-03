# Surface recovery action boundaries

Reference revision: `0296f009f32f710495979d30772d8332af2d411a`.
These are independently described control-flow observations, not copied game
implementation. Numerical animation lengths are recorded separately in
smashcraft:docs/smash-melee-reference/retail-action-lengths.json.

Ceiling recovery, observed in melee:src/melee/ft/kinds/ftCommon/ftCo_PassiveCeil.c,
consumes its horizontal impulse event once, then transitions to ordinary fall
when animation tracks finish. Its input-interrupt callback is empty. For the
three recorded test profiles the animation length is 26 frames. Entry clocks,
track completion and collision transitions must determine the actual simulation
boundary; the length alone is not a substitute for those rules.

Wall recovery, observed in melee:src/melee/ft/kinds/ftCommon/ftCo_PassiveWall.c,
pauses animation during the startup timer. Timer expiry resumes animation and
applies the selected wall or wall-jump impulse. Wall and wall-jump animation
lengths are 26 and 40 frames respectively for the recorded profiles. After
startup, aerial actions can interrupt; ceiling recovery does not share that
interrupt policy. Wall physics applies aerial friction without ordinary steering
acceleration while this action remains active.

Wall entry sets facing opposite the passed collision direction. The source's
RightWallHug means a right-facing surface contacted by the fighter's left ECB
point, not a wall on the fighter's right. This is explicit in
melee:src/melee/mp/mpcoll.c and in the negative-X impact branch of
melee:src/melee/ft/ftCo_800C7CA0.c. PassiveWall passes -1 there and sets facing
to +1; LeftWallHug gives the opposite pair. Thus entry facing and horizontal
impulse point outward, matching Smashcraft's normal convention. The recorded
actor attributes are positive (0.5 and approximately 1.4 MU/frame). No facing
or horizontal-impulse sign correction is required for those profiles.

## Open production discrepancies

At primary revision `80df62d`, smashcraft:wurst/Simulation.wurst saturates the
ceiling clock at the impulse event and the wall clock at startup expiry. Neither
clock reaches the animation completion boundary. Ceiling recovery also does
not yet enforce its full input lock. Wall facing uses the outward stage normal;
its facing and signed impulse require reconciliation with the observations above.
The existing startup, impulse and protection tests do not prove these missing
action boundaries. Native recovery observation remains open.

The previously suspected facing discrepancy above was resolved by following
the wall collision flag to its ECB point and impact direction, as described
above. Collision repositioning remains unverified.

The subsequent ceiling-boundary implementation advances the clock beyond the
impulse, enters ordinary fall at the actor's configured animation end (26 in
the recorded profiles), and blocks attacks, specials, jumps and air dodges until
that transition. Air drift remains enabled: the ceiling physics callback uses
ordinary airborne drift and gravity. Three focused CeilingTech cases passed,
including production collision entry and the 25/26 action boundary. This closes
the modeled ceiling completion/input-lock discrepancy; independent frame traces,
ECB attachment/repositioning and native execution remain unverified. Wall action
completion and interrupts still require implementation.

The public attack, jump and air-dodge entry points now reject ordinary actions
during wall startup as well as the per-frame early return. The real-contact
wall fixture checks this lock on every startup tick and attack availability at
expiry; all five WallTech cases passed. Buffered wall-jump selection still uses
the separate recovery input path. Full post-startup interrupt priority and
animation completion remain open.

Wall recovery now advances beyond startup, with the paused startup excluded from
the animation clock. The actor-owned wall and wall-jump clip limits default to
26 and 40, matching the three recorded profiles. A real-contact fixture exercises
both selections through completion, retaining each state until the final frame;
the six WallTech cases passed. These modeled completion boundaries do not prove
collision positioning, facing, post-startup interrupt priority or independent
retail frame-trace parity.

Post-startup wall physics now rejects ordinary drift acceleration and retains
aerial friction, matching the observed PassiveWall physics callback. Successful
attack, special and aerial-jump entries leave surface recovery; air-dodge entry
already did so. The production collision case verifies friction against opposing
stick input, followed by a jump interrupt restoring normal drift. All seven
WallTech cases passed. Complete priority among simultaneous interrupt inputs
remains unverified.

The assembled primary tree at `872a370` passed the normal `Tests` filter:
490/490, zero compiler errors and one existing unused-import warning. Evidence:
smashcraft:build/physics-r10-aggregate.log. This includes the ceiling and wall
completion/input cases and deterministic replay checks, but excludes the ongoing
RunBrake follow-up and does not establish native or independent trace parity.

The normal 0.0.4 map built at primary `bd88afe`, build ID `melee-physics-r10`:
smashcraft:build/wurst-map/Smashcraft 0.0.4.w3x. SHA-256:
`1f5287970d30cb12c7ccf4a7c78a12f50be5afb7d14392fc7228354cd9f6a262`.
Compilation reported zero errors and six warnings; evidence is retained in
smashcraft:build/physics-map-r10.log. Automatic deployment was disabled to
preserve the peer's current native candidate. This build excludes the pending
RunBrake follow-up and has not been observed in Warcraft.

The RunBrake follow-up integrated as `da63988`; the assembled tree passed
492/492 normal tests (smashcraft:build/physics-r11-aggregate.log). Candidate
0.0.5 built at `b0aaf04`, build ID `melee-physics-r11`, with zero errors and six
warnings (smashcraft:build/physics-map-r11.log). Map:
smashcraft:build/wurst-map/Smashcraft 0.0.5.w3x. SHA-256:
`ddb778d5287a00ddfcf9d9aa5c518403c1766fac627d9bdace17800c1a1309f9`.
Deployment remained disabled and native observation is still outstanding.

TurnRun entered after its facing-command frame needs a separate first-pause
boundary check. The source initializes its pause marker to zero on entry; its
first animation callback observing the command pauses, and a subsequent callback
can flip facing. The current boolean command latch treats a past-command entry
as already paused. The existing frame-14 fixture checks eventual facing, but
does not isolate that first callback. This remains a movement timing discrepancy
to resolve before asserting retail action-clock parity.

The past-command TurnRun entry discrepancy is now fixed with a separate pending
pause state. Entry at frame 14 advances to 15 and pauses on the first subsequent
animation callback; only a later callback evaluates the velocity condition and
flips facing. The new production-transition case discriminates these callbacks,
and replay capture retains the pending phase. Focused TurnRun checks passed 4/4;
the assembled normal suite passed 493/493 with zero errors and the existing
unused-import warning (smashcraft:build/physics-turn-pause-aggregate.log).
This fix is not present in the previously built 0.0.5 map. Independent retail
frame traces and native action-clock verification remain open.

Candidate 0.0.6 includes the TurnRun first-pause fix. It built at `abe2d7b`,
build ID `melee-physics-r12`, with zero errors and six warnings; evidence:
smashcraft:build/physics-map-r12.log. Map:
smashcraft:build/wurst-map/Smashcraft 0.0.6.w3x. SHA-256:
`ef9a52f70fac081935da57e72b5299b972ab6a7e0d7706411809ffcda8ceb7a8`.
Deployment was disabled to preserve the peer candidate. Native observation,
independent traces and remaining dash input-priority rules are still open.

## Getup stand completion ordering

melee:src/melee/ft/kinds/ftCommon/ftCo_DownStand.c transitions to ordinary ground
state in its animation callback when tracks finish; the input phase follows that
callback. The selected retail profiles' DownStand clips are 30 frames in
smashcraft:docs/smash-melee-reference/retail-action-lengths.json.

Smashcraft previously cleared DOWN_STAND after processing jump input and returned
without ordinary input handling, adding a locked tick. Completion now runs in
the existing pre-input recovery phase, alongside floor-tech completion. A
production getup entry followed by a jump on tick 30 failed before the change
and passed afterward on both original hosts. Roll, down-damage and getup-attack
end conventions are separate and are not certified by this fix. The focused
completion case and existing RecoveryTests passed; broader assembled checks and
native verification remain pending for this change.
