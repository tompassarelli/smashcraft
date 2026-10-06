# Match rules and another match

Smashcraft puts Stocks, Time, Endless and Automatic rematch beside the fighter
roster. Every player sees the same choices and any present player can change
them before continuing to stages. The defaults are 3 stocks, 7:00, Endless off
and Automatic rematch off. These are a short competitive match with room for a
comeback; automatic play is an explicit session choice.

## Prior art

| Game or tool | Match rules and repeat play | Wording and consequence |
| --- | --- | --- |
| Slippi Melee | The local Slippi settings inject Salty Runback. The upstream assembly checks each of four players' held A and B, then reloads the match scene; otherwise it loads fighter selection. Faster Melee settings include Stock Mode, 4 Stocks, 8 Minutes and Skip Results Screen. | “Salty Runback” is a held shortcut at the end, not an unattended restart. Skipping results removes a stop between games. |
| Rivals of Aether II 1.6.1 | In local play or lobbies with tournament mode off, any player presses TriggerLeft + TriggerRight + Jump after the game ends and before results. It restarts with the current stage and characters. | The official notes call it “Runback” and a “New QoL feature”. Patch 1.6.1.2 corrects prompts shown where runback is unavailable and a black-screen edge case. A visible, available action matters as much as the shortcut. |
| Super Smash Bros. Ultimate | Quickplay chooses preferred rules (Time, Stock or Stamina, player count, stock/time and items); those preferences do not guarantee the next match's rules. Battle Arenas instead show the host's rules, require ready-up, allow back-out, and rotate designated players after results. | “Preferred rules”, “Battle Arena”, ready-up and back-out make the choice visible. Arena rotation serves a waiting group rather than immediate repeated games between the same people. |

Sources:

- Local source: `~/code/resources/melee-unlocked/port/slippi_sys/GameSettings/GALE01r2.ini`
  and the parallel `slippi_sys_general` / `slippi_sys_playback` trees. These
  identify the injected Salty Runback code; they are private reference inputs.
