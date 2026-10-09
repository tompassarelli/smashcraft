# Drills and multi-hit aerials

How platform fighters build multi-hit aerials, why drill down airs are hard
to escape at low percent, and how Smashcraft's drills and multi-hit aerials
work (#152). Retrieved 2026-10-07.

## Reference facts

### Melee

Frame data from the one corpus, smashcraft:references/melee-frame-data/
(`records.jsonl` from meleeframedata.com, hitbox frames from libmelee's
`framedata.csv` in `libmelee.jsonl`):

| Down air | Hitbox frames | Damage | Total | Landing lag (L-cancelled) |
| --- | --- | --- | --- | --- |
| Fox | 5–6, 8–9, 11–12, 14–15, 17–18, 20–21, 23–24: seven hits, one frame apart | 3 (2 late) | 49 | 18 (9) |
| Peach | 12–13, 18–19, 24–25, 30–31: four hits, four frames apart | 3 | 39 | 15 (7) |
| Pikachu | 14–26, one hitbox | 12 | 57 | 40 (20) |

Melee's Pikachu down air is a single spinning hit, not a drill; Fox's and
Peach's are the reference drills.

- **Crouch cancel.** A fighter hit in `Squat` or `SquatWait` takes
  `kb_squat_mul` (0.67) of the knockback
  (melee:src/melee/ft/kinds/ftCommon/ftCo_Damage.c, `ftCo_Damage_CalcKnockback`)
  and less hitlag; holding down for automatic SDI then keeps it grounded
  ([defense](melee/defense.md#influence-on-knockback)). A hit removes the
  crouch, so only the first hit of a string is cancelled.
- **Why Melee drills are risky.** Each drill hit is weak and launches at a
  fixed angle, so a crouch-cancelled or ASDI-down victim stays on the floor
  with little hitstun and acts before the attacker's landing lag ends.
- **SDI.** Every hit's hitlag admits SDI, so a long multi-hit gives the
  defender many chances to leave it before the final hit
  ([techniques](melee/techniques.md#sdi-teleports)).

### Ultimate

From ultimateframedata.com, all 88 fighter pages, aerials classified as
multi-hit when the page lists more than one hit start or a rehit rate (this
over-counts a few moves whose second start is a sweetspot, such as Marth's
down air):

| Aerial | Multi-hit | Most common | With a landing hit |
| --- | --- | --- | --- |
| Neutral air | 34 of 87 | 2 hits (14); 4–8 hits (13); rehit (6) | 2 |
| Forward air | 21 of 86 | 2–3 hits (12) | 3 |
| Back air | 12 of 87 | 3 hits (5) | 3 |
| Up air | 24 of 88 | rehit (9); 2 hits (8) | 0 |
| Down air | 21 of 88 | 2–13 hits | 18 |

67 of 88 fighters have at least one multi-hit aerial; 48 have a multi-hit
neutral or forward air. Examples:

- **Two-hit neutral airs**, a weak hit that keeps the target close and a
  launcher: Captain Falcon 4% (frames 7–8) then 6% (13–15); Marth, Lucina,
  Roy and Chrom 6–7 then 15–21 (Lucina 4.2% then 8.5%).
- **Longer neutral airs**: Falco four hits (3/6/10/17), Pikachu four
  (3/9/15/21), Mewtwo six, Pit eight.
- **Up airs**: Fox two kicks, 5% (9–10) then 10% (12–13); Peach two;
  Mega Man, Samus and Sheik rehit.
- **Drills keep their hits and gain landing hits**: Fox seven hits
  (5–23, 1.4% each, 3% final) plus a landing hit, landing lag 17; Kirby six
  plus a landing hit; Peach four hits (12/18/24/30) with no landing hit,
  landing lag 8; Pikachu's down air stays one meteor hit (13%) with a
  landing hit.
- **Autolink.** Most of Smash 4's and Ultimate's aerial multi-hits launch at
  the special 367° angle: the victim is sent toward the hitbox's centre
  plus the attacker's own velocity
  ([SmashWiki: Autolink angle](https://www.ssbwiki.com/Autolink)), so they
  stay together between hits. Ultimate has no crouch cancel against them.
  Its multi-hits also carry per-hitbox SDI multipliers, some raised, such as
  Piranha Plant's up special at 3 and 3.5
  ([SmashWiki](https://www.ssbwiki.com/Piranha_Plant_(SSBU)/Up_special)).

## Smashcraft's rules

- **Rehit by window.** A contact may hit a target once per window; a later
  window may hit it again (smashcraft:ts/src/game/sim/attacks.ts). A
  multi-hit gives hit *k* window *k*; `multiHit` in
  smashcraft:ts/src/game/sim/heroes/multiHit.ts builds them.
- **Link hits.** Every hit but a multi-hit's last is a link hit: zero
  growth, so its launch is its base at every percent and weight, and its
  hitstun covers the gap to the next hit, even crouch-cancelled. An
  airborne target struck by one also takes the attacker's own velocity
  (`carry` in smashcraft:ts/src/game/sim/hitRegions.ts, applied in
  contacts.ts): Smashcraft's form of the autolink angle. Grounded targets
  are held on the floor by a downward link.
- **Drills.** An authored `fall` holds the attacker's vertical speed over
  attack frames, replacing gravity and fast fall; horizontal air drift and
  stick control persist through every aerial, as in Melee (Tom, 0.0.103); a `landingHit` turns landing during the active frames into a
  grounded continuation of the same attack instead of landing lag, so its
  hits keep their windows (smashcraft:ts/src/game/sim/down.ts).
- **SDI stays the answer.** Bounded SDI allows 12 Melee units per hit and
  24 per string ([gameplay design](../gameplay-design.md#bounded-sdi)), so
  every new multi-hit is shaped so that a defender who smash-DIs away
  leaves it before the last hit. Crouching and holding down are not an
  answer: link hits outlast a crouch-cancelled first hit, and each
  drill's ending tumbles or leaves the attacker ahead.

## The roster's multi-hits

Frames count from one, as the [roster](roster.md) does.

| Fighter, move | Hits (frames, damage) | Link | Ending | Risk |
| --- | --- | --- | --- | --- |
| Blademaster down air, Bladestorm | 10–11, 13–14, 16–17, 19–20, 22–23 (2 each); plunge 25–34 (2) | flanks pull in; keeps air drift, hangs at 1.5 units a frame, then plunges at 14 | landing hit 4, fixed 90 knockback at 80° (tumbles at any percent); 12-frame landing | most rewarding; shielded, he lands 15 frames and is shield-grabbed |
| Warden down air, Falling Knives (Fan of Knives in miniature) | 7, 9, 11 (2 each), 13 (3) | drags down; falls at 9 units a frame | none; landing lag 10 | low reward, safe: she acts first on hit, sets up a grab, or her Fan of Knives mark into Shadow Pursuit |
| Shadow Hunter down air, glaive drill | 9–10, 12–13, 15–16, 18–19 (2 each) | keeps air drift while falling at 3 units a frame | fling 4 at 25°, base 65 (tumbles at any percent) toward the ledge; landing lag 14 | positioning and edge-guarding, not a combo starter |
| Blademaster neutral air, Blade Wheel | 7–9 (3), 13–15 (6) | first turn pulls in | second, tighter turn launches at 50° | like Falcon's and Marth's |
| Dreadlord neutral air, Batwing Turn | 7–8, 10–11 (2 each), 14–16 (5) | wing beats drag along | launches at 50° | |
| Lich neutral air, Frost Halo | 9–11, 13–15, 17–19 (2 each), 21–22 (4) | a ring that holds a target in place; nothing at its centre | bursts outward at 50° | long, so it is a trap more than an approach |
| Warden up air, Sky Crescent | 5–6, 8–9 (2 each), 11–13 (5) | lifts with her | launches at 85° | the juggle kick, after Fox's and Falco's |

Illidan's two-hit forward air belongs to his kit. Rifleman's
shared up air was already two hits (4 then 8, two frames apart); both link,
but its second hit covers the same box as the first, so one hit's SDI
cannot clear it.

smashcraft:ts/src/game/match/multiHitAerialContracts.tests.ts plays each
through the match step with scripted inputs: every hit connects in order at
0, 50 and 100%; the drills' endings; a shield grab punishing a shielded
Bladestorm; SDI away escaping each new multi-hit before its last hit; and a
crouching victim against each drill compared with Dreadlord's single-hit
down air.

## Hypotheses

- Values are provisional and original; Melee and Ultimate rows are evidence
  for relations (hit spacing, landing hits, link-then-launch), not templates.
- The test positions are chosen contact setups, not every spacing; a target
  struck at a drill's edge may fall out early, which is intended.
