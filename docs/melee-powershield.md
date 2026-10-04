# Powershield and projectile reflection

The shared shield input records the trigger's nonzero-to-press timing in
deterministic fighter state. NTSC 1.02 PlCo.dat has a two-frame powershield
input window at common offset `+0x2A0`. A full digital trigger press inside that
window starts the GuardReflect timer. The input age and reflector timer are
copied and compared by replay; the input row retains its press edge and trigger
activity.

The retail reflector counter at common `+0x2A4` starts at 1. Complete
execution of the original callback `0x80093BC0` left the reflector flag set
after callback one (counter 0) and cleared it during callback two (counter
-1). Smashcraft keeps two active contact samples from the shield press: the
entry tick and the tick after the first callback. This observed timer result is
recorded in
`smashcraft:docs/smash-melee-reference/retail-powershield-clock.json`.
The observer now executes five complete callbacks without return patches,
including the ordinary shield-descriptor creation at reflector expiry.
The secondary counter at `+0x2B4` starts at 3: its flag remains after callbacks
one through three and clears on callback four. A separate entry flag clears on
callback one. The earlier patched callback observation did not expose those
later updates; it is superseded by the complete callback corpus.

Smashcraft retains a separate four-sample melee powershield timer alongside
the two-sample projectile reflector. During that melee window, blocked contacts
preserve shield health and use the unmodified defender pushback speed before
the existing cap; ordinary contacts apply the common `+0x2BC` multiplier
0.6000000238418579. Shieldstun, hitlag and attacker recoil retain the ordinary
contact path. Success emits one shield-success flash through the impact journal.
The timer is copied, compared and reset with the other replayed fighter state.
Twelve original scalar contact observations cover ordinary/perfect flags,
strengths 0.4 and 1, and powers 3, 10 and 30. A full-strength power-10 contact
has the same 6.5 stun duration in both cases, but defender pushback is
0.7800000905990601 ordinarily and 1.3000000715255737 when perfect, in Melee
units. The original contact accumulator preserves its seed on perfect contacts.
See `smashcraft:docs/smash-melee-reference/retail-powershield-contact.json`.
These are isolated original branches with return patches before presentation
and full state-entry consumers, not a complete gameplay contact trace.