- [Slippi Salty Runback assembly](https://github.com/project-slippi/slippi-ssbm-asm/blob/master/External/Salty%20Runback/Salty%20Runback.asm),
  especially `Inputs_GetPlayerHeldInputs`, checks A/B and `Runback` / `LoadCSS`.
- [Slippi Faster Melee settings](https://github.com/project-slippi/slippi-ssbm-asm/tree/master/Binary/FasterMeleeSettings),
  including `4Stocks.bin`, `8Minutes.bin`, `StockMode.bin` and `SkipResultsScreen.bin`.
- [Rivals II Patch 1.6.1, official announcement](https://store.steampowered.com/news/app/2217000/view/1830163047269145), “Runback”.
- [Rivals II Hotfix 1.6.1.2, official announcement](https://store.steampowered.com/news/app/2217000/view/1830797770236938).
- [SmashWiki Quickplay](https://www.ssbwiki.com/Quickplay), “Preferred rules”,
  and [Battle Arena](https://www.ssbwiki.com/Battle_Arena), a secondary description
  of host rules, ready-up/back-out and rotation.

The direct player preference informing this choice is Tom's request in
[Smashcraft #74](https://github.com/tompassarelli/smashcraft/issues/74): he liked
Slippi's repeat-match shortcut and wants two people to keep playing without
menus. “Friendlies” did not communicate that purpose. Rivals' developer calls
its equivalent quality of life; that is developer intent, not a player survey.
SmashWiki records complaints about Quickplay failing to honor preferred rules,
which supports showing the actual shared rules here. These sources do not
establish a community consensus on automatic restarts.

For a quick reset during practice, SmashWiki describes the Smash series'
**Reset** control: it sends fighters to their original spawn points and restores
damage. In Ultimate it also restores stage state, removes items and restarts
the music; random events repeat. That is a practice reset, distinct from
finishing and repeating a competitive match. Source: [Training Mode,
Reset](https://www.ssbwiki.com/Training_Mode#Training_options).

## Smashcraft's choice

Use **Automatic rematch**, not “Friendlies” or “Salty Runback”: it names what
happens. After a normal result, a visible **Rematch in N** counts down five
seconds. The countdown begins advancing once the controller helpers have
stopped the previous match. Any player can stop it with a menu control; the
press is consumed, so cancelling does not also start a match. The next press
chooses a new match through fighter selection. An automatic rematch preserves
fighters, slot modes, stage and rules, while resetting combat and the clock.
A player leaving cancels the countdown.

**No time limit** removes only the clock. **Endless** additionally removes the
stock end: fighters respawn after knockouts, the HUD hides stocks and time,
and any player can pause and press Escape to return to fighter selection.
Stock and time choices remain available when Endless is turned off again.

This deliberately differs from a quick reset during combat: the ordinary
match still finishes and shows its result. Automatic rematch stays off until
chosen, avoiding an unexpected second game. Slippi and Rivals use end-of-match
button shortcuts; neither source above describes an unattended automatic
session. Saved presets, ranking and matchmaking are separate concerns.

## Opening, ending and results

The Smash series frames every match the same way. Melee holds the fighters
through "Ready... GO!": a replay's first frame is -123 and its first playable
frame is -39 (Slippi's frame convention, also in
`melee-unlocked:port/app/launcher_replay_stats.inl`). Brawl, Ultimate and Rivals
of Aether II count "3, 2, 1, GO!" over about three seconds. The final KO is
called "GAME!" (or "TIME!" when the clock ends it), the action holds on that
moment, and then a results screen shows the winner in its victory pose with
its series' victory fanfare, beside every fighter's KOs, falls and damage.
Each stage plays music from its own franchise.

Smashcraft follows that shape with Warcraft III's built-in assets
([#123](https://github.com/tompassarelli/smashcraft/issues/123); the held start is
[#129](https://github.com/tompassarelli/smashcraft/issues/129)):

- **Calls.** "3", "2" and "1" tick with the Battle.net countdown tick, "GO!"
  plays the Battle.net game-found sting, and "GAME!"/"TIME!" tolls the
  Alliance bell. A stock loss plays the Battle.net death sting, and the move to a
  last stock adds the interface warning. The status line carries the words.
- **Results.** "GAME!" holds for 90 frames (1.5 s). Then a panel lists each
  fighter's stocks, damage, KOs and falls, with the winner first. The winner
  stands where it finished, facing the camera in its model's Stand Victory
  (Stand Channel or Stand Ready where the model has none). It shouts its battle
  cry over a crowd cheer and its race's victory theme. A KO goes to the last
  fighter whose hit landed.
- **Selection.** Hovering a fighter or a stage ticks. Confirming a fighter
  clicks and plays that hero's trained-unit line ("Ready" in its sound set),
  the closest Warcraft has to Smash's announced pick. Fighter and stage
  selection play the Frozen Throne menu theme.
- **Hurt cries.** Melee gives a damage voice only to knockback past its
  damage-fly threshold and to KOs (`melee:src/melee/ft/kinds/ftCommon/ftCo_Damage.c`).
  Smashcraft's hero models carry their death cry in the Death sequence, so a
  weak hit shows a silent stand-in, and one fighter cries at most every 120
  frames (smashcraft:ts/src/game/presentation/hurtVoice.ts).

Stage themes are matched to setting and race:

| Stage | Track | Why |
| --- | --- | --- |
| Frozen Throne | Lich King's theme | Icecrown's master |
| Nordrassil | Night Elf 1 | the World Tree's people |
| Gryphon Aerie | Human (Frozen Throne) 1 | Aerie Peak's dwarves and the Alliance |
| Durotar Skies | Orc 1 | the orcs' homeland |
| Naxxramas | Undead 3 | the Scourge citadel |
| Hellfire Citadel | Illidan's theme | Illidan's Outland fortress |
| Blackrock | Orc (Frozen Throne) 1 | the Blackrock clan's mountain |
| Ahn'Qiraj | Naga theme | an alien, ancient people beneath the sands |
| Sky Deck (test) | Human 1 | neutral practice ground |

All of these are presentation, so they read confirmed frames and never feed the
simulation. Every path is a script path into the installed game:
`bun tools/presentation/stock-sounds.ts --extract CASC_EXTRACT` checks each
against the game's storage through CascLib and records it in
smashcraft:ts/src/game/assets/stockSoundInfo.ts, and a test holds the
presentation to that table. No audio is copied.
