# Kit review 1: Blademaster, Mountain King, Warden, Rifleman, Illidan

Owner direction (Tom, 7 Oct 2026): "maximum ambition, no stone unturned, best
Warcraft III map in existence". Tom found Archer's up and down specials dull
and Illidan's neutral special uninteresting and had them redesigned
([Archer's hippogryph specials](archer-specials.md), #113, #116). This review
gives the same treatment, unasked, to the other kits on main. Moves already
being redesigned elsewhere are out of scope: Rifleman's bear (#111), blaster
(#117) and frost trap (#114), and Illidan's Mana Burn (#116).

Numbers are provisional authoring values, not measured balance; #105 tunes
them. Frames follow the roster notation (smashcraft:docs/design/roster.md):
the press is frame 1, windows are inclusive. H is the hero reference height,
132 units. Run speeds for scale: Archer 13.2 a frame, Blademaster 14.3,
Warden 15.0, Mountain King 11.6.

## The bar

[Archer's specials](archer-specials.md) set it: a second decision after the
press, a visible setup the opponent can see and answer, a cost for the setup,
and a recovery whose safest route still has a guess in it. A Melee or Rivals 2
player calls a move dull when it is one button with one outcome: a straight
dash that stops at shield, a projectile with no angle or timing choice, a
recovery that goes the same way every time, a ring that one jump answers.

## Prior art

| Fighter (game) | Move | What it teaches |
| --- | --- | --- |
| Greninja (Ultimate) | Shadow Sneak | Disappear, reappear and kick; holding back at the end kicks behind instead (12% against 10%) ([SmashWiki](https://www.ssbwiki.com/Shadow_Sneak)). One move, two sides: the defender guesses which. |
| Forsburn (Rivals) | Forward special clone | A smoke copy that breaks from a single hit ([Rivals of Aether](https://rivalsofaether.com/?p=7614)). A decoy the opponent must spend a hit on. |
| Zelda (Ultimate), Rosalina | Phantom, Luma | A placed partner away from the fighter is a second position to threaten from; hitting it removes the threat. |
| Donkey Kong (Melee onward) | Giant Punch | Charge, then release on a second press; shield cancels and stores the charge ([SmashWiki](https://ssbwiki.com/Giant_Punch)). The charge is a bait as much as an attack. |
| Fox, Falco (Melee) | Reflector | Jump-cancellable from frame 4 ([SmashWiki](https://ssbwiki.com/Fox_(SSBM)/Down_special)), which turns a 1-hit poke into the waveshine game. A shine without the jump cancel is a different, duller move. |
| Toon Link, Link (Ultimate) | Boomerang | Out and back: the return is a second hit from the other side. |
| Ike (Ultimate), Kirby | Aether, Final Cutter | Rise, then a committed straight plunge: the edge-guarder must guess ledge or stage. |
| Meta Knight, Pit, Charizard (Brawl) | Glide | A recovery line bent in flight, with an attack out of it. |
| Maypul, Zetterburn (Rivals) | Mark, burn | A status a move applies, cashed in by another move: two-step setups the defender can see. |
| Sheik, Marth (Melee) | Vanish, Dolphin Slash | Recovery mixups come from direction and timing, not invincibility. |

## Scoring

Each move scores 0 (none) to 3 (rich) on decisions after the press (D),
mixups it creates (M), reads it rewards (R), risk against reward (RR),
counterplay a defender can see and choose (C) and Warcraft identity (W).
Under 9 of 18 is dull; those are redesigned.

### Blademaster

| Move | D | M | R | RR | C | W | Total | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Wind Cutter (neutral B) | 0 | 0 | 1 | 2 | 2 | 1 | 6 | Dull, but his weak ranged pressure is the stated weakness; keep. |
| Wind Walk Strike (side B) | 0 | 0 | 1 | 1 | 2 | 1 | 5 | **Redesign.** A straight dash that stops at shield; Warcraft's Wind Walk is a backstab out of stealth, not a charge. |
| Rising Blade (up B) | 1 | 1 | 1 | 2 | 2 | 1 | 8 | Marth's Dolphin Slash with drift; serviceable; keep. |
| Mirror Feint (down B) | 1 | 1 | 2 | 1 | 1 | 1 | 7 | **Redesign.** A back step and an optional slash: the image is cosmetic, so Mirror Image does nothing. |
| Forward tilt, forward smash (tip sweetspots) | 1 | 1 | 2 | 2 | 2 | 2 | 10 | Good spacing identity (the deliberate Critical Strike); keep. |

### Mountain King

| Move | D | M | R | RR | C | W | Total | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Storm Bolt (neutral B) | 0 | 0 | 1 | 2 | 2 | 1 | 6 | **Redesign.** A plain straight projectile: neither a stun nor a hammer. |
| Storm Rush (side B) | 0 | 0 | 1 | 1 | 2 | 1 | 5 | Dull, but a committed body charge suits a heavy; keep and score again after the others land. |
| Thunder Leap (up B) | 1 | 0 | 0 | 1 | 2 | 1 | 5 | **Redesign.** Same arc every time; no guess for the edge-guarder. |
| Thunder Clap (down B) | 0 | 0 | 1 | 1 | 1 | 2 | 5 | **Redesign.** One ring that one jump answers; no timing or bait. |
| Forward air Hammer Drop, back air | 1 | 1 | 2 | 2 | 2 | 2 | 10 | Good heavy identity; keep. |

### Warden

| Move | D | M | R | RR | C | W | Total | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Shadow Strike (neutral B) | 0 | 0 | 1 | 1 | 2 | 2 | 6 | **Redesign.** The poison is three 1% ticks: a status with no consequence. |
| Pursuit Lunge (side B) | 1 | 0 | 1 | 1 | 2 | 1 | 6 | **Redesign.** A dash slash; "pursuit" pursues nothing. |
| Blink (up B) | 2 | 2 | 2 | 2 | 2 | 3 | 13 | Eight directions and a punishable endpoint; keep. |
| Fan of Knives (down B) | 0 | 0 | 1 | 1 | 2 | 2 | 6 | **Redesign.** A get-off-me ring with no follow-through. |
| Heel Blade (back air), Pursuer (forward air) | 1 | 1 | 2 | 2 | 2 | 1 | 9 | Fine. |

### Rifleman (up special only; bear, blaster and trap are in #111, #117, #114)

| Move | D | M | R | RR | C | W | Total | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Recoil recovery (up B) | 0 | 0 | 0 | 1 | 1 | 2 | 4 | **Redesign.** Fixed launch with 21 frames of intangibility: no route, no answer but waiting. |
| Down tilt (Archer's timing, more damage) | 1 | 1 | 1 | 2 | 2 | 1 | 8 | Fine for a sample normal. |

### Illidan (Mana Burn is #116)

| Move | D | M | R | RR | C | W | Total | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Parry Step (side B) | 1 | 1 | 3 | 2 | 2 | 2 | 11 | A real counter; keep. |
| Wing Ascent (up B) | 0 | 0 | 0 | 1 | 1 | 2 | 4 | **Redesign.** A fixed 30-a-frame rise; the owner's tentative glide fits here. |
| Immolate (down B) | 0 | 1 | 2 | 2 | 2 | 2 | 9 | **Redesign.** Tom asked for "shine-like"; a shine that cannot be jump-cancelled is the dull half of the shine. |

## Shared mechanics the redesigns add

These are kit data, so each fighter states which it uses:

- **Branches after the press.** A running special lists follow-ups, each with
  a frame window and the input that takes it: special, attack or shield. The
  first matching branch replaces the rest of the action (smashcraft:ts/src/game/sim/heroSpecials.ts).
  A follow-up can turn the fighter to the held stick when it starts.
- **Travel that passes bodies but stops at a raised shield.**
- **Relocation:** a motion frame that moves the fighter to its placed object,
  or to just behind a marked opponent.
- **Returning projectile:** flies out, then back to its owner; a second press
  of the same special calls it back early.
- **Statuses from strikes:** a strike can apply the same statuses a
  projectile can (a mark).

## Blademaster (#124)

Identity kept: spacing and whiff punishment, weak at range. The redesign
gives him Warcraft's two tricks: Wind Walk's backstab and Mirror Image's
second body.

### Side B: Wind Walk (picked)

18 mana. Frames 1–7: he fades (translucent, never invisible); frames 8–31:
he walks 0.09H a frame (2.2H in all), passing through bodies but stopping at
a raised shield. From frame 10 to 31:

- **Attack: Backstab.** A slash, active on its frames 6–8, 12% EDGE at 40°,
  ending on its frame 28. The stick held at the press picks the side: held
  back, he turns and slashes behind, so walking through the opponent and
  slashing back is the cross-up, the slash in front the straight read.
- **Special: Step out.** The walk stops and the action ends 8 frames later:
  the feint into grab or shield.
- **Nothing:** the walk ends on frame 31 and he recovers to frame 44.

In the air it travels once per airtime and ends helpless, Backstab included.

Counterplay: the 7-frame fade is the cue; no intangibility, so any hit stops
it; a raised shield stops the walk and blocks both slash sides, and the
Backstab is punishable on shield; a jump over the walk leaves him in 13
frames of recovery. Reward 12% and an edge launch against 18 mana.

Rejected: a hold-to-travel Shadow Sneak (distance by charge). It needs a held
special input the controls don't carry, and the distance read is weaker than
the side read.

### Down B: Mirror Image (picked)

15 mana. Frames 1–7 a tell; frame 8 leaves an **image** where he stood (a
placed object with 1 durability: any hit or projectile shatters it; it lasts
150 frames) and he steps 1.0H back (down held with a side: toward that side)
over frames 8–13; the action ends on frame 24.

**Swap** (down special while the image stands, no mana): frames 1–5 the image
flashes; frame 6 he swaps to the image's place; a slash on frames 8–10 at 10%
EDGE 40° facing the way the image faces; ends on frame 30. The image is gone.

Counterplay: the image is a fixed, visible anchor: stand by it and hit the
flash, or break it with any hit to deny the swap; the slash is punishable on
shield. Reward: a second position to threaten from, a disengage that keeps
pressure, and an edge-guard (leave the image at the ledge, swap there).

Rejected: an image that attacks on its own (an autonomous clone is a second
fighter's worth of pressure for 15 mana; the roster forbids autonomous clone
attacks).

## Mountain King (#125)

Identity kept: compact heavy, close reads, poor chase. The redesign gives him
the bait and the thrown hammer.

### Down B: Thunder Clap, charged (picked)

20 mana. Frames 1–9 he raises the hammer; frames 10–49 he holds the charge.

- **Special in frames 10–29: Clap.** Slam on its frame 4–7: the ring of
  ±0.85H at 9% LAUNCH 70°; ends on its frame 28.
- **Special in frames 30–49, or nothing (slams on frame 50): Thunder Clap.**
  Slam on frames 4–7 after the press (53–56 when it runs out): the ring at
  12% LAUNCH 70°, plus two ground waves, one each way, 0.10H a frame for 24
  frames (about 2.4H past the ring), 7% LAUNCH 75°; ends 28 frames after the
  slam.
- **Shield in frames 10–49: Hold.** The charge is dropped and the action
  ends; a held shield raises next frame. The bait.

The air form keeps its under-hammer swing.

Counterplay: no armor at any point, so a hit during the charge stops it; a
jump clears the ring and the waves; the waves are reflectable. The charge is
a tell, and the shield-cancel is the mixup: the defender who jumps on the
tell meets a shield and an up air out of it.

### Neutral B: Storm Bolt, returning (picked)

8 mana. Thrown on frame 20 as now (0.12H a frame). After 45 frames it turns
and flies back toward his body at 0.14H a frame until he catches it or 90
frames pass. Pressing neutral special while it flies **calls it back** at
once (a 10-frame gesture). 5% LAUNCH 65° both ways: on the way back it
launches toward Mountain King. One bolt; it ends on any
hit, shield or reflection.

Counterplay: the return flies the line between the hammer and Mountain King,
so leaving that line avoids it; shield and powershield answer both legs, and
a reflected bolt is lost to him until it expires.

### Up B: Thunder Leap with Hammerfall (picked)

The leap as now. **Special in frames 16–28: Hammerfall.** He hangs for 3
frames, then plunges at 0.16H a frame with the hammer under him: 12% SPIKE
against airborne targets, 10% at 55° against grounded ones. Landing ends it
with 24 frames of landing lag; ending airborne leaves him helpless.

Counterplay: the plunge is straight down, so a defender not under him is safe
and punishes the 24-frame landing; offstage, a plunge is a self-destruct. It
gives the edge-guarder a real guess: drift to the ledge or crash on the
stage.

## Warden (#126)

Identity kept: light, mobile precision, punishable blink. The redesign makes
her the hunter: she marks, then pursues.

### Neutral B: Shadow Strike marks (picked)

5 mana, the same slow dagger. A body hit now **marks** for 180 frames (the
poison deals 1% every 60 frames, three in all); the mark shows on the target.

### Down B: Fan of Knives marks (picked)

18 mana, the same radial strike; every fighter it hits is marked as Shadow
Strike marks.

### Side B: Shadow Pursuit (picked)

15 mana. With no marked opponent within 2.5H, it is Pursuit Lunge as now.
Against a marked opponent in range:

- frames 1–14 a tell (the mark flares on the target);
- frame 15 she appears just behind the target, facing it, and the mark is
  spent;
- a slash on frames 18–20, 10% EDGE at 35°; ends on frame 40.

Counterplay: the mark is visible for its whole 180 frames, and the 14-frame
flare is inside #69's 15-frame reaction floor for a single choice: shield (the
slash is punishable on shield), attack behind (a back air or a turnaround),
or move away so she appears behind an empty spot. Getting hit by Shadow
Strike or Fan of Knives is the defender's real mistake; she can't mark from
nothing.

Rejected: a marked Blink (up special to a marked target). It would make her
recovery depend on the opponent's position on stage and skip the edge-guard.

## Rifleman (#127)

### Up B: Recoil Shot, aimed and two-stage (picked)

Cooldown as now. The stick held through frame 4 picks where he flies, at 30
a frame: straight up with no side (as now), diagonally up with a side, level
with down and a side. On frame 4 the recoil shot fires the opposite way. The
stick picks the flight rather than the shot, so holding toward the stage
always heads home. He is intangible on frames 4–10 (was 4–24).

**Second shot:** special on frames 12–24 fires again, the newly held stick
picking the flight the same way, at 22 a frame; he is then helpless at the action's end, as he is without it. Each
shot is a real projectile, so the gun is also the edge-guard answer: shoot
down-back into the fighter waiting at the ledge.

Counterplay: two short routes instead of one long safe one; the gun shows
each direction; intangibility now ends before the second shot, so the
edge-guarder hits the second shot's path.

## Illidan (#128)

### Down B: Immolate, jump-cancellable (picked)

As now, plus: from its frame 4 (its first active frame) a jump press cancels
it into a jump, as Fox's and Falco's reflectors do. The 24-frame cooldown
stays, so there is no multishine. Grounded it is the shine-into-jump game
(jump-cancelled immolate into aerials, or into a wavedash); in the air the
spike can be jump-cancelled into a second jump.

Counterplay: the hitbox is the same 4 frames, and the cooldown means the
second immolate is 24 frames away: a shield on the first hit wins.

### Up B: Wing Ascent with a glide (picked)

The rise as now. **Jump in frames 16–28: Glide.** He spreads his wings and
glides forward at 9 a frame, sinking 1.5 a frame; stick up holds the line
(speed 7, sink 0.5), stick down dives (speed 11, sink 4). The glide lasts up
to 90 frames. **Attack during the glide: wing slash**, 8% at 45°, active on
its frames 4–7; ends helpless. A glide that runs out, or lands, ends as the
ascent does: helpless in the air, landing lag on the ground.

Counterplay: the glide is slow and visible, so the edge-guarder reads its
line and meets it; the slash is the bail-out that covers the front only.
Rejected: a held-special glide, because the controls carry no held special.

## What changes for the computer

Each fighter's gameplan (#105) keeps using the moves through the same special
inputs; the new branches are taken only where a gameplan names them.