Smashcraft fighters use an explicitly authored shield circle centered at local
offset `(0, 45)` with base radius `60` world units. These are original
Smashcraft tuning values, not copied Melee character geometry. Its current
reflector radius is `base radius × shieldSizeMultiplier × 0.75`; `0.75` is the
common reflector-size value at `+0x2A8`. Original joint-scaling and reflector
creation routines now confirm the health/pressure dependence: they attach the
reflector to the same uniformly scaled shield joint. Nineteen synthetic cases
execute both complete routines without return patches. For unit base size and
health 60, strength 0 gives joint scale 1, strength 0.3 gives
0.8725000619888306, and strength 1 gives 0.5750000476837158. The reflector's
local radius stays 0.75. Doubling the base size doubles the joint scale.
The original kind-14 branch keeps its base size independent of health/pressure;
it is reference evidence, not a requirement to add that fighter to Smashcraft.
See `smashcraft:docs/smash-melee-reference/retail-shield-joint.json` and
`smashcraft:tools/physics-probe/observe-shield-joint.mjs`.
Final collision matrices, joint animation/placement and guard-entry ordering
remain unobserved, so this does not establish complete world-geometry parity.
The original shield-contact routine `0x80007BCC` now executes twelve synthetic
point-capsule cases through the existing private Gekko interpreter, without
return patches. A radius-1 hit against a radius-2 shield accepts distance 3,
including exact tangency, and rejects the next binary32 value above 3.
The radius-1 shield similarly accepts distance 2. The cached shield position
is zero and its joint matrix is identity; both hit-capsule endpoints coincide.
See smashcraft:docs/smash-melee-reference/retail-shield-contact.json and
smashcraft:tools/physics-probe/observe-shield-contact.mjs. This proves those
isolated collision classifications, not shield/body priority or pose geometry.
Production melee selection still tests an authored rectangle against the victim
origin, then classifies every eligible contact as blocked when shielding.
Independent shield intersections and exposed-body pokes remain missing.
Projectile contact selection now checks the ordinary authored shield circle
before the existing body-contact predicate, after the reflector opportunity.
Shield-only intersections can block a projectile; body intersections outside
the shield apply body damage despite held guard. The selected blocked status
is retained in the contact batch rather than inferred again from held guard.
The swept path remains a point path, matching the existing reflector geometry;
projectile sizes, capsule/matrix arithmetic and body geometry are not yet
verified against complete retail contact execution. Melee coverage/pokes remain
missing. Eight focused powershield checks pass, including one connected
two-case regression for exposed-body versus shield-only projectile contact.
Evidence: smashcraft:build/projectile-shield-focused.log.
The assembled simulation check passes 555/555, with zero errors and the
existing RecoveryTests unused-import warning. Evidence:
smashcraft:build/projectile-shield-assembled.log. No emitted-Lua arithmetic or
native collision parity is claimed by these source checks.
Twelve further cases enter the original dispatch fragment at `0x80079050`,
after shielding eligibility. The original collision helper and its result
branch execute unchanged. Contact cases reach `0x80079080`, before shield
response; misses reach `0x800790B4`, before the body-check path. Return stops
at those locations and their following instruction preserve the caller's
return address; response consumers are not executed. The selections agree
with the twelve isolated collision cases. See
smashcraft:docs/smash-melee-reference/retail-shield-selection.json and
smashcraft:tools/physics-probe/observe-shield-selection.mjs. These observations
support separate shield-first contact selection, while complete eligibility,
body collision, contact response and same-frame ordering remain unverified.
The production swept-shield predicate now calls a shared capsule/circle
intersection function. Twenty-six original `0x80007BCC` observations compare
against that function: twelve stationary cases, eight segments in both endpoint
orders, and six hit-radius scale cases. A segment from x=-5 to x=5 at y=3
contacts the radius-2 shield with hit radius 1; one binary32 step higher misses.
Both endpoint orders agree. Hit scale 0.5 accepts distance 2.5 and rejects 3;
hit scale 2 accepts distance 4. All executions use identity joint geometry and
cached shield position, with no original instruction patches.
Facts: smashcraft:docs/smash-melee-reference/retail-shield-capsule.json.
Observer: smashcraft:tools/physics-probe/observe-shield-capsule.mjs.
The existing projectile path continues to supply capsule radius zero; the
refactor does not choose physical hitbox shapes for the authored melee moves.
Eleven focused powershield checks pass, including the three grouped original
collision comparisons. Evidence: smashcraft:build/capsule-shield-focused.log.
These selected classifications do not establish general float32 collision
arithmetic parity, final joint transforms, hurt-capsule behavior or native proof.
An expanded observation adds eight diagonal/endpoint cases; these agree with
the current double-precision classification. A subsequent 340-case boundary
comparison exposes 133 disagreements. Three concrete counterexamples are
retained in smashcraft:docs/smash-melee-reference/retail-shield-capsule-counterexamples.json.
The first is a point-path endpoint at (0.2273183912038803, 1.8602772951126099)
against radius 1.8741145133972168: the original accepts it and the current
double-precision squared-distance comparison rejects it. Projection and distance
rounding remain to be established; simply matching symmetric tangency cases is
insufficient. The production helper is not exact and this defect blocks its
claim of Melee collision fidelity. All original executions remain unpatched.
The same three counterexamples now include original contact coordinates and
signed contact-distance output. The first two report positive overlap
1.1920928955078125e-7; the third reports negative overlap
-2.980232238769531e-7. These values distinguish calculation differences from a
simple change to the final inclusive comparison. The first reported contact
coordinate also differs from its nearest endpoint, so a final square-root
replacement alone has not been shown to repair the original path.
Facts: smashcraft:docs/smash-melee-reference/retail-shield-capsule-details.json.
Observer: smashcraft:tools/physics-probe/observe-shield-capsule-details.mjs.
The observer executes the full unchanged routine and records its capsule output
fields, with the same synthetic geometry limitations as the original cases.
The precision defect above is now repaired for the recorded identity-circle
cases. Production uses binary32 endpoint differences, a rounded squared-length
sum, fused projection/interpolation and distance sum, rounded square root, and
the joint-radius conversion's rounded multiply/divide. Interpolation starts
from the newest capsule endpoint. The retained near-zero threshold is
0.000009999999747378752, observed at retail r2 offset `-0x7FF0`.
An identity transform still requires radius conversion: rounding its product
and quotient can shift the effective radius by one binary32 step. Omitting that
step left nine disagreements after repairing projection/distance arithmetic.
All 340 boundary observations are retained as numerical facts in
smashcraft:docs/smash-melee-reference/retail-shield-capsule-boundaries.jsonl.
The production emitted-Lua probe now matches all 374 recorded classifications
(34 geometry cases plus 340 boundary cases); all sixteen precision groups pass.
Six selected asymmetric/normalization cases add one grouped source regression;
the focused suite passes 12/12. Evidence:
smashcraft:build/capsule-precision-focused.log and
smashcraft:build/capsule-precision-lua.log. This closes those counterexamples,
not arbitrary transforms, body capsules, translated cases or Warcraft-native
square-root behavior. The native builder includes the new classification group
for its next candidate; no native result is inferred from emitted Lua.
The assembled simulation suite passes 559/559, with zero errors and the existing
RecoveryTests unused-import warning. Evidence:
smashcraft:build/capsule-precision-assembled.log.
Projectile travel is tested against
the swept circle in the simulation's x/z plane. Reflection transfers ownership
to the defender and applies the observed common damage multiplier `0.5` and
speed multiplier `0.699999988079071`. It keeps the source projectile's authored
visual family when ownership changes and carries that identity through replay.
An accepted reflection increments a separate deterministic presentation serial;
the existing impact journal uses it to emit one shield-success flash, separate
from an ordinary blocked-hit flash.

