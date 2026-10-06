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
