# Mana

Every fighter has one resource for specials: mana. Tom decided it on
7 Oct 2026 ("mana should be a real resource") and the shape below. Mana is
earned by fighting, spent on specials, and shown over every fighter's head.
Normals, grabs and throws never cost it. The rules live in
smashcraft:ts/src/game/sim/mana.ts and are pinned by
smashcraft:ts/src/game/sim/mana.tests.ts. The bar is in
smashcraft:ts/src/game/ui/manaBar.ts and is tested by
smashcraft:ts/test/mana-bar.test.ts. The numbers are authoring values; the
#105 balance pass measures and tunes them.

## Rules

| Rule | Value |
|---|---|
| Bar | 100 mana, full at the start of every stock. |
| Ground trickle | +1 every 60 frames (1 a second). No wait after spending. |
| Air trickle | +1 every 60 frames (1 a second). |
| No trickle | While shielding (and in shieldstun), held or holding a grab, in hitstun, frozen, asleep or stunned, or during a special. Normals do not stop it. |
| Landing a normal or throw | +1 per whole percent dealt to a body, at most 12 a hit. |
| Perfect shield/parry | +8 once per timed window, including projectile reflection. |
| Taking a hit | +1 per 2 whole percent taken, at most 6 a hit (the comeback share). Any source counts, specials and projectiles included. |
| No gain | From hits on a shield, from pummels, and for the striker of a special's strike or projectile. |
| Spending | The cost is paid once when the special starts. An interrupted special is not refunded. |
| Can't afford | The special does not come out, the input is not spent as an attack, and the bar flashes once for that press. |
| Up specials | Below the full cost, the free weaker form comes out instead, so recovery is never lost. The original three fighters' up specials are free. |

Integers only: points, and a trickle remainder counted in 120ths of a point
(ground +2 a frame, air +2), so the host and Lua32 agree. Both are in the
replay state for every fighter.

### Costs: the tiers

- **Free:** normals, grabs, throws, pummels, and the weaker up special.
- **Cheap (0-10):** neutral specials, the poke you throw in neutral.
- **Standard (12-20):** side and down specials, and full up specials (15).
- **Signature (25 and up):** the spell a player picks the hero for: Death
  and Decay, Divine Shield, Sleep, Hex, the bear. A signature spell must be
  visibly strong on screen: big effect, clear tell, a payoff worth a quarter
  of the bar. A kit review that can't make it strong lowers it to standard.

Hero kits author their costs in their `*Specials.ts` (listed in
[roster.md](roster.md)). Archer, Rifleman and Illidan predate the kit
format. They pay these costs from `originalSpecialCost`, and their per-move
cooldowns still apply:

| Fighter | Neutral | Side | Down | Up |
|---|---|---|---|---|
| Archer | Arrow 3 | Homing arrow 12 | Hippogryph call, or its dive from the perch, 15 | Ride, free |
| Rifleman | Blaster 3 | Bear 25 (signature) | Freeze trap 15 | Recoil, free |
| Illidan | Mana Burn 10 | Fel Rush 12 (branches free) | Immolation 15 | Wing Ascent, free |

The cheap shots cost 3 so that spamming them (a blaster every 20 frames is
9 mana a second) outruns the 1-a-second trickle. Hits keep a pressuring
shooter topped up. Missing drains it.

### Mana Burn

Illidan's neutral special is built on mana (#116, [illidan.md](illidan.md)).
A body hit burns 25 of the target's mana. Illidan gets none of it: Mana Burn
denies, it doesn't steal. Then it stuns for 15 frames, plus up to 45 more in
proportion to how empty the burn leaves the target: 26 frames against a full
bar, 60 against an empty one. The burn lands even on a target immune to the
stun. The next damaging hit ends the stun, and 300 frames of sleep-group
immunity follow. A shield takes neither the burn nor the stun. Against a
fighter who has spent everything, Mana Burn is a real opening. Against one
who has saved, it is a tax. The read is on the opponent's bar.

## The bar

- **Over the head (primary).** A thin segmented blue bar sits over each
  fighter's head, so nobody looks down mid-fight. It has ten segments of
  10 mana and uses the grab-escape meter's frame style and size (0.07 wide,
  0.005 tall). When the escape meter shows, the mana bar stacks just above
  it, 3 thousandths of the screen apart, and never overlaps it.
- **On the HUD plate (reference).** A matching smaller bar sits in the
  plate's mana track.
- **Refusal:** both bars blink red for about three quarters of a second.
- **Gain:** a rise of 3 or more in one update glows the bar briefly. The
  trickle's single points never glow.
