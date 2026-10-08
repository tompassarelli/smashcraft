# Stage music

Each stage plays music from its own franchise
(smashcraft:docs/design/match-flow.md). In Smashcraft that means a stock
Warcraft III track chosen for the fighters who call the stage home
(smashcraft:docs/design/home-stages.md). No music is imported: every track
is already in the game, and the game's music volume applies to it. Tom
asked for this on 8 Oct ([#271](https://github.com/tompassarelli/smashcraft/issues/271)).

The source of truth is `STAGE_MUSIC` in
smashcraft:ts/src/game/presentation/matchAudio.ts. The match starts its
stage's track with `PlayMusic`, which loops it until the results screen.
smashcraft:ts/src/game/presentation/matchCues.tests.ts fails when a stage
in the catalog has no track, when its track is not a stock path, or when two
stages share one. smashcraft:tools/presentation/stock-sounds.ts checks each
path against the installed game.

| Stage | Id | Home fighters (faction) | Track | Why |
| --- | --- | --- | --- | --- |
| Sky Deck (test) | 0 | none | Human1 | The first RoC campaign theme, a neutral opener for practice. |
| Frozen Throne | 2 | Lich King (Scourge) | LichKingTheme | Arthas's own theme as the Lich King, for his climb to the throne. |
| Durotar Skies | 3 | Thrall, Blademaster, Shadow Hunter, Beastmaster, Cairne, Chen, Peon, Tinker (Horde) | OrcX1 | The TFT orc theme, the music of "The Founding of Durotar". |
| Naxxramas | 4 | Lich, Sylvanas (Scourge, Forsaken) | NaxxramasWalking1 | The game's own Naxxramas music, written for the necropolis. |
| Stratholme | 6 | Forsaken Paladin, Dreadlord (Alliance, Dreadlords) | ArthasTheme | The prince's theme, for the city where Arthas turned. |
| Tomb of Sargeras | 7 | Warden (Sentinels) | NagaTheme | The naga hold the Broken Isles where Maiev chases Illidan. |
| Nordrassil | 10 | Archer (Sentinels) | NightElf1 | The RoC night elf theme, for the Sentinels' defence of the World Tree. |
| Gryphon Aerie | 11 | Rifleman, Jaina (Alliance) | HumanX1 | The TFT Alliance theme, for Jaina's expedition and its riflemen. |
| Blackrock | 12 | Mountain King (Alliance) | Human3 | An Alliance campaign theme for the dwarves at the edge of Khaz Modan. |
| Ahn'Qiraj | 13 | none | NightElf2 | The night elves sealed Ahn'Qiraj's ruins; their theme suits the ancient place. |
| Hellfire Citadel | 14 | Illidan, Pit Lord, Kael'thas (Illidari, Legion) | IllidansTheme | Illidan's own theme, for his conquest of Magtheridon's citadel. |

Script paths are `Sound\Music\mp3Music\<Track>.flac`; the game resolves each
to the `.mp3` or `.ogg` it stores. Menus play War3XMainScreen and a win plays
the winner's race victory theme, as before.

## Stock music in the client

The installed client (8 Oct) stores these tracks under
`war3.w3mod:sound\music\mp3music\`, listed through CascLib; all are
available to a stage:

- Campaign themes: Human1-3, HumanX1, Orc1-3, OrcX1, NightElf1-3,
  NightElfX1, Undead1-3, UndeadX1.
- Hero and faction themes: ArthasTheme, LichKingTheme, IllidansTheme,
  NagaTheme, BloodElfTheme, OrcTheme.
- Moods: Comradeship, DarkAgents, Doom, PursuitTheme, SadMystery, Tension,
  TragicConfrontation, HeroicVictory, DarkVictory, Credits, PH1.
- Victory and defeat stings: HumanVictory, OrcVictory, NightElfVictory,
  UndeadVictory, and each race's Defeat.
- Menus: MainScreen, War3XMainScreen, War2IntroMusic.
- Reforged-era additions: NaxxramasWalking1-6, Undercity and
  UndercityAmbience01-03, WestPlaguelands, CrimsonForest, Forsaken1-3 and
  their stems, HolyWarriorsOathB/D, AllianceBattleMarch, Battle_A/B,
  Battle_Intense_A-C, Combat1-3, Race1-3.
- Warcraft I and II remakes: `war1\Human1-3`, `war1\Orc1-3`,
  `war2\Human2-5`, `war2\Orc2-5`, each with an `_opl` variant.