The original entry routine's complete input call path and native timing have
not been executed here. The two-frame input age follows the observed common
integer and the reference ABI description. Projectile behavior is covered by
focused deterministic simulation tests, not by a native Melee or Warcraft
collision trace. Native tuning of the authored shield center/radius remains
open. Complete melee powershield actionability, the post-contact counter at
`+0x2B8`, ordinary shield pokes/tilt and full input/collision scheduling remain
unimplemented or unverified. The observed post-contact setup starts a counter
of 4 and clears its timer; no action-timing behavior is inferred from those
stores alone.

The post-contact counter is now retained separately from the perfect-contact
window. Five original cases (counter 0 through 4) execute the counter branches
from GuardOn, Guard and GuardReflect, and the GuardOff action-selection prefix.
Held guard decrements a positive counter once; the shield-drop prefix preserves
it. A positive counter selects the side-special input check followed by the
additional action-check chain; zero skips to the ordinary remaining checks.
The observer stops before those selected consumers, so it does not prove that
a requested original attack succeeds or establish full callback ordering.
See `smashcraft:docs/smash-melee-reference/retail-powershield-actions.json` and
`smashcraft:tools/physics-probe/observe-powershield-actions.mjs`.

Production preserves this counter through hitlag and shieldstun, consumes it
while guard remains held, and retains it when dropping shield. A successful
perfect contact also clears the minimum-hold restriction, matching the observed
post-contact setup's zero minimum-guard timer. During shield drop, a positive
counter allows attack checks without clearing movement recovery. Beginning an
attack clears the guard clocks and drop recovery. Replay copies and compares
the new counter. Complete original input/attack trajectories and native
action-timing verification remain open.
The action-window integration passes seven focused powershield tests and
554/554 assembled simulation checks. Evidence:
`smashcraft:build/powershield-actions-focused.log` and
`smashcraft:build/powershield-actions-assembled.log`.

The melee-contact integration passes six focused powershield tests and the
assembled 553/553 simulation checks. All fifteen emitted-Lua precision groups
pass, including twelve new ordinary/perfect pushback outputs in the existing
shield group. Evidence: `smashcraft:build/melee-powershield-focused.log`,
`smashcraft:build/melee-powershield-assembled.log` and
`smashcraft:build/melee-powershield-precision.log`.

The numerical probe
`smashcraft:tools/physics-probe/observe-powershield-clock.mjs` loads the retail
files from private storage and keeps its original-containing ELF and outputs
under `~/.local/share/smashcraft-melee-reference/powershield-clock-runner`.
The tool uses symbol/ABI addresses only and does not publish executable bytes
or decompiled implementation.

The first assembled implementation passed 549 normal simulation checks and fourteen
emitted-Lua precision groups. The playable map built from source `c0d092a`
(with an unused test import and indentation cleaned up) with deployment
disabled. Evidence: `smashcraft:build/powershield-map-integration.log`.
That historical map occupied ~/code/wc3-melee/worktrees/melee-physics-public/build/wurst-map/Smashcraft 0.0.12.w3x
and has since been replaced by the DI-integrated candidate documented in
`smashcraft:docs/melee-foundation-roadmap.md`.
SHA-256: `c402c3e231cc29350ba28350ab176587eddac4fc816c52eb57f71bd30785ec0b`.
It has not been installed or observed natively.
