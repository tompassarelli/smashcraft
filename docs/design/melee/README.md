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
- [Aerials on shield](aerials-on-shield.md): the shieldstun formula, hitlag on
  shield, landing lag and fast fall, out-of-shield options per fighter, and how
  timing, strength, spacing and side set an aerial's safety, with worked examples.
- [Defence](defense.md): shield, dodges, influence on knockback, techs, ledges and grabs.
- [Archetypes](archetypes.md): weight, speed and frame data across the cast.
- [Techniques and jank](techniques.md): emergent techniques and the engine
  mechanics that cause them, including wobbling, chain grabs and SDI teleports.
- [Why](why.md): what the designer and the community have said about the game's shape.
- [Hit and movement events](hit-effects.md): the effect and sound each hit, element,
  strength, footstep and landing plays, read from the decompilation.

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

## Smashcraft decisions

The questions raised by Melee's wavedash, dash dancing, shield safety,
out-of-shield actions, ledges, crouch cancelling and ASDI are resolved in
[shared mechanic defaults](../../gameplay-design.md#shared-mechanic-defaults).
Throw-to-regrab chains use the adopted
[throw regrab rule](../../gameplay-design.md#throw-regrabs), and roster physics
and trade-offs use the [expansion defaults](../../gameplay-design.md#expansion-roster-defaults).
The case study's Melee values remain reference facts, not a template for fighters.
