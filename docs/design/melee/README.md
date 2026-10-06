# Melee case study

A descriptive study of Super Smash Bros. Melee (NTSC 1.02) for what it is: its
movement, its attacks and defences, how its cast trades weight against speed
against frame data, the techniques players found in it, and why it came out
this way. It states no preference. What Smashcraft takes from Melee, changes or
leaves out is decided only in [gameplay design decisions](../../gameplay-design.md).

- [Movement](movement.md): ground speeds and the initial dash, jumps, falling,
  air control, wavedashes and wavelands, rolls and spot dodges.
- [Attacks](attacks.md): startup, ending lag, reach and safety on shield across
  the cast; out-of-shield punishes; aerials on shield by timing, spacing and drift.
- [Defence](defense.md): shield, dodges, influence on knockback, techs, ledges and grabs.
- [Archetypes](archetypes.md): weight, speed and frame data across the cast.
- [Techniques and jank](techniques.md): emergent techniques and the engine
  mechanics that cause them, including wobbling, chain grabs and SDI teleports.
- [Why](why.md): what the designer and the community have said about the game's shape.

## Where the numbers come from

Every number in these pages is computed by smashcraft:ts/scripts/meleeCaseStudy.ts
from the reference data and written into the pages between HTML comment
markers (`v:` for a value, `table:` for a table). Run `bun scripts/meleeCaseStudy.ts` from smashcraft:ts/ after changing
the data or a page's markers; `--check` lists stale pages, and the test suite
fails on any. The inputs are the two Melee fact layers:

- smashcraft:references/melee-frame-data/: per-move frame data from
  meleeframedata.com's database (startup, active frames, interruptible frame,
  total, shieldstun, damage, landing lag) and libmelee's recorded hitbox
  positions and dodge travel. Its README records provenance and the meaning
  and traps of every field.
- smashcraft:docs/smash-melee-reference/retail-roster.json: every fighter's
  attributes, selected common values, animation lengths and selected command
  events, read privately from the owner's GALE01 revision 2 disc, with field
  layouts from the decompilation (melee:src/melee/ft/types.h at revision
  0296f009f32f710495979d30772d8332af2d411a).

The script checks the two sources against each other. Jump squat agrees for
<!-- v:check.squat -->26 of 26<!-- /v --> fighters, weight for <!-- v:check.weight -->26 of 26<!-- /v -->,
run speed for <!-- v:check.run -->26 of 26<!-- /v --> and initial dash speed for
<!-- v:check.dash -->25 of 26<!-- /v --> (differing: <!-- v:check.dashDiffer -->Luigi<!-- /v -->, where the
site lists the run speed). The retail roll and spot-dodge intangibility windows
agree with the site's in <!-- v:check.dodgeWindows -->72 of 76<!-- /v --> cases; the others
are <!-- v:check.dodgeDiffer -->Mewtwo's forward roll (corpus 4–22, retail 4–21), Mewtwo's back roll (corpus 4–20, retail 4–19), Young Link's forward roll (corpus 4–20, retail 4–19) and Young Link's back roll (corpus 4–20, retail 4–19)<!-- /v -->. The pages use the retail values. The jump
rule reproduces SmashWiki's Fox heights, which the script asserts.

## Conventions

- Distances are Melee units, speeds Melee units per frame, time in frames at
  60 per second. A fighter's position is the centre of its feet.
- Frames are numbered from 1, the first frame of the action, as
  meleeframedata.com numbers them. Hitlag is excluded: both fighters freeze for
  the same frames, so it moves no advantage.
- "On shield" is the attacker's frame advantage: the frame the defender can act
  out of shieldstun minus the frame the attacker can act. Negative means the
  defender acts first. The formulas are in [Attacks](attacks.md#reading-the-numbers).
- Simulated movement follows the decompiled rules named beside each table, on
  flat ground with the stick fully held. It is arithmetic on the recorded
  parameters, not a recorded game trace.

## Open design questions for the owner

Each is a fact about Melee that Smashcraft has not yet taken a position on.
Decided items are in [gameplay design decisions](../../gameplay-design.md) and
not repeated here.

1. Character physics spread: Melee's cast spans the fall speeds, gravities and
   air speeds in [Movement](movement.md#falling-and-air-control). How wide a
   spread Smashcraft's fighters cover is open.
2. Wavedash and waveland: they follow from the air dodge carrying momentum into
   the landing ([Techniques](techniques.md#wavedash-and-waveland)). Whether
   Smashcraft keeps that property is open.
3. Dash dancing and the initial dash window: per-fighter initial dash lengths
   range as shown in [Movement](movement.md#ground-movement). How long
   Smashcraft's windows are, and whether they differ by fighter, is open.
4. Ground moves on shield: in Melee nearly every grounded normal loses on
   shield and only spacing makes it safe ([Attacks](attacks.md#safety-on-shield)).
   The target on-shield range for Smashcraft's moves is open.
5. Aerials on shield: an aerial's safety depends on hitting late and landing
   at once ([Attacks](attacks.md#aerials-on-shield-by-timing-spacing-and-drift)).
   How much spacing and drift decide safety in Smashcraft is open.
6. Out-of-shield options: Melee lets the defender grab, jump-cancel into up
   smash or grab, or jump into an aerial ([Defence](defense.md#shield)). Which
   of these Smashcraft offers, and how fast, is open.
7. Chain grabs that depend on the victim's fall speed or weight
   ([Techniques](techniques.md#chain-grabs)). Whether any such grab is acceptable
   short of a loop is open (#68 covers loops without escape).
8. Ledge play: regrab lock, ledge intangibility and edge-hogging
   ([Defence](defense.md#ledges)). Smashcraft's ledge rules follow Melee today;
   whether they stay is open.
9. Weight against speed: Melee's heavy fighters are not uniformly slow
   ([Archetypes](archetypes.md)). Which trade-offs Smashcraft's fighters embody is open.
10. Crouch cancelling and ASDI down: low-percent hits on a crouching fighter
    lose knockback and hitlag ([Defence](defense.md#influence-on-knockback)).
    Whether Smashcraft keeps both is open.