- **EX affordability:** EX Neutral, EX Side or EX Neutral + Side beside the bar names the neutral/side casts its current mana can pay. Shield + Special requests EX; its normal cost plus 25 buys one 8% hit of armor on frames 1–6.

The bar's parts hang from its back frame, so following a fighter is one
native call a frame (playable-bot-four: native calls +1.7%, predicted cost
+1.0%).

## Why this shape

The previous rule (regenerate only on the ground after 120 idle frames)
punished the play we want. A fighter who kept fighting never regenerated,
so mana was a start-of-stock budget and specials dried up mid-stock. The
best resources in fighting and action games come back from fighting:

- **Smash Ultimate's Hero** has a 100 MP gauge. It refills 1 a second and
  by 0.8x the base damage of his normal hits, shield damage included. Spells
  cost MP. Kept here: a slow trickle plus damage-earned mana, normals as the
  engine, spells as the spend. ([SSBWiki: MP](https://www.ssbwiki.com/MP))
- **Inkling's ink tank** (150 units) is spent by specials and smashes and
  refilled by shielding with special held. It shows that a visible gauge on
  the fighter is readable, and that refilling should cost the fighter
  something. Here the cost is tempo: no trickle while shielding.
  ([SSBWiki: Ink Tank](https://www.ssbwiki.com/Ink_Tank))
- **Steve** mines materials on the ground and spends them on crafting and
  blocks. A resource earned by staying on stage is a good fit for a stage
  fighter. Here, staying active earns mana while the passive floor remains equal on ground and in the air.
- **Robin's tomes** have durability (Thunder: 20 uses, Thoron 8 at once) and
  recharge only after they run out. The cost should scale with the spell's
  size, as our tiers do. We rejected the lockout: an empty bar here still
  recovers.
- **World of Warcraft's Rage** is generated by dealing and taking damage and
  decays out of combat. **Fury** (Demon Hunter) is built by basic strikes and
  spent on big ones. **Insanity** builds from spells and drains while spent.
  The comeback share is Rage's "taking damage fills it". Normals building
  mana for specials is Fury's builder/spender split.
- **Street Fighter's super meter** fills on attacks landed and, less, on
  hits taken. SF6's Drive gauge drains on use and burns out when empty,
  refilling slowly. The comeback share is capped so a long combo can't fill
  the bar, as SF's is.
- **Guilty Gear's Tension** fills from moving forward and attacking. Its
  Negative Penalty empties it and slows its gain for 10 seconds when a
  player retreats or avoids contact. ([Dustloop: GGST
  Gauges](https://dustloop.com/w/GGST/Gauges)) Our answer to camping is
  milder: shielding stops the trickle, and only landed normals earn the
  big gains.

## Alternatives considered

- **Keep the idle-delay regeneration.** Rejected: it rewards walking away,
  and a fighter in a fight rarely stands still for 2 seconds.
- **Per-move cooldowns for every fighter.** Rejected as the main limit:
  cooldowns are invisible and don't trade between moves. The originals keep
  theirs as move timing rules beside mana.
- **Gain on shield hits (Hero's rule).** Deferred: it makes shield pressure
  pay twice. #105 can add it if pressure fighters starve.
- **A retreat penalty (Guilty Gear's Negative Penalty).** Rejected for now.
  Platform fighters retreat legitimately (ledge, recovery, multi-fighter
  matches), and "forward" is ambiguous with four fighters.
- **Separate resources per hero** (Fury for Illidan, Rage for Pit Lord).
  Rejected: one bar, one rule set, one read. A hero's identity goes in how it
  spends and in kit passives (Illidan's drain on hit), not in a second gauge.
- **Spell hits earning mana.** Rejected: a 20-cost spell that hits for 12
  would cost 8. Normals earn, spells spend.
- **Carrying mana between stocks.** Rejected: a full bar each stock keeps a
  comeback stock dangerous and the bar's state easy to read.

## Ultimates (designed, not built yet)

A separate **ultimate charge**, not mana, for a later issue. It is a match
rule: on for casual, off for competitive, like Smash Ultimate's Final Smash
meter.

- **Filled by skill, never by time:** landing true combos (a longer combo
  fills more), parries and powershields, techs, and KOs.
- **Drains slowly during passive play,** so camping can't bank it.
- **When full:** a high-commitment, readable, dodgeable Warcraft III
  ultimate, never a guaranteed KO. Some are temporary transformations, such
  as Illidan's Metamorphosis. A whiff costs the user (long recovery, charge
  spent).
- **Display:** a thin gold edge along the mana bar, overhead and on the
  plate, filling with the charge. The bar's layout leaves room for it.
  Ultimates draw from the reserved six-object pool in [roster.md](roster.md).
