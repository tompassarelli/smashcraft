# Expansion heroes: how a hero is registered and run

The roster heroes ([roster specification](design/roster.md)) share one
registration path, one special-move executor and one resource. A hero is a
data record; the simulation, replay, selection and object data read it.

## Registering a hero

- `ts/src/game/sim/codes.ts` reserves the Character codes: Blademaster 3,
  Mountain King 4, Warden 5, Lich 6, Forsaken Paladin 7, Dreadlord 8, Shadow Hunter 9, Pit Lord 10, Beastmaster 11, Lich King 12.
  Hero specials run under `SpecialAction.heroNeutral`..`heroDown` (13-16) and
  hero projectiles under `ProjectileKind.hero` (5).
- `ts/src/game/sim/heroes/<hero>Hero.ts` is one hero's `HeroDefinition`
  (`sim/heroes/hero.ts`): product name, purpose, weakness, `passive` and
  optional `ultimate` (official name and one line each), `moves`
  (`FighterMoves`, `sim/heroMoves.ts`), `specials` (`FighterSpecials`,
  `sim/heroSpecials.ts`), presentation (Warcraft model, object
  code, portrait, projectile model, per-pose clips with a fallback) and
  `complete`.
- `ts/src/game/sim/heroes/heroBodies.ts` holds the roster's weight, run,
  air-speed, width and height multipliers. An optional `shield` scale grows the
  reference shield's centre height and radius for a body that would stand
  outside it (Pit Lord 1.35). `sim/tuning.ts` derives a hero's
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
A kit has its official `name` and a one-line `description`, a `ground`
form, an optional `air` form and an optional `free` form; a form the design
names on its own (Backstab, Hammerfall) carries its own `name`. Names are
written only there (and in `sim/originalKits.ts` for the original three);
`sim/moveNames.ts` reads them for [the move list](move-list.md), which
`bun scripts/moveList.ts` regenerates, the Moves page and training's readout.
Normals have no official name; an optional `inspiredBy` on a move is a
docs-only design reference. Each `AuthoredSpecial` uses the roster's frame numbering: the entry
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
  aim (Pursuit Lunge's 20 degrees); `driftSpeed` adds the live stick's x at
  that many units per frame (Spectral Ascent's steering); `stopsAtBody`
  clamps forward travel to end just short of a raised shield or another
  fighter's body (Storm Rush), and `stopsAtShield` only at a raised shield,
  passing bodies (Wind Walk); `relocate` moves the fighter at once on the
  window's first frame, onto its placed object (Mirror Image's swap) or just
  behind the nearest marked opponent within `relocateReach`, spending the mark
  (Shadow Pursuit); a kit's `marked` form is chosen while a poisoned opponent
  is within its range, and `strikeStatus` applies a status with each strike
  that reaches a body (Howl of Terror's Terror);
- `aimFrames`: through this frame a held stick re-chooses the aim, so an up
  special can still be aimed sideways or down; without it the aim is the
  stick on entry;
- `projectiles`: spawn frame, offset, velocity (and an up-held velocity),
  life, radius, `activeFrom` (the spawn frame is age one), effect,
  `reflectable`, `limit`, `cancelOnInterrupt`, `needsLineOfSight` (not placed through solid stage surfaces), `gravity` (subtracted from
  the vertical velocity before each move: Fel Spit's arc); a cast that
  would exceed a limit or the three-projectile cap fails before spending; in a
  match a hero projectile ends on a wall, an underside or a solid deck's top,
  and passes through pass decks; an optional
  `status` (`sim/heroStatus.ts`) applies when it reaches a body, never
  through a shield;
- `hurt`: body poses over the special's frames (`hurtPose`, 1-based), which
  `sim/hurtboxes.ts` uses instead of the standing body while they cover the
  current special frame;
- `intangible` and `armor` windows (armor takes one hit's reaction up to its
  damage; the damage applies and throws ignore it). A `shell` armor is
  armed once on its first frame, lasts through its last even after the
  action ends, is spent by one hit, and blocks starting the special again
  while any armor remains;
- `commandGrab`: a window whose strike latches the nearest grabbable body
  through the shared grab link (shields do not stop it, an external hit breaks
  it, #85's throw-hitstun rule refuses it), releases it `holdFrames` later
  with its effect as a throw, and ends the action `recovery` frames after
  that instead of at the whiff `endFrame` (`sim/heroCommandGrab.ts`);
- `followUps`: branches `{ window, special, input, facesStick }`. The first
  whose window holds the next frame and whose input (special by default,
  attack or shield) was freshly pressed replaces the rest of the action with
  `special`, whose frame 1 is the press tick; `facesStick` turns the fighter
  to the held stick first. It spends its own cost, clears the hit registry and
  cannot itself branch. The running form records it (base form +
  `FOLLOW_UP_FORM` times one more than its index), so rollback restores it,
  and it plays the `<slot>SpecialFollowUp` pose when the hero's clip table
  maps one (Wind Walk's Backstab); a recall form plays it too (Mirror Image's
  swap). The computer presses an attack or special branch whose strike
  reaches its target (match/botHeroKit.ts `pressHeroFollowUp`);
- a `guard` window with `heal` and `healCapPerStock`: when an opponent's
  damaging strike, hero special strike or projectile overlaps the fighter's
  body during it, the action records one success and restores `heal` damage
  percent, never more than `healCapPerStock` in a stock (`resolveHeroGuards`,
  run before specials advance). It protects nothing itself; pair it with
  `intangible`. The success and the stock's healing are fighter state;
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
- `companion` on a placement makes the object a partner (`sim/companions.ts`,
  Beastmaster's bear). It walks to `followBehind` behind its owner on the deck
  it was set down on, never jumps or falls and stops at that deck's ends. It
  lunges `lungeTravel` with its `bite` only on an order, is stunned
  `stunFrames` by a hit mid-lunge, and leaves after `leashFrames` farther
  than `leash` from its owner. Its lunge is cancelled while its owner is in
  hitstun or a grab. Its mode, frames, leash count, bitten targets and deck
  are fighter state. An `AuthoredSpecial`'s `command` orders the partner on
  its `frame`: a lunge, refused before spending while the partner is lunging
  or stunned, or a walk back at `returnSpeed`;
- `recall` on an `AuthoredSpecial` removes the placed object when the action
  completes, and a kit's `recall` form replaces every other form while the
  object stands (Serpent Ward's free recast).

## Statuses

`sim/heroStatus.ts`: one status per fighter, its kind and immunity group in
`sim/codes.ts` (`HeroStatusKind`, `HeroStatusGroup`). A kind's rules say
whether it discards every input (motion and gravity continue and the current
action ends), refuses neutral, side and down specials, or ends on the next
damaging hit, or scales the damage of every hit the fighter deals (Terror, 0.9); the hit that applies a status resolves first, so it never ends
its own status. A status ending by time or hit grants its group's immunity, so
no source chains it. Reapplying refreshes the duration. Status, frames, group
and per-group immunity are rollback state, written to the canonical record
only while live; a new stock clears them.

Carried (the Lich King's Val'kyr Shadowguard, #167) discards every input
and replaces motion: each frame the fighter moves its rule's speed toward its
back and rises, with no gravity or drift, and the hit that applies it turns
the victim to face back along the hit. It mashes out as Sleep does (never
before frame 20) and any damaging hit ends it (`carryHeroStatus`).

A projectile's optional `pool` (Defile) keeps it alive through its hits: it waits `every`
frames between strikes and widens by `growth` per body hit up to `maxRadius`;
its hit count and wait are projectile rollback state.

`sim/heroSpecialRules.ts` executes them: `chooseHeroSpecial` selects the
form, `enterHeroSpecial` spends and records the entry, `advanceHeroSpecial`
runs one frame, `heroSpecialContact` selects strikes and `landHeroSpecial`
ends a form with landing lag. A kit field a hero needs and this list lacks is
added to `AuthoredSpecial` and executed here, with a focused test.

## Mana

Every fighter has the one mana resource (`sim/mana.ts`); its rules, numbers
and bar are in smashcraft:docs/design/mana.md. A press the fighter cannot
afford starts nothing and counts one `visuals.manaDenied`; an up special
below its full cost takes its `free` form instead. The entry form and aim,
airtime uses, armor, each hero projectile's record and the placed object are
fighter state: rollback copies them, replay difference compares them, and the
canonical replay text includes them for fighters with a hero kit (mana itself
for every fighter). There is no ultimate action, so ultimates stay off.

The shared contracts are in `ts/src/game/sim/heroSpecials.tests.ts`.

## Presentation

- In the playable build (pooled presentation) a hero draws from its clip
  pool like the original fighters: one model per sequence of its stock
  classic model, so a clip index selects that exact sequence.
  smashcraft:tools/animations/export-original-clips.ts exports a pool for
  every hero in `HERO_ROSTER` (extracting the stock model from the game's
  archives with `--extractor`/`--storage`) and regenerates
  `assets/fighterOriginalClipInfo.ts`; rerun it when a hero is added.
  smashcraft:ts/src/game/render/fighterPool.tests.ts fails a selectable
  fighter without a pool, or whose table names a sequence its pool lacks.
- Without a pool a hero draws with its fighter unit, made from its own object
  (base `earc`, like the original fighters, so no hero icon or experience bar
  shows) with the hero's stock model. The unit plays each clip by sequence
  index (`SetUnitAnimationByIndex`): an animation name picks at random among
  same-named variants.
- `presentation.clips` is a `HeroClipTable` (`sim/heroes/hero.ts`): pose to
  `{ index, seconds }`. Pose selection (`presentation/fighterPose.ts`) fits
  `seconds` to the action's frames. The original fighters fill the same table
  from their packaged clips (`presentation/fighterClips.ts`). A pose the table
  leaves out plays `fallback`, except the `HeroStatePose` states (dash, run,
  crouch, fall, landing, shield, air dodge, smash charge, KO, dizzy), which
  keep the original fighters' pose for that state.
- The drawn body keeps clear of stage faces with Archer's body envelope
  stretched by the hero's width and height (`presentation/fighterPlacement.ts`).
- Star KOs fly the hero's own model off; there is one KO body per star-KO
  impact and selectable fighter (`render/combatEffects.ts`).
- The scene report counts a shown hero unit as drawn under its model
  (`platform/sceneReport.ts` passes Wisp's `unitModel`), and the player view
  declares every hero model, with model facts read from the classic models.
