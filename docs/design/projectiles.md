# Projectiles and their counterplay

Which properties of Super Smash Bros. Ultimate's projectiles players blame for
safe, slow play, how Melee and other platform fighters answer projectiles, and
what players liked. This is a descriptive reference and takes no position;
Smashcraft's rules are in
[gameplay design decisions](../gameplay-design.md#projectiles-and-powershield).
Shield vocabulary (shieldstun, shield advantage, out of shield) is in
[platform-fighter design language](platform-fighters.md); powershield and parry
history is in [modern platform fighters §1](modern-platform-fighters.md#1-perfect-shield-on-release-the-parry).
Retrieved 2026-10-06. Entries marked (secondary) come from news summaries or
search results rather than the primary source or game data.

## The complaint

- **Hungrybox's thread** (26 September 2026; [post](https://x.com/LiquidHbox/status/2103978593005027356)):
  a top reply Tom highlighted says Ultimate's projectiles are too strong and
  make play safe and boring (reported in #98; the reply page needs an X login
  and was not retrieved). EventHubs' summary of the replies names "Snake
  spamming projectiles", "Steve just hiding behind blocks" and DLC characters
  "so overtuned and defensive"
  ([EventHubs, 26 Sep 2026](https://www.eventhubs.com/news/2026/sep/26/hungrybox-smash-painful-truths/)).
- **Zoning as a nuisance.** "Some would rather stay far away and launch lazers,
  fruit, and ballistic missiles at their foes. This tactic is called 'zoning.'
  Many consider it a nuisance"
  ([Inven Global, 23 Feb 2022](https://www.invenglobal.com/articles/16552/zoners-smash-ultimate-tier-list)),
  listing Palutena's Explosive Flame, Snake's grenades and R.O.B.'s Robo Beam
  among others.

## Ultimate's projectile properties

| Property | Ultimate | Effect on the exchange | Source |
|---|---|---|---|
| Shieldstun | 0.8 × damage × t × m × p + 2 with p = 0.29 for projectiles (unless t or m differs from 1) | A blocked projectile holds the defender in shield for very little time, so on-shield advantage is close to the shooter's own lag | [SmashWiki Shieldstun](https://www.ssbwiki.com/Shieldstun) |
| Shield damage | Version 3.0.0 "reduced the power against shields" of some 57 projectile attacks | Projectiles stopped breaking shields; holding shield against them became cheap | [EventHubs, 18 Apr 2019](https://www.eventhubs.com/news/2019/apr/18/here-are-six-big-takeaways-super-smash-bros-ultimates-version-30-patch) (secondary), [SmashWiki Shield](https://www.ssbwiki.com/Shield) |
| Safety by distance | On-shield numbers are often far negative yet unpunishable at range: Min Min's forward smash -32 to -30, Snake's Nikita -19/-14 | The relevant number is whether the defender can reach the shooter before it acts, not the frame advantage alone | [Ultimate Frame Data: Min Min](https://ultimateframedata.com/minmin), [Snake](https://ultimateframedata.com/snake) |
| Lingering and timed objects | Snake's grenade explodes about 2.5 s after the pull and can be cooked; at most two in play; C4 lasts 26.6 s; dropping shield while holding a grenade drops it at Snake's feet | Area denial that persists while the shooter acts again; the shooter's own shield is protected by its explosion | [SmashWiki Hand Grenade](https://www.ssbwiki.com/Hand_Grenade), [Ultimate Frame Data: Snake](https://ultimateframedata.com/snake) |
| Perfect shield | Released on contact (the parry); no reflection. Against a direct projectile it is "strictly worse for punishing … than normal shielding"; against a traditional projectile it "offers an advantage … albeit not as significant"; before 9.0.0 that advantage was 3 frames lower | The timing answer that once sent a projectile back now mostly saves shield frames | [SmashWiki Perfect shield](https://www.ssbwiki.com/Perfect_shield) |
| Parry against projectile pressure | Against Cross, a parry skips 10 frames of shield freeze and 11 of shield drop, "saving at least 21 frames over sitting in shield" | The parry's value against projectiles is getting moving again, not punishing | [Jackie Peanuts, 9 Jan 2019](https://jackiepeanuts.substack.com/p/the-logic-behind-parrying-projectiles) |
| Shield exits | Shield drop 11 frames; minimum shield 3; shield grab +4 frames right after blocking; up special and up smash directly out of shield; jump squat 3 for almost everyone | Approaching through projectiles behind a shield costs the drop lag every time | [SmashWiki OoS](https://www.ssbwiki.com/OoS), [Shield](https://www.ssbwiki.com/Shield) |
| Reflectors | Character moves (Fox's Reflector, Palutena's Counter and others), listed per fighter | Reflection is a character's tool, not a universal answer | [Ultimate Frame Data stats: reflectors](https://ultimateframedata.com/stats) |

## Melee's answers

- **Powershield reflection.** Raising the shield within 2 frames of a
  projectile's arrival reflects it at half damage; against physical attacks the
  window is 4 frames and removes shield damage, at the cost of more pushback
  ([SmashWiki Perfect shield](https://www.ssbwiki.com/Perfect_shield);
  [Melee defence](melee/defense.md); decompilation timing in
  smashcraft:docs/melee-powershield.md). The reflected projectile's damage and
  speed multipliers are part of each reflector's descriptor
  (melee:src/melee/lb/types.h, `ReflectDesc`). SmashWiki notes that humans
  rarely powershield because of "the reaction times and precision usually
  required".
- **Lasers as the reference projectile.** Fox's laser starts on frame 10 and
  ends on 36 grounded; aerial lasers land with no landing lag, so short-hop
  lasers cost little (smashcraft:references/melee-frame-data/records.jsonl,
  `fox` `neutral_b`/`aneutral_b`; Falco 23 and 57, aerial from frame 13).
  Fox's laser has "no knockback or hitstun" and is used "to camp and bring up
  damage" ([SmashWiki Blaster (Fox)](https://www.ssbwiki.com/Blaster_(Fox)));
  Falco's "stuns the opponent in addition to doing damage"
  ([SmashWiki Blaster (Falco)](https://www.ssbwiki.com/Blaster_(Falco))).
- **Shield exits.** Shield drop 15 frames and minimum shield 8, against
  Ultimate's 11 and 3; light shield changes the shield's size and pushback
  ([SmashWiki Shield](https://www.ssbwiki.com/Shield)). Up special and up
  smash out of shield need a jump cancel
  ([SmashWiki OoS](https://www.ssbwiki.com/OoS)).

## Other platform fighters

- **Brawl and Smash 4.** Perfect shield narrowed to 3 frames and "no longer
  reflects projectiles; should a projectile connect during perfect shield
  frames, it will either disappear or rebound off the shield at an angle"
  ([SmashWiki Perfect shield](https://www.ssbwiki.com/Perfect_shield)).
- **Rivals of Aether.** Parrying a projectile reflects most projectiles to the
  sender, and a parried player enters parry stun after its attack completes;
  a projectile already reflected once grants no invulnerability when parried
  again (search summary of the
  [Rivals of Aether system page](https://mizuumi.wiki/w/Rivals_of_Aether/System),
  secondary). Rivals 2 restored shields to "defend against spam with much less
  risk" ([Rivals 2 FAQ](https://rivals2.com/faq)); the parry button and its
  timing are in [modern platform fighters §7](modern-platform-fighters.md#7-parry-as-a-dedicated-button-rivals-rivals-2-nasb-slap-city).

## What players liked

Reception sources are thin and mostly forum posts. The powershield-versus-parry
split (some preferring a reflect that rewards anticipation, others the
release-timed parry that is hard to do by accident) and the call by Ultimate
pros for a stronger parry are collected in
[modern platform fighters §1](modern-platform-fighters.md#1-perfect-shield-on-release-the-parry).
The 2019 parry article argues the parry's value against projectiles is
movement: "immediate dash movement to close distance"
([Jackie Peanuts](https://jackiepeanuts.substack.com/p/the-logic-behind-parrying-projectiles)).
No retrieved source praises Ultimate's projectile safety itself.

## Smashcraft's current projectiles, for comparison

Described, not judged; sources are smashcraft:ts/src/game/sim/projectiles.ts,
specials.ts and shield.ts.

| Fighter | Projectile | Spawn | Flight | Hit |
|---|---|---|---|---|
| Rifleman | Blaster shot (neutral special) | grounded: special frame 9, shoulder height; aerial: frame 14, hip height, cancelled by landing (8 frames of landing lag) | speed 36, 60 frames | flinch without knockback, 3 frames of hitstun per damage: grounded 4 (12), aerial 3 (9) |
| Rifleman | Recoil blast (up special) | frame 4, downward | 8 frames | 5, launches downward |
| Illidan | Mana Burn (neutral special) | frame 16, one out at a time | speed 12, 90 frames, at the shield's centre height | 5, electric, flinch and a stun of 20-80 frames by percent; cancels an opposing traveling projectile ([roster](roster.md#mana-burn-neutral-special)) |

Each fighter holds up to 16 projectiles; a full owner fires nothing. A
raise-timed powershield reflects a projectile during the shield's first 2
frames inside 0.75 of the shield radius, sending it back at 0.7 speed and half
damage; a held shield blocks a projectile that meets the shield circle, and a
projectile that meets exposed body outside the shield hits. Illidan's parry
answers projectiles as well as strikes. Rifleman's bear and trap are summons, not projectiles (smashcraft:ts/src/game/sim/summons.ts).
The [interaction graph](interaction-graph.md) measures each projectile's flight, arrival on a shield, out-of-shield punishes, powershield presses and a standing defender's answers in its projectile situations.
