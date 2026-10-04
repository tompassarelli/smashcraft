# Shared Melee visual-effect inventory

Scope: common gameplay cues relevant to Smashcraft's original fighters. The
source index is melee at revision 0296f009f32f710495979d30772d8332af2d411a.
This is an implementation inventory, not a claim of native visual parity.
Use independently authored graphics or Warcraft assets; retain all Melee
binaries, animation assets and command streams outside repositories.

Each cue must follow its real gameplay event, with position, contact normal,
logical clock and presentation lifetime kept separate. A successful tech,
missed tech, shield contact and electric hit must be visually distinguishable.
Do not infer all of them from a damage-percent change. Replay must not duplicate
one-shot effects, and pausing must freeze their presentation. Aesthetic sizes,
colors and lifetime tuning are changeable and are not fixed test requirements.

| Cue | Gameplay trigger and placement | Reference family | Current delivery status |
| --- | --- | --- | --- |
| Ordinary hit spark | Accepted damaging/launching contact at victim/contact | melee:src/melee/ft/ftcoll.c; melee:src/melee/ef/eflib.c | Accepted-contact spark implemented; event tests pass; native appearance unverified |
| Electric hit | Accepted contact with electric effect, distinct victim arcs | melee:src/melee/ft/ftcoll.c | Distinct electric contact event and authored arcs implemented; event tests pass; native appearance unverified |
| Shield hit | Blocked contact at shield surface, without victim hit cue | melee:src/melee/ft/kinds/ftCommon/ftCo_GuardDamage.c | Blocked-contact event and shield flash implemented; event tests pass; native appearance unverified |
| Shield bubble | Active shielding; tracks fighter and shield health | melee:src/melee/ft/kinds/ftCommon/ftCo_Guard.c | Existing Warcraft shell; native appearance unverified |
| Shield break | Shield depletion and launch transition | melee:src/melee/ft/kinds/ftCommon/ftCo_ShieldBreakFly.c | Transition burst implemented; native appearance unverified |
| Dizziness | Shield-break dizzy state; above head | melee:src/melee/ft/kinds/ftCommon/ftCo_FuraFura.c | Existing Warcraft overhead effect; native appearance unverified |
| Roll dust | Accepted ground roll; feet/trailing motion | melee:src/melee/ft/kinds/ftCommon/ftCo_Escape.c | Entry dust and moving roll trails implemented; native appearance unverified |
| Spot-dodge dust | Accepted spot dodge; short ground cloud at feet | melee:src/melee/ft/kinds/ftCommon/ftCo_Escape.c | Existing paired entry clouds; native appearance unverified |
| Empty/aerial landing dust | Air-to-ground contact; floor position | melee:src/melee/ft/kinds/ftCommon/ftCo_Landing.c | Landing event and dust implemented; native appearance unverified |
| Missed floor tech / knockdown | Enter down-bound on impact; surface position | melee:src/melee/ft/kinds/ftCommon/ftCo_DownBound.c | Existing burst plus dust; exact visual timing unverified |
| Successful floor tech | Enter passive or passive roll; sharp success flash | melee:src/melee/ft/kinds/ftCommon/ftCo_Passive.c | In-place and rolling success flash implemented; native appearance unverified |
| Wall/ceiling missed tech | Reflected high-speed contact; recorded normal/position | melee:src/melee/ft/kinds/ftCommon/ftCo_DamageFlyReflect.c | Contact journal drives surface-oriented effects; native appearance unverified |
| Wall/ceiling successful tech | Accepted surface recovery; contact flash | melee:src/melee/ft/kinds/ftCommon/ftCo_PassiveWall.c; melee:src/melee/ft/kinds/ftCommon/ftCo_PassiveCeil.c | Contact journal drives surface-oriented effects; native appearance unverified |
| Getup/tech-roll dust | Accepted floor recovery motion; trailing feet | melee:src/melee/ft/kinds/ftCommon/ftCo_DownStand.c | Recovery entry and moving roll dust implemented; native appearance unverified |
| Dash takeoff / reversal dust | Ground locomotion entry or reversal; feet | melee:src/melee/ft/kinds/ftCommon/ftCo_Dash.c | Dash-entry/reversal dust implemented; native appearance unverified |
| Run footfall dust | Moving on floor; cadence, suppressed in hitlag | melee:src/melee/ft/kinds/ftCommon/ftCo_Run.c | Moving-floor dust cadence implemented; native appearance unverified |
| Braking / skid smoke | Ground braking or turn; trailing feet | melee:src/melee/ft/kinds/ftCommon/ftCo_RunBrake.c; melee:src/melee/ft/kinds/ftCommon/ftCo_TurnRun.c | Deceleration dust implemented; native appearance unverified |
| Ground jump puff | Actual takeoff, not button press; takeoff floor | melee:src/melee/ft/kinds/ftCommon/ftCo_Jump.c | Accepted jump serial drives puff at takeoff origin; native appearance unverified |
| Double-jump ring | Accepted aerial jump; below fighter | melee:src/melee/ft/kinds/ftCommon/ftCo_JumpAerial.c | Accepted aerial jump drives ring; native appearance unverified |
| Air-dodge cue | Accepted air dodge; follows protection presentation | melee:src/melee/ft/kinds/ftCommon/ftCo_EscapeAir.c | Accepted air-dodge entry drives ring; native appearance unverified |
| Knockback smoke trail | Significant launch motion; trailing fighter | melee:src/melee/ft/kinds/ftCommon/ftCo_DamageFlyHi.c | Tumble-motion trail implemented; native appearance unverified |
| Grab / throw cues | Accepted capture/release/contact, not every hold tick | melee:src/melee/ft/kinds/ftCommon/ftCo_Catch.c; melee:src/melee/ft/kinds/ftCommon/ftCo_Throw.c | Accepted capture and throw-contact cues authored; headless event/replay checks pass; native appearance pending |
| Charge / ready flash | Smash-charge entry and ready threshold | melee:src/melee/ft/kinds/ftCommon/ftCo_AttackS4.c | Charge-entry and full-charge flashes authored; headless entry/threshold/hitlag checks pass; native appearance pending |
| Ledge catch / recovery | Actual catch or accepted ledge option | melee:src/melee/ft/kinds/ftCommon/ftCo_CliffCatch.c | Catch and accepted climb/roll/attack/jump cues authored at ledge lip; headless transition checks pass; native appearance pending |
| Directional blast-zone KO | Actual stock loss at boundary; oriented outward | melee:src/melee/ft/ft_0D31.c | Stock-loss event drives directional burst; exact death rules remain unfinished |
| Star KO | Eligible top death; fighter recedes/spins then sparkle | melee:src/melee/ft/ft_0D31.c DeadUpStar | Separate cinematic pending |
| Screen KO | Eligible top death; foreground flight/tumble/drop | melee:src/melee/ft/ft_0D31.c DeadUpFall; melee:src/melee/ft/ft_0D4D.c | Separate cinematic pending |
| Respawn arrival / protection | Out-to-live transition; spawn location/body | melee:src/melee/ft/kinds/ftCommon/ftCo_Rebirth.c | Out-to-live event drives arrival ring; native appearance unverified |
| Freeze / ice break | Accepted freeze state and release | melee:src/melee/ft/kinds/ftCommon/ftCo_DamageIce.c | Existing FrostEffects, review pending |
| Character-specific attacks | Existing authored Smashcraft special windows/contact | melee:src/melee/ft/kinds/ftFox; melee:src/melee/ft/kinds/ftFalco and other fighter families | Warcraft-specific SpecialEffects already exists; port only relevant effect language |
| Items, transformations and stage hazards | Actual feature-specific events | melee:src/melee/it; melee:src/melee/gr | Outside current Smashcraft mechanics; do not fabricate events |

The common capture/throw, charge/ready and ledge cues reuse the authored shield,
jump and tech effect models. Their ages and pool positions are replay state;
projection does not advance them. The focused `wc3-melee:test.sh Impact` run passes
21/21, including accepted/rejected transitions, frozen grab/charge clocks,
paused projection, snapshot replay and removal of corrected predicted cues.
Native placement, visual timing, pause/resume and rollback appearance remain
pending; the selected sizes and lifetimes are authored, not retail measurements.

Death selection is not simply a random animation for every stock loss. The
retail top-death handler first checks top-boundary eligibility, then player/game
flags and camera constraints; its random selection uses a common-table screen
probability. Side/bottom deaths use directional bursts. Frozen variants also
exist. Numerical selection/timing facts must be recorded before claiming their
exact reproduction. Warcraft camera movement and presentation choices must be
explicit; a proxy effect is not evidence that a cinematic is implemented.
