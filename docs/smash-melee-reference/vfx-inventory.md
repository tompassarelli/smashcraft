# Shared Melee visual-effect inventory

Historical fixture notes below retain Archer only where they describe captures before the 9 October 2026 roster cut (#339); she is absent from the current roster.

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
| Star KO | Eligible top death; fighter recedes/spins then sparkle | melee:src/melee/ft/ft_0D31.c DeadUpStar | Authored receding/spinning Rifleman observed in native top-KO fixture; sparkle readability and camera extremes remain unaccepted |
| Screen KO | Eligible top death; foreground flight/tumble/drop | melee:src/melee/ft/ft_0D31.c DeadUpFall; melee:src/melee/ft/ft_0D4D.c | Authored Archer foreground flight, tumble, hold and departure observed natively, including a pause/resume; wider camera/replay cases remain open |
| Respawn arrival / protection | Out-to-live transition; spawn location/body | melee:src/melee/ft/kinds/ftCommon/ftCo_Rebirth.c | Out-to-live event drives arrival ring; native appearance unverified |
| Freeze / ice break | Accepted freeze state and release | melee:src/melee/ft/kinds/ftCommon/ftCo_DamageIce.c | Existing FrostEffects, review pending |
| Character-specific attacks | Existing authored Smashcraft special windows/contact | melee:src/melee/ft/kinds/ftFox; melee:src/melee/ft/kinds/ftFalco and other fighter families | Warcraft-specific SpecialEffects already exists; port only relevant effect language |
| Items, transformations and stage hazards | Actual feature-specific events | melee:src/melee/it; melee:src/melee/gr | Outside current Smashcraft mechanics; do not fabricate events |

The common capture/throw, charge/ready and ledge cues reuse the authored shield,
jump and tech effect models. Their ages and pool positions are replay state;
projection does not advance them. The focused `smashcraft:test.sh Impact` run passes
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

## Authored top-KO cinematics (5 October 2026)

The existing accepted top-blast-zone stock-loss event selects star when
(completed simulation frame + character index) is even, screen otherwise.
Rifleman/Illidan indices are 0/1/2. This deterministic presentation policy
is intentionally different from retail's probability and game/camera flags;
it neither adds top-death eligibility nor changes stock, protection or respawn.
Side and bottom deaths retain their directional bursts. Match results and reset
clear cinematics immediately, so a match-ending KO does not delay results.

Star: 90 completed frames of the fighter receding, shrinking and spinning,
then an 18-frame authored eight-ray sparkle at the terminal background position.
Screen: 24 frames approaching the foreground while tumbling, 24 frames holding
that pose, then 52 frames dropping and fading. Both reuse the installed authored
fighter models in a frozen hit pose; the sparkle reuses the authored tech rays.
No original Melee assets are imported. These are authored timings, not measured
retail reproduction. Cinematics may overlap the existing 60-frame respawn.

The camera continues tracking live fighters. Cinematic entry compresses the
exit X to 45% and caps height at 480 world units to re-enter the viewing area;
star travels 1400 units behind the arena, screen 550 toward the camera. These
world-space choices do not claim fixed screen placement under every camera
zoom. Native onset, readability, layering and camera extremes remain unverified.

Bodies and sparkle read confirmed impact state even with predicted fighter
presentation enabled. Their transforms derive only from completed-frame ages;
pause and repeated rendering do not advance them, snapshot restoration retains
selection/model/age, and correction replaces the pool without appending a new
native effect. Fixed handles are allocated during common initialization.

Native trigger: in a non-final-stock match, launch a fighter across the top
boundary with eligible upward knockback. Record its completed KO frame; the
parity rule above identifies the expected sequence. Repeat with opposite parity
(or the adjacent character at the same frame). Observe through frame +108;
pause during flight/drop, resume, and start a new match while a body is visible.
Side/bottom KOs should retain bursts. A final-stock match-ending KO should clear
immediately. Numerical fixture: the focused tests in
smashcraft:wurst/ImpactStateTests.wurst place an airborne tumbling fighter at
z=761 with upward knockback TOP_KO_MINIMUM_UPWARD_KNOCKBACK + 10. Build with
`WC3_SCENARIO=ko` to apply that fixture to all active fighters at match start;
Rifleman exercise opposite selection parity.

Source check: 23/23 tests pass with the pinned compiler, zero errors and nine
indentation and unused-code warnings. The smashcraft:test.sh Impact source set was extended
locally with smashcraft:wurst/CombatEffects.wurst and generated ImpactAssetInfo to
also typecheck the native renderer. Evidence:
smashcraft:build/ko-source-tests.log. This covers projection phases/lifetimes for
all three fighter models, read-only repeated projection, pool reset, and a real
accepted top KO through snapshot restore/re-execution without duplicate bodies.
It does not establish native animation or camera acceptance.

Integrated native checkpoint: source `0507dbd`, diagnostic `ko-20261005`,
keyboard/shadow-d0-r24/pool-predicted, compiled and packaged with zero errors
and 27 existing warnings. Both retained online clients loaded the same candidate
and reached the fight with the KO fixture. The attempted video capture failed
because the installed FFmpeg lacks x11grab; no cinematic appearance verdict
follows from this run. Use compositor recording for the next clip.
Private artifact:
~/.local/share/smashcraft-build-inputs/playable-integration-20261005/build/ko-20261005.w3x,
SHA256 `4f77cf28d711f8b73d2f40f425e6e92d52b3a202298f3bc94de280b351a15406`.

The same artifact was successfully recorded with wf-recorder on 5 October.
Two online clients reached the top-KO fixture. Archer visibly approaches the
foreground, tumbles and holds before departing; Rifleman visibly recedes above
the platform. A pause/resume during the sequence held the foreground pose:
the central body crop at video 1.35 and 1.80 seconds has normalized pixel RMSE
0.00002893 (lossy recording). The clips show the paused status, then resume and
ordinary live fighters after the cinematic. No source or timing changes were
needed for this observation.

Both native traces have the same six confirmed frame/checksum checkpoints,
from frame 0 through 222. This supports this two-character fixture and one pause;
it does not certify Illidan, terminal sparkle readability, camera extremes,
final-stock interruption, match reset or native correction appearance.
Raw numeric evidence: smashcraft:evidence/ko-native-20261005/. Local video:
smashcraft:build/native-ko-capture-20261005/ko-pause.mp4.
