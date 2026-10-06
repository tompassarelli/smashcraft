# Expansion heroes: how a hero is registered and run

The seven roster heroes ([roster specification](design/roster.md)) share one
registration path, one special-move executor and one resource. A hero is a
data record; the simulation, replay, selection and object data read it.

## Registering a hero

- `ts/src/game/sim/codes.ts` reserves the Character codes: Blademaster 3,
  Mountain King 4, Warden 5, Lich 6, Uther 7, Dreadlord 8, Shadow Hunter 9.
  Hero specials run under `SpecialAction.heroNeutral`..`heroDown` (13-16) and
  hero projectiles under `ProjectileKind.hero` (5).
- `ts/src/game/sim/heroes/<hero>Hero.ts` is one hero's `HeroDefinition`
  (`sim/heroes/hero.ts`): product name, purpose, weakness, `moves`
  (`FighterMoves`, `sim/heroMoves.ts`), `specials` (`FighterSpecials`,
  `sim/heroSpecials.ts`), presentation (Warcraft model, base unit, object
  code, portrait, projectile model, per-pose clips with a fallback) and
  `complete`.
- `ts/src/game/sim/heroes/heroBodies.ts` holds the roster's weight, run,
  air-speed, width and height multipliers. `sim/tuning.ts` derives a hero's
  physics from Archer's (weight, dash/run/walk speed, air speed; jumps and
  gravity unchanged) and `physics/contactGeometry.ts` scales Archer's hurt
  capsule by width and height. Ledge, wall and roll data use Archer's.
- `ts/src/game/sim/heroes/registry.ts` lists the heroes in build order.
  `SELECTABLE_CHARACTERS` is the original three plus every hero whose
  `complete` is true; selection rules, menu cycling and the map's fighter
  objects (`game/objectData.ts`) use it, so an incomplete hero is never
  selectable and adds nothing to the map.

## Specials

`FighterSpecials` has a `SpecialKit` per input (neutral, side, up, down).
A kit has a `ground` form, an optional `air` form and an optional `free`
form. Each `AuthoredSpecial` uses the roster's frame numbering: the entry
tick is frame 1, windows are inclusive and `endFrame` N means the fighter
acts again on N+1. It may author:

- `cost`, spent once on entry, never refunded;
- `regions`: strike paths built with `heroRegion`, struck against the
  target's authored hurt volumes (`sim/hurtboxes.ts`) or shield, each target
  once per action. Strike paths are disjoint by construction: a weapon never
  extends the body. Limbs that must be hittable belong in the hero's hurt
  volumes;
- `motion`: velocity set on each frame of a window, facing-relative, with an
  optional `aimedSpeed` that follows the stick held on entry;
- `projectiles`: spawn frame, offset, velocity (and an up-held velocity),
  life, radius, `activeFrom`, effect, `reflectable`, `limit` and
  `cancelOnInterrupt`; a cast that would exceed a limit or the three-projectile
  cap fails before spending; in a match a hero projectile ends on a wall, an
  underside or a solid deck's top, and passes through pass decks;
- `hurt`: body poses over the special's frames (`hurtPose`, 1-based), which
  `sim/hurtboxes.ts` uses instead of the standing body while they cover the
  current special frame;
- `intangible` and `armor` windows (armor takes one hit's reaction up to its
  damage; the damage applies and throws ignore it);
- `groundOnly`, `oncePerAirtime`, `helpless` and `landingLag`;
- `placement`: the fighter's one placed object (`SpecialPlacement`, such as
  Serpent Ward), standing `offsetX` ahead of the caster's feet from the
  placement frame, which is its age 1. `sim/placedObjects.ts` runs it after
  the frame's projectiles: each opponent's normal, hero special and
  projectile that touches its upright capsule spends durability by that
  hit's damage, once per attack or action (projectiles are used up); it
  never stops a strike from reaching a fighter. At each age in `fireAges` it
  emits its `shot` straight along its facing unless its owner is held, in
  hitstun or out, and under the three-projectile cap. It ends at zero
  durability, after `life` frames, or on its owner's stock loss;
- `recall` on an `AuthoredSpecial` removes the placed object when the action
  completes, and a kit's `recall` form replaces every other form while the
  object stands (Serpent Ward's free recast).

`sim/heroSpecialRules.ts` executes them: `chooseHeroSpecial` selects the
form, `enterHeroSpecial` spends and records the entry, `advanceHeroSpecial`
runs one frame, `heroSpecialContact` selects strikes and `landHeroSpecial`
ends a form with landing lag. A kit field a hero needs and this list lacks is
added to `AuthoredSpecial` and executed here, with a focused test.

## Mana

`ROSTER_MANA`: 100 mana, full on spawn and on each new stock. After 120
frames without spending, a grounded, actionable fighter (not shielding,
held, stunned or acting) regains a point every 10 such frames. A press the
fighter cannot afford starts nothing and counts one `visuals.manaDenied`; an
up special below its full cost takes its `free` form instead. Mana, its delay
and remainder, the entry form and aim, airtime uses, armor and each hero
projectile's record and the placed object are fighter state: rollback copies them, replay
difference compares them, and the canonical replay text includes them for
fighters with a hero kit. The original fighters keep their cooldowns and no
mana. In a match each hero's HUD plate shows "Mana N" above it, and "Not
enough mana" for about three quarters of a second after each refused press
(`ui/manaReadout.ts`). There is no ultimate action, so ultimates stay off.

The shared contracts are in `ts/src/game/sim/heroSpecials.tests.ts`.
