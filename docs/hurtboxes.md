# Hurt volumes that follow animation

A fighter's body is a short list of authored capsules, chosen each frame from
its state and attack frame. The drawn model informs the authoring and never
decides contact. Source: smashcraft:ts/src/game/sim/hurtboxes.ts.

## Authoring types

- `HurtPart`: one facing-relative capsule, `x1, z1, x2, z2, radius`, origin at
  the fighter's feet, positive x in front (the same frame as `StrikeCapsule`).
  Optional `state`:
  - `HurtState.normal` (default): a touching strike hits.
  - `HurtState.invincible`: a strike that touches only invincible parts is
    spent on the target: its window counts as used against that fighter, with
    no damage, knockback or hitlag.
  - `HurtState.intangible`: strikes pass through; they may still touch another
    part or hit later in their window.
- `HurtPose`: `{ firstFrame, lastFrame, parts }` over zero-based attack frames,
  inclusive, as `MoveRegion` counts them. Charging a smash holds the attack
  frame, so a charge holds its pose.
- `FighterHurtboxes`: `{ stand, crouch?, attacks }`. `attacks[style]` lists the
  poses of that attack; a frame no pose covers, and every state without its own
  body, uses `stand`. `crouch` applies while grounded and crouching outside
  attacks.

Whole-body intangibility (dodges, ledge, techs, respawn) stays in
`isIntangible` (smashcraft:ts/src/game/sim/conditions.ts) and is checked first.

## Hero kits

A kit puts its bodies in `FighterMoves.hurtboxes`
(smashcraft:ts/src/game/sim/heroMoves.ts). `heroHurtPose(first, last, parts)`
takes the roster brief's frames, counting the entry tick as frame one like
`heroRegion`; `hurtPart(x1, z1, x2, z2, radius, state?)` builds a part. A kit
without `hurtboxes` keeps its character's standing capsule in every state.
The shipped fighters' bodies live in the same file's `CHARACTER_HURTBOXES`.

Rules for authored bodies:

- Weapons stay outside the body: only limbs and torso extend, so a weapon's
  reach past the arm is the move's disjoint.
- An extended limb reaches toward the strike on the frames the drawn limb
  does, typically from late startup through early recovery, so a whiffed move
  is punishable at its hand or foot.
- Mark intangible or invincible parts deliberately and name the trade-off in
  the move's brief; they change which trades the move wins.

## Contact

Hit selection (smashcraft:ts/src/game/sim/attacks.ts) places each part with
the target's pose facing and tests it against the strike capsule:
`strikeHurtContact` returns a hit on any normal part, otherwise "spent" when
only invincible parts touch. Grabs take any part that is not intangible. A
raised shield still takes a strike that reaches it. Bot spacing, push radius
and the hero reference height keep reading the standing capsule.

## Determinism and replay

Bodies are immutable data selected from rollback state (character, kit,
attack style and frame, crouch, pose facing), so a restored snapshot selects
the same parts. A kit's `hurtboxes` are part of its canonical record
(smashcraft:ts/src/game/replay/canonical.ts), so changing them changes the
state checksum, and a tape of a kit without them is unchanged.

## Checking against the drawn pose

`bun wisp view hurtboxes --assets DIR --out OUT` (from smashcraft:ts/) plays
each shipped fighter's sampled moves through the production step and pose
selection, skins the packaged model at the clip time the fighter pool shows,
flattens it onto the stage plane and draws the volumes over it: yellow normal,
blue invincible, green intangible, red outlines for active strikes, and a
phase bar (orange startup, red active, blue recovery). It writes one PNG per
fighter and move and prints, per frame, how much of the drawn body the volumes
cover and how much of the volumes the body fills. Held weapons are part of the
drawn silhouette and deliberately outside the volumes, so coverage below 100%
is expected.

## Shipped fighters

Archer, Rifleman and Illidan author poses for the sampled moves: jab, down
tilt, forward smash, forward air and down air. Each extended pose spans the
last two startup frames through three recovery frames; heights scale with the
fighter's standing capsule.

| Move | Pose | Special parts |
| --- | --- | --- |
| Jab | arm reaching about 49 units forward | |
| Down tilt | torso ducked to 62% height, front leg swept forward | |
| Forward smash | torso wound back through startup, then torso and arm forward | Illidan's arm intangible |
| Forward air | torso tucked, front leg kicked out | |
| Down air | legs driven below the feet | Archer's legs intangible, Rifleman's invincible |

The special parts are provisional design choices: the Archer's down air beats
an anti-air aimed at its legs, the Rifleman's spends one, and Illidan's
forward smash cannot be stuffed at the arm. Captures of build 0.0.49's models
cover 49-98% of the drawn body on active frames, the rest being held weapons
and loose cloth outside the volumes.
