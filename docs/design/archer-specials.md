# Archer's hippogryph specials

Archer's up and down specials share one hippogryph. Owner direction (Tom,
6 Oct 2026): keep the hippogryph at the core, but make both moves far more
expressive. The move that ran before this design was a fixed 24-frame mount
rise into helpless fall (up) and a backward hop with one swoop through the
gap (down): no decision after the press, nothing for an edge-guarder to read.

Numbers are provisional authoring values, not measured balance. Source:
smashcraft:ts/src/game/sim/specials.ts and smashcraft:ts/src/game/sim/summons.ts.

## What makes these moves expressive elsewhere

| Fighter (game) | Move | What it teaches |
| --- | --- | --- |
| Snake (Brawl, Ultimate) | Cypher | Letting go early by attacking, pressing down or air dodging turns the drone into an upward 6% projectile and leaves Snake able to act; he can't ride again until he lands ([SmashWiki](https://www.ssbwiki.com/Cypher)). A recovery with an actionable bail-out and a hitbox left behind. |
| Steve (Ultimate) | Minecart | Jumping out sends the cart on as a hitbox: the vehicle outlives the rider. |
| Pit (Ultimate), Inkling (Ultimate) | Power of Flight, Super Jump | The route is chosen and bent in flight, so the edge-guarder must guess high or low. |
| Sheik, Marth (Melee) | Vanish, Dolphin Slash | Recovery mixups come from direction and timing, not invincibility. |
| Rosalina (Ultimate) | Luma | A companion placed away from the fighter is commanded back through the opponent; hitting the fighter's side of the pair breaks the setup. |
| Kragg, Maypul (Rivals of Aether) | Rock pillar, Mark and Lily | A persistent object or mark sets up a later, chosen follow-up; the second press is the read. |
| Clairen, Etalus (Rivals) | Plasma field, ice | Stage control: a zone the opponent must route around. |

Shared lessons: a second decision after the press, a visible setup the
opponent can see and answer, a cost for the setup (lag, a spent resource),
and a recovery whose safest route still has a guess in it.

## Up special: Hippogryph Ride

**Alternative A, steerable ride with a leap-off (picked).** Archer whistles
and hovers for 5 frames while the hippogryph swoops under her, then rides
for 35 frames (frames 5–39). Up with a side at the press starts the ride
angled toward that side; plain up starts straight. Through the ride:

- **Steer:** the stick bends the ride 1.0 a frame horizontally, up to 12 a
  frame either way.
- **High or low route:** the ride rises 12 a frame; down held flattens it to
  4 a frame, a long low line to the ledge.
- **Ride out:** at frame 40 the hippogryph leaves and Archer falls helpless,
  as before. Most distance, no options.
- **Leap off:** jump from frame 12 to 39 springs Archer off (rising 14) with
  her aerials and air dodge available, but no jump and no second ride until
  she lands, catches a ledge or is hit. The hippogryph flies on along the
  ride for 18 frames as an upward strike: 6%, 80°, base 30, growth 80, so it
  covers her bail-out from an edge-guarder above.

Riding uses the hippogryph wherever it is: a perched or swooping hippogryph
comes to carry her, ending that down-special setup. The recovery is never
locked out by the down special.

**Counterplay.** No intangibility at any point. The 5-frame hover is the
interception window; any hit knocks her off the mount. The ride rises
slower than her jumps (12 a frame against 22), so an edge-guarder sees the route; the high
and low routes and the leap-off are the guess the edge-guarder must make.
Leaping off gains less height than riding out, and the bird's strike covers
only above and ahead of the ride.

**Alternative B, charged ride with a talon dive (rejected).** Hold special
to charge the height (Etalus-style), then attack during the ride for a
downward talon spike. Rejected: charging on a recovery is a static read,
the spike out of a recovery gives a free edge-guard with no commitment, and
it adds a fifth Archer kill option while her identity is distance.

Frame data: hover 0–4, ride 5–39, helpless from 40; leap-off 12–39; ride
cooldown 90 frames; once per airtime.

## Down special: Hippogryph Call and Dive

**Alternative A, call to a perch, then dive (picked).** One hippogryph,
two presses.

- **Call** (no hippogryph out): Archer whistles, a 24-frame action. The
  hippogryph enters 150 behind her, 40 above her feet, and swoops forward at
  28 a frame for 18 frames, striking each fighter it passes once (8%, 45°,
  base 22, growth 100). It then **perches** where the swoop ended, about 350
  ahead, for up to 240 frames. Down with a side keeps the old **disengage**:
  Archer faces that side and hops back from it (18 back, 16 up) while the
  hippogryph swoops that way. Plain down stands her ground.
- **Dive** (hippogryph perched): Archer points, a 16-frame action. On frame
  6 the hippogryph leaves its perch and dives at where Archer is, arriving
  18 frames later and overshooting 6 more: 9%, a low 20° launch along its
  path, base 26, growth 95. Archer runs behind an opponent or stands at the
  ledge, then dives the hippogryph through them: a sandwich in neutral, a
  line through the recovery path when edge-guarding.
- One hippogryph: no new call while it is flying; the dive's press puts the
  down special on a 60-frame cooldown, the call's on 24.

**Counterplay.** The perch is visible and the dive always flies at Archer,
so leaving the line between them avoids it, a shield blocks it, and its
arrival is 24 frames after the press. Hitting or grabbing Archer scares the
hippogryph off its perch: pressure on Archer removes the setup, and a hit
during the dive's first 5 frames stops the dive. The call's swoop starts
behind her and is a commitment of 24 frames. The perch expires after 4 s.

**Alternative B, a guard stance (rejected).** Down special as a counter:
struck in frames 6–20, the hippogryph swoops behind the attacker. Rejected:
counters are per-fighter (Illidan's parry); Archer plays to her speed and
distance, and a counter asks her to stand still.

## How the two share the hippogryph

The down special's perch is stage control Archer spends when she rides:
offstage, using the ride ends her edge-guard setup, and a perched
hippogryph means her opponent knows the ride will cost it. The ride's
leap-off leaves the hippogryph behind as a strike, so both moves end with
the hippogryph acting on its own.

## Presentation

Existing assets only: the stock hippogryph model (`walk` while swooping or
carrying, `stand` while perched, `attack` while diving or flying on after a
leap-off), and Archer's special-up and special-down clips.
