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
- `motion`: velocity set on each frame of a window, facing-relative. The
  next frame moves by exactly that velocity, without steering, drag, gravity
  or the fall-speed cap; stage collision still stops it, so a long one-frame
  displacement (Warden's Blink) ends at the deck body or lands on the deck.
  `aimedSpeed` replaces the direction with one of eight aimed directions;
  `aimedTilt` turns a horizontal heading to a fixed angle for an up or down
  aim (Pursuit Lunge's 20 degrees); `steerX` makes the horizontal velocity
  that speed times the stick side held on each frame (Bat Ascension);
- `aimFrames`: through this frame a held stick re-chooses the aim, so an up
  special can still be aimed sideways or down; without it the aim is the
  stick on entry;
- `projectiles`: spawn frame, offset, velocity (and an up-held velocity),
  life, radius, `activeFrom`, effect, `reflectable`, `limit` and
  `cancelOnInterrupt`; a cast that would exceed a limit or the three-projectile
  cap fails before spending; in a match a hero projectile ends on a wall, an
  underside or a solid deck's top, and passes through pass decks; an optional
  `status` (`sim/heroStatus.ts`) applies when it reaches a body, never
  through a shield;
- `hurt`: body poses over the special's frames (`hurtPose`, 1-based), which
  `sim/hurtboxes.ts` uses instead of the standing body while they cover the
  current special frame;
- `intangible` and `armor` windows (armor takes one hit's reaction up to its
  damage; the damage applies and throws ignore it);
- `commandGrab`: a window whose strike latches the nearest grabbable body
  through the shared grab link (shields do not stop it, an external hit breaks
  it, #85's throw-hitstun rule refuses it), releases it `holdFrames` later
  with its effect as a throw, and ends the action `recovery` frames after
  that instead of at the whiff `endFrame` (`sim/heroCommandGrab.ts`);
- `groundOnly`, `oncePerAirtime`, `helpless` and `landingLag`.

## Statuses

`sim/heroStatus.ts`: one status per fighter, its kind and immunity group in
`sim/codes.ts` (`HeroStatusKind`, `HeroStatusGroup`). A kind's rules say
whether it discards every input (motion and gravity continue and the current
action ends), refuses neutral, side and down specials, or ends on the next
damaging hit; the hit that applies a status resolves first, so it never ends
its own status. A status ending by time or hit grants its group's immunity, so
no source chains it. Reapplying refreshes the duration. Status, frames, group
and per-group immunity are rollback state, written to the canonical record
only while live; a new stock clears them.

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
projectile's record are fighter state: rollback copies them, replay
difference compares them, and the canonical replay text includes them for
fighters with a hero kit. The original fighters keep their cooldowns and no
mana. In a match each hero's HUD plate shows "Mana N" above it, and "Not
enough mana" for about three quarters of a second after each refused press
(`ui/manaReadout.ts`). There is no ultimate action, so ultimates stay off.

The shared contracts are in `ts/src/game/sim/heroSpecials.tests.ts`.
