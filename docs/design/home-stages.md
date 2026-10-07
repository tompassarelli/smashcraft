# Home stages

In Smash every fighter has a home stage from their own world (Dream Land for
Kirby, Pokémon Stadium for Pikachu). Each Smashcraft fighter has a stage
that feels like a place you would meet them in a Warcraft III campaign
(Reign of Chaos, RoC; The Frozen Throne, TFT). Tom decided, 7 Oct
(delegated).

The source of truth is smashcraft:ts/src/game/menu/homeStages.ts;
smashcraft:ts/test/home-stages.test.ts checks that it covers every
selectable fighter exactly once and that this table agrees with it. Stage ids are the catalog tiles in
smashcraft:ts/src/game/menu/stageCatalog.ts.

| Fighter | Home stage | Stage id | Why |
| --- | --- | --- | --- |
| Archer | Nordrassil | 10 | RoC's last mission, "Twilight of the Gods": the Sentinels defend the World Tree from Archimonde at Mount Hyjal. |
| Rifleman | Gryphon Aerie | 11 | Ironforge riflemen and Wildhammer gryphon riders fight side by side in every Alliance army, the Gryphon Aviary beside the Barracks. |
| Illidan | Hellfire Citadel | 14 | TFT's "Lord of Outland": Illidan storms Magtheridon's citadel in Outland. |
| Blademaster | Durotar Skies | 3 | TFT's "The Founding of Durotar": Samuro of the Burning Blade fights for Thrall's new homeland. |
| Mountain King | Blackrock | 12 | Blackrock Mountain rises at the edge of Khaz Modan, the dwarves' homeland; its forges are held by their Dark Iron kin. |
| Warden | Tomb of Sargeras | 7 | TFT's "Terror of the Tides": Maiev hunts Illidan to the Broken Isles and into the Tomb of Sargeras. |
| Lich | Naxxramas | 4 | Kel'Thuzad, raised as a lich in RoC, rules the Scourge necropolis Naxxramas. |
| Uther | Stratholme | 6 | RoC's "The Culling": Uther refuses to purge Stratholme and leaves Arthas at its gates. |
| Dreadlord | Stratholme | 6 | RoC's "The Culling": the dreadlord Mal'Ganis waits for Arthas in the plagued city. |
| Shadow Hunter | Durotar Skies | 3 | Vol'jin's Darkspear trolls settle Durotar's coast beside Thrall's orcs. |
| Pit Lord | Hellfire Citadel | 14 | Magtheridon, the pit lord who holds the citadel until Illidan takes it. |
| Beastmaster | Durotar Skies | 3 | Rexxar is the hero of TFT's bonus campaign, "The Founding of Durotar". |
| Lich King | Frozen Throne | 2 | TFT's final mission: Arthas climbs Icecrown and takes the Frozen Throne. |

Ahn'Qiraj and Sky Deck (test) are home to no fighter. A stage may host
several fighters, as Smash's do; Durotar Skies hosts the Horde's three.

Stratholme (6) and Tomb of Sargeras (7) were added for this table: Uther,
Dreadlord and Warden had no stage from their campaigns.
