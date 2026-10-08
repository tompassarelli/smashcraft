# Project documentation

[Smashcraft project home](../README.md)

Docs hold durable knowledge: how the game and its systems work, design
decisions and their reasons, reference data, and procedures. Anything that
changes, such as status, progress, plans, priorities or claim tables, lives in
GitHub issues under roadmap [#16](https://github.com/tompassarelli/smashcraft/issues/16).
Dated trial records live in [evidence](../evidence/README.md).

## Game

- [Player guide](player-guide.md): controls, menus and match flow.
- [Move list](move-list.md): every fighter's specials, passive and ultimate by official name, generated from the kit data.
- [Gameplay design decisions](gameplay-design.md): the owner's principles and decisions, the deviations from Melee and open questions. The only place Smashcraft's stance is written.
- [Melee case study](design/melee/README.md): Melee's movement, attacks, defence, archetypes, techniques and jank, described with numbers computed from the reference data.
- [Fighting-game design language](design/fighting-games.md): frame advantage, highs and lows, footsies, okizeme, strike/throw, hitboxes and hurtboxes, archetypes, with sources.
- [Platform-fighter design language](design/platform-fighters.md): how platform fighters change that language: shield, aerials on shield, ledge, DI and SDI, tech chases, edgeguarding, the interaction graph.
- [Modern platform-fighter mechanics](design/modern-platform-fighters.md): sourced inventory of mechanics later games added or changed relative to Melee.
- [Execution and reaction windows](design/execution-windows.md): windows other games use, human limits, and proposed bounds.
- [Stages](design/stages.md): what Melee and Ultimate players pick and why, accepted variance and hazards, Warcraft places and built-in assets per race, and an evaluation of the draft stage list.
- [Home stages](design/home-stages.md): every fighter's home stage from their Warcraft campaign, with the lore reason.
- [Stage music](design/stage-music.md): each stage's stock Warcraft track, chosen for its home fighters, and the music the client ships.
- [Water stage](design/water-stage.md): how Jungle Japes' river and Sandover Village's Lurker Shark work, with frame data and sources, and the Tomb of Sargeras tide and hydra built on them.
- [Stock platforms](design/stock-platforms.md): building stage platforms from Warcraft's own models and textures: techniques, byte costs, limits per graphics mode, and which platforms each suits.
- [Stage art](design/stage-art.md): research-based rules for stage backgrounds, skies and scenery: readable fight plane, symmetric decks with asymmetric dressing, depth bands, fog, motion budget, floating stages with no ground below, and the per-stage art checklist.
- [Stage boards](design/stage-boards.md): every stage's Ultimate and Rivals of Aether 2 references, its material set (deck top, edge, body, platforms) from stock Warcraft textures, and a pass/fail screenshot rubric.
- [Warcraft features since Reforged](design/warcraft-features.md): index of every lighting, fog, sky, water, particle, material, terrain and camera feature from 1.32 through 3.0 Forsaken Kingdom, with natives, script access, graphics modes and cost.
- [Move legibility](design/move-legibility.md): how platform fighters make specials readable (effect restraint, colour per element, victim element effects) and the startup cue, active spell, missile and element each Smashcraft special shows.
- [Animation reference library](design/animation-reference.md): sourced references for silhouettes, anticipation/contact/recovery, drills, dodges and techs, grabs and throws, and the nine damage reactions, with verified timestamps, rights and the private-pixel rule.
- [Hurtbox legibility](design/hurtbox-legibility.md): why Ultimate players report losing with correct spacing (hurtbox shapes per animation, interpolation, hit-pose shifts, glancing blows, randomness) and Melee's comparable cases, with sources.
- [Projectiles](design/projectiles.md): Ultimate's projectile properties players blame, Melee's powershield and laser answers, other platform fighters, and Smashcraft's current projectiles.
- [Archer's hippogryph specials](design/archer-specials.md): how great platform-fighter specials create decisions, and Archer's steerable ride with a leap-off and her perch-and-dive, with frame data and counterplay.
- [Kit review 1](design/kit-review-1.md): Blademaster, Mountain King, Warden, Rifleman's recovery and Illidan scored for decisions, mixups, reads and counterplay, with redesigned specials, frame data and counterplay.
- [Mana](design/mana.md): every fighter's one resource for specials: earned by landing normals and throws, a capped comeback share and a trickle; cost tiers; Mana Burn; the overhead bar; Hero, Inkling, Steve, Robin, WoW, Street Fighter and Guilty Gear prior art; designed ultimates.
- [Tilts and dash attacks](design/tilts.md): each fighter's jab, forward/up/down tilt and dash attack by identity, Melee's timing distribution, Ultimate's angled forward-tilt rule (straight strikes angle, vertical swings do not) and the down-tilt and dash-attack roles.
- [Interaction graph](design/interaction-graph.md): for each situation, Smashcraft's options, what beats what by how many frames, and the punish windows, computed per fighter from its move data.
- [Match flow](design/match-flow.md): match rules, endless play and automatic rematch, with Slippi and other platform-fighter prior art.
- [Computer opponent profiles](design/cpu-profiles.md): six named opponents with individually authored five-tier growth, blended competencies and persistent openings; Opponent + Difficulty selection and deterministic calibration contract.
- [Smashcraft client](design/client.md): the Slippi-style companion app: Slippi, Rivals, Ultimate and W3Champions prior art, the match record format the map writes, full-match replay design and the phased roadmap.
- [Delivery goal](delivery-goal.md): what the finished game contains.
- [Current release](playable-0041.md): files, startup and controls for 0.0.41.

## Physics and moves

- [Physics reference](physics.md): source values, implementation and known differences.
- [Melee camera](melee-camera.md): how Melee's match camera frames and follows the fighters, and how ours follows it.
- [Expansion heroes](heroes.md): registering a hero, its specials and mana.
- Melee mechanics: [air cutoff](melee-air-cutoff.md), [analog shield](melee-analog-shield.md), [ground motion](melee-ground-motion.md), [hitlag scalars](melee-hitlag-scalars.md), [hitstun boundaries](melee-hitstun-boundaries.md), [powershield](melee-powershield.md), [scalar math](melee-scalar-math.md), [tech input](melee-tech-input.md).
- [Smash Melee reference data](smash-melee-reference/README.md): physics parameters, every fighter's retail attributes and the targeted retail observations used by the physics tests.
- [Melee frame-data reference](../references/melee-frame-data/README.md): the one Melee frame-data corpus: per-move frame data, hitbox positions and dodge travel.
- [Move data](move-data.md), [move comparisons](move-comparisons.md) and [move reference join](move-reference-join.md): queryable production move facts.
- [Native arithmetic comparison](native-physics-precision.md): how to check Warcraft against headless numbers.

## Netcode and controllers

- [Netcode design](netcode-proposal.md): synchronization and rollback design.
- [Input clock contract](input-clock-contract-20261004.md): how inputs get their frame.
- [Warcraft API and netcode findings](warcraft-api-netcode-findings.md): engine behavior learned the hard way.
- [Online play and companion direction](online-delivery.md): controller architecture choices.
- [Cross-platform companion](controller-platforms.md) and [controller prior art](controller-prior-art.md).

## Building and testing

- [Development setup and loop](development-loop.md): build, reload and test workflow.
- [CI](ci.md): the workflows, and how a cloud worker's `claude/**` branch lands on main by itself (autoland).
- [TypeScript workflow](typescript.md): source rules, build and test commands.
- [Graphics settings](graphics-settings.md): which Warcraft III graphics settings Smashcraft reads, the LAN pool profiles and recommended player settings.
- [What a player sees](player-view.md): scene report and frame probe checks, their expectations and thresholds.
- [Fighter animation work](fighter-animation-work.md): asset authoring and native pose checks.
- [Warcraft procedures](wc3-procedures.md), [screen states](wc3-screen-state.md) and [authentication](warcraft-authentication.md).

## Keeping docs from rotting

- Write a doc only for knowledge that stays true until the code or design changes. Put status, next steps and results-so-far in the owning issue.
- When a trial teaches something durable, add that fact to the relevant doc above, in a sentence, with the build it was observed on. Keep the trial's raw record in `evidence/`.
- Don't add "current state", "updated on" or "remaining work" sections to a doc. If a doc needs one, the content belongs in an issue.
