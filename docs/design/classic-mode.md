# Classic mode

Classic is Smashcraft's arcade ladder: each fighter has a themed route of six
fights that ends at a lore boss, then an ending card. Issue
[#284](https://github.com/tompassarelli/smashcraft/issues/284); the approved
MVP and Tom's boss upgrade are in
[#285](https://github.com/tompassarelli/smashcraft/issues/285) and
smashcraft:docs/design/single-player-modes.md. The tournament opening that
frames it is [#269](https://github.com/tompassarelli/smashcraft/issues/269).
Researched 8 Oct 2026.

The source of truth for the routes is smashcraft:ts/src/game/classic/routes.ts;
smashcraft:ts/src/game/classic/classic.tests.ts checks that every selectable
fighter has exactly one route and that its fifth fight is on its home stage
(smashcraft:docs/design/home-stages.md). Statements marked **Judgement** are
reasoning, not findings.

## How others do it

**Super Smash Bros. Ultimate, Classic.** Every fighter has its own route, a
themed list of opponents and stages, with a bonus stage somewhere along it.
The player picks a starting intensity up to 5.0. It rises with each win, to
9.9 at most: a fast or dominant win ("Nice Play!") adds 0.6 to 1.4, an
ordinary win 0.2 to 0.6, and long fights with heavy damage add less. A
continue costs gold and lowers intensity by 0.7 (a Classic Ticket keeps it),
and any continue caps the run at 9.8. Most routes end with Master Hand on
Final Destination (Crazy Hand joins from intensity 7.0); others end with
Rathalos, Dracula, Giga Bowser, Marx, Galleom or Ganon, each with health to
deplete. Clearing it plays a credits minigame and a congratulations image
themed to the fighter, and shows the score.
([SmashWiki, Classic Mode (SSBU)](https://www.ssbwiki.com/Classic_Mode_(SSBU)),
read 8 Oct 2026.) Reviewers single out the per-fighter themes: "each character
seemingly has a list of opponents and stages that are themed around
themselves" ([Well Played, Dec 2018](https://www.well-played.com.au/super-smash-bros-ultimate-review/)).

**Street Fighter 6, Arcade.** The player chooses 5 or 12 stages, rounds,
time and difficulty. A five-stage ladder has one bonus stage (the
destructible truck), a twelve-stage ladder adds the basketball parry
challenge, and bonus stages can be turned off
([Street Fighter Wiki, Bonus Stage](https://streetfighter.fandom.com/wiki/Bonus_Stage);
[GameFAQs, 12 stages](https://gamefaqs.gamespot.com/boards/358511-street-fighter-6/80788064)).
Fights are mostly random except the story fights, usually the last one. Each
character's story is told in voiced still illustrations, and finishing it
unlocks that ending's artwork
([Steam discussion](https://steamcommunity.com/app/1364780/discussions/0/4337609007231330086/?ctp=2)).
Reviewers found the stories thin ("won't win any awards", Tom's Guide, 2023),
and one player in three finishes Arcade once (Steam 35.5%,
smashcraft:docs/design/single-player-modes.md).

**Tekken 8, Arcade Battle and Character Episodes.** Arcade Battle is a pure
ladder: "you pick a character and face eight opponents, back to back", with no
cinematic ending. Character Episodes are "a quick, arcade-style story mode
with each character, complete with opening story set-ups, a few matches with
key characters, and closing cinematics"
([Seasoned Gaming, Jan 2024](https://seasonedgaming.com/2024/01/29/review-tekken-8-the-peoples-champ/)).
On Steam 31.4% clear Arcade Battle and 14.1% finish five Character Episodes.

What Classic takes from them:

- From Ultimate: a themed route per fighter, a chosen starting difficulty that
  climbs, a continue that lowers it, and a boss with health instead of
  stocks.
- From SF6 and Tekken: a short ladder (five or six fights, about ten
  minutes), a rival fight that tells the fighter's story, and a short ending
  for that fighter.
- Not taken: bonus stages, scores and unlocks (not required by #284).

## Route format

Every route is six fights:

| Fight | Opponents | Stage | Stocks (player / each rival) | Time | Named opponent and tier |
| --- | --- | --- | --- | --- | --- |
| 1 | one lore rival | the rival's stage | 1 / 1 | 3:00 | Vale, start tier |
| 2 | one lore rival | the rival's stage | 1 / 1 | 3:00 | Ember, start tier |
| 3 | one lore rival | the rival's stage | 1 / 1 | 3:00 | Flint, start + 1 |
| 4 | two lore rivals together | the first rival's stage | 2 / 1 | 3:00 | Kite and Wren, start + 1 |
| 5 | the arch-rival | the fighter's home stage | 2 / 2 | 4:00 | Rook, start + 2 |
| 6 | the lore boss | the boss's stage, hazards off | 2 / boss health | 5:00 | (boss health from start + 2) |

Rival fights keep their stage's hazards; items are off. A rival's stage is
usually its own home stage, so a route visits the places of its story; a
route may move a fight to a stage its line names (Gryphon Aerie stands in for
Theramore and Lordaeron's human towns). Each fight opens with the first
rival's line as a transmission, and the result says what the next press does.
Each fight is one data entry of the configured-match engine (below).

## Difficulty curve

The player chooses a starting difficulty at fighter selection, one of the
computer players' five tiers (Rookie, Beginner, Intermediate, Advanced,
Expert; smashcraft:docs/design/cpu-profiles.md); the default is Beginner. The
fights climb from it: start, start, +1, +1, +2, capped at Expert. A loss
offers a continue: the same fight again, with the whole run one tier easier
(not below Rookie). Back at any result ends the run. **Judgement:** whole
tiers instead of Ultimate's 0.1 steps, because the tiers are the authored
difficulty Smashcraft has and each one plays visibly differently.

## Boss rules

Tom's upgrade (#285): three bespoke lore bosses instead of a scaled-up roster
fighter, each with its own deterministic attack pattern, and every route ends
at one of them.

- **What a boss is.** Like Master Hand, a boss is not a fighter. It hovers
  over the stage, takes damage from the player's strikes and projectiles, and
  has health instead of stocks: 210 (Lich King), 240 (Archimonde) or 270
  (Kil'jaeden) at Rookie, plus 30 for each tier above. The player has two
  stocks and five minutes; the boss wins if either runs out.
- **Deterministic pattern** (stage rule 13, #274, in
  smashcraft:docs/design/stage-art.md). Each boss repeats a fixed timetable of
  strikes, starting 1.5 s after GO!. Every strike has a tell (35 to 55
  frames: the boss's spell animation, a warning mark on each area and its
  name in the notice line), then its active frames, then a rest. Timing is a
  function of the match clock alone; an aimed strike takes the player's x on
  its tell's first frame and never follows afterwards. Nothing reads a random
  draw. Shields block strikes; dodges pass through them.
- **Native assets.** Each boss is a stock or already-imported model drawn
  scaled up behind the fighters' plane, with stock spell art for its tells and
  hits. No new imports: the Lich King uses the Lich King fighter's existing
  model (`war3mapImported\LichKing2.mdx`, already in the map) at 3.2×;
  Archimonde is Warcraft's own Archimonde model (`Units\Demon\Warlock\Warlock`)
  at 2.6×; Kil'jaeden has no Warcraft III model, so he is the same eredar
  model at 2.8×, tinted red (**Judgement**: the closest stock body).

| Boss | Stage | Strikes, in order (tell / active / rest frames) | How to beat it |
| --- | --- | --- | --- |
| The Lich King | Frozen Throne | Howling Blast: a frost column at the player (45/10/35); Remorseless Winter: a low sweep across the deck (50/12/40); Frostmourne's Cleave over the right half (40/8/45); Howling Blast again; the Cleave over the left half (40/8/60) | Walk out of the column; jump the sweep; stand on the half the Cleave leaves |
| Archimonde | Nordrassil | Rain of Fire on four columns (50/14/20), then on the three between them (50/14/35); Finger of Death at the player (35/6/45); Doom's Shockwave along the deck (45/10/60) | Stand between the first rain's columns, then move; side-step the finger; jump the wave |
| Kil'jaeden | Tomb of Sargeras | Three Shadow Spikes, each a column at the player (40/8/12, 40/8/12, 40/8/35); Legion Lightning across the air above the deck (45/12/40); Darkness around himself as he descends (55/14/70) | Keep moving through the spikes; stay grounded for the lightning; get out from under him for Darkness |

The Lich King ends the routes of fighters whose story runs to Northrend and
Arthas; Archimonde those of Reign of Chaos's battle for Hyjal; Kil'jaeden
those tied to Illidan's bargain, the Broken Isles and the Legion's demons.

## Ending format

Clearing the boss shows the ending card over the result: the fighter's card
portrait, its name as the speaker in Warcraft's transmission colours, two or
three lines in the fighter's voice, and the results line:
`Time 9:42 · 312% damage taken · 1 continue · finished on Beginner`. Time is
match time across every fight, lost ones included; damage taken counts every
increase in the player's damage. The next press returns to fighter selection
with the menu's settings as they were. Not required: per-fighter cutscenes,
voice acting, unlocks, a bonus stage, saved records.

## The tournament opening

#269 builds a 30-60 second opening the first time Classic starts.
smashcraft:ts/src/platform/shell/classicOpening.ts is where it plays: before a
run's first fight loads, from the same synchronized event, calling the fight's
start when it ends.

## Configured matches

Classic and Lore Battles share one engine
(smashcraft:ts/src/game/classic/runState.ts and configuredMatch.ts): a
configured match is one data entry naming the player's fighter (or the one
chosen), the opponents with their named computer and tier, the stage, rule
changes from the existing settings (stocks, the player's stocks, time,
starting damage, hazards), a win condition (KO, survive the clock, KO within
the clock, defeat the boss), the boss and its health, whether it is the
list's last entry, and the transmission before it. The engine puts an entry
into the ordinary settings and stage load, starts its fighters with the
entry's stocks and damage, judges the win condition, and keeps the run's
time, damage taken and continues as synchronized match state. A run restores
the menu's settings when it ends. Lore Battles (#305) is a list of entries
played through the same calls; classic.tests.ts plays one such entry, built
from data alone, to its survive condition.

`-dev classic NAME` starts a fighter's run from fighter selection and `-dev
classic boss NAME` its final battle, for native captures.

## Routes

| Fighter | 1 | 2 | 3 | 4 (team) | 5 (home) | Boss | Story |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Archer | Peon, Durotar Skies | Blademaster, Durotar Skies | Lich, Naxxramas | Pit Lord + Dreadlord, Hellfire Citadel | Illidan, Nordrassil | Archimonde | A Sentinel holds Ashenvale against orc, Scourge and demon until Archimonde climbs Mount Hyjal. |
| Rifleman | Peon, Durotar Skies | Shadow Hunter, Durotar Skies | Dreadlord, Stratholme | Lich + Forsaken Paladin, Naxxramas | Mountain King, Gryphon Aerie | The Lich King | An Ironforge marksman follows Muradin north and finds Frostmourne's master waiting. |
| Illidan | Dreadlord, Stratholme | Murloc, Tomb of Sargeras | Kael'thas Sunstrider, Hellfire Citadel | Warden + Archer, Tomb of Sargeras | Pit Lord, Hellfire Citadel | The Lich King | Kil'jaeden's deadline runs short: Illidan takes Outland, then races Arthas up Icecrown. |
| Blademaster | Rifleman, Gryphon Aerie | Jaina Proudmoore, Gryphon Aerie | Mountain King, Blackrock | Archer + Warden, Nordrassil | Pit Lord, Durotar Skies | Archimonde | A Burning Blade swordsman cuts across Kalimdor to repay the demon blood of Mannoroth. |
| Mountain King | Shadow Hunter, Durotar Skies | Blademaster, Durotar Skies | Dreadlord, Stratholme | Lich + Forsaken Paladin, Naxxramas | Rifleman, Blackrock | The Lich King | Muradin Bronzebeard sails to Northrend after Mal'Ganis, toward the sword that betrays him. |
| Warden | Murloc, Tomb of Sargeras | Archer, Nordrassil | Kael'thas Sunstrider, Hellfire Citadel | Pit Lord + Dreadlord, Hellfire Citadel | Illidan, Tomb of Sargeras | Kil'jaeden | Maiev hunts her prisoner from the Broken Isles into the Tomb, where his master Kil'jaeden waits. |
| Lich | Rifleman, Gryphon Aerie | Forsaken Paladin, Stratholme | Jaina Proudmoore, Gryphon Aerie | Archer + Thrall, Nordrassil | Sylvanas Windrunner, Naxxramas | Archimonde | Kel'Thuzad spreads the plague and opens Dalaran's gate for Archimonde, who has no further use for him. |
| Forsaken Paladin | Peon, Durotar Skies | Blademaster, Durotar Skies | Lich, Naxxramas | Sylvanas Windrunner + Lich, Naxxramas | Dreadlord, Stratholme | The Lich King | A risen paladin returns to Stratholme to judge the prince who purged it. |
| Dreadlord | Forsaken Paladin, Stratholme | Mountain King, Blackrock | Illidan, Hellfire Citadel | Sylvanas Windrunner + Lich King, Naxxramas | Lich, Stratholme | Kil'jaeden | Mal'Ganis plays every side of the tournament, until Kil'jaeden comes to collect. |
| Shadow Hunter | Murloc, Tomb of Sargeras | Mountain King, Blackrock | Jaina Proudmoore, Gryphon Aerie | Lich + Dreadlord, Naxxramas | Blademaster, Durotar Skies | Archimonde | A Darkspear shadow hunter carries the voodoo of the Echo Isles to the summit of Hyjal. |
| Pit Lord | Peon, Durotar Skies | Cairne Bloodhoof, Durotar Skies | Kael'thas Sunstrider, Hellfire Citadel | Warden + Archer, Tomb of Sargeras | Illidan, Hellfire Citadel | Kil'jaeden | Magtheridon holds Hellfire Citadel for the Legion until Kil'jaeden judges him a failure. |
| Beastmaster | Peon, Durotar Skies | Chen Stormstout, Durotar Skies | Cairne Bloodhoof, Durotar Skies | Jaina Proudmoore + Rifleman, Gryphon Aerie | Thrall, Durotar Skies | Kil'jaeden | Rexxar wanders from Durotar to the Broken Isles, where the Legion's master meddles with the beasts. |
| Lich King | Mountain King, Blackrock | Jaina Proudmoore, Gryphon Aerie | Sylvanas Windrunner, Naxxramas | Illidan + Kael'thas Sunstrider, Hellfire Citadel | Forsaken Paladin, Frozen Throne | Kil'jaeden | Arthas takes the Frozen Throne, then turns its power on the demon who forged the first Lich King. |
| Thrall | Rifleman, Gryphon Aerie | Blademaster, Durotar Skies | Cairne Bloodhoof, Durotar Skies | Jaina Proudmoore + Archer, Nordrassil | Beastmaster, Durotar Skies | Archimonde | The Warchief leads the Horde to Kalimdor and makes an old enemy an ally at Hyjal. |
| Jaina Proudmoore | Peon, Durotar Skies | Lich, Naxxramas | Lich King, Frozen Throne | Thrall + Blademaster, Durotar Skies | Rifleman, Gryphon Aerie | Archimonde | Jaina leads Lordaeron's survivors west and forges a truce at the foot of the World Tree. |
| Sylvanas Windrunner | Kael'thas Sunstrider, Hellfire Citadel | Dreadlord, Stratholme | Lich, Naxxramas | Forsaken Paladin + Mountain King, Stratholme | Archer, Naxxramas | The Lich King | The Banshee Queen wins her body back and goes north for her murderer. |
| Cairne Bloodhoof | Peon, Durotar Skies | Beastmaster, Durotar Skies | Pit Lord, Hellfire Citadel | Lich + Dreadlord, Naxxramas | Thrall, Durotar Skies | Archimonde | The chieftain of the Bloodhoof leads his tribe from Mulgore to the battle for the World Tree. |
| Chen Stormstout | Peon, Durotar Skies | Beastmaster, Durotar Skies | Mountain King, Blackrock | Murloc + Warden, Tomb of Sargeras | Thrall, Durotar Skies | Kil'jaeden | Chen Stormstout travels the world for the perfect brew, and the Legion spills his last keg. |
| Peon | Goblin Tinker, Durotar Skies | Rifleman, Gryphon Aerie | Archer, Nordrassil | Blademaster + Thrall, Durotar Skies | Shadow Hunter, Durotar Skies | Archimonde | One peon just wanted to chop trees and somehow ended up at the end of the world. |
| Goblin Tinker | Peon, Durotar Skies | Mountain King, Blackrock | Rifleman, Gryphon Aerie | Pit Lord + Dreadlord, Hellfire Citadel | Chen Stormstout, Durotar Skies | Archimonde | A goblin engineer sells to every side, then tests his best invention on the Legion's master. |
| Kael'thas Sunstrider | Lich, Naxxramas | Jaina Proudmoore, Gryphon Aerie | Warden, Tomb of Sargeras | Dreadlord + Sylvanas Windrunner, Stratholme | Illidan, Hellfire Citadel | The Lich King | The prince of Quel'Thalas avenges his father and his homeland on the one who burned the Sunwell. |
| Murloc | Peon, Durotar Skies | Archer, Nordrassil | Kael'thas Sunstrider, Hellfire Citadel | Warden + Illidan, Tomb of Sargeras | Shadow Hunter, Tomb of Sargeras | Kil'jaeden | A Broken Isles murloc defends its tide pools from everyone, then from the Legion itself. |

Each route's fifth fight is on the fighter's home stage. Fighters that share
Durotar Skies (Thrall's Horde) also share many of its rivals; their routes
differ in order, team fight, arch-rival and boss.
