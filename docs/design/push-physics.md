# Shield and body pushes

Smashcraft uses six world units per Melee unit. These rules use numerical
facts from NTSC 1.02, identified in the read-only Melee reference checkout at
`0296f009f32f710495979d30772d8332af2d411a`. No reference code or assets are
copied. Shield contact facts are in `src/melee/ft/kinds/ftCommon/ftCo_Guard.c`
(`ftCo_80092F2C`); horizontal body nudge facts are in
`src/melee/ft/ftcommon.c` (`ftCommon_8007DD7C`, `ftCommon_8007E0E4`). The
coefficients below come from the locally identified NTSC 1.02 PlCo.dat.

A block uses integer damage D and shield strength S (0 for light, 1 for full).
Its Melee shieldstun basis is `T = 1.5 * D * (1 - (0.05 + 0.65*S)) + 2`.
The defender's initial slide is `6 * min(2, T * 0.2 * 0.6)` world units per
frame. A perfect shield omits the final 0.6 factor. A direct grounded attacker
recoils away by `6 * (0.07*D + 0.02)` world units per frame. Projectiles do
not recoil their shooter; airborne direct contact uses the existing relative
step and weight rule documented in `docs/physics.md`.

Both channels pause in hitlag. Before each subsequent displacement, defender
slide loses its fighter's floor traction; grounded attacker recoil loses 1.1
 times its traction. With D=4, full shield, defender traction 0.09 Melee units,
and attacker traction 0.08, the initial speeds are 2.736 and 1.8 world units.
The first displacement after hitlag is 2.196 for the defender and 1.272 away
for the attacker. Light shields slide farther because their T is larger.
Shield health affects the shield's size and damage cost, rather than this
slide formula. Every arithmetic step is binary32.

Grounded bodies on the same floor push apart while their standing torso
radii overlap. Each overlapping opponent contributes PlCo.dat common +0x450,
0.30000001192092896 Melee units (1.8000000715255737 world units) per frame.
The rate is the same for idle, walking, shielding, dash and run. It adds a
small displacement and never clamps fighters against one another: a dash or
run moves faster and can cross through. Walking can keep nudging a shielding
opponent until it leaves the deck. The contract starts an Archer 30 units
inside the edge and its shielded opponent 3 units inside; two walking frames
push the opponent past either edge without damage.

Smashcraft uses its authored standing torso radii instead of Melee's
character-specific nudge widths. It computes all pair contributions before
moving anyone, with slot order resolving coincident centres. Grabbed fighters,
ground dodges, airborne fighters and hitlag participants do not nudge. No
push velocity persists across frames: the existing position snapshots capture
the whole result for rollback. Melee's common +0x454=0.1 and +0x458=1.4
adjust and cap depth-plane movement; this side-view game has no depth movement.

`ts/src/game/match/pushPhysicsContracts.tests.ts` runs the production match
path in Bun and Lua32. The `push-physics` acceptance tape records walking
body overlap and damage-dependent shield contact with corrected predictions
and rollbacks for `bun wisp parity tapes`.
