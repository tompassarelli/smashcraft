# Home stages

In Smash every fighter has a home stage from their own world (Dream Land for
Kirby, Pokémon Stadium for Pikachu). Each Smashcraft fighter has a stage
that feels like a place you would meet them in a Warcraft III campaign
(Reign of Chaos, RoC; The Frozen Throne, TFT). Tom decided, 7 Oct
(delegated).

The source of truth is smashcraft:ts/src/game/menu/homeStages.ts;
smashcraft:ts/test/home-stages.test.ts checks that it covers every
selectable fighter exactly once, naming any fighter without one, and that each home stage is a selectable stage. Stage ids are the catalog tiles in
smashcraft:ts/src/game/menu/stageCatalog.ts.

| Fighter | Home stage | Stage id | Why |
| --- | --- | --- | --- |
| Rifleman | Gryphon Aerie | 11 | Ironforge riflemen and Wildhammer gryphon riders fight side by side in every Alliance army, the Gryphon Aviary beside the Barracks. |
| Illidan | Hellfire Citadel | 14 | TFT's "Lord of Outland": Illidan storms Magtheridon's citadel in Outland. |
| Blademaster | Durotar Skies | 3 | TFT's "The Founding of Durotar": Samuro of the Burning Blade fights for Thrall's new homeland. |
| Mountain King | Blackrock | 12 | Blackrock Mountain rises at the edge of Khaz Modan, the dwarves' homeland; its forges are held by their Dark Iron kin. |
| Warden | Tomb of Sargeras | 7 | TFT's "Terror of the Tides": Maiev hunts Illidan to the Broken Isles and into the Tomb of Sargeras. |
| Malfurion Stormrage | Tomb of Sargeras | 7 | Malfurion follows Illidan and Maiev through the Broken Isles in TFT. |
| Lich | Naxxramas | 4 | Kel'Thuzad, raised as a lich in RoC, rules the Scourge necropolis Naxxramas. |
| Forsaken Paladin | Stratholme | 6 | RoC's "The Culling": Lordaeron's paladins refuse to purge Stratholme and leave Arthas at its gates. |
| Dreadlord | Stratholme | 6 | RoC's "The Culling": the dreadlord Mal'Ganis waits for Arthas in the plagued city. |
| Shadow Hunter | Durotar Skies | 3 | Vol'jin's Darkspear trolls settle Durotar's coast beside Thrall's orcs. |
| Pit Lord | Hellfire Citadel | 14 | Magtheridon, the pit lord who holds the citadel until Illidan takes it. |
| Beastmaster | Durotar Skies | 3 | Rexxar is the hero of TFT's bonus campaign, "The Founding of Durotar". |
| Lich King | Frozen Throne | 2 | TFT's final mission: Arthas climbs Icecrown and takes the Frozen Throne. |
| Anub'arak | Frozen Throne | 2 | TFT's underground Northrend campaign brings the crypt king and Arthas through Azjol-Nerub toward Icecrown. |
| Medivh | Nordrassil | 10 | RoC's prophet brings the human, orc and night elf leaders together to defend Mount Hyjal and its World Tree. |
| Thrall | Durotar Skies | 3 | Thrall leads the founding of Durotar. |
| Jaina Proudmoore | Gryphon Aerie | 11 | Jaina leads the Alliance expedition with its human forces. |
| Sylvanas Windrunner | Naxxramas | 4 | The Dark Ranger fights the Scourge in Lordaeron. |
| Cairne Bloodhoof | Durotar Skies | 3 | Cairne and the tauren help Thrall establish the Horde homeland. |
| Chen Stormstout | Durotar Skies | 3 | Chen accompanies Rexxar in The Founding of Durotar. |
| Peon | Durotar Skies | 3 | Orc peons build the Horde settlements. |
| Goblin Tinker | Durotar Skies | 3 | Goblin engineers supply the Horde with machinery. |
| Kael'thas Sunstrider | Hellfire Citadel | 14 | Kael follows Illidan into Outland. |
| Murloc | Tomb of Sargeras | 7 | TFT's "Terror of the Tides": murlocs and the naga's mur'gul thralls hold the Broken Isles' shores around the tomb; its tide floor is their water. |
| Kobold | Blackrock | 12 | A candle-hoarding miner belongs in the tunnels beneath the mountain. |
| Grom Hellscream | Durotar Skies | 3 | Grom's Warsong clan fought beside Thrall's Horde in Kalimdor before his final charge at Mannoroth. |

Ahn'Qiraj and Sky Deck (test) are home to no fighter. A stage may host
several fighters, as Smash's do; Durotar Skies hosts several Horde fighters.

Stratholme (6) and Tomb of Sargeras (7) were added for this table: Forsaken Paladin,
Dreadlord and Warden had no stage from their campaigns.

Both stages are selectable. Stratholme uses cobbled slopes and three rooftop
platforms before a ruined cathedral, city gate and distant fires. Tomb of
Sargeras uses two overhanging end platforms, a shallow tide floor, distant
Naga temple and waterfall. Each has its own quiet sky, light and deck palette;
background pieces remain behind the fight and the lower sky stays a void.
