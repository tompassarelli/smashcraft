# Training (#120)

Training is a match rule chosen at fighter selection beside Stocks, Time,
Endless and Automatic rematch. A training match has no clock and no lost
stocks; every computer fighter is a training partner that does what the
player set (stand, shield, crouch, jump, attack or fight) and escapes hits and
techs the way the player set. The match reports what the player's last move
did in frames, how far ahead the player was afterwards, and the length and
damage of the current combo, and it can show every attack's hit areas and
every fighter's body. Any player can put everyone back at the start.

## Prior art

| Tool | What players use most | What it teaches us |
| --- | --- | --- |
| UnclePunch Training Mode / TrainingMode Community Edition (Melee, 20XX lineage) | An on-screen information display (action state, frame advantage, act-out-of-shield frames, intangibility, hitlag/hitstun remaining); CPU options for behaviour, shield, SDI/DI direction (including "random from your custom DI options"), tech option and counter-action after hitstun or shieldstun; savestates; frame advance; event drills (ledgedash, L-cancel, wavedash). | Numbers the game otherwise hides are the core value; a partner that reacts the same way every time is how a combo or punish is proven. Frame advance and savestates exist because Melee runs on a console with one player; they are separate features, not a requirement of the display. |
| Super Smash Bros. Ultimate training stage | A grid stage, CPU behaviour (stand, walk, jump, attack, control, CPU), CPU shield and DI settings, damage set per fighter (0–999%), combo counter that turns red when a hit was escapable, speed 1×–¼× and frame advance, launch trajectory lines, hitbox display, a quick reset (L+R+A) to starting positions. | The combo counter and a one-gesture reset are what make practice loops quick. Damage set per fighter lets a player practise a kill confirm at its real percent. |
| Rivals of Aether II training | "Show hitboxes" draws hitboxes red and hurtboxes green, with hitstun and armor in their own colors; DI lines (maximum, minimum and the input actually held); damage 0–999%; CPU action menu. | Color-coded volumes are the accepted language for hit areas; drawing the body and the attack together is what players use to learn spacing. |
| Street Fighter 6 training | A frame meter under the fighters showing startup, active and recovery for each move and each combo, with the opponent's state beside it and the advantage number at the end; dummy guard ("after first hit" exposes dropped combos), stun recovery and reversal settings; recording slots; position reset. | Advantage on block is the single most-used number. "Block after first hit" is the cheapest way to show a dropped combo; our combo counter does the same job by counting only hits the partner could not act between. |

Sources: [TrainingMode Community Edition](https://github.com/AlexanderHarrison/TrainingMode-CommunityEdition),
[SmashWiki Training](https://www.ssbwiki.com/Training) and
[Training Mode](https://www.ssbwiki.com/Training_Mode),
[Rivals of Aether Practice Mode](https://wiki.gbl.gg/w/Rivals_of_Aether/Practice_Mode),
[EventHubs on SF6's frame meter](https://www.eventhubs.com/news/2022/sep/16/sf6-training-visual-frame-data),
[Infil's SF6 beta notes](https://words.infil.net/w03-sf6beta-p6.html).

## What Smashcraft keeps, and why

1. **Frame readout.** After each of the player's attacks: the frame its first
   hit can land (startup), how many frames it can hit (active) and its total
   length. After a hit or a shielded hit: the advantage, the frame the
   partner can act minus the frame the attacker can act, labelled "on hit" or
   "on shield". Positive means the attacker acts first. This is UnclePunch's
   and SF6's most-used number and our sim already knows each move's authored
   startup and active frames and when each fighter can act.
2. **Combo counter.** Hits on the same partner count as one combo while the
   partner could not act between them; the counter shows hits and damage and
   keeps the last combo on screen until the next one starts. It replaces
   SF6's "block after first hit" and Ultimate's red counter with one rule.
3. **Training partner.** Behaviour: Stand, Shield, Crouch, Jump, Attack (its
   jab, again and again) or Fight (the normal computer). Escape: None, In
   (toward the attacker), Out (away), or Random. Tech: None, In place,
   Toward, Away or Random. Random draws from the match frame, so every
   client and every replay draws the same.
4. **Damage.** The partner starts and restarts at a chosen damage, 0% to
   300% in steps of 10.
5. **Reset.** Any player holding both shields and pressing attack puts every
   fighter back on its starting spot with its set damage, as Ultimate's
   L+R+A does. The reset is read from the players' inputs inside the
   simulation, so it rolls back and replays like any other input.
6. **Hit areas.** An option draws every active attack's hit areas and every
   fighter's body, red and green after Rivals. It reads the same authored
   volumes the hits use (smashcraft:docs/hurtboxes.md), so what it draws is
   what hits.
7. **Speed.** Full, half or quarter speed: the match advances one frame in
   every one, two or four. Presses made on frames the match skips are kept
   for the next frame it runs.

## Not kept

- **Frame advance and savestates.** Warcraft matches are multiplayer and
  rollback-confirmed; a paused frame advance would need every client's
  controller helper to agree on each step (the pause barrier,
  smashcraft:ts/src/game/shell/pauseBarrier.ts) and savestates would need a
  second snapshot channel. Quarter speed covers most of the use.
- **Changing partner settings mid-match.** Settings are chosen at fighter
  selection; leaving from the pause returns there in two presses. Changing
  synchronized match state while the rollback history holds earlier
  snapshots would need a new match epoch.
- **Recording and playback of the partner, event drills, DI lines.** Later
  work once the core loop is in players' hands.

## How it works

Training is `MatchState.training` plus a `TrainingState` record
(smashcraft:ts/src/game/match/training.ts) holding the partner settings and
the readout. Both are synchronized simulation state: they are copied with the
match, compared by the replay difference and written to the checksum (only
when training is on, so other matches keep their checksums). The partner's
inputs replace the computer's inputs in `produceComputerInput`, so tapes,
network rows and replays all use the same partner. The readout is measured in
`stepMatch` from fighter state only (damage, shield stun, `canAttack` /
`canShieldGrab`), so a rollback replays it exactly. Hit areas are
presentation: the shell draws them from the confirmed world and they never
feed the simulation.
