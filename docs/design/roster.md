# Smashcraft roster

> **Frozen (26 October 2026):** Forsaken Paladin was frozen pending replacement, and Uther replaced him on 28 October 2026 ([uther.md](uther.md)). `agents/frozen-topics.toml` in south, which the issue guard and dispatch read, keeps listing him until Tom lifts it. The remaining planned additions, Tyrande, Stitches and a dismounted Thrall, are in [roster-next.md](roster-next.md) (28 October 2026).

> **Removed (30 October 2026):** Sniper, the original Rifleman, left the game at Tom's decision: he is on no select grid, computer, Random, Classic or Lore Battle list, and the map carries none of his art, model or object data. Character code 1 stays as the base Rifleman body that headless tests use as a fixed reference target and training dummy (`HARNESS_ONLY_FIGHTERS` in `ts/src/game/roster/kits.ts`).

> **Reinstated (30 October 2026):** Tom reversed his 29 October cut and Anub'arak is back in the roster as he was before the removal, with character code 23 again his; he sits at the end of the Undead group on the select grid, after Mal'Ganis.

> **Renames (31 October 2026):** Tom asked for the Butcher to be shown to players as Stitches and for the Murloc to be shown as the duo Mrgl & Grgl, on the select card, portrait, damage panel, results, computer lines, announcer text, menus, credits and these docs. The internal names stay: the `Character.butcher` and `Character.murloc` codes, `HeroDefinition.name` (the developer-command key "Butcher" and "Murloc"), the `butcher` and `murloc` source folders, generated art, clip and sound paths, and the `interactions --attacker Murlocs` option.

> **Select grid order (30 October 2026):** the character select grid lists the fighters by faction in reading order, Human, Orc, Undead, Night Elf, Burning Legion, then Neutral, with the Random tile last; `SELECT_GRID_ORDER` in `ts/src/game/ui/selectionLayout.ts` holds the order and `selectionFrames.tests.ts` pins it. Chen sits with the Neutral fighters (Tom, 30 October 2026).

> **Select grid order (31 October 2026):** the grid now ends with Mannoroth (Pit Lord) and Archimonde, just before the Random tile, after the Neutral fighters; Onyxia takes the place between them when she replaces the Goblin Alchemist ([onyxia.md](onyxia.md); Tom, 31 October 2026).

Tom’s roster decision (9 October 2026, #339): 21 fighters remain. Every fighter needs a strong, pointed personality: funny, annoying, menacing, heroic, or something equally specific. Never flat or generic. The roster holds at 29 fighters (Tom, 28 October 2026, [roster-next.md](roster-next.md)) until every fighter feels good. The only planned additions are [Grom Hellscream (#340)](https://github.com/tompassarelli/smashcraft/issues/340), [Anub’arak (#341)](https://github.com/tompassarelli/smashcraft/issues/341), [Malfurion (#342)](https://github.com/tompassarelli/smashcraft/issues/342), and [Medivh (#343)](https://github.com/tompassarelli/smashcraft/issues/343). No further additions are planned.

We explored Definitive Edition models, found they differ widely from the Classic models (for example, Sylvanas's Definitive body is about 55% wider than her Classic one, so shared animations and hurtboxes would need rescaling), and the game focuses on the Classic models.

## Malfurion Stormrage (#342)

**Identity:** a serene, arrogant archdruid who treats the duel as gardening. He
points where his opponent ought to stand, closes that space with roots and a
treant, then dismisses them with his staff. A space-trapping zoner, distinct
from Jaina's falling spells, Lich's frost bursts and Shadow Hunter's crossfire.
He has no stacks or second resource. All four ordinary specials are
free, and he gains no resource beyond the shared ultimate meter.

**Body:** weight 94, run 10.8 units/frame, air 5.7 units/frame, standing hurt
capsule endpoints at heights 4 and 101.2, radius 24. Slow feet and a tall exposed body make failed setup
punishable. Stock campaign Malfurion, Keeper spells and Force of Nature treant
art provide his presentation.

**Normals:** two dismissive staff jabs (5-frame startup, 3/4 damage), angled
staff pokes (9, 8), upward branch lift (8, 7), low root sweep (7, 6), shoulder-led
dash check (11, 9.25). Forward smash plants a long branch (19, 16, recovering 37 frames), up smash
raises the canopy (18, 16), down smash sweeps roots front then back (17, 13).
Neutral air circles the staff (8, 8); forward/back air push it away (12/9,
12/11); up air lifts it (10, 11); down air plants its tip below him (16, 12).
Landing lag is 16/18/16/16/22 before the shared automatic halving. Down tilt
and up throw launch into canopy follow-ups; down throw creates a tech chase.

| Special | Ordinary action and counterplay |
|---|---|
| Entangling Roots, neutral | Mark a low patch 180 units ahead on frame 8; roots hit once after 20 telegraph frames for 8 damage and a 24-frame movement bind. Jump or shield the patch. 42 total frames. |
| Stag Charge, side | Coil, then bound forward for frames 12–20 with a branching staff strike for 11 damage. Shield stops the charge; 43 total leaves a whiff punish. Air charge ends helpless. |
| Dream Ascent, up | Rise diagonally on frames 10–23 with a 7-damage canopy strike, spending the aerial jump and ending helpless. 40 total; exposed above and after the rise. |
| Force of Nature, down | Plant one fragile treant on frame 26, 20 durability, 240-frame life; four branch bolts do 5 damage each. Setup takes 50 frames. Destroy or jump the treant; repeat down special recalls it. |

**Grabs:** shared standing/dash/pivot envelope. One staff-butt pummel uses the
shared 3-damage escape window. Forward throw dismisses the victim (8 damage,
frame 14); back throw flings them behind (9, 17); up throw lifts on a branch
(7, 15); down throw plants them for a tech chase (6, 19). Throw recovery is
22/24/10/24 frames. The normal throw-hitstun regrab rule applies.

**Play-style profile:** ranged setup and horizontal traps, mostly grounded
spacing, retreat and shield defense, occasional aerial branch finishers. The
signature is Entangling Roots into staff spacing; it permits shield and jump
answers rather than an automatic follow-up. Initial balance numbers are
provisional until the one farm probe.

```balance-profile
fighter: malfurion-stormrage
archetype: zoner
aerials: nair 10-35, fair 15-40, bair 15-45, uair 10-35, dair 0-25
air-share: 15-45
approach: 20-50
ranged: 25-65
specials: neutral 5-25, side 3-20, up 0-8, down 3-15
```

Path draft for Tom to correct (#358):

```ceiling-plan
fighter: malfurion-stormrage
path: decision
basic-moves: neutral-special,side-special,neutral-air
```

Basic gameplan: Use simple nature shots and a neutral aerial. Keep one approach, use the listed moves, no read-based punishes or advanced kit sequences. Recovery keeps the normal up special.

Expert gameplan: Place roots and nature control to force a route and punish it. Use the full authored kit and gameplan at the same CPU skill.


Adopted by the owner on 6 October 2026 from the 2 October expansion brief.
The requested roster is Blademaster, Mountain King, Warden, Lich, Forsaken Paladin,
Dreadlord and Shadow Hunter, in that order. The Tavern kits below record the earlier expansion brief. Their tuning tables are starting values, not shipped
balance measurements. Existing fighters and newer gameplay decisions remain
authoritative; in particular, the throw-hitstun regrab rule adopted in #85
replaces this brief's earlier fixed protection timer.

This is a proposed expansion roster and implementation brief for Tom Passarelli’s Smashcraft, a Warcraft III platform fighter. It defines complete initial movesets for the seven requested heroes and all eight Tavern candidates, with a recommended build order. The goal is distinct, readable fighters with measurable counterplay and moves that can be replayed correctly by the custom simulation.

All move designs and numbers below are proposals, not existing implementation facts, copied Melee frame data, or a claim of proven balance. Preserve the existing Rifleman and Illidan. The current source tree was not inspected for this document; the implementation agent must map this specification onto the real project rather than assume module or animation names.

### Signature strong/weak move (#389)

Forward smash, split by position: strong hit sweetspot, frames 19-21, 16%; weak hit sourspot, frames 19-21, 11.2%. Wrath bursts at the staff's tip, so the druid kills at range.
The roster table is in [gameplay-design.md](../gameplay-design.md#strong-and-weak-hits-389) and every split in the [move list](../move-list.md).

## Scope and priorities

“Shadow shaman” is interpreted as Warcraft III’s Shadow Hunter, with Rokhan as the character reference. If Tom intended a different character, preserve this design under Shadow Hunter rather than silently rename another hero. Forsaken Paladin uses the Paladin identity. The eight Tavern kits are historical candidates from the expansion brief; the five additions named above are the current plan.

| Order | Hero | Distinct purpose | Main weakness |
| --- | --- | --- | --- |
| 1 | Blademaster | Grounded sword spacing and whiff punishment | Exposed recoveries and weak ranged pressure |
| 2 | Mountain King | Compact heavy with hammer and axe | Slow approach and limited air drift |
| 3 | Warden | Precision mobility and edge pressure | Light body and punishable teleport endpoints |
| 4 | Pandaren Brewmaster | Staff brawler with brew and fire combinations | Slow commitments and limited ranged reach |
| 5 | Lich | Deliberate projectile placement | Frail body and slow attacks at close range |
| 6 | Uther the Lightbringer | The Silver Hand's hammer, an all-rounder with an answer for every situation | Slow air drift and no long-range pressure |
| 7 | Dreadlord | Air movement, grabs, and close pressure | Large hurtbox and no safe long-range approach |
| 8 | Shadow Hunter | Totem placement and angles | Setup can be destroyed or bypassed |
| 9 | Pit Lord | Extreme heavy with long cleaves | Very large target and slow recovery |
| 10 | Goblin Tinker | Gadgets, mechanical reach, and rockets | Long setup and exposed body |
| 11 | Goblin Alchemist | Ogre brawler with potion preparation | Slow body and buffs that require commitment |
| 11b | Onyxia | Lady Katrana Prestor builds damage with shadow strings, then reveals the black dragon to finish the stock ([onyxia.md](onyxia.md)); she is selectable in the Alchemist's place and the Alchemist is hidden, not deleted | A kill-poor human form, then a huge dragon who cannot change back for five seconds |
| 12 | Naga Sea Witch | Ground control and arcing projectiles | Slow air movement and exposed recovery |
| 13 | Beastmaster | Three-animal pack coordination | Shared resources and punishable pet commands |
| 14 | Dark Ranger | Marked targets and a single skeletal helper | Requires setup and must approach to cash in marks |
| 15 | Firelord | Fire zones that scar the ground, and a dive through the floor to the newest scar | Zones have startup and can be escaped vertically; the dive is open to a hit for 6 frames before it and 16 after, and waits 120 frames |

Akama, the Broken Ashtongue elder of The Frozen Throne, is planned for a later kit; until then he plays as a stand-in.

### Akama, neutral B (Tom, 2026-10-30)

Tom asked on 2026-10-30 for Akama's neutral B to play like Sheik's Needle Storm after playtesting. It is the first move of his own kit; his side, up and down specials and every normal stay the stand-in's ([standins.md](standins.md)). The feel comes from public Needle Storm frame data ([SmashWiki Needle Storm](https://www.ssbwiki.com/Needle_Storm), [SmashWiki Sheik (SSBU) neutral special](https://www.ssbwiki.com/Sheik_(SSBU)/Neutral_special)), scaled to our units; the shuriken is a stock Classic Warden knife missile.

| Input | Move and behavior | Timing and cost |
| --- | --- | --- |
| Neutral B | **Shuriken Volley:** hold special to ready shurikens and release to throw what is ready. A tap readies 1 and one more is ready every 15 frames held, up to 6 at 75 frames after the stance (Needle Storm adds a needle every 15 frames from 1 to 6); holding past 6 keeps 6 until release. Shield or jump during the charge stores the count and leaves him actionable at once (4 frames to put the stance away on shield); the count is kept through landing, being hit and rollback, and a lost stock empties it. A press with a count stored resumes charging from it on the ground, and a release swings it at once. In the air the press throws the stored count at once with no charge (1 when nothing is stored), and the count is spent. Each shuriken is a reflectable projectile, 2% damage, base 4 and growth 12 on a horizontal flinch, 20 frames of life at 12 units a frame on the ground (10 units a frame and 7 down in the air, after Needle Storm's downward air throw of 30 to 35 degrees). The volley fans by 0.5 units a frame of vertical speed per shuriken, centred on the throw. Full volley of 6 deals 12%, under the 15% cap, so it never combos into a guaranteed follow-up: Akama stays in recovery until after the last hit's flinch ends. A small blue glow at his hand grows with the count, and stays while a count is stored. | First shuriken leaves on frame 6 after the release and one more every 3 frames (Needle Storm hits from frame 11, one needle every 3 frames); recovery 23 frames after the last shuriken on the ground, 17 in the air with 12 frames of landing lag (Needle Storm ends 23 frames after its last needle begins on the ground, 17 in the air; 12 frames of landing lag); 0 mana |


### Akama, up B (Tom, 2026-10-30)

Tom's idea on 2026-10-30: Akama's up B is **Shadow Step**, a two-leg invisible teleport recovery. The feel follows public Vanish frame data for Sheik ([SmashWiki Vanish](https://www.ssbwiki.com/Vanish), [SmashWiki Sheik (SSBU) up special](https://www.ssbwiki.com/Sheik_(SSBU)/Up_special)): intangible from frame 14 on the ground and 19 in the air through frame 54, a 5% reappearance hit on frames 55 to 56, about 30 frames of airborne intangibility, direction set by the stick, and 20 frames of landing lag. We keep the shape, scaled to our units and a shorter total, since a step here is a move through space and not a delay. Smoke and shadow are stock Classic models only (Invisibility, Blink and Curse target art).

| Input | Move and behavior | Timing and cost |
| --- | --- | --- |
| Up B | **Shadow Step:** he dissolves into shadow smoke on frames 1 to 12, intangible from frame 8, and the stick sets his heading at any angle until frame 12. Frames 13 to 22 he travels unseen along that heading at 0.25H a frame, 2.5H in all, marked by a thin smoke streak along the path. He reappears on frame 23 with an arrival slash for 6% at a 20 degree launch (a small hit at a low angle, after Vanish's reappearance hit of 5%). If special is still held on frame 26 he stays visible and vulnerable for 8 frames to aim with the stick, dissolves for 4 frames (intangible from the tenth frame of the second leg), and steps again for 6 frames at the same speed, 1.5H, which is 60% of the first step, with a second arrival slash. Releasing special before frame 26 ends the move at the first arrival. At most two steps, then a helpless fall. Total reach is about 4H, a little beyond Sheik's Vanish, paid for by the visible aim window between the steps. A step that reaches a free ledge snaps to it, on either leg: a path entering the stage lip within 0.5H below the top and ending within 0.5H of the ledge catches it, as Blink does; deeper entry lands him or stops against the stage. One use per airtime; landing lag 24 after the helpless fall. 0 mana | Leg one: dissolve f1 to 12, intangible f8 to 22, travel f13 to 22, slash f23 to 25, hold check f26, end f36 (10 recovery frames after the slash). Leg two: aim f1 to 8, intangible f10 to 18, travel f13 to 18, slash f19 to 21, end f32 |
Akama, Firelord and Goblin Alchemist are selectable now as stand-ins on the shared placeholder moveset ([standins.md](standins.md)); the sections below are their real kits, not yet built.

Mrgl & Grgl ([#262](https://github.com/tompassarelli/smashcraft/issues/262)),
requested by Tom on 8 October 2026, is a small, light rushdown; his kit,
body and gameplan are in [murloc.md](murloc.md). His close-range normals are fast and multi-hit (Tom, 2026-10-30): a held spear-poke jab flurry, a five-hit spear drill down air that links into a grounded jab, and a frame-3 neutral air. His up smash is a point-first spear thrust straight up overhead whose hit is a column over his head reaching 122 (2026-10-30, was a rearward arc to 100); frame data is in the Mrgl & Grgl kit table.

Build order is a recommendation, not permission to delete or overwrite ongoing work. Finish or checkpoint the current synchronization milestone before integrating new gameplay into that branch. A first overnight pass should finish one or two complete heroes and reusable move primitives; it should not report all fifteen finished because character-select entries exist.

## Shared combat contract

### Controls and move inventory

Use logical actions rather than hardcoded physical keys. A is normal attack; direction and the existing tilt modifier choose tilts versus smashes. In the air, A plus direction selects neutral, forward, back, up, or down aerial. B is special: neutral B, side B, up B, and down B. Grab is the existing grab binding. Throws are forward, back, up, or down after grabbing. Ultimate is the existing dedicated logical action, not a new overloaded B combination.

Every fighter has jab, three tilts, dash attack, three smashes, five aerials, standing and dash grab, pummel, four throws, and four specials. Preserve the existing jump, shield, roll, dodge, ledge, tech, DI, and fastfall rules. No attack L-cancel requirement. Do not invent one-frame links as a requirement for a basic kit to function.

### Timing and geometry notation

The simulation runs at 60 ticks per second. Timings are simulation frames, not render frames or Warcraft network callbacks. An action begins on frame 1. In normal tables, F/A/R means first active frame, active duration, and recovery after the last active frame. For 6/3/15, the hitbox is active on frames 6 through 8 and the action is free on frame 24. Unless overridden, one target can be hit once per action even if volumes overlap. L is landing lag for an aerial; no autocancel windows in the initial implementation. Landing ends the aerial hitboxes and starts its listed landing lag. Aerials do not gain landing hitboxes unless specified.

H is a fixed reference height taken from the standing combat hurtbox of the current baseline fighter, not from model bounds. Reach is measured from fighter center to the furthest hit volume: S = 0.55H, M = 0.80H, L = 1.10H, XL = 1.40H. These are initial outer extents, not solid rectangles. Construct capsules or circles along the described swing and inspect the full path. Do not fill the entire arc with a huge active volume. Mirroring uses logical facing.

Weapon-only extensions can be disjointed; hands, feet, wings, tails, and bodies retain attached hurtboxes. A glowing effect does not justify an invisible extra hitbox. Unarmed magic has only the explicit reach in the table. Draw each fighter at its stock model scale ("Model scale" below) and fit its hurtboxes to that drawn body; do not stretch all heroes to identical silhouettes.

Angles are degrees relative to the attack direction: 0 horizontal, 45 diagonal outward, 90 upward, 270 downward. A back aerial or back throw points away from facing. For up/down throws, use facing only to break horizontal ties. Downward aerial angles become 55 degrees against grounded targets in the first pass, unless a row explicitly specifies a grounded effect. Use existing meteor-cancel behavior if present; this document does not add or remove it.

Smash timings describe an uncharged move. Hold charging immediately before its first active frame, up to 45 additional frames; scale damage linearly from 1.00 to 1.25 and use the existing knockback relationship. No armor or invulnerability while charging. Input release continues the move; it does not restart startup.

### Knockback and hitstun

Use the project’s existing knockback, hitlag, hitstun, DI, shieldstun, and staling formulas. Do not replace core physics to make this document’s estimates match. Each attack names a tuning class: LINK for a short follow-up opportunity, POKE for separation without a strong launch, LAUNCH for an aerial chase, EDGE for a low outward launch, KILL for a finisher, or SPIKE for an airborne downward launch. Throws add two (#107): JUGGLE for an up throw's guaranteed short juggle and CHASE for a down throw's tech chase, tuned per kit until `bun wisp interactions` reports the role in smashcraft:tools/move-data/interactions/throws.md.

Calibrate classes in an empty test stage against a reference weight at 60 percent, no DI and no walls. Indicative displacement along the launch direction after 30 ticks: LINK 0.6–1.2H; POKE 1.2–2.0H; LAUNCH 2.0–3.0H; EDGE 2.5–3.5H; KILL 3.5–5.0H; SPIKE downward 2.5–3.5H before gravity. These are test bands, not a second knockback formula. Publish the actual coefficients and measured outcomes once calibrated. Adjust hitstun separately through the established formula rather than assuming distance proves a true combo. LINK never guarantees a follow-up without testing DI, percentage, weight, and move timing.

No critical-hit RNG, random evasion, chance-on-hit stuns, or automatic spell counters. Every fighter is distinctive through expressive standard actions, designed case by case (Tom, 9 Oct 2026, #148). Fighters have no passives (Tom, 9 Oct 2026, #384). Floats, extra jumps and visible double-jump armour are movement properties, like weight and air speed, and are learned by playing. One universal meter, the ultimate meter, filled only by centre-stage orbs (#335; one meter since 2026-10-29); no character stacks, charges, resource timers or further bars. Ordinary move durations, cooldowns, statuses and placed-object HP remain action state. Damage is Smash-style percent damage; a healing move lowers it directly. Damage-over-time ticks do not cause hitlag, hitstun or knockback. A status applies only on an actual body hit, not on shield.

### Proposed resource profile

Every fighter carries one meter, the ultimate meter; its rules, numbers and display are in [mana.md](mana.md). Regular specials are free and no move deducts a cost on entry; a press below a full meter starts the ordinary special.

Every up B has a weaker zero-mana version described in its kit; being depleted must not remove basic recovery. If current mana is below the full up B cost, automatically select the free version and spend zero mana; this is the explicit exception to the unaffordable-move rule. If sufficient mana exists, use the full version. Full-strength up B uses its listed cost. One up B use per airtime; it resets only on grounded actionable state or stock respawn, not on ledge regrab. Up B and mobility specials marked helpless prohibit attacks, specials, and double jump until landing or the existing hitstun escape rules. They do not confer ledge invulnerability. Non-mobility specials never refresh jumps or recovery availability.

Offensive specials may be interrupted by being hit normally. No generic B-to-B or B-to-A cancels. Any exception must be stated in the move. Neutral B is usually cheap or free; normals and grabs are always free. Maintain a separate shield resource for this proposal. Do not grant characters separate mana or shield economies without a stated kit rule.

### Grabs and throws

Standing, dash and pivot grab boxes follow the shared [scaled grab envelope](grabs.md) adopted in #337: reach 96/120/144, height 50 and three active frames. The individual kit rows retain their startup and whiff duration; their former grab reach and active duration are superseded. Dash and pivot grabs add three startup and eleven total frames. Shield grabs begin on the first free frame after shield stun, without dropping shield; jump squat accepts a standing grab on every frame. A successful grab latches one target at a defined anchor and ends grab hitboxes. Grabs beat shield, but never intangible opponents. Mutual grabs on the same frame break both grabs with symmetric separation and 12 frames of recovery.

Use the existing escape system if one exists. Otherwise use a deterministic 45-frame base hold plus min(30, floor(victim percent / 5)) frames, reduced by validated new input edges at most once every three frames. Each accepted edge removes two hold frames. Throw input starts immediately and locks out pummel. Each kit authors its pummel's look (no launch; no mana gain or healing); its 3 percent damage, hold length, mashing and the pummel's timing and single use are shared (smashcraft:docs/gameplay-design.md, "Grab holds and pummels", #101). Throws list damage, release frame counted from throw entry, thrower recovery after release, launch angle, and knockback class. Every up throw is a JUGGLE and every down throw a CHASE; forward and back throws follow the kit's identity (smashcraft:docs/gameplay-design.md, "Throw roles"). The tables of kits not yet built keep their first-pass rows until the kit is measured. Targets are held until release and then enter normal hitstun. Do not add a second guaranteed hit via throw animation contact.

Use #85's adopted regrab rule: a fighter cannot be grabbed while its remaining hitstun comes from a throw, including remaining hitstun after a gentle landing. This restriction ends with that throw hitstun or a replacing hit, and does not block ordinary attacks. Do not add a fixed post-throw protection timer. Throws cannot be cancelled or redirected after entry. Thrower movement is limited to the scripted anchor motion; no walk-off carrying. In multiplayer, an external hit breaks the hold before release and clears both actors consistently. Resolve same-frame external hits, throw releases, and grabs with stable rules; do not let player-slot iteration decide.

### Projectiles and summons

All speeds are H per simulation frame. Projectiles use swept collision, stable IDs, bounded lifetimes, one hit per target unless otherwise specified, and explicit reflectability. Default ordinary bolts reflect and are destroyed on solid stage geometry or a body/shield hit; no penetration. Shields stop status application. Persistent puddles and zones cannot be reflected and do not hit through solid terrain. No homing unless a move explicitly defines it. Predicted entities live in snapshot state, not divergent native unit simulation.

Per fighter, cap ordinary traveling projectiles at 3 and persistent owned objects at 2 unless the kit states a smaller limit. Summons are at most one active bear, skeleton, or lava spawn for their respective owner. Cosmetic clones cannot collide, grab, body-block, or consume hitboxes. Ultimates receive a separate reserved pool of at most six combat objects per competitor, so activating one cannot silently evict a normal pet or trap. Destroy owned combat entities on stock loss and clear them on round reset. A new cast beyond an entity cap must fail before spending mana, unless that move explicitly recalls or replaces an object.

Summon durability is a separate damage pool. Attacks can hit a fighter and a summon on the same frame if their volumes intersect; the summon never shields the owner by intercepting a melee hit. Summons cannot grab, take stocks, activate items, or trigger native Warcraft orders. Their hits do not refill the owner’s resources. Totems and gadgets are targetable by normal attacks; shields cannot be placed around them.

### Defense and status limits

Armor, when explicitly listed, absorbs hit reaction from one hit up to its listed damage threshold, but damage still applies; grabs ignore armor. A stronger hit breaks it. Being heavy grants no armor. Intangibility is only on the explicitly listed frames and cannot be reused to refresh ledge invulnerability. Never let a defensive transformation clear existing hitstun.

At most one copy of each status per target; reapplication refreshes duration but does not stack strength. Hex and sleep count down in simulation frames, not wall time. Their timers, active source IDs, immunity windows, and any damage counters belong in snapshots. No status disables ordinary jumping, shielding, DI, or recovery unless its exact short effect states otherwise. Hex is the one that does: it takes every control but DI (Tom, 2026-10-26, #521), and its mash-out, never before frame 36, is what keeps it from removing recovery.

### The ultimate meter

Every special is free; Strong + Special is the ordinary special. The ultimate (Attack + Special) needs the full ultimate meter, which only centre-stage orbs fill. The rules and input are in [gameplay-design.md](../gameplay-design.md#build-and-spend-mana-and-the-ultimate-meter) and [mana.md](mana.md). Earlier ultimate proposals below are historical design references, with no gameplay action.

## Baseline fighter properties

### Run and entry-dash ceiling (#333)

No fighter's ordinary run or entry dash exceeds Captain Falcon's NTSC 1.02
speed. Our design target, from public frame data (SmashWiki's Captain Falcon
page), is a run speed of 2.299999952316284 and a dash entry of 2.0 Melee
units/frame.

Smashcraft's existing scale is six world units per Melee unit at 60 logical
frames/second (`WORLD_UNITS_PER_MELEE_UNIT` in `sim/tuning.ts`,
[physics](../physics.md#initial-implementation-choices)). Binary32 scaling
gives a run ceiling of **13.799999237060547 world units/frame** and dash-entry
ceiling of **12 world units/frame**.

The four over-limit fighters retain their strict speed order, above Shadow
Hunter's unchanged 13.728 run and 11.856 dash: Blademaster < Dreadlord <
Mrgl & Grgl < Warden. Their explicit overrides preserve the existing walk
multiplier and all other movement properties.

| Fighter | Run before → after | Entry dash before → after |
| --- | ---: | ---: |
| Blademaster | 14.256 → 13.74 | 12.312 → 11.892 |
| Dreadlord | 14.520 → 13.76 | 12.540 → 11.928 |
| Mrgl & Grgl | 14.784 → 13.79999828338623 | 12.768 → 11.999999046325684 |
| Warden | 15.048 → 13.799999237060547 | 12.996 → 12 |

Values in this table other than the ceiling are rounded for readability.
Fighters already below the ceiling keep their existing values.

Weight is relative to the current reference fighter at 1.00. Run speed is a multiplier on the existing reference; air speed is a multiplier on 1.00 Melee units a frame, the air-drift reference ([Air drift and jump momentum](../gameplay-design.md#air-drift-and-jump-momentum), #190); hurtbox dimensions are relative width and height. All fighters start with the same two jumps, with jump velocity and gravity inherited from the reference unless later testing explicitly changes them. Air speed does not change jump height. Size must match the visible model; trim collision capsules rather than counting weapons or flames as torso.

| Hero | Weight | Run speed | Air speed | Width | Height |
| --- | --- | --- | --- | --- | --- |
| Blademaster | 1.00 | 1.08 | 1.00 | 1.00 | 1.05 |
| Mountain King | 1.12 | 0.88 | 0.82 | 1.10 | 0.85 |
| Warden | 0.88 | 1.14 | 1.10 | 0.90 | 1.00 |
| Brewmaster | 1.13 | 0.98 | 0.90 | 1.20 | 1.10 |
| Lich | 0.85 | 0.90 | 0.95 | 0.90 | 1.28 |
| Uther | 1.41 | 0.86 | 0.84 | 1.08 | 1.02 |
| Dreadlord | 1.24 | 1.10 | 1.22 | 1.10 | 1.15 |
| Shadow Hunter | 0.94 | 1.04 | 1.00 | 0.92 | 1.08 |
| Pit Lord | 1.28 | 0.80 | 0.75 | 1.65 | 1.35 |
| Tinker | 1.05 | 0.94 | 0.86 | 1.20 | 0.95 |
| Alchemist | 1.20 | 0.86 | 0.80 | 1.35 | 1.25 |
| Naga Sea Witch | 1.02 | 0.94 | 0.76 | 1.20 | 1.05 |
| Beastmaster | 1.10 | 0.97 | 0.88 | 1.15 | 1.26 |
| Dark Ranger | 0.90 | 1.08 | 1.04 | 0.90 | 1.00 |
| Firelord | 0.98 | 0.94 | 0.94 | 1.02 | 1.10 |
| Lich King | 1.12 | 0.84 | 0.86 | 1.12 | 1.26 |

### Model scale

Decided 7 Oct 2026 (#162, Tom delegated): fighters keep Warcraft's own model
proportions. Each fighter is drawn at its stock unit's model scale times one
shared factor, `FIGHTER_MATCH_SCALE` (1.0), with no per-fighter size boost;
1.0 leaves the median fighter's size, and so the camera's framing, unchanged.
The stock scale is the unit's `modelScale:sd` in the game's
`units/unitskin.txt`, the field Warcraft applies to the classic models the
clients draw. Unit body, clip pool, effects, star knockout and stage placement
all read the one value in smashcraft:ts/src/game/presentation/modelScale.ts;
smashcraft:ts/test/model-scale.test.ts pins draw scale = stock scale × the
factor for every fighter. Hurt capsules follow the drawn body:
smashcraft:ts/test/drawn-size.test.ts holds each drawn head within 0.9-1.3 of
its capsule's top.

| Fighter | Stock unit | Stock model scale | Draw scale | Before #162 |
| --- | --- | ---: | ---: | ---: |
| Rifleman | hrif | 1.00 | 1.00 | 1.40 |
| Illidan | Edem | 1.00 | 1.00 | 0.80 |
| Blademaster | Obla | 1.00 | 1.00 | 1.00 |
| Mountain King | Hmkg | 1.00 | 1.00 | 1.00 |
| Warden | Ewar | 1.00 | 1.00 | 1.00 |
| Lich | Ulic | 1.00 | 1.00 | 0.80 |
| Uther | Huth | 1.10 | 1.10 | 1.10 |
| Dreadlord | Udre | 1.00 | 1.00 | 1.00 |
| Shadow Hunter | Oshd | 1.00 | 1.00 | 1.00 |
| Pit Lord | Nplh | 1.00 | 1.00 | 0.95 |
| Beastmaster | Nbst | 1.00 | 1.00 | 0.85 |
| Lich King | none: Kwaliti's LichKing2 | 1.00 | 1.00 | new |

Rifleman stands 87 units at scale 1, Shadow Hunter 138: the dwarf is drawn
smaller because Warcraft draws him smaller. The fighters whose draw scale
moved had their hurt capsule's height refit to the drawn head, keeping the
ratio of drawn height to capsule top they had before: Rifleman's top is 87
(was 122), Illidan's 159 (127), Lich's 151 (121) and Beastmaster's 143 (122),
the heroes through Height above. Widths stay as authored: each kit's strikes
and travel stops are spaced against them. Pit Lord's drawn height stays
within the band, so his capsule is unchanged.

The Lich King (#167) is a community model with no Warcraft unit behind it,
so no unit model scale applies: he is drawn at 1.0 times the shared factor.

### Credits

Every fighter draws Warcraft III's own models except these community works,
which the map imports from private build inputs (never Git) at the archive
paths their authors' readmes name (smashcraft:ts/src/game/assets/importedModelInfo.ts).
The map's description carries the same credits.

- The [Lich King model by Kwaliti](https://www.hiveworkshop.com/threads/the-lich-king.154837/)
  (Hive Workshop): LichKing2, its portrait, textures and
  [command icons](https://www.hiveworkshop.com/threads/btnlichking.154846/),
  used with credit as the author permits.
- [Warchief Thrall Dismounted by johnwar](https://www.hiveworkshop.com/threads/warchief-thrall-dismounted-re-classic.332006/)
  (Hive Workshop), built on Ujimasa Hojo's Grom Hellscream:
  `WarchiefThrallDismountedV2.mdx`, imported as
  `war3mapImported\WarchiefThrallDismountedV2.mdx` for Thrall's unit, with
  every Smashcraft clip authored on it by smashcraft:tools/animations/thrall-clips.ts.
  The page states no usage terms (read 28 October 2026,
  smashcraft:docs/design/roster-next.md#hive-model-terms), so we credit
  every author it names, as Hive's custom asks.
- [Tyrande Whisperwind (Re-Classic Pack) by johnwar](https://www.hiveworkshop.com/threads/tyrande-whisperwind-re-classic-pack.348819/)
  (Hive Workshop, approved and recommended): its dismounted body
  `TyrandeDismountedV2.mdx`, imported as `war3mapImported\TyrandeDismountedV2.mdx`
  for Tyrande, with every Smashcraft clip authored on it by
  smashcraft:tools/animations/tyrande-clips.ts. It is a 5,181-polygon model
  that draws only Warcraft III's own Classic textures, with no texture of its own.

- [Katrana Prestor by Footman16](https://www.hiveworkshop.com/threads/katrana-prestor.362851/)
  (Hive Workshop, approved and recommended, Classic SD models): `KatranaPrestorHero.mdx`
  and its texture `KatranaPrestor.blp`, imported as
  `war3mapImported\KatranaPrestorHero.mdx` for Onyxia's human form. It is an
  843-polygon edit of AndrewOverload519's Female Human Mage and kangyun's Sally
  Whitemane staff, both permissions posted on the page (read 31 October 2026,
  smashcraft:docs/design/roster-next.md#onyxias-two-models-read-31-october-2026).
  Its page asks only for credit. Its two command icons are crops of Hearthstone
  art and are not imported; the select portrait is rendered from the model.

Source terms read on 29 October 2026 from the Wayback Machine's 20 October
2025 copy of the page: johnwar names Ujimasa Hojo's Archer, Dark Ranger,
Sylvanas Windrunner and derivatives and kangyun's Tyrande Whisperwind (Heavy
Mount) as the base models, and posts kangyun's permission in the thread. The
page states no usage terms, so we credit every author it names, as Hive's
custom asks: "Tyrande Whisperwind (Re-Classic) by johnwar (Hive Workshop),
built on Ujimasa Hojo's Archer, Dark Ranger and Sylvanas models and kangyun's
Tyrande, used with kangyun's permission."

Source terms read on 13 October 2026: the model resource identifies Kwaliti,
`LichKing2.mdx` and `LichKing2_Portrait.mdx`, and asks users to give credit.
Kwaliti's [23 January 2025 usage statement](https://www.hiveworkshop.com/profile-posts/951524/)
on the [author's Hive profile](https://www.hiveworkshop.com/members/kwaliti.136001/)
permits free use of the author's work in any way, with credit to the author
and Hive Workshop as the original source. The relevant terms are:

> “use my stuff freely whichever way you see fit”
> “Just credit me & the Hive as the original source.”

The map description credits Kwaliti and Hive Workshop; the repositories keep
these assets outside Git in private build inputs.

Stages also import one community model:

- The [Undead Walls Pack by Kuzakani](https://www.hiveworkshop.com/threads/undead-walls-pack.369286/)
  (Hive Workshop, approved 8 December 2025): `UndeadWalls.mdx`, imported
  as `war3mapImported\UndeadWalls.mdx` for Naxxramas's back wall. It is an
  MDX 800 model built in Retera Model Studio from Warcraft III's own Classic
  textures, with no texture of its own and no World of Warcraft geometry.

Source terms read on 18 October 2026: the resource is tagged "Open Source"
(free to use and modify) and asks nothing beyond Hive Workshop's usual
credit to the author. The page also carries Hive's "Contains External
Material" tag without naming the material; the model itself references only
Warcraft III textures, and the page's one outside picture is an Icecrown
Citadel reference image. Our copy changes one texture path of the birth and
death dust emitter, `Textures\Clouds8x8.blp`, absent from the Classic
3.0.0.24268 archives, to `Textures\Dust3x.blp`. The map
description credits Kuzakani and Hive Workshop.

Original art generated in this repository needs no credit beyond the
project's own: Chen's paper parasol, its model and both textures, is
generated by smashcraft:tools/effects/parasol.ts with no outside art.

The individual hero sections below specify all attacks. Their counterplay descriptions are acceptance goals to test, not claims established by these numbers.

## Blademaster

**Identity:** a disciplined sword fighter who wins by spacing the outer blade and punishing misses. He gets strong reach and ground speed, not unrestricted teleportation or random critical hits. His exposed hands and torso remain hittable.

### Normals

| Input and move | F/A/R and landing | Damage | Reach and launch | Behavior |
| --- | --- | --- | --- | --- |
| Jab — Hilt Check | 4/2/13 | 3 | S, 35, POKE | Quick pommel strike; no sword-length disjoint |
| Forward tilt — Measuring Cut | 8/3/19 | 8 inner, 9 outer | L, 35, POKE | Outer final 0.20H of blade rewards spacing |
| Up tilt — Rising Crescent | 7/5/20 | 8 | M, 90, LAUNCH | Arc above and slightly behind; weak directly low in front |
| Down tilt — Ankle Cut | 7/3/17 | 6 | L, 75, LINK | Low thin sweep; a starter rather than a kill move |
| Dash attack — Advancing Slash | 10/4/28 | 8.5 strong, 7 tip | L, 45, LAUNCH | Moves 0.55H forward during startup; cannot pass through shield |
| Forward smash — Execution Cut | 17/3/35 | 13 inner, 17 outer | XL, 40, KILL growth, base 30 | Large horizontal cut; outer 0.20H is sweetspot |
| Up smash — Sky Splitter | 15/4/30 | 16 | L, 90, KILL | Narrow vertical blade with no broad ground scoop |
| Down smash — Low Circle | 14/6/31 | 14 | L, 25, EDGE | Low sword sweep in front on frames 14–16, then behind on 17–19; one hit total per target |
| Neutral air — Blade Wheel | 6–7, 14–17; 36 total; L7 | 3.7 + 9.3 | 0.75H blade, link 90 then 45, base 50 | Two forward flips with the blade out, one hit per flip ([multi-hit](aerials.md)): the first holds the foe in hitstun, the second launches; after Melee Marth's neutral air |
| Forward air — Long Cut | 10/3/22; L14 | 11 inner, 14 outer | L, 40, EDGE | Primary spacing aerial; outer 0.20H sweetspot |
| Back air — Reverse Edge | 8/3/23; L13 | 12 | L, 35, KILL | Strong behind, commits facing |
| Up air — High Thrust | 6/3/19; L11 | 8 | M, 85, LAUNCH | Narrow upward poke |
| Down air — Crescent Tipper | 6/4/35; L16 | 12.1 tip, 8.4 inner | 0.75H blade; tip 290 (spike), base 40; inner 45, base 20; 44 frames, auto-cancel before 6 and from 38 | One crescent sweep under him from front to back; the outer 0.20H of the blade is the tipper and spikes, the inner blade sends up and away; after Melee Marth's down air, but 44 frames where Marth's is 59 (a deliberate departure: Tom asked on 2026-10-28 that Blademaster be able to down air off stage and still recover, so he can double jump, up special, air dodge or attack from frame 44) |

### B specials

| Input | Proposed move and behavior | Timing and cost |
| --- | --- | --- |
| Neutral B | **Quickdraw** (Tom, 2026-10-28; after Melee Marth's Shield Breaker and Roy's Flare Blade): hold special to crouch in an iaido stance with the blade sheathed while the hilt glows brighter, then release to draw. Uncharged it is a quick cut with a 0.3H step; each further 1/17 of the charge adds 1% and speed, up to a 2.2H dash slash at full charge that passes through the foe and leaves him behind them. 7–24 damage at 80 degrees, growth 108.6, base 40, so the foe pops up as he blurs past (a low-charge draw leads into up air; a full one kills off the top); shield damage 1.5 times the damage. Each foe is struck once per draw, and every hit pops a red Warcraft III critical-strike number of the damage dealt, sized by it. In the air the stance neither stalls nor lifts him, and the draw's horizontal dash happens once per airtime. | Stance f1–8, charge up to 60 frames held at f8, auto-draw at full; draw: dash and hit from f13 for 6 (uncharged) to 10 (full) frames, stop, end 16 frames later (f34 uncharged, f38 full); 0 mana |
| Side B | **Mirror Image** (#124): after a visible tell, an image stays where he stood (one hit of any kind shatters it; 210 frames, 3.5 s) and he steps 1.0H the way side B points, turning first when it points behind him; holding left or right during frames 1–11 sets the side he steps instead while he keeps the facing side B gave him; in the air the step is sideways only, once per airtime, with no rise. Side special while the image stands **swaps**: he takes the image's place facing its way and slashes for 10 damage at 40 degrees, EDGE. The image never attacks; no intangibility. | Image and step f12, end f28, 15 mana;
| Up B | **Rising Whirlwind:** sword extended through a charged spin dash, in the chosen direction, meeting the [#252 long-route recovery band](../gameplay-design.md#recovery-and-edgeguarding); one hit for 9 damage at 80 degrees, LAUNCH. No intangibility. Mana-free version meets the 240-unit route floor with no attack. | Aim f1–8, hit f9–14, dash f9–22, stop f23, then helpless; 15 mana |
| Down B | **Wind Walk** (#124, #523, smashcraft:docs/design/kit-review-1.md): Marth's Counter. He fades see-through; a strike that meets him in the window freezes its attacker 11 frames while he steps out behind them and kicks them straight up from a hand plant, 7% at 90 degrees, base 30, growth 170 (kills Rifleman at centre stage from 160%). A whiff stands wide open; in the air it is the same whiff, with no travel and no helpless fall. | Counter f5–29, end f59 (acts f60); kick: behind on f8, hit f14–20, end f46; 18 mana | swap f6, slash f8–10, end f30, free |

### Grab and throws

Standing grab 7/2/22, reach 0.55H, one-handed collar catch. Pummel: pommel strike using shared values.

| Throw | Animation and release | Damage | Release and recovery | Launch |
| --- | --- | --- | --- | --- |
| Forward | Shoulder shove with blade hilt | 7 | f12, R18 | 35, EDGE |
| Back | Pivot and kick behind | 8 | f15, R22 | 40, EDGE |
| Up | Hilt lifts target overhead | 6 | f13, R10 | 85, JUGGLE |
| Down | Knee check and low toss | 5 | f16, R20 | 65, CHASE |

**Ultimate — Bladestorm:** the powered-up form of Rising Whirlwind, keeping its sword-out spin. Its design uses f24 startup, 120-frame active spin on f24–143 with ground speed capped at half normal run speed, reach L, six possible 3-damage LINK hits at 70 degrees per target at least 18 frames apart, then a single 10-damage KILL finisher at 45 degrees on f144–146; R40. No invulnerability or armor, no grab, and no ledge travel off solid ground. One activation ID tracks all hit limits. Avoid literal uninterruptible Warcraft Bladestorm.

**Required counterplay test:** forward smash whiff must give a fast fighter at its outer edge a plausible approach punish; Mirror Image cannot reset its own recovery or create a true 50/50 without prior advantage.

**As implemented** (smashcraft:ts/src/game/fighters/blademaster/moves.ts, blademasterSpecials.ts, blademasterClips.ts). Every row above is authored; these are the departures:

- Forward tilt also has up- and down-angled forms with the row's timing and damage; only the blade path changes.
- Down air's tip spikes airborne targets only; it sends grounded targets at 55 degrees, as the shared notation directs.
- Dash grab uses the shared rule (startup +3, recovery +8) on the standing grab's volumes.
- Quickdraw, Mirror Image and Wind Walk keep their grounded timing in the air; Quickdraw and Mirror Image end on landing with 20 frames of lag, and the airborne Wind Walk keeps the rest of its lag on landing; it neither stalls nor ends helpless.
- Rising Whirlwind hovers through f12, then dashes in the chosen direction over f13–26 and stops on f27, so the helpless fall starts from rest. Tom asked on 28 Oct 2026 (delegated) for four more startup frames than the f8 hover; the aim window, motion, hit regions, hurt poses and end frame all moved four frames later and the baseline's frame values with them. The paid route rises 480–640 units; the shorter free route reaches at least 240 units on either axis, with no hit (#252). The stock whirlwind is reserved for this move family.
- Wind Walk is a special guard with `counter` and `freezeFrames`: the countered strike's attacker is locked (`special.seekTarget`) and the kick's `Relocation.behindLocked` places him behind them within 2.5H; a projectile or an attacker out of reach gets the kick in place. Mirror Image's image is a placed object drawn as his see-through model; the swap is its recall form (`relocate`). Tom asked on 28 Oct 2026 (delegated) for four more startup frames on Mirror Image: the image appears on f12 and the step starts on f13 instead of f8 and f9, the end frame moves from f24 to f28, ground and air alike, and the swap press keeps its timing. On the same day the two specials traded inputs: Wind Walk went to down B, where Marth's Counter sits, and Mirror Image to side B, stepping the way side B points (a grounded press stops his run on f1 so the image stays where he stood; the air form is once per airtime). The computer recovers with side-B Mirror Image toward the stage and then an angled Rising Whirlwind when it has no jump left (`recovery.sideSpecial` in his gameplan).
- Presentation extends the stock model with a distinct authored gesture for every jab, tilt angle, smash and aerial. Down smash sweeps front then rear; neutral air is two whole-body forward flips with the blade drawn on each hit; back air turns into its slash; down air sweeps one crescent under him from front to back. The double jump keeps its authored front flip. These clips preserve the existing combat timing, regions and damage.
- Bladestorm is not implemented; ultimates stay off in competitive play.

### Play-style profile

Tom-tunable draft (8 Oct; smashcraft:docs/design/balance.md, "Play-style profiles"). Blade-tip spacing and whiff punishment on the ground.

```balance-profile
fighter: blademaster
archetype: bait-and-punish
aerials: nair 10-40, fair 15-45, bair 15-45, uair 5-30, dair 0-25
air-share: 15-45
approach: 40-70
ranged: 0-20
specials: neutral 1-10, side 2-12, up 0-8, down 1-10
```

Path draft for Tom to correct (#358):

```ceiling-plan
fighter: blademaster
path: execution
basic-moves: forward-tilt,down-tilt,neutral-air
```

Basic gameplan: Poke with grounded tilts and use a neutral aerial on simple jumps. Keep one approach, use the listed moves, no read-based punishes or advanced kit sequences. Recovery keeps the normal up special.

Expert gameplan: Time dash-dancing, sword confirms and aerial routes into the right finisher. Use the full authored kit and gameplan at the same CPU skill.

### Signature strong/weak move (#389)

Forward smash, split by position: strong hit sweetspot, frames 17-19, 17% at base 30; weak hit sourspot, frames 17-19, 13% at base 30 (Tom, 17 Oct: he struggled to kill, so the tip now kills nearly as early as Mountain King's smash). Critical Strike at the katana's tip: the duelist who spaces to the tip kills.
The roster table is in [gameplay-design.md](../gameplay-design.md#strong-and-weak-hits-389) and every split in the [move list](../move-list.md).


## Mountain King

**Identity:** a compact heavy whose hammer, axe, and deliberate stun setups reward close reads. He has strong burst force and a projectile, but poor chase and limited air drift. No random Bash.

### Normals

| Input and move | F/A/R and landing | Damage | Reach and launch | Behavior |
| --- | --- | --- | --- | --- |
| Jab — Hammer Butt | 5/2/15 | 4 | S, 35, POKE | Short body check with hammer hilt |
| Forward tilt — Axe Hook | 9/3/21 | 13.75 | M, 35, EDGE | Wide frontal chop with exposed hand |
| Up tilt — Hammer Lift | 8/4/22 | 9 | M, 90, LAUNCH | Head-level scoop, limited rear reach |
| Down tilt — Boot and Axe | 7/3/18 | 7 | S, 70, LINK | Low kick; no trip RNG |
| Dash attack — Dwarf Charge | 11/5/28 | 13.75 | M, 40, LAUNCH | Body hitbox; completely tradeable |
| Forward smash — Mountain Breaker | 20/3/36 | 21 | L, 40, KILL | Heavy overhead hammer; head is sweetspot, handle 16 damage |
| Up smash — Twin Lift | 17/5/32 | 17 | M, 85, KILL | Axe and hammer form one hit above |
| Down smash — Stone Sweep | 16/6/34 | 16 | M, 25, EDGE | Front then back, one hit per target |
| Neutral air — Hammer Somersault | 7/26/11; 43 total; L8 | 12 clean (7–14), 9 late (15–32) | hammer at arm's length plus body; 45, clean base 18, late base 0, growth 100 | One front flip with the right hammer flung out, its head circling him in front, under, behind and over; one hit, strongest early. After Melee Pikachu's neutral air (3–10 clean, 11–28 late, 39 total, 7 L-cancelled), four frames later for the heavy; auto-cancel before 7 and from 38 |
| Forward air — Hammer Drop | 16/3/30; L21 | 16 | M, 270, SPIKE | Hammer head spikes; handle launches 45 degrees for 11 |
| Back air — Backhand Axe | 10/3/25; L15 | 13 | M, 35, KILL | Strong short rear swing |
| Up air — Headbutt | 7/4/22; L13 | 10 | S, 85, LAUNCH | Body hurtbox stays exposed |
| Down air — Storm Drill | 12/13/22; 46 total; L20 | 12, electric | head-down body plus hammer; 45, base 20, growth 100 | He flips head-down and drills about his vertical axis with the right hammer held out, so the head and hammer strike under and round him; one hit, no stall or bounce. After Melee Pikachu's down air (14–26, 12% electric, 57 total, actionable 48, 20 L-cancelled, auto-cancel from 38), two frames sooner so his short hop reaches a standing foe; auto-cancel only from 36 |

### B specials

| Input | Proposed move and behavior | Timing and cost |
| --- | --- | --- |
| Neutral B | **Storm Bolt** (#125, smashcraft:docs/design/kit-review-1.md): thrown hammer; 5 damage, LAUNCH at 65 degrees, flies straight ahead at 0.10H/frame until it hits or its life (90) ends; it never comes back (#547). Reflectable; one bolt active. Landing before the hammer leaves continues the same cast on the ground, with the hammer still on f23 and no landing lag added. | Spawn f23, end f61; 8 mana |
| Side B | **Storm Rush:** shoulder dash 1.2H; 12 damage, EDGE at 35 degrees. No armor, no command grab, stops at shield. Air version has no upward lift and ends helpless. | f13–18 active/moving, R28; 18 mana |
| Up B | **Thunder Leap:** arcing 1.8H rise and up to 0.7H horizontal travel; hammer attack during ascent for 8 damage, LAUNCH at 80 degrees. Free version reaches 1.3H, no attack. **Hammerfall** (#125, #509): with no special press, on f27 of the leap (its top), hit or miss, a stick held in a different one of the 8 direction zones from the leap's starts the dive: he hangs 3 frames, then dives hammer first along that zone at 0.16H/frame (straight down with the stick down); a stick at rest or still in the leap's zone starts nothing and he falls helpless (Tom 2026-10-28): 12 damage against airborne targets (SPIKE on the downward dives, LAUNCH at 85, 50 or 35 degrees on the up, up-diagonal and sideways ones), 10 at 55 degrees against grounded ones. The downward dives run until he lands; the up, up-diagonal and sideways dives travel 12 frames (1.9H) and end on f33. Landing lag 24, helpless after the dive, or after the leap without one. | Rise/hit f11–16, movement through f30, then helpless; 15 mana; Hammerfall free |
| Down B | **Thunder Clap, charged** (#125): he raises the hammer f1–6 and holds the charge f7–46. Special in f7–26: Clap, ground ring of 0.85H both sides, 9 damage LAUNCH 70 degrees; special in f27–46 or running out (slam f50): Thunder Clap, the ring at 12 plus a reflectable ground wave each way (0.10H/frame, 24 frames, active from its 6th, 7 damage LAUNCH 75 degrees); shield in f7–46 drops the charge. No armor. Air version swings hammer underneath with 0.55H reach, no charge, no shockwave. | Slam active f4–7 after the release, end 28 (Clap) or 32 (Thunder Clap) frames after it; run-out ends f78; 20 mana |

### Grab and throws

Standing grab 8/2/25, reach 0.50H. Pummel: helmet headbutt.

| Throw | Animation and release | Damage | Release and recovery | Launch |
| --- | --- | --- | --- | --- |
| Forward | Hammer-hilt shove | 9 | f14, R22 | 35, EDGE |
| Back | Over-the-shoulder heave | 10 | f18, R27 | 40, KILL |
| Up | Hammer-assisted toss | 8 | f16, R13 | 90, JUGGLE |
| Down | Ground slam with rebound | 7 | f20, R26 | 75, CHASE |

**Ultimate — Avatar:** f30 vulnerable transformation, R12, then 480 frames at weight multiplier 1.15 and damage multiplier 1.10. No permanent armor, immunity, heal, size change, or knockback cleanse. Existing knockback at activation is not retroactively recomputed. Visual stone overlay must preserve silhouette.

**Required counterplay test:** blocked Storm Bolt must not guarantee a grab from its full travel distance; Thunder Clap cannot cover both a retreat and a jump without a read (a jump clears ring and waves; the shield cancel is the bait).

**Implemented kit** (smashcraft:ts/src/game/fighters/mountain-king/moves.ts, mountainKingSpecials.ts, fighters/mountain-king/clips.ts). Every row above is implemented; nothing is omitted. Deliberate additions and choices where the table is silent:

- Forward tilt also has up- and down-angled paths with the same timing and damage.
- Hammer Drop's head launches grounded targets at 55 degrees (the shared grounded spike rule).
- Air Thunder Clap reuses 10 damage and 70-degree LAUNCH on its 0.55H under-hammer path.
- Thunder Clap is a ground-level ring 30 units tall, so a jump clears it while it still covers both sides; its release and shield cancel are follow-up branches (`followUps`), and the waves start just past the ring.
- Thunder Leap puts half its exact rise into the f9-14 hit window and eases over f15-28 so it peaks at the listed height; the free form peaks at 1.3H with 0.5H drift.
- Storm Rush stops at a raised shield or a body (shared `stopsAtBody`) and stops dead after its 1.2H dash; its lowered shoulder carries a hurt volume while it strikes.
- Mountain King's hurt volumes add the arm, leg or boots behind each normal from late startup through early recovery; hammer and axe stay outside them.
- The stock model has thirteen usable sequences and no jump, hit, dodge, ledge or grab clips: hits play the opening of Death, jumps and techs the opening of Stand - 3, ledge and grab holds a held Stand Ready.

**Balance** (#105, all-pairs computer field, 3 stocks): Storm Bolt 7 → 5 damage, so it covers his slow approach instead of winning neutral from range: field win rate 71% (b2ed6109, 100/pair) → 66% (20/pair), self-destructs 1%.

**Gameplan** (smashcraft:ts/src/game/fighters/mountain-king/gameplan.ts, #105): he keeps 0.6-1.0H, at Axe Hook's tip, spacing with Axe Hook and Boot and Axe and covering his slow approach with Storm Bolt from 1.5H out; he shoots or runs in with grab, Boot and Axe and Dwarf Charge, never jumps in, and meets an attack with his shield or a spot dodge. Boot and Axe, Hammer Lift and the down throw start his strings; Mountain Breaker, Twin Lift, Backhand Axe and the back throw finish. His limited air drift is the weakness he plays around: he fights on the ground and keeps his spot 160 units inside the edge, so a launch leaves the shortest way back, and returns to the ledge with his jump before Thunder Leap.

### Play-style profile

Tom-tunable draft (8 Oct; smashcraft:docs/design/balance.md, "Play-style profiles"). A grounded heavy; back air only as a finisher, Storm Bolt covers the approach.

```balance-profile
fighter: mountain-king
archetype: heavy
aerials: nair 15-45, fair 15-45, bair 0-20, uair 5-30, dair 5-30
air-share: 5-35
approach: 45-75
ranged: 0-20
specials: neutral 3-15, side 1-10, up 0-8, down 1-10
```

Path draft for Tom to correct (#358):

```ceiling-plan
fighter: mountain-king
path: mixed
basic-moves: forward-tilt,down-tilt,neutral-special
```

Basic gameplan: Use safe axe pokes and a hammer throw, then return directly. Keep one approach, use the listed moves, no read-based punishes or advanced kit sequences. Recovery keeps the normal up special.

Expert gameplan: Mix hammer control, grabs, close confirms and charged kill windows. Use the full authored kit and gameplan at the same CPU skill.

### Signature strong/weak move (#389)

Forward smash, split by position: strong hit sweetspot, frames 20-22, 23.2%; weak hit sourspot, frames 20-22, 17.7%. The storm hammer's head carries the weight; the haft only shoves.
The roster table is in [gameplay-design.md](../gameplay-design.md#strong-and-weak-hits-389) and every split in the [move list](../move-list.md).


## Warden

**Identity:** light, mobile precision fighter using crescent blades and a punishable blink. Her escape options cost space and commitment; they cannot erase a bad attack. Fan of Knives gives close coverage rather than full-screen zoning.

### Normals

| Input and move | F/A/R and landing | Damage | Reach and launch | Behavior |
| --- | --- | --- | --- | --- |
| Jab — Gauntlet Cut | 3/2/13 | 3 | S, 35, POKE | Short interrupt, low reward |
| Forward tilt — Crescent Slice | 7/3/18 | 8 | M, 35, POKE | Moderate disjoint, no sword-length spacing |
| Up tilt — Crescent Lift | 6/4/18 | 7 | M, 85, LINK | Front-to-overhead arc |
| Down tilt — Low Blade | 5/2/17 | 5 | M, 70, LINK | Thin forward poke |
| Dash attack — Pursuit Cut | 8/4/24 | 9 | M, 60, LAUNCH | Advances 0.6H, stops at opponent/shield |
| Forward smash — Judgment Edge | 15/3/30 | 16 | L, 40, KILL | Requires spacing; inner hit 12 damage |
| Up smash — Moon Arc | 13/4/27 | 14 | M, 90, KILL | Vertical threat with small ground coverage |
| Down smash — the splits (#518) | 6/5/35, charge between 2 and 3 | 12 | S, 25, EDGE | Fox's split kick: both legs out along the floor at once, hitting front and back on the same frames, each launching away from her |
| Neutral air — Cloak Spin | 5/5/18; L10 | 6 | M, 50, POKE | Short circular blade sweep |
| Forward air — Pursuer | 8/3/20; L12 | 10 | M, 40, EDGE | Fast approach aerial with limited reach |
| Back air — Heel Blade | 7/3/22; L12 | 11 | M, 35, KILL | Exposed leg before weapon tip |
| Up air — Sky Crescent | 5/9/15; L10 | 2 + 2 + 5 | M, 85, LAUNCH | Three rising kicks ([multi-hit](aerials.md)); the last launches |
| Down air — Falling Knives | 7/7/14; L10 | 2×3 + 3 | M, drill | Fan of Knives in miniature: a short fast [drill](aerials.md) that drags down; no landing hit; safe, sets up a grab or her Fan of Knives mark |

### B specials

| Input | Proposed move and behavior | Timing and cost |
| --- | --- | --- |
| Side B | **Shadow Dash** (Tom's 2026-10-28 rework, Fox's Melee Illusion): a straight horizontal dash with her Blink afterimages along the path, holding still on f1–20 and covering 3.5H on f21–25; pressing special again on f21–24 stops her where she is, and the shortened dash still slashes everyone on the path it covered. The slash is 7 damage at 80 degrees, growth 40 standing and 60 in the air (fightcore.csv's Illusion rows) with base 74 (Illusion's 68 raised so a foe tumbles from 0%), a hit, a shield and a whiff all keep the same 63 frames; a pop-up that starts her strings at low percent; no stun, no homing, no teleport. In the air she hangs through the dash and uses it once per airtime, landing lag 20; a dash that ends in the air, from the ground or the air, leaves her helpless. Shared with Fel Rush through smashcraft:ts/src/game/sim/specials/illusionDash.ts. | f21–25 travel, end f63; 15 mana |
| Neutral B | **Shadow Strike:** one slow thrown blade; 2 impact damage, flinchless (Tom 2026-10-28): no knockback, hitstun, launch, hitlag or interruption of the victim's action, as Fox's laser, while a raised shield still blocks it as before. Each hit adds one **poison stack** (cap 5) and refreshes a 120-frame timer; when the timer runs out the stacks burst for 1 damage each, flinchless, with a poison-burst effect and sound, and clear. A glow over the victim's head grows with the stack count. Fan of Knives keeps its own ticking poison. Speed 0.11H/frame, life 30, radius 0.13H. Reflectable; the stacks and their burst never flinch. Timed as Fox's laser (2026-10-28): the blade leaves on frame 10 of 36 standing and in the air, she acts on frame 37, a second blade may follow while the first still flies, and landing in the air ends the cast at once with no landing lag. | Spawn f10, end f36, air landing lag 0; 5 mana |
| Up B | **Blink:** choose one of eight directions from held input at entry, travel up to 3.5H; f1–7 vulnerable, f8–10 intangible, endpoint vulnerable from f11. No hitbox. A path entering the main-deck lip within 0.5H below its top may pass: an endpoint above stays there, an endpoint within 0.5H of a free ledge catches, and one farther in lands. A taken ledge leaves her outside; deeper entry stops against the stage. Free version travels 1.9H in the chosen direction, with no intangibility. | Displacement f9; f11–30 endpoint recovery then helpless; 20 mana |
| Down B | **Fan of Knives**, a ring of knives around her (#494): f4–7, two mirrored knife capsules ahead of and behind her that each launch the foe away from her. On the ground 6.1 damage pushes the foe away at 15 degrees with shine's set knockback of 80 at every percent, so it stuns for as many frames as shine and tumbles only foes light enough for shine to tumble (Tom, 27 Oct); in the air it hits like Fox's Melee shine, 5 damage with a set knockback of 80 on a fixed horizontal semi-spike away from her, and her vertical speed is held at zero, so she nearly stops falling. Jump-cancellable from f4; every body hit is poisoned. ([design](warden-fan-of-knives.md)). | f4–7 active, end f27; 18 mana |

### Grab and throws

Standing grab 6/2/22, reach 0.48H. Pummel: elbow to the ribs.

| Throw | Animation and release | Damage | Release and recovery | Launch |
| --- | --- | --- | --- | --- |
| Forward | Knee and shove | 6 | f10, R18 | 35, EDGE |
| Back | Vault behind and kick | 7 | f14, R21 | 40, EDGE |
| Up | Blade-hilt launch | 5 | f11, R9 | 85, JUGGLE |
| Down | Trip and upward kick | 4 | f14, R20 | 70, CHASE |

**Ultimate — Spirit of Vengeance:** f24 startup and R18; for 360 frames, every completed normal creates one delayed spectral copy of that attack 12 frames later at its recorded world position. Copies deal 35 percent damage, POKE knockback, no statuses, and cannot spawn more copies. Maximum one queued copy and one active copy. Copy the recorded active hitbox timeline and facing of the normal, starting at its first active frame; it lasts that normal’s active duration and never follows the owner afterward. The opponent sees the ghost windup. No duplicated grabs, specials, or projectiles. If queuing would exceed the cap, the new copy is skipped deterministically.

**Required counterplay test:** Blink endpoint can be covered after reading direction; Fan of Knives on shield must leave a punish opportunity. No teleport may be activated from attack recovery.

**As implemented** (smashcraft:ts/src/game/fighters/warden/moves.ts, wardenSpecials.ts, wardenHero.ts; clips in smashcraft:ts/src/game/fighters/warden/clips.ts). Every row above is authored; these are the departures:

- Forward tilt also has up- and down-angled forms with the row's timing and damage; only the blade path changes.
- Warden's arm reaches each blade's hand from two frames before the strike to four after, in held poses; only the blades are disjoint. Heel Blade's leg is exposed on frames 5-13.
- Pursuit Cut stops dead after its travel instead of sliding on.
- Blink reads its eight directions from the stick held through frame 8, because an up special is always entered holding up. A grounded endpoint keeps the full recovery to frame 30. Blink follows the shared lip, occupied-ledge and deep-entry rules in gameplay-design.md, "Recovery and edgeguarding".
- Shadow Dash's shortening is the move's `shorten` window: a special press on travel frames 22-25 skips to the stop frame, so the path already swept is the one hit; A hit or a shield never skips her end lag.
- Shadow Strike's poison is its own status slot beside sleep-like conditions: it never replaces or blocks one, ignores immunity groups and refreshes rather than stacks.
- Presentation uses the stock Warden model with authored motion clips. Fan of Knives has distinct ground and air casts, coiling then spreading both arms at release (#239). Shadow Strike plays Spell Throw, and Blink plays Dissipate.
- Spirit of Vengeance is not implemented; ultimates stay off in competitive play.

**Gameplan** (smashcraft:ts/src/game/fighters/warden/gameplan.ts, #105): she keeps 0.7-1.4H, just past her blades, and spaces with Crescent Slice and Shadow Dash; she runs in with dash attack, Shadow Dash and grab or jumps in with aerials led by Pursuer, and never camps at long range. Up tilt, down tilt, up air, the up and down throws and her side special start her strings, the Shadow Dash pop-up into up air; Heel Blade, Judgment Edge, Moon Arc and the low outward Pursuer and Twin Crescent finish. She spends her jump before Blink, so its punishable endpoint is her last resort, and stays out from under a target.

### Play-style profile

Tom-tunable draft (8 Oct; smashcraft:docs/design/balance.md, "Play-style profiles"). Precision mobility and edge pressure by a light fighter.

```balance-profile
fighter: warden
archetype: rushdown
aerials: nair 15-40, fair 20-45, bair 5-25, uair 5-30, dair 10-35
air-share: 30-65
approach: 55-85
ranged: 0-15
specials: neutral 2-12, side 3-15, up 0-8, down 1-10
```

Path draft for Tom to correct (#358):

```ceiling-plan
fighter: warden
path: execution
basic-moves: forward-tilt,side-special,neutral-air
```

Basic gameplan: Poke, throw a simple knife and use a neutral aerial. Keep one approach, use the listed moves, no read-based punishes or advanced kit sequences. Recovery keeps the normal up special.

Expert gameplan: Cross up with blinks and vary knife pressure, drills and directional finishers. Use the full authored kit and gameplan at the same CPU skill.

### Signature strong/weak move (#389)

Forward smash, split by position: strong hit sweetspot, frames 15-17, 16%; weak hit sourspot, frames 15-17, 12%. The blade's far edge: a hunter who strikes at her reach.
The roster table is in [gameplay-design.md](../gameplay-design.md#strong-and-weak-hits-389) and every split in the [move list](../move-list.md).


## Pandaren Brewmaster

**Identity:** a staff-and-body heavyweight with expressive drunken movement and a brew-then-fire combination. Drunken Brawler becomes a timed evasive move rather than random dodging. He is fun at close range without copying Mountain King’s stun and hammer game.

### Normals

| Input and move | F/A/R and landing | Damage | Reach and launch | Behavior |
| --- | --- | --- | --- | --- |
| Jab — Palm Check | 5/2/14 | 4 | S, 35, POKE | Open-hand strike |
| Forward tilt — Staff Poke | 9/3/22 | 10 | L, 35, POKE | Narrow thrust, exposed hands |
| Up tilt — Barrel Lift | 8/4/22 | 9 | M, 85, LAUNCH | Jug and arm overhead |
| Down tilt — Low Staff | 8/3/19 | 7 | L, 65, LINK | Long low sweep, modest reward |
| Dash attack — Belly Bump | 10/5/27 | 12 | M, 40, EDGE | Large body hitbox, no armor |
| Forward smash — Keg Breaker | 19/3/34 | 20 | L, 40, KILL | Two-handed staff swing |
| Up smash — Staff Vault | 16/5/31 | 17 | L, 90, KILL | Staff rises first; body follows without invulnerability |
| Down smash — Sweeping Circle | 15/6/32 | 15 | L, 25, EDGE | Low front then rear swing |
| Neutral air — Roundhouse | 7/6/21; L14 | 9 | M, 50, POKE | Belly and foot circle, tradeable |
| Forward air — Keg Swing | 12/4/26; L17 | 14 | M, 40, KILL | Broad but short arm/jug hit |
| Back air — Back Kick | 9/3/24; L14 | 12 | M, 35, EDGE | Body extension is vulnerable |
| Up air — Staff Spin | 8/5/22; L13 | 10 | L, 85, LAUNCH | One hit per rotation action |
| Down air — Belly Flop | 15/5/30; L23 | 14 | M, 270, SPIKE | Adds 0.04H/frame downward velocity once; no bounce |

### B specials

| Input | Proposed move and behavior | Timing and cost |
| --- | --- | --- |
| Neutral B | **Breath of Fire:** fixed short cone, range 1.2H, 7 damage, POKE at 35 degrees. One hit per target. A Brewed target takes 4 additional burn damage over 60 frames, consuming Brewed; burn does not flinch. No held infinite breath. | f16–21 active, R25; 5 mana |
| Side B | **Drunken Haze:** arcing flask, initial velocity (0.09H, 0.06H)/frame, gravity 0.004H/frame squared, life 40. Burst radius 0.45H on collision; 3 damage with low POKE. Applies Brewed for 180 frames, reducing ground acceleration by 10 percent, not max speed, jump, or air control. One flask active, reflectable before burst. | Spawn f18, end f42; 15 mana |
| Up B | **Rising Cask:** wind-assisted corkscrew rising 1.9H, lateral drift up to 0.5H; 8 damage, LAUNCH at 80 degrees. No invulnerability. Free version 1.3H with no hitbox. | Hit/movement f10–17, ascent through f28, then helpless; 15 mana |
| Down B | **Drunken Sway:** grounded lean with intangibility f7–10 and no automatic counter. Second B during f11–18 requests a palm follow-up: first active 7 frames later, 3 active, R24, 10 damage, EDGE at 40 degrees. Base sway has fixed R through f34. In air, a vulnerable 0.25H backward lean, no intangibility or repeated lift. | Base end f34, cost 18 mana; follow-up no extra cost |

### Grab and throws

Standing grab 8/3/25, reach 0.60H. Pummel: belly bump.

| Throw | Animation and release | Damage | Release and recovery | Launch |
| --- | --- | --- | --- | --- |
| Forward | Belly-launch shove | 8 | f14, R21 | 35, EDGE |
| Back | Hip toss | 10 | f18, R25 | 40, KILL |
| Up | Staff-assisted toss | 7 | f15, R20 | 85, LAUNCH |
| Down | Seated slam and bounce | 6 | f20, R25 | 70, LINK |

**Ultimate — Storm Earth and Fire:** keep one playable fighter and avoid three autonomous fighters in the first version. On activation, f24 startup, R15, enter Storm for 180 frames (+15 percent air speed), then Earth for 180 (+15 percent weight), then Fire for 180 (+15 percent damage). No overlapping bonuses, healing, hitstun cleanse, or change to hitbox size. Two trailing elementals are cosmetic. A literal split can be a later redesign after partner mechanics are proven.

**Required counterplay test:** Brewed must never guarantee Breath of Fire from neutral. Drunken Sway cannot cover repeated attacks or grabs for its entire action.

## Lich

**Identity:** a fragile caster with deliberately placed frost attacks. The visual hover does not grant flight, immunity to ground moves, or extra jumps. Close-range normals are short; extended frost reach requires commitment.

### Normals

| Input and move | F/A/R and landing | Damage | Reach and launch | Behavior |
| --- | --- | --- | --- | --- |
| Jab — Bone Knuckle | 6/2/16 | 3 | S, 35, POKE | Weak emergency hand strike |
| Forward tilt — Frost Palm | 10/3/23 | 8 | M, 35, POKE | Compact ice extension |
| Up tilt — Crown of Ice | 9/4/23 | 8 | M, 85, LAUNCH | Ice appears only above shoulders |
| Down tilt — Chilling Touch | 8/3/20 | 6 | M, 65, LINK | Thin low burst |
| Dash attack — Cold Drift | 12/5/29 | 10 | M, 50, LAUNCH | Drifts 0.45H; vulnerable body throughout |
| Forward smash — Ice Spear | 22/3/36 | 18 | XL, 35, KILL | Stationary linear spear, not a traveling projectile |
| Up smash — Frozen Spire | 20/5/34 | 17 | L, 90, KILL | Narrow ground-to-air column |
| Down smash — Grave Frost | 19/5/35 | 14 | L, 25, EDGE | Two short floor bursts, one hit per target |
| Neutral air — Frost Halo | 9/14/17; L16 | 3×2 + 4 | M, 50, POKE | Ring around the torso that pulses three times, then bursts ([multi-hit](aerials.md)) |
| Forward air — Shard Fan | 12/3/27; L17 | 11 | L, 40, EDGE | Attached fan-shaped magic hitbox |
| Back air — Bone Spike | 10/3/25; L15 | 12 | M, 35, KILL | Short rear burst |
| Up air — Cold Star | 8/4/23; L14 | 9 | M, 85, LAUNCH | Precise overhead hit |
| Down air — Falling Crystal | 16/4/31; L22 | 12 | M, 270, SPIKE | Attached downward crystal, not a projectile |

### B specials

| Input | Proposed move and behavior | Timing and cost |
| --- | --- | --- |
| Neutral B | **Frost Nova** (#130, [kit review 2](kit-review-2.md#lich-130)): a slow orb, speed 0.09H/frame, life 80, radius 0.16H; 9 damage, POKE at 35 degrees and Chill on a body. Neutral B again while it flies stops it on the gesture's frame 4; 6 frames later it bursts for 3 frames: radius 0.7H, 10 damage, LAUNCH at 70 degrees, Chill. One orb, reflectable until burst. **Chill:** 75 frames at 60% walk, dash, run and air-drift top speed; a shield stops it; 120 frames of immunity. | Orb f18, end f41 (two frames longer since 15 Oct traction slides a shield out of grab range; projectile rule 2 keeps a three-frame shield-grab window); 10 mana. Burst gesture end f14, free |
| Side B | **Death and Decay** (#130): a field placed 1.5H ahead (a backward press turns Lich first, as every side special does), only with line of sight; radius 0.75H. It strikes the first body or shield in it from f30 (5 damage, POKE at 80 degrees) and again from f70 (9 damage, LAUNCH at 70 degrees), and is gone after f97. Interrupting Lich before f30 removes it. | Field f8, end f50; 25 mana |
| Up B | **Spectral Ascent:** visible upward glide, 2.1H height and up to 0.4H lateral drift, no hitbox or intangibility. Free version 1.4H. | Movement f10–34, helpless afterward; 15 mana |
| Down B | **Frost Armor** (#130): f22 cast grants a 240-frame shell that absorbs the hit reaction of one hit of at most 8 damage and chills the melee striker. Damage still applies; grabs bypass it. Presentation: an icy shell stays on Lich for the whole hold and blinks off more often through its last 60 frames; an absorbed hit cracks it with an ice burst and the striker takes a frost tint while chilled; Dark Ritual's shatter is a larger frost nova. **Dark Ritual:** down B while the shell holds shatters it on f6 into a 0.6H burst around Lich (5 damage, POKE at 60 degrees) and gains no meter (Tom removed the gain, 2026-10-29). | Cast f22, end f45; 20 mana. Ritual end f24, free |

### Grab and throws

Standing grab 10/2/28, reach 0.70H. Visible spectral hand, no tether recovery or remote grab. Pummel: cold pulse.

| Throw | Animation and release | Damage | Release and recovery | Launch |
| --- | --- | --- | --- | --- |
| Forward | Ice-palm discharge | 7 | f14, R23 | 35, EDGE |
| Back | Rotate target in spectral hand | 8 | f18, R26 | 40, EDGE |
| Up | Raise on an ice pillar | 7 | f17, R13 | 90, JUGGLE |
| Down | Drop and burst beneath target | 6 | f19, R26 | 75, CHASE |

**Ultimate — Frost Wyrm** (design only; owner direction, 7 Oct 2026): he summons a frost wyrm. Death and Decay became his side special ([kit review 2](kit-review-2.md)), so the channelled field below no longer describes his ultimate; it stays as the earlier design reference. **Earlier Death and Decay ultimate:** ground-only, f36 telegraph to a marked 2.0H-radius region centered 1.0H ahead; channel for up to 180 frames. Six 3-damage ticks per target at least 30 frames apart, no flinch, then a 12-damage LAUNCH burst at 80 degrees if the channel completes. Hitting or grabbing Lich ends the field without finisher. R35 after release. No percentage-health damage or unavoidable map-wide effect.

**Required counterplay test:** a fast fighter already inside Lich’s forward-tilt range must be able to challenge a missed orb or field. Frost Armor may help one trade but cannot permit casting through an entire combo.

### As built

Source: smashcraft:ts/src/game/fighters/lich/kit.ts, lichMoves.ts and
lichSpecials.ts. Every normal, grab, pummel, throw and special above is
implemented; the ultimate is not (there is no ultimate action). Changes from
the tables:

- **Death and Decay** pressed toward Lich's back turns him and places the
  field 1.5H ahead of the new facing (gameplay-design "Turnaround specials"). A field whose line from Lich crosses solid stage geometry is not
  placed (the cast and its cost still happen). Its two strikes are two
  stationary zones, so with Frost Nova's orb Lich owns three projectiles.
- **Frost Nova's burst** press is accepted once the 41-frame cast has ended,
  so the nearest burst is about 1.9H ahead.
- **Spectral Ascent** steers with the live stick at up to 0.4H/25 per frame
  over its window, in place of air drift; with a neutral stick it rises
  straight up.
- **Vertical physics** (Tom asked for a slightly floatier Lich after a playtest, 2026-10-30): gravity 0.19, terminal speed 2.4 and fast-fall speed 3.0 Melee units (the reference fighter's 0.23, 2.8 and 3.4), and full, short and aerial jump speeds the reference's scaled by sqrt(0.19 / 0.23): 3.34, 1.91 and 4.01 (3.68, 2.10 and 4.416). A full jump peaks 0.5% lower and hangs 10.7% longer (33.8 to 37.4 frames); ground speed, air speed, air acceleration, weight and every move are unchanged. Spectral Ascent's rise is a fixed velocity, so its recovery reach does not shrink. The values are `HERO_VERTICAL` in smashcraft:ts/src/game/sim/tuning.ts.
- **Frost Armor**'s shell protects from frame 22 for 240 frames, even after
  the cast ends; any hit spends it, and only a hit of at most 8 damage loses
  its reaction. While it holds, down B is Dark Ritual.
- **Bodies:** Lich has no weapon, so the conjured frost beyond the hand is
  each move's disjoint; the casting arm extends the hurt volume from late
  startup through early recovery of every normal, the grab, Frost Nova and
  Death and Decay.
- **Presentation:** the stock HeroLich model has ten sequences (Stand, Stand
  Ready, Stand - 2, Stand - 3, Walk, Stand Channel, Attack, Spell, Death,
  Dissipate). Hand strikes play Attack, frost casts Spell, sustained magic
  Stand Channel; hit reactions use the Stand - 3 sway and knockdowns Death.
- Knockback classes use provisional growth/base values, not the
  displacement-calibrated bands.

**Gameplan** (smashcraft:ts/src/game/fighters/lich/gameplan.ts, #105): he keeps 1.5-2.4H, where Death and Decay lands on the target and Frost Nova still flies, and never runs in: he advances behind his shots and covers a run-in with Ice Spear. A threat close by he mostly answers by backing out to range. Death and Decay, down tilt, up tilt and the down throw start his strings; Ice Spear, Bone Spike and a late Death and Decay finish. He jumps before Spectral Ascent, aims for the ledge, and stays off the edge, out of close range and out from under a target.

### Play-style profile

Tom-tunable draft (8 Oct; smashcraft:docs/design/balance.md, "Play-style profiles"). Deliberate projectile placement from range by a frail, slow caster.

```balance-profile
fighter: lich
archetype: zoner
aerials: nair 10-35, fair 10-35, bair 20-50, uair 5-30, dair 0-25
air-share: 15-45
approach: 20-50
ranged: 30-70
specials: neutral 5-25, side 5-25, up 0-8, down 3-15
```

Path draft for Tom to correct (#358):

```ceiling-plan
fighter: lich
path: decision
basic-moves: neutral-special,side-special,forward-smash
```

Basic gameplan: Shoot the two frost tools and smash only close targets. Keep one approach, use the listed moves, no read-based punishes or advanced kit sequences. Recovery keeps the normal up special.

Expert gameplan: Choose frost placement, shield pressure and ranged confirms for the opponent position. Use the full authored kit and gameplan at the same CPU skill.

### Signature strong/weak move (#389)

Forward smash, split by position: strong hit sweetspot, frames 18-20, 18%; weak hit sourspot, frames 18-20, 12.6%. Frost bursts at the staff's tip, so a caster who keeps distance kills at range.
The roster table is in [gameplay-design.md](../gameplay-design.md#strong-and-weak-hits-389) and every split in the [move list](../move-list.md).


## Uther the Lightbringer

**Identity:** the Silver Hand's stern, unhurried paladin and the roster's first
all-rounder: a hammer for every range and a holy answer for every situation,
none of them the best in its class. He replaced Forsaken Paladin on
28 October 2026 (Tom's request); the full kit is in [Uther](uther.md) and
production frame data lives in fighters/uther/moves.ts and specials.ts.

## Dreadlord

**Identity:** a winged close-range fighter with strong grabs and deceptive aerial approaches. Bat imagery supports movement, but he cannot fly indefinitely. Sleep is a short skill shot, not unavoidable RTS crowd control.

### Normals

| Input and move | F/A/R and landing | Damage | Reach and launch | Behavior |
| --- | --- | --- | --- | --- |
| Jab — Claw Check | 5/2/15 | 4 | S, 35, POKE | Direct claw hit |
| Forward tilt — Raking Claw | 9/3/22 | 10 | M, 35, EDGE | Long arm remains vulnerable |
| Up tilt — Wing Lift | 8/4/22 | 9 | M, 85, LAUNCH | Wing arc overhead has matching hurtbox |
| Down tilt — Low Rake | 7/3/20 | 6 | M, 70, LINK | Low claw sweep |
| Dash attack — Predatory Elbow | 10/5/27 | 11 | M, 50, LAUNCH | Advances 0.5H, body hit |
| Forward smash — Twin Talons | 18/4/34 | 18 | L, 40, KILL | Two claws act as a single hit |
| Up smash — Night Ascendant | 16/5/31 | 16 | L, 85, KILL | Wings and claws overhead |
| Down smash — Wing Sweep | 15/6/32 | 14 | L, 25, EDGE | Broad front/rear body attack |
| Neutral air — Batwing Turn | 7/10/19; L11 | 3 + 3 + 7 | M, 50, POKE | Three wing beats ([multi-hit](aerials.md)); wide, tradeable |
| Forward air — Talon Reach | 10/4/24; L10 | 14 | L, 40, EDGE | Forward reach at cost of exposing arm |
| Back air — Wing Backhand | 9/4/25; L10 | 15 | L, 35, KILL | Wing hurtbox extends too |
| Up air — Horn Lift | 7/3/21; L12 | 8 | M, 85, LAUNCH | Short upward head attack |
| Down air — Talon Drop | 14/4/29; L20 | 12 | M, 270, SPIKE | Downward claw strike, no stall |

### B specials

| Input | Proposed move and behavior | Timing and cost |
| --- | --- | --- |
| Neutral B | **Carrion Swarm:** a short bat cloud moving at 0.09H/frame for 32 frames, radius 0.25H. One hit for 7 damage, POKE at 40 degrees. Reflectable as one projectile, one cloud active. | Spawn f20, end f45; 5 mana |
| Side B | **Vampiric Pounce** (#237): horizontal corkscrew with bats trailing, ground and air. A 4-frame windup (a swarm of bats gathers into his chest) precedes a 2.24H travel across 16 frames (f5–20), stopping short of bodies/shields; 0.45H bite catch live from f5 through f23, so touching a body catches it on the first travel frame. The bite lands 4 frames after the catch for 11.75 damage, launching straight up (90 degrees, base 110, growth 12) so Dreadlord, free 13 frames after the bite (6 are hitlag), can jump and strike before the victim leaves hitstun at 0–80%. | Catch f5–23; whiff R34; 20 mana | Bite heals 4%, at most 12 a stock. Air form is once per airtime and ends helpless. |
| Up B | **Bat Ascension:** steerable rising curve up to 2.0H high and 0.8H across, no hitbox. Visible bat-body hurtbox throughout; no intangibility. Free version 1.4H height and 0.3H across. | Movement f9–32, then helpless; 15 mana |
| Down B | **Sleep** (#132): visibly slow projectile, speed 0.06H/frame, life 50, radius 0.18H, one active and reflectable. Body hit deals 2 damage and 160 frames of sleep, the same in the air as on the ground (no air special case, 2026-10-27 correction); an airborne sleeper keeps its velocity but falls at a tenth of its gravity and max fall speed for the full sleep, so the long air sleep is a punish window and not a KO (Tom, 2026-10-27; gameplay-design.md "Disabled fall"); a hit puts normal gravity back until hitstun ends; the sleeper cannot act, mashes out with the grab and freeze rule (8 frames a press or new stick direction, never before frame 24) and wakes on the next damaging hit. Then 240-frame sleep immunity. Shield blocks it. No bonus damage on waking. | Spawn f26, end f58; 25 mana |

### Grab and throws

Standing grab 7/3/26, reach 0.65H. Pummel: claw squeeze. No automatic lifesteal.

| Throw | Animation and release | Damage | Release and recovery | Launch |
| --- | --- | --- | --- | --- |
| Forward | Wing-assisted shove | 10 | f12, R20 | 35, EDGE |
| Back | Spin and fling | 12 | f18, R25 | 40, KILL |
| Up | Toss into bat cloud | 9 | f15, R11 | 85, JUGGLE |
| Down | Claw pin then kick free | 8 | f19, R25 | 65, CHASE |

**Ultimate — Summon Inferno:** a burning mark 260 ahead; f40 the meteor crashes there for 14% at 80°, and an Infernal rises on the mark and fights for 480 frames (Tom asked on 2026-10-31 for it to stay 3 seconds longer, from 300 frames): it walks slowly toward the nearest foe and slams with a 16-frame wind-up (9%, 45°, KO near 150% on a heavy), and its immolation burns 1.5% around it every 30 frames. It has 30 durability, a hit mid-slam staggers it, and it vanishes when its owner loses the stock. Dreadlord's casting action ends f56. No invulnerable summon or instant full-stage hit.

**Required counterplay test:** Sleep from neutral must be jumpable or shieldable and cannot reset its own sleep chain. Vampiric Pounce should lose to a preemptive attack and to a correctly spaced retreat.

**As implemented (smashcraft:ts/src/game/fighters/dreadlord/moves.ts, dreadlordSpecials.ts):** every row above is present; the departures are these.

- Nothing Dreadlord swings is disjointed: each claw, wing, horn and elbow path is also his body, fully out from a frame before its first active frame to two after its last, drawn out and folded back through held 3-frame poses. His standing body adds folded wings behind the shoulders to the roster capsule.
- Vampiric Pounce’s ground and air approaches stop at a body or shield and hold their height through the corkscrew. Both forms bite; the air form is once per airtime and ends helpless.
- Bat Ascension steers with the live stick (`driftSpeed`): a full side held through the rise gives 0.8H (free form 0.3H), a neutral stick rises straight. His spread wings are part of his body throughout; it has no intangibility.
- Sleep's 2-damage hit stops his target's momentum like any hit; the sleep that follows leaves velocity alone, slows an airborne sleeper's fall to a tenth of its gravity and max fall speed, and discards the sleeper's inputs.
- Presentation uses the classic HeroDreadLord model's eleven usable sequences: claws on Attack - 1/2, wings and horns on Spell and Stand - 3, the low sweep and down air on Spell Slam, jumps and Bat Ascension on the Stand - 2 wing spread. Dissipate draws no body and is not used.

### Play-style profile

Tom-tunable draft (8 Oct; smashcraft:docs/design/balance.md, "Play-style profiles"). Air movement, grabs and close pressure.

```balance-profile
fighter: dreadlord
archetype: grappler
aerials: nair 15-45, fair 10-40, bair 10-40, uair 5-30, dair 5-30
air-share: 20-55
approach: 50-80
ranged: 0-15
specials: neutral 1-10, side 2-12, up 0-8, down 1-10
```

Path draft for Tom to correct (#358):

```ceiling-plan
fighter: dreadlord
path: mixed
basic-moves: neutral-air,forward-air,side-special
```

Basic gameplan: Approach with simple aerials and one rush. Keep one approach, use the listed moves, no read-based punishes or advanced kit sequences. Recovery keeps the normal up special.

Expert gameplan: Mix sleep, grabs, cross-up rushes and conversion routes. Use the full authored kit and gameplan at the same CPU skill.

### Signature strong/weak move (#389)

Back air, split by timing: strong hit clean, frames 9-9, 13.6%; weak hit late, frames 10-12, 9.5%. The hoof kick lands hardest the frame it opens; a vampire who reads the approach takes the clean strike, the rest lingers as a weak wall.
The roster table is in [gameplay-design.md](../gameplay-design.md#strong-and-weak-hits-389) and every split in the [move list](../move-list.md).


## Shadow Hunter

**Identity:** Rokhan-inspired trap and angle specialist with a glaive, a destructible serpent ward, and brief hex pressure. His zoning is built from placed threats and traps. He retains functional normals when his setup is gone.

### Normals

| Input and move | F/A/R and landing | Damage | Reach and launch | Behavior |
| --- | --- | --- | --- | --- |
| Jab — Glaive Handle | 5/2/14 | 3 | S, 35, POKE | Quick close check |
| Forward tilt — Crescent Chop | 9/3/21 | 11.75 | L, 35, POKE | Long glaive front cut |
| Up tilt — Totem Lift | 8/4/21 | 8 | M, 85, LAUNCH | Weapon shaft above |
| Down tilt — Low Crescent | 7/3/19 | 8.5 | M, 70, LINK | Low safe-distance poke, modest stun |
| Dash attack — Jungle Slash | 10/4/27 | 10 | M, 50, LAUNCH | Forward slicing step |
| Forward smash — Spirit Cleaver | 19/3/34 | 18 | L, 40, KILL | Full glaive arc |
| Up smash — Loa’s Reach | 17/4/31 | 15 | L, 90, KILL | Spirit outline marks real vertical hitbox |
| Down smash — Twin Totems | 16/5/33 | 13 | M, 25, EDGE | Brief front/rear bursts, not persistent wards |
| Neutral air — Glaive Circle | 7/5/21; L13 | 8 | M, 50, POKE | One surrounding sweep |
| Forward air — Spirit Edge | 10/3/25; L15 | 11 | L, 40, EDGE | Weapon extension |
| Back air — Heel Hook | 8/3/23; L13 | 10 | M, 35, EDGE | Exposed foot |
| Up air — Crescent Sky | 7/3/21; L12 | 8 | M, 85, LAUNCH | Short upward cut |
| Down air — Glaive Drill | 9/14/15; L14 | 4×2 + 4 | M, drill | Sideways-carrying [drill](aerials.md) ending in a fling toward the ledge |

### B specials

| Input | Proposed move and behavior | Timing and cost |
| --- | --- | --- |
| Neutral B | **Spirit Glaive** (#133, [kit review 2](kit-review-2.md#shadow-hunter-133)): a returning glaive, speed 0.12H/frame out for 22 frames, then back toward Shadow Hunter at the same speed; life 70, radius 0.15H, one active, reflectable (a reflected glaive flies straight). Outbound 6 damage, POKE at 35 degrees; returning 5 damage, POKE toward him. Caught, it ends. | Spawn f18, end f40; 0 mana |
| Side B | **Serpent Ward:** ground-only placement 0.65H ahead; one ward, 26 durability, 240-frame life. It fires straight in its placement-facing direction at age 45, 85, 125, 165 and 205, never auto-aiming. Shots: 6 damage, POKE at 35 degrees, speed 0.10H/frame, life 36, radius 0.12H, reflectable. Recasting with a ward active recalls it after the same vulnerable animation, costs 0, and grants no refund. | Ward appears f26, action ends f52; initial cast 20 mana |
| Up B | **Loa Vault:** a spirit-assisted arc 2.0H high and 0.6H lateral, no hitbox or intangibility. Free version 1.4H and 0.3H lateral. | Movement f8–30, then helpless; 15 mana |
| Down B | **Hex** (#133): short visible orb, speed 0.07H/frame, life 26, radius 0.18H. 2 damage, POKE at 40 degrees. For 140 frames (110 before #521, 50 before Tom's 2026-10-20 playtest) the target has no control: it cannot move, jump, shield, dodge, attack, grab or use any special, up special included (before #521 it kept movement, jump, shield, dodges and up special). DI, SDI, teching and grab mashes on a hit or grab still work. On the ground it makes a helpless frog hop every 30 frames of the hex (half its walk speed sideways, half a short hop up), to a side drawn from its slot, the frame and the frames left, so rollback and replays repeat it; a hop that would land past its deck's edge turns back, and with no room either way it hops in place. Hexed in the air it falls with no steering and at a tenth of its gravity and max fall speed, the frog floating down (Tom, 2026-10-27; gameplay-design.md "Disabled fall"); a hit puts normal gravity back until its hitstun ends. It mashes out with the grab and freeze rule, never before frame 36 (20 before #105 pass 4: a point-blank Hex ran out during his own cast); that mash is how a fighter hexed off-stage gets back to recover. No hurtbox change. 240-frame hex immunity after it ends. Reflectable; one active. | Spawn f24, end f40 (f53 before #105 pass 4); 25 mana |

### Grab and throws

Standing grab 8/2/24, reach 0.55H. Pummel: mask headbutt.

| Throw | Animation and release | Damage | Release and recovery | Launch |
| --- | --- | --- | --- | --- |
| Forward | Glaive-shaft push toward setup | 7 | f12, R20 | 35, EDGE |
| Back | Hip turn and spirit shove | 8 | f16, R24 | 40, EDGE |
| Up | Loa-assisted toss | 6 | f14, R8 | 85, JUGGLE |
| Down | Sweep and short bounce | 5 | f17, R23 | 70, CHASE |

**Ultimate — Big Bad Voodoo:** f30 ground cast and R15 create a visible 1.0H-radius ward zone lasting 300 frames, with a 20-durability totem. Owner and allies inside take 20 percent less damage; no reduction to hitstun, knockback, grab vulnerability, or shield damage. The ward never grants invulnerability and can be destroyed. In singles it protects its owner only. Count damage reduction before percent accumulation but keep knockback based on the unreduced attack damage for stable expectations.

**Required counterplay test:** a ward can be cleared with one or two intentional attacks; ward fire plus Hex cannot permanently remove recovery or lock shield. Throws into a ward are setups to measure, not assumed true combos.

**Implemented kit notes.** Source: smashcraft:ts/src/game/fighters/shadow-hunter/moves.ts (normals, grab, throws), shadowHunterSpecials.ts (specials, ward and Hex values) and shadowHunterHero.ts (registration and clip map). The model is the classic `units\orc\HeroShadowHunter\HeroShadowHunter.mdl` at scale 1.0 (Stand Ready is 138 units tall against 1.08H). It has fourteen sequences and one attack clip, so moves share clips by motion: glaive cuts play Attack, overhead moves Spell, the low lunge and the overhand release Spell Throw, Twin Totems and Serpent Ward the hopping Stand Channel, jumps and Loa Vault the leap in Stand Victory, knockdown Death, and a KO the rising spirit of Dissipate. The model has no kick, so Heel Hook plays the rear arm-and-glaive sweep of Stand -2; its hit volume keeps the listed M reach and the swinging arm carries an exposed hurt volume, preserving the move's no-disjoint trade-off. No move is omitted.

### Play-style profile

Tom-tunable draft (8 Oct; smashcraft:docs/design/balance.md, "Play-style profiles"). Totem placement and angles.

```balance-profile
fighter: shadow-hunter
archetype: setplay
aerials: nair 10-40, fair 10-40, bair 15-45, uair 5-30, dair 0-25
air-share: 15-45
approach: 35-65
ranged: 15-50
specials: neutral 3-15, side 2-12, up 0-8, down 3-15
```

Path draft for Tom to correct (#358):

```ceiling-plan
fighter: shadow-hunter
path: decision
basic-moves: forward-tilt,side-special,neutral-special
```

Basic gameplan: Use a spear poke and the two simple ranged tools. Keep one approach, use the listed moves, no read-based punishes or advanced kit sequences. Recovery keeps the normal up special.

Expert gameplan: Time wards, healing and hex to control space and create a conversion. Use the full authored kit and gameplan at the same CPU skill.

### Signature strong/weak move (#389)

Forward tilt, split by position: strong hit sweetspot, frames 9-10, 11%; weak hit sourspot, frames 9-10, 7.7%. The spear's point: a trickster who pokes from outside reach.
The roster table is in [gameplay-design.md](../gameplay-design.md#strong-and-weak-hits-389) and every split in the [move list](../move-list.md).


## Pit Lord

**Identity:** the largest heavy, with a huge cleaver and wide body attacks. Long reach is offset by startup, recovery, and a large target. His size must not require native pathing changes or give him armor.

### Normals

| Input and move | F/A/R and landing | Damage | Reach and launch | Behavior |
| --- | --- | --- | --- | --- |
| Jab — Haft Check | 7/3/19 | 6 | M, 35, POKE | Slow close-range jab |
| Forward tilt — Cleaving Sweep | 13/4/33 | 12 | XL, 35, EDGE | Main space claim; blade disjoint only |
| Up tilt — Horn and Cleaver | 12/5/27 | 12 | L, 85, LAUNCH | Broad overhead arc with weak low front |
| Down tilt — Front Hoof | 10/3/24 | 9 | M, 65, LINK | Exposed hoof attack |
| Dash attack — Demonic Bulk | 15/6/32 | 16 | L, 40, EDGE | Body charge, no armor |
| Forward smash — Annihilating Cleave | 27/4/43 | 25 head, 19 inner | XL, 40, KILL | Longest commitment, cleaver tip sweetspot |
| Up smash — Abyssal Lift | 24/5/39 | 22 | XL, 85, KILL | Tall slow anti-air |
| Down smash — Rear and Front Stomp | 22/7/41 | 19 | L, 25, EDGE | Front f22–24, rear f26–28; one hit total |
| Neutral air — Hellish Turn | 12/7/29; L20 | 13 | L, 50, POKE | Body rotation with huge vulnerable torso |
| Forward air — Falling Cleaver | 19/4/36; L25 | 19 | XL, 40, KILL | Large slow arc, no meteor |
| Back air — Tail Lash | 14/4/31; L20 | 15 | L, 35, EDGE | Body hurtbox covers the drawn tail within the legible-hurtbox reach |
| Up air — Horn Thrust | 11/4/28; L18 | 12 | M, 85, LAUNCH | Narrow overhead body attack |
| Down air — Glaive Plunge | 18/5/38; L28 | 18 | L, 270, SPIKE | Glaive raised overhead drives straight down under him; no landing shockwave or bounce |

### B specials

| Input | Proposed move and behavior | Timing and cost |
| --- | --- | --- |
| Neutral B | **Howl of Terror:** visible two-sided roar, 7 damage at 35 degrees, radius 1.0H, no lingering status. | Active f15–18, end f46; 12 mana |
| Side B | **Ruin Charge:** 1.5H grounded charge, 15 damage, EDGE at 35 degrees. One-hit armor up to 6 damage on f19–24; no armor on startup or recovery. Stops at shield. Air version travels 0.8H horizontally, no armor, helpless afterward. | Active/movement f19–26, R38; 22 mana |
| Up B | **Abyssal Leap:** slow arcing leap in the [#252 heavy recovery band](../gameplay-design.md#recovery-and-edgeguarding), hoof hit for 10 damage at 80 degrees, LAUNCH. Free route reaches at least 240 units on either axis with no hit. | Hit f13–18, movement through f32, then helpless; 15 mana |
| Down B | **Rain of Fire:** a held channel; a wave of three slanting fireballs into a burning patch ahead every 18 frames, up to four waves, 2 damage each at 80 degrees. Release to recover; a hit breaks it; in the air, one wave. Shieldable, not reflectable. | Waves from f16, every 18 frames; 22-frame recovery; tap ends f55 |

The sourced redesign and visual gestures are in [Pit Lord](pit-lord.md).

### Grab and throws

Standing grab 11/3/31, reach 0.80H. Pummel: horn jab, shared 3 damage despite huge size.

| Throw | Animation and release | Damage | Release and recovery | Launch |
| --- | --- | --- | --- | --- |
| Forward | Cleaver-haft heave | 11 | f17, R27 | 35, EDGE |
| Back | Tail-assisted fling | 12 | f22, R32 | 40, KILL |
| Up | Toss from the horns | 10 | f20, R29 | 85, KILL |
| Down | Hoof pin and release | 8 | f23, R31 | 65, LINK |

**Ultimate — Doom:** a targeted curse: locks the nearest foe within 600 units, and on f20 a fel bolt lands on them through shields for 10% and the Doom curse (see [ultimates](ultimates.md) and [Pit Lord](pit-lord.md)).

**Required counterplay test:** fast characters can get inside a missed cleave and punish it. Pit Lord must have a usable close escape, but cannot turn jab into a fast long-range wall. Check that size does not make standard platforms impossible to traverse.

### Pit Lord as built

Source: smashcraft:ts/src/game/fighters/pit-lord/moves.ts (normals, grabs,
throws, body), pitLordSpecials.ts and pitLordHero.ts (#121). Every row
above is implemented with its listed timing, damage, angle and reach. Launch
classes use provisional coefficients. Deliberate differences:

- The up throw is a JUGGLE and the down throw a CHASE (#107), released on
  f20 and f23. Their totals are 30 and 50 frames.
- The standing grab is 10/3/32, one frame earlier than 11/3/31 with the
  same total, so it still catches a jump out of shield in the early-ascent
  window (#107).
- Down air's glaive tip reaches about 45 below his feet, just behind his centre; his hurtboxes are fitted
  to the drawn body (weapon excluded) inside the legible-hurtbox limits, Tail
  Lash included, with no rule-6 departure (smashcraft:docs/gameplay-design.md).
- His shield is the reference shield scaled by his 1.35 height (centre and
  radius). The reference shield would leave his 1.65-wide body outside it, and
  an arcing Fel Spit then struck him through it.
- Rain of Fire's fireballs start 2.36H above the floor under them and fall
  0.18H per frame for 12 frames with radius 0.3H, harmful only on their last 4
  frames; shielding covers the impacts.
- Howl of Terror's whole effect is its immediate outward hit; no damage
  reduction remains.
- Ruin Charge's armor lapses during his own hitlag, like every special's
  armor window, so the charge's contact frame does not extend it.

Presentation uses the stock classic HeroPitLord model, scale 0.95. It has
seventeen sequences and no hit, ready or jump clip, so flinches play
"Stand - 2". The cleaver normals map to "Attack" (thrust), the "Attack Slam"
pair (overhead) and "attack - 2" (both-sides sweep). pitLordHero.ts lists
every pose's clip.

**Gameplan** (smashcraft:ts/src/game/fighters/pit-lord/gameplan.ts, #105):
he holds 120-190 units at Cleaving Sweep's tip. He makes the target act with
Rain of Fire from range and runs in behind Ruin Charge's armor. Down tilt and the
throws start his strings. Annihilating Cleave kills from 70%, then Abyssal
Lift, Falling Cleaver and the back throw. Being caught inside a whiffed
cleave is his weakness, so he backs out of close range and stays on the ground
away from the edge.

## Goblin Tinker

**Identity:** a mechanical gadget fighter with telescoping arms and one factory. His gadgets are readable and destructible, and the opponent can attack him while he installs them. Keep robots as bounded deterministic objects.

### Normals

| Input and move | F/A/R and landing | Damage | Reach and launch | Behavior |
| --- | --- | --- | --- | --- |
| Jab — Wrench Tap | 5/2/15 | 4 | S, 35, POKE | Short wrench hit |
| Forward tilt — Piston Arm | 10/3/24 | 7.5 | L, 35, POKE | Disjointed metal tip; extension visibly retracts |
| Up tilt — Gear Lift | 9/4/23 | 8 | M, 85, LAUNCH | Mechanical arm above head |
| Down tilt — Low Spanner | 7/3/20 | 6 | M, 65, LINK | Thin ground poke |
| Dash attack — Wheel Ram | 11/5/28 | 9.75 | M, 45, LAUNCH | Body collision, not armored |
| Forward smash — Hydraulic Punch | 18/3/37 | 16.25 | XL, 35, KILL | Slow long piston; handle 11 damage |
| Up smash — Spring Hammer | 15/4/33 | 15.5 | L, 90, KILL | Strong vertical tool |
| Down smash — Dual Pistons | 17/5/35 | 12.5 | L, 25, EDGE | Front/rear extensions, one hit |
| Neutral air — Gear Spin | 8/6/23; L15 | 9 | M, 50, POKE | Attached machinery circle |
| Forward air — Extendable Wrench | 12/3/27; L17 | 12 | L, 40, EDGE | Main air reach |
| Back air — Exhaust Kick | 10/4/25; L15 | 12 | M, 35, KILL | Short flame cone attached to body |
| Up air — Rotor Chop | 8/4/23; L14 | 9 | M, 85, LAUNCH | One hit; no hovering |
| Down air — Drill Tap | 15/5/31; L22 | 12 | M, 270, SPIKE | One hit, no trapping multi-hit drill |

### B specials

| Input | Proposed move and behavior | Timing and cost |
| --- | --- | --- |
| Neutral B | **Cluster Rocket:** one small rocket per press, aimed straight or 35 degrees upward from input at entry. Speed 0.11H/frame, life 35, radius 0.15H, 6 damage, POKE at 45 degrees. Up to two active. Reflectable; no random spread or explosion splash in v1. | Spawn f19, end f42; 3 mana |
| Side B | **Pocket Factory:** ground-only, appears 0.6H ahead, 16 durability, life 240. Spawns one Clockwerk Goblin at age 45, then a second at age 135 only if the first is gone. Goblin walks forward at 0.035H/frame, life 90, 5 durability; falls at ledges, never auto-chases. Contact starts a 15-frame visible fuse, then radius 0.40H explosion for 7 damage, EDGE at 45 degrees; hittable during fuse. One factory and one goblin total. Tinker has an explicit three-object persistent cap for factory, goblin, and mine together; each individual limit still applies. Recast recalls factory without a refund. | Place f30, end f58; 25 mana initial, 0 recall |
| Up B | **Rocket Pack:** rises 2.0H and up to 0.6H across, 7-damage exhaust hit beneath on ascent, LAUNCH at 75 degrees. Free version sputters to 1.35H, no hit. | Ignition f11, hit f11–15, travel through f30, then helpless; 15 mana |
| Down B | **Spring Mine:** ground-only, one visible mine placed at feet, armed after 30 frames, life 180, 5 durability. Opponent proximity within 0.35H starts a 12-frame red flash; explosion radius 0.55H, 8 damage, LAUNCH at 85 degrees. Cannot trigger on owner or be remotely detonated. Recast with a mine active fails. | Place f24, end f50; 18 mana |

### Grab and throws

Standing grab 10/2/29, reach 0.80H, telescoping clamp. No tether to ledges. Pummel: small piston tap.

| Throw | Animation and release | Damage | Release and recovery | Launch |
| --- | --- | --- | --- | --- |
| Forward | Clamp launches forward | 7 | f14, R23 | 35, EDGE |
| Back | Mechanical arm rotates behind | 8 | f18, R26 | 40, EDGE |
| Up | Spring ejector | 7 | f16, R22 | 90, LAUNCH |
| Down | Clamp sets target on a spring | 5 | f20, R27 | 75, LINK |

**Ultimate — Robo-Goblin:** f30 vulnerable transformation, R15, then 480 frames of +15 percent weight and +10 percent normal damage. No size, range, immunity, shield, or speed changes; specials unchanged. Use a model variant only if animation coverage is verified; otherwise use a readable mechanical overlay.

**Required counterplay test:** factory plus mine cannot cover every grounded approach and jump simultaneously. Factory destruction clears future spawns, but already spawned goblin follows its own bounded life. Replays reproduce fuse timing exactly.

## Goblin Alchemist

Selectable now as a stand-in on the shared placeholder moveset ([standins.md](standins.md)); this kit is the plan for his real one.

**Identity:** the ogre does the punching and throwing while the goblin prepares potions. Heavy body, large target, and short bursts of speed. Healing and Chemical Rage require commitment; no random potion outcomes.

### Normals

| Input and move | F/A/R and landing | Damage | Reach and launch | Behavior |
| --- | --- | --- | --- | --- |
| Jab — Ogre Palm | 6/3/17 | 5 | M, 35, POKE | Broad hand hit, exposed arm |
| Forward tilt — Backhand | 11/4/25 | 12 | L, 35, EDGE | Long arm with matching hurtbox |
| Up tilt — Overhead Swat | 10/5/24 | 10 | L, 85, LAUNCH | Covers overhead but not feet |
| Down tilt — Ogre Boot | 9/3/22 | 8 | M, 65, LINK | Low body attack |
| Dash attack — Belly Charge | 13/6/32 | 14 | L, 45, EDGE | Body hitbox and no armor |
| Forward smash — Two-Handed Crush | 24/4/40 | 23 | L, 40, KILL | Two fists, one hit per opponent |
| Up smash — Goblin Toss Feint | 21/5/36 | 19 | L, 90, KILL | Ogre lifts both hands; goblin stays cosmetic and attached |
| Down smash — Double Ground Slap | 20/6/38 | 17 | L, 25, EDGE | Front and back palms |
| Neutral air — Ogre Spin | 10/6/26; L18 | 12 | L, 50, POKE | Broad tradeable body attack |
| Forward air — Heavy Fist | 15/4/31; L21 | 16 | L, 40, KILL | Long exposed arm |
| Back air — Backward Elbow | 12/4/28; L18 | 14 | M, 35, EDGE | Rear shoulder strike |
| Up air — Upward Swat | 9/4/25; L16 | 11 | L, 85, LAUNCH | Broad hand overhead |
| Down air — Stomping Boots | 18/5/35; L25 | 16 | M, 270, SPIKE | No landing quake |

### B specials

| Input | Proposed move and behavior | Timing and cost |
| --- | --- | --- |
| Neutral B | **Acid Bomb:** arcing flask at (0.09H, 0.07H)/frame, gravity 0.004H/frame squared, life 40, burst radius 0.45H. 5 impact damage, POKE at 40 degrees, plus 3 damage over 90 frames. Target takes +10 percent damage for 120 frames, with no hitstun or knockback increase. One active, reflectable before burst; no stacking. | Spawn f23, end f50; 5 mana |
| Side B | **Chemical Rush:** a 1.0H ogre shove, 12 damage, EDGE at 35 degrees; not a command grab. With Chemical Rage active, travels 1.3H but has identical timing and hitbox size. Air version moves 0.6H and ends helpless. | f15–20 active, R30; 18 mana |
| Up B | **Volatile Launch:** potion burst propels the ogre 1.85H high and 0.5H across. A single blast at takeoff deals 7 damage, EDGE at 45 degrees, radius 0.45H. Free version 1.25H and no blast. | Blast f12–14, ascent through f32, then helpless; 15 mana |
| Down B | **Mix and Drink:** on entry choose tonic by held direction: neutral/up = Chemical Rage; down = Healing Tonic. Rage grants +15 percent run speed for 180 frames, with no attack-speed, air-speed, or damage modifier. Tonic heals 4 damage percent with an 8-percent cap per stock. Ground-only; interruption before drinking grants nothing. Cannot refresh active Rage. | Drink f40, end f65; 25 mana |

### Grab and throws

Standing grab 9/3/29, reach 0.70H. Pummel: ogre squeeze, standard 3 damage.

| Throw | Animation and release | Damage | Release and recovery | Launch |
| --- | --- | --- | --- | --- |
| Forward | Ogre bowling toss | 10 | f15, R25 | 30, EDGE |
| Back | Over-the-shoulder fling | 11 | f20, R29 | 40, KILL |
| Up | Two-handed sky toss | 9 | f18, R26 | 85, LAUNCH |
| Down | Belly pin and bounce | 7 | f22, R30 | 70, LINK |

**Ultimate — Transmutation Flask:** f32 spawn, end f70; arcing gold potion with velocity (0.10H, 0.08H)/frame, gravity 0.004H/frame squared, life 45 and burst radius 0.65H. Body hit deals 18 damage, KILL at 45 degrees and briefly applies a cosmetic gold material. No instant death, currency, inability to DI, or actual petrification. Reflectable before bursting; no homing.

**Required counterplay test:** Rage improves access to close range but cannot turn a heavy jab into a faster move. Healing is capped and vulnerable. Acid cannot multiply damage repeatedly through duplicate status applications.

## Naga Sea Witch

**Identity:** a serpentine midrange caster using her bow, tail, and water. Grounded space control and a vulnerable water recovery define her game. Her tail remains a hittable body part when extended.

### Normals

| Input and move | F/A/R and landing | Damage | Reach and launch | Behavior |
| --- | --- | --- | --- | --- |
| Jab — Bow Check | 6/2/16 | 4 | S, 35, POKE | Bow body, no projectile |
| Forward tilt — Tail Lash | 10/4/24 | 10 | L, 35, EDGE | Long vulnerable tail |
| Up tilt — Forked Crown | 9/4/23 | 8 | M, 85, LAUNCH | Attached lightning arc overhead |
| Down tilt — Low Tail | 8/3/21 | 7 | L, 65, LINK | Low body extension |
| Dash attack — Serpent Slide | 12/5/29 | 11 | M, 45, LAUNCH | Slides 0.55H, vulnerable body |
| Forward smash — Trident of Water | 22/3/37 | 19 | XL, 35, KILL | Stationary water spear with obvious tell |
| Up smash — Geyser | 20/5/34 | 17 | L, 90, KILL | Vertical burst, no persistent field |
| Down smash — Coil Sweep | 18/6/35 | 15 | L, 25, EDGE | Tail arcs front then back |
| Neutral air — Coiled Turn | 9/6/24; L16 | 9 | M, 50, POKE | Body circle |
| Forward air — Bow Arc | 12/3/27; L17 | 12 | L, 40, EDGE | Melee magic extension, not an arrow |
| Back air — Tail Kick | 11/4/26; L16 | 13 | L, 35, KILL | Extended hurtbox with tail |
| Up air — Water Crescent | 8/4/23; L14 | 9 | M, 85, LAUNCH | Thin upward arc |
| Down air — Tail Spear | 16/4/32; L22 | 13 | L, 270, SPIKE | No aerial stall |

### B specials

| Input | Proposed move and behavior | Timing and cost |
| --- | --- | --- |
| Neutral B | **Frost Arrow:** uncharged only, straight or 30 degrees up, speed 0.13H/frame, life 32, radius 0.12H; 6 damage, POKE at 35 degrees. On body hit reduces ground acceleration by 10 percent for 60 frames, not air control or top speed. One active, reflectable. No downward aerial aim in v1. | Spawn f21, end f45; 4 mana |
| Side B | **Forked Lightning:** fixed two-prong attack from the body, one horizontal and one 35 degrees upward, maximum reach 1.35H. One hit per target for 10 damage, LAUNCH at 60 degrees. Cannot aim at an enemy automatically or jump to additional targets. | f22–24 active, R31; 20 mana |
| Up B | **Water Spout:** upward ride 2.0H with only 0.3H horizontal drift. Column is a cosmetic movement trail; one attached hit near Naga on f13–18 for 8 damage, LAUNCH at 85 degrees. Free version 1.35H, no hit. | Ascent f13–34, helpless afterward; 15 mana |
| Down B | **Mana Shield:** grounded stance f1–38; armor against one hit up to 7 damage on f8–17, taking full damage and consuming protection. Grabs bypass; no reflection or counter hit. Same action can be used in air but has no armor and only preserves the normal trajectory, so it is not an air stall. | End f38; 20 mana |

### Grab and throws

Standing grab 9/2/27, reach 0.65H, short tail coil. No dragging or moving hold. Pummel: coil squeeze.

| Throw | Animation and release | Damage | Release and recovery | Launch |
| --- | --- | --- | --- | --- |
| Forward | Tail uncoils forward | 8 | f14, R23 | 35, EDGE |
| Back | Tail pivot toss | 9 | f18, R26 | 40, EDGE |
| Up | Geyser toss | 7 | f17, R24 | 90, LAUNCH |
| Down | Low coil release | 6 | f20, R27 | 70, LINK |

**Ultimate — Tornado:** ground-only f36 cast, end f70. One visible tornado appears 1.0H ahead and travels forward at 0.025H/frame for 180 frames. Radius 0.65H, height 1.8H, no homing or hidden suction. Each target can take up to three 4-damage hits at least 45 frames apart, LAUNCH at 80 degrees. No instant kill, camera effect, or trapping against a wall; tornado stops at solid terrain.

**Required counterplay test:** Forked Lightning has a low or rear blind spot and a whiff punish. Frost Arrow does not stack slowing effects into immobility. Water Spout is visibly punishable at its apex.

## Beastmaster

**Identity:** Rexxar-inspired axe fighter who directs Bear, Quilbeast and Hawk from three separate positions. [The pack design](beastmaster.md) owns his current specials, roles, commitments and references.

### Normals

| Input and move | F/A/R and landing | Damage | Reach and launch | Behavior |
| --- | --- | --- | --- | --- |
| Jab — Axe Hilt | 5/2/15 | 4 | S, 35, POKE | Short hit |
| Forward tilt — Broad Axe | 10/3/23 | 12 | L, 35, EDGE | Weapon head disjoint |
| Up tilt — Antler Lift | 9/4/23 | 9 | M, 85, LAUNCH | Axe rises above shoulder |
| Down tilt — Low Chop | 8/3/20 | 7 | M, 65, LINK | Short axe sweep |
| Dash attack — Hunter’s Shoulder | 11/5/28 | 13 | M, 45, LAUNCH | Body advance 0.5H |
| Forward smash — Twin Axe Hew | 21/4/36 | 22 | L, 40, KILL | Both axes strike as one action |
| Up smash — Hunting Horns | 18/5/33 | 17 | L, 85, KILL | Twin upward arcs |
| Down smash — Clearing Sweep | 17/6/34 | 15 | L, 25, EDGE | Front then back |
| Neutral air — Axe Circle | 8/6/23; L15 | 10 | M, 50, POKE | One hit around torso |
| Forward air — Overhand Chop | 13/4/28; L18 | 14 | L, 40, KILL | Slow weapon arc |
| Back air — Hunter’s Boot | 9/3/24; L14 | 12 | M, 35, EDGE | Exposed leg |
| Up air — Axe Lift | 8/4/23; L14 | 9 | M, 85, LAUNCH | Narrow above |
| Down air — Downward Hew | 16/4/32; L22 | 13 | M, 270, SPIKE | No forced descent |

### B specials

[The pack design](beastmaster.md) replaces the original single-Bear kit: Wild
Axes fly out and vanish, side special calls Bear then Stampede, down special calls a
Quilbeast then its volley, and grounded up special calls Hawk then its dive.
Airborne up special remains Hawk Lift. Each animal owns a position, health,
lifetime and command state, and all three may coexist.

### Grab and throws

Standing grab 8/2/25, reach 0.60H. Pummel: axe-hilt strike. Bear attacks are suppressed while owner holds a target or performs a throw, through throw recovery.

| Throw | Animation and release | Damage | Release and recovery | Launch |
| --- | --- | --- | --- | --- |
| Forward | Hunter’s shove | 8 | f13, R22 | 35, EDGE |
| Back | Shoulder toss | 9 | f17, R26 | 40, EDGE |
| Up | Twin-hilt launch | 7 | f15, R22 | 85, LAUNCH |
| Down | Wrestling trip | 6 | f19, R25 | 70, LINK |

Stampede is the Bear command on side special; it needs no separate ultimate
input. Normals and throws retain their current authored data, including the
low down-throw chase from #208 and the accepted #186 numeric tuning.

Source: smashcraft:ts/src/game/fighters/beastmaster/moves.ts,
beastmasterSpecials.ts, beastmasterHero.ts and sim/companions.ts. Stock classic
BeastMaster, GrizzlyBear, QuillBeast and WarEagle models draw the formation;
the Stampede missile draws its two thunder lizards. The computer uses the
same four inputs and animal commands as the player.

## Dark Ranger

**Identity:** a deliberate bow-wielding necromancer built around one marked target and one fragile skeleton. Dark Ranger gets slower shots, curse pressure, and setup. No permanent possession of another fighter.

### Normals

| Input and move | F/A/R and landing | Damage | Reach and launch | Behavior |
| --- | --- | --- | --- | --- |
| Jab — Dagger Check | 4/2/14 | 3 | S, 35, POKE | Short blade |
| Forward tilt — Bow Hook | 8/3/20 | 8 | M, 35, POKE | Melee bow sweep |
| Up tilt — Dagger Lift | 7/4/20 | 7 | M, 85, LAUNCH | Thin overhead cut |
| Down tilt — Low Dagger | 6/3/18 | 5 | M, 65, LINK | Low poke |
| Dash attack — Shadow Elbow | 9/4/25 | 9 | M, 50, LAUNCH | Body approach |
| Forward smash — Cursed Thrust | 18/3/32 | 17 | L, 35, KILL | Bow and short spectral extension, not projectile |
| Up smash — Mourning Crescent | 16/4/29 | 15 | L, 90, KILL | Narrow spectral blade overhead |
| Down smash — Grave Sweep | 15/5/31 | 13 | M, 25, EDGE | Front and back dagger arcs |
| Neutral air — Cloak Cut | 6/5/20; L12 | 7 | M, 50, POKE | Short body circle |
| Forward air — Bow Slash | 9/3/23; L14 | 10 | M, 40, EDGE | No automatic projectile |
| Back air — Heel Dagger | 8/3/24; L14 | 11 | M, 35, KILL | Rear exposed leg attack |
| Up air — Dark Crescent | 6/3/20; L11 | 7 | M, 85, LAUNCH | Precise anti-air |
| Down air — Falling Dagger | 13/3/29; L20 | 11 | M, 270, SPIKE | No dive or bounce |

### B specials

| Input | Proposed move and behavior | Timing and cost |
| --- | --- | --- |
| Neutral B | **Black Arrow:** straight shot, speed 0.12H/frame, life 35, radius 0.12H, 7 damage, POKE at 35 degrees. On body hit marks that target for 240 frames; only one marked target per owner. No charge or directional firing in v1; one active arrow, reflectable. | Spawn f23, end f48; 4 mana |
| Side B | **Raise Minion:** ground-only summon a skeleton 0.65H ahead, 8 durability, life 240. It walks straight at 0.025H/frame, falls off ledges, and never auto-turns. When an opponent is within 0.55H in front, telegraph 18 frames then slash for 5 damage, POKE at 40 degrees; 3 active, 36 recovery. Only one skeleton. Against the owner’s marked target, slash does 7 damage and consumes the mark; no heal or mana gain. Recast with skeleton active recalls it. | Summon f29, end f54; 20 mana initial, 0 recall |
| Up B | **Banshee Rise:** spectral glide 2.0H high and 0.6H across, visible vulnerable hurtbox, no hitbox or intangibility. Free version 1.4H and 0.3H across. | Movement f9–31, then helpless; 15 mana |
| Down B | **Silencing Shot:** a slow short projectile at 0.08H/frame, life 22, radius 0.17H, 3 damage, POKE at 40 degrees. For 45 frames, a body-hit target cannot start neutral/side/down B; up B, normals, shield, jump, grab, and DI remain available. 180-frame silence immunity afterward. One active and reflectable. | Spawn f25, end f54; 22 mana |

Skeleton attacks are cancelled by being hit, followed by 18 frames of stun. They are suppressed while their owner is grabbed, in hitstun, or holding/throwing an opponent through throw recovery, matching the anti-loop policy for the bear. A normal arrow does not create a skeleton automatically; this avoids kill-trigger dependencies and runaway entity counts.

### Grab and throws

Standing grab 7/2/23, reach 0.50H. Pummel: dagger hilt, never lifesteal.

| Throw | Animation and release | Damage | Release and recovery | Launch |
| --- | --- | --- | --- | --- |
| Forward | Bow-shaft shove | 6 | f11, R19 | 35, EDGE |
| Back | Pivot and kick | 8 | f15, R23 | 40, EDGE |
| Up | Spectral hand toss | 6 | f14, R20 | 85, LAUNCH |
| Down | Dagger trip | 5 | f17, R23 | 70, LINK |

**Ultimate — Banshee Form:** replaces literal Charm. f1–18 a hittable transformation that a hit cancels; f19–98 she is intangible and glides low at 9 a frame on the foe nearest at activation, turning at most 8° a frame and swinging back round after a foe who gets past her, for 14% at 45° on contact, then carries through, at most 14% from one use (numbers in [ultimates](ultimates.md)). Shieldable, rolled through late, and escaped by running away; no control reversal, mind control, full-screen silence, or unavoidable hit.

**Required counterplay test:** her basic arrow must leave time to approach between shots. Skeleton destruction meaningfully removes pressure; silence cannot take away recovery or create a permanent status loop.

## Firelord

Selectable now as a stand-in on the shared placeholder moveset ([standins.md](standins.md)); this kit is the plan for his real one.

**Identity:** a caster who leaves brief fire zones that scar the ground and dives through the floor back to the newest scar. Flame trails are visually clear and mechanically bounded. The floating model still follows normal jumps and gravity.

### Normals

| Input and move | F/A/R and landing | Damage | Reach and launch | Behavior |
| --- | --- | --- | --- | --- |
| Jab — Ember Palm | 6/2/16 | 4 | S, 35, POKE | Short close hit |
| Forward tilt — Flame Lash | 10/3/23 | 9 | L, 35, POKE | Attached flame extension |
| Up tilt — Rising Ember | 9/4/23 | 8 | M, 85, LAUNCH | Overhead burst |
| Down tilt — Cinder Sweep | 8/3/21 | 6 | M, 65, LINK | Low short flame |
| Dash attack — Burning Shoulder | 12/5/29 | 11 | M, 45, LAUNCH | Body hit, no lingering trail |
| Forward smash — Magma Fist | 22/4/37 | 19 | L, 40, KILL | Big visible flame fist |
| Up smash — Eruption | 20/5/35 | 18 | L, 90, KILL | Vertical column with limited side reach |
| Down smash — Split Fissure | 19/5/36 | 15 | L, 25, EDGE | Short front/rear bursts |
| Neutral air — Ember Ring | 9/6/24; L16 | 9 | M, 50, POKE | One hit, no continuous damage |
| Forward air — Flame Palm | 12/3/27; L17 | 12 | L, 40, EDGE | Attached flame hand |
| Back air — Cinder Burst | 10/3/26; L16 | 13 | M, 35, KILL | Short rear blast |
| Up air — Flame Crown | 8/4/24; L14 | 9 | M, 85, LAUNCH | Upward wedge |
| Down air — Magma Point | 16/4/32; L22 | 13 | M, 270, SPIKE | Attached downward flame, not falling projectile |

### B specials

| Input | Proposed move and behavior | Timing and cost |
| --- | --- | --- |
| Neutral B | **Incinerating Ember:** straight projectile at 0.10H/frame, life 35, radius 0.16H; 5 damage, POKE at 35 degrees. Consecutive body hits add one heat mark, max 3, expiring 180 frames after the latest hit. The third hit consumes marks and adds 3 damage plus LAUNCH at 65 degrees instead of normal POKE; no secondary area explosion. One active, reflectable. | Spawn f21, end f45; 3 mana |
| Side B | **Submerge:** ground-only; in the air the press is the neutral special. He sinks into the floor and resurfaces on the floor at the newest live Lava Raze crater, one that has a floor under it. One hit as he surfaces: 8 damage, LAUNCH at 80 degrees with low knockback (base 22, growth 70), a 44-unit-radius capsule over and ahead of him, active f13–17 while he is still intangible; the sink does not hit. Intangible for 12 frames while he is underground, and he keeps his facing. With no live crater he resurfaces 0.9H ahead of where he sank when a floor lies level there, and otherwise stays where he sank (our default, not Tom's). The crater is not used up, so a second dive after the cooldown goes to it again. | Open f0–5, intangible f6–17 (he is at the crater from f12, hit f13–17), end f34; a 120-frame cooldown from the press; no mana |
| Up B | **Lava Surf:** replaces Flame Jet (Tom asked for a lava-flow ride like Murloc's Tidal Surf, 2026-10-31). He rides a flow of lava steered by the stick in all eight directions, once per airtime, from the ground or the air: 20 frames of ride at 8 units a frame plus up to 9 more up or down from the stick and 5 sideways. Up held climbs 340 units, 2.6H and 1.3 times Flame Jet's 2.0H, about Tidal Surf's reach and short of Pit Lord's 3.5H and Lich's 3.7H; no stick climbs 1.2H; down held does not climb; up to 0.8H sideways. Three fire hits along the way, 2, 2 and 4 damage, the first two straight up with no growth and the last LAUNCH at 80 degrees like Tidal Surf's, 8 damage in all, the same as Flame Jet. Helpless at the end, ledge grab unchanged. Look: a stock Classic fire immolation under his feet, no lava model from Definitive Edition. | Ride f6–25 (hits f6–9, f12–15, f18–21), end f34, then helpless; 15 mana |
| Down B | **Lava Raze:** three Shadowraze-style lava eruptions at 1x, 2x and 3x a 0.7H step ahead of his front, picked by the stick's motion over the 10 frames up to and including the press: plain down erupts one step ahead, down and forward two, and a quarter-circle forward (down, then down and forward, then forward, in order) three, and the quarter-circle picks Lava Raze even though the press itself reads forward. A plain forward press is the side special, and the stick after the press picks nothing. A glowing crack opens on the ground at the aimed spot. The eruption is a 0.35H-radius molten column, so the three spots tile with no gap; it sits on the ground below the spot, does not appear past a ledge, and from the air lands on the floor below the aimed point. 12 damage at every distance, LAUNCH at 60 degrees outward from the column's centre: a foe left of it flies left, right of it flies right, exactly on it flies away from Firelord, so a far raze behind a foe pulls them in and a near raze in front of a foe pushes them off. One hit per cast, shieldable. After the glow a scorch of embers stays on the floor where the column stood for 180 frames, the crater Submerge dives to; it has no hitbox and does not block anything, and it is drawn so a foe can read where Firelord will come up. | Crack f14, eruption hits f23–26, end f30 (air landing lag 20); 20 mana |

Existing projectiles remain independent after firing. Heat marks are per source and target; reflected Embers belong to the reflector and cannot consume someone else’s marks.

### Grab and throws

Standing grab 9/2/26, reach 0.60H. Pummel: ember squeeze, no extra heat mark.

| Throw | Animation and release | Damage | Release and recovery | Launch |
| --- | --- | --- | --- | --- |
| Forward | Flame-palm shove | 7 | f13, R22 | 35, EDGE |
| Back | Pivoting eruption | 8 | f17, R25 | 40, EDGE |
| Up | Vent beneath target | 7 | f16, R23 | 90, LAUNCH |
| Down | Cinder slam and pop-up | 6 | f20, R27 | 70, LINK |

**Ultimate — Volcano:** ground-only f40 startup creates a volcano 1.3H ahead, 25 durability, life 180. Three eruptions at ages 30, 90, and 150, radius 0.85H, each 9 damage, LAUNCH at 80 degrees. No random rocks or full-map targeting. Destroying the volcano ends later eruptions. Owner’s casting action ends f78. Each eruption has a 20-frame visible warning; cannot hit through solid platforms.

Down B was Molten Patch, a ground zone 0.7H ahead; Tom replaced it on 2026-10-30 with Lava Raze, after Nevermore's Shadowraze in Dota, and picked the three distances by stick. The numbers are the proposed ones, unchanged. Mana is a trait tag only, so the 20 is not charged yet.

Tom asked on 2026-10-31 to replace the side special Lava Spawn with Submerge: he sinks into the ground and quickly resurfaces at his last Lava Raze location; each raze leaves a crater for 180 frames (3 s) and Submerge targets the newest live one; he named two uses, extending a combo after a raze and escaping. The rule for a dive with no crater is ours, and so are the rest of the numbers:

- **Crater.** The raze's chain is crack, eruption, glow, then a crater of 180 frames, counted from the frame the glow ends. It sits on the floor the raze landed on, so a raze cast from the air has a crater on the floor below and one that did not open (past a ledge, or over the void) leaves none. The newest crater wins by age. A crater is skipped, and the next newest taken, when no floor lies under it at the dive, as when its platform has gone.
- **Fallback.** With no valid crater he comes up 0.9H ahead of where he went down if a floor lies within a short step of his height there, and stays where he is if not; a defensive dive at a ledge never carries him off it.
- **Underground.** Intangible for 12 frames (the window opens a frame early, as every special window does), against 14 for a spot dodge and 16 for a roll, so the dive is no longer a dodge than the dodge. He is open to a hit for the 6 frames he sinks and the 16 after the last intangible frame.
- **Not an endless escape.** The move ends on frame 34 (33 frames after the press frame) and cannot start again for 120 frames from the press: 86 frames after he can act again, and 12 of every 120 frames intangible, a tenth. The crater, not Submerge, is what he needs, and a new one costs a raze (30 frames) that can be hit at the crack.
- **Farm read (2026-10-31, Wren Expert, 408 matches a pair against each of the other 30 fighters, commit 77446957a0).** Firelord won 40% of 12,240 matches, below the 45% to 55% band, so the side special is not yet in band. The pairs ranged from 13% (Jaina and Shadow Hunter) to 80% (Warden); neutral special, dash attack and forward smash carried the damage. No read from before Submerge was taken, so the loss of the hitting Lunge it replaced is the likely cause and not a measured one; the computer treats Submerge only as a defensive stance. A retune is its own box: give the computer a use for the dive, or a hit on the way up, and read the field again.
- **Native capture (2026-10-31, Classic, offline build 3.0.0.24268, `test/native/captures/firelord-submerge/right.pad`, main 05ecc49718).** All 12 capture frames came back from pair 16 with none missed (one resume after two frames missed on the first attempt). The raze's embers show on the floor from frame 302 and stay through 372; he sinks on frames 368 to 372 and is gone by 375; from 375 to 400 he rises out of the crater with a column of dust and stands on it with the embers still on the floor. The crater does not wait on the capture queue's hold: a plain pad holds each capture frame 180 ticks, and the 30-tick hold belongs to the queue's own showcase pads, where a side special is pressed with no earlier raze, so those pads have no crater to show. Giving the showcase a raze before Submerge is its own box; a longer hold would not change what it captures.

Tom asked on 2026-10-31, after a playtest, for three changes, all in:

- **Motion input.** The stick history is a general reader on every fighter whose kit asks for it (`sim/stickHistory.ts`): 14 frames of the stick as one of nine zones, saved with rollback and canonical state, and a kit lists the motions that pick its move or its aim (`selectedByMotion`, `aimByMotion`). Lava Raze reads 10 frames. A stick sweep from down to forward takes 3 to 7 frames on a pad, so 10 leaves slack for a slow thumb; any longer and a crouch followed a moment later by a forward press would read as a quarter-circle. Both ends are tested: the down step on the oldest buffered frame still counts, one frame older does not, and a plain forward press or a quarter-circle that finished earlier casts the side special.
- **Chain.** The end frame went from 48 to 30. Two erupting hits land one end frame apart, so a foe must still be in hitstun that many frames after the first. Hitstun is 23 frames at 0 percent and 38 at 40 percent, and it ends when the foe lands, which is after about 20 and 26 frames. At 30 a second raze hits a foe still in hitstun at 50 to 70 percent with no DI (60 percent is the named case), at 40 to 60 with DI toward or away, at 60 to 70 with DI down, and not at 0 to 40 percent, where the foe has landed first.
- **No true infinite.** Every hit adds 12 percent, no DI escapes the chain at 80 percent, and a foe who mashes buttons escapes it from 60 percent, so a chain that starts at 50 percent ends within three more hits. All of it is tested.
- **Launch.** 60 degrees outward, because the old 85 sent foes almost straight up (the sideways part was 9 percent of the speed), which kept them in the column and gave nothing to read; at 60 the sideways part is half the speed and the foe still stays airborne long enough to chain. A steeper 70 or 85 chains at more percents but pushes less; a flatter 50 chains nowhere at an end frame of 30. The balance baseline was re-frozen for the change: the raze's kill percent in the feel table moved from 182 to 99 and its frame advantage rose by 18 on the three recorded hits, both from the lower launch angle and the shorter end lag.

**Required counterplay test:** lava fire plus Lava Raze leaves an aerial route and cannot cause indefinite shieldstun. A visible crater tells the foe where Submerge ends, and the 16 frames after it are the punish. Heat marks create a readable incentive to avoid the third hit without giving normals hidden explosions.

## Lich King

**Identity (#167, Tom delegated 7 Oct):** Arthas in the Helm of Domination, a
heavy Frostmourne swordsman who commands the dead, from Warcraft III and the
Icecrown Citadel encounter. Distinct from the Lich (Kel'Thuzad), a light frost
caster: the Lich King wins with blade reach and kill power and controls space
with Defile and the Val'kyr. He is slow on foot and in the air, so fast
pressure inside the blade and juggles are his weakness.

Source: smashcraft:ts/src/game/fighters/lich-king/moves.ts, lichKingSpecials.ts,
lichKingHero.ts and lichKingGameplan.ts. Frames are F/A/R as in the notation
above; damage and launch classes are provisional. The move list
(smashcraft:docs/move-list.md) names every special.

### Normals

| Move | F/A/R | Damage | Reach | Notes |
| --- | --- | --- | --- | --- |
| Jab, Pommel and Rake | 6/3/13, 7/3/16, 9/3/23 | 3, 3, 5 | 0.6H, 0.8H, 1.1H | A three-step chain (#163) ending in a Frostmourne thrust |
| Forward tilt, Frostmourne Sweep | 11/4/24 | 15 | 1.35H | From his shoulder to the floor: not angled |
| Up tilt, Overhead Reap | 10/5/23 | 11 | arc to 1.45H | Covers behind him |
| Down tilt, Frozen Ground | 9/4/22 | 6 + 6 | 1.1H front, 0.9H back | Front, then behind: the two-sided sweep |
| Dash attack | 10/4/29 | 11 | 1.1H | Travels 40 in startup, stops at a body |
| Forward smash, Frostmourne Cleave | 19/4/38 | 24.75 tip, 20.5 inner | 1.35H | The tip sweetspot |
| Up smash, Remorseless Winter | 18/8/38 | 15, then 10 | 0.72H all round | A burst around him, then a weaker gust |
| Down smash, Quake | 17/6/40 | 14 + 14 | 1.1H each side | Front f17-19, back f20-22 |
| Neutral air | 10/8/24, land 16 | 11 + 11 | 1.1H | Front then back |
| Forward air | 14/4/30, land 20 | 13 | 1.25H | Kills; reaches less than the forward tilt |
| Back air | 11/4/26, land 18 | 13 | 1.1H | His strongest aerial |
| Up air | 10/5/25, land 16 | 12 | arc to 1.45H | |
| Down air, Frostmourne Plunge | 14/5/37, land 26 | 14 | 0.55H below | Spikes in the air, 55 degrees on the ground |

Grab 9/2/30. Throws: forward 10 (EDGE), back 12 (KILL), up 8 (JUGGLE), and
**Harvest Soul**, the down throw: 6 (CHASE).



### B specials

- **Howling Blast** (neutral, 15 mana): a wide frost gust leaves on frame 22
  at 0.072H a frame and flies 53 frames, about 3.7H (35% farther than the
  frame-28, 0.08H, 36-frame version); end lag 28 frames; reflectable.
  Landing in the air finishes the same cast on the ground, blast and armor on
  their frames, with no landing lag.
- **Val'kyr Shadowguard** (side, 20 mana): a Val'kyr flies out on frame 14
  and seizes the first body she reaches (a shield stops her; she can't be
  reflected). The victim is carried 3 units a frame the way she flew, rising,
  for 100 frames, with no control. Mashing frees them, never before frame 20;
  any damaging hit, his own included, drops the carry; then 240 frames immune.
  (Tom delegated, 7 Oct): she carries toward the edge he faces rather than the
  nearest one, so the player aims the drop and the victim can read it.
- **Ascension of the Damned** (up, 15 mana): an ice column lifts him 2H over
  frames 8-30, steered 0.35H, inside a frost vortex that strikes once (9),
  then a helpless fall. The free form rises 1.3H with no vortex.
- **Defile** (down, 20 mana, ground only): a shadow pool 0.6H ahead on frame
  20, where he can see, for 180 frames. Its rim warns for 18 pool frames,
  then turns bright violet: each 2-damage strike is at least 36 frames apart
  and grows the radius by 6, from 0.3H to at most 0.6H. Airborne foes are safe;
  shields block without growing it. One at a time, 320 frames between casts,
  leaving at least 120 frames with no pool. He commits through frame 50:
  jump away, roll out, shield, or punish the cast. The rim follows the actual
  radius, including growth; an overlapping grounded body can touch it from
  outside its centre. Delegated rework, 7 Oct (#174).

### Ultimate (designed, not built)

**Fury of Frostmourne**: the raid's ending wipe. Every opponent above a high
percent who isn't shielding or dodging is launched.

### Lich King as built

Presentation uses Kwaliti's model (see Credits) with its own sequences until
the authored clips land; his voice is the game's Evil Arthas set, whose
selection line is "What" (the campaign unit has no Ready line).

**Gameplan** (lichKingGameplan.ts, #105): he holds the sweep's tip spacing,
makes the target act with Howling Blast and Defile, starts tech chases from
Frozen Ground and Harvest Soul, and kills with the smashes, his back air and a
Val'kyr carry near the ledge.

### Play-style profile

Tom-tunable draft (8 Oct; smashcraft:docs/design/balance.md, "Play-style profiles"). A heavy swordsman holding Frostmourne's tip; kills with smashes, back air and a Val'kyr carry.

```balance-profile
fighter: lich-king
archetype: bait-and-punish
aerials: nair 10-40, fair 15-45, bair 15-50, uair 5-30, dair 0-25
air-share: 15-45
approach: 40-70
ranged: 0-20
specials: neutral 2-12, side 2-12, up 0-8, down 2-12
```

Path draft for Tom to correct (#358):

```ceiling-plan
fighter: lich-king
path: mixed
basic-moves: forward-tilt,neutral-special,neutral-air
```

Basic gameplan: Use sword pokes and a simple ranged strike. Keep one approach, use the listed moves, no read-based punishes or advanced kit sequences. Recovery keeps the normal up special.

Expert gameplan: Combine ground control, grabs and sword confirms into planned finishers. Use the full authored kit and gameplan at the same CPU skill.

### Signature strong/weak move (#389)

Forward smash, split by position: strong hit sweetspot, frames 22-25, 24.75%; weak hit sourspot, frames 22-25, 20.5%. Frostmourne's point: the king kills at the end of the blade.
The roster table is in [gameplay-design.md](../gameplay-design.md#strong-and-weak-hits-389) and every split in the [move list](../move-list.md).


## Original fighters

Rifleman and Illidan were built before this specification. Their kits live in
the shared move tables (smashcraft:ts/src/game/sim/hitRegions.ts,
smashcraft:ts/src/game/sim/specials.ts, smashcraft:ts/src/game/sim/summons.ts)
and their gameplans (#105) in smashcraft:ts/src/game/sim/originalGameplans.ts.
Their normals still share one set of frame data and hitboxes (Rifleman's down
tilt is the exception), so physics and specials carry their identities.

### Rifleman

**Identity:** a gunner who holds ground. He is slow on the ground (run 9.00)
and late off it (5-frame jump squat), but floaty, weight 80 and
harder-hitting: his down tilt deals 10. The blaster shoots with hitstun from
range, but a grounded shot leaves on frame 9 and holds him until frame 39, and a short-hop shot (#117) costs a landing,
so his wall costs a commitment his slow body can't cover. The bear walks ahead as cover. The freezing trap guards the gap in
front of him and sets up a smash. Down special places it at frame 22 and
ends at frame 38 (16 frames of recovery). It arms 20 frames after placement,
lasts 480 frames (8 s), freezes for up to 300 frames, and has a 90-frame cooldown (#325). **Weakness:** he can't chase, and in close
his slow start loses scrambles.

**Gameplan:** keeps 220–520 units away. His spacing tools are the blaster at
200–700, the bear at 120–450, the trap at 60–260 and down tilt within 150.
He mostly shoots and advances behind his shots (weight 3), and sometimes
jumps in with forward or down air (weight 1). He answers threats with his
shield, a spot dodge or a jump; he never retreats, because he is too slow to.
Down tilt leads into forward air, up tilt or another down tilt; the trap
into forward or up smash; the bear into a shot or forward smash. He kills
with forward smash from 80%, up smash from 95% and the recoil shot from
100%. He returns to the ledge and spends his jump before the recoil. He
avoids close range.

**Balance** (#248, his 20-pair computer field, Wren Expert, 400/pair): forward tilt growth 90 → 108 and dash attack 95 → 114, for kill power (he dealt 191 damage per stock taken against a field median near 140): field win rate 38% (5adb030c, run 37736380119) → 46% (run 37741496717, measured on 7cb29b97; landed as 07b13e80).

#### Play-style profile

Tom-tunable draft (8 Oct; smashcraft:docs/design/balance.md, "Play-style profiles"). Blaster and traps from range; the Bear is his signature spell (smashcraft:docs/design/mana.md).

```balance-profile
fighter: rifleman
archetype: zoner
aerials: nair 10-35, fair 10-35, bair 20-50, uair 5-30, dair 0-25
air-share: 15-45
approach: 25-55
ranged: 25-65
specials: neutral 8-30, side 3-15, up 0-8, down 2-12
signature: side-special 50
```

Path draft for Tom to correct (#358):

```ceiling-plan
fighter: rifleman
path: decision
basic-moves: neutral-special,down-tilt,neutral-air
```

Basic gameplan: Keep shots simple, poke nearby targets and recover with up special. Keep one approach, use the listed moves, no read-based punishes or advanced kit sequences. Recovery keeps the normal up special.

Expert gameplan: Place and recall the bear, trap routes and cover jumps while varying shot pressure. Use the full authored kit and gameplan at the same CPU skill.

#### Signature strong/weak move (#389)

Forward tilt, split by position: strong hit sweetspot, frames 7-9, 9.3%; weak hit sourspot, frames 7-9, 6.5%. The bayonet's point: he keeps foes at the end of the barrel, so a thrust spaced to the tip pays.
The roster table is in [gameplay-design.md](../gameplay-design.md#strong-and-weak-hits-389) and every split in the [move list](../move-list.md).


### Illidan

**Identity:** the original fighter with the highest air speed and the
longest glaives (forward and back air reach 175 units; forward smash, Fel
Lunge, lunges 40–70 to reach 160–190, #379).
He reaches farther and deals less: the twin-glaive forward air 3 + 4, back air 6, forward
smash 10, all at 85 knockback growth, and his smashes start from 20 base
knockback like everyone's ordinary hits. Every hit he lands drains the
target's mana, more for big hits and combo enders, and his side special is
Fel Rush ([Illidan](illidan.md), #147). His down special, Immolate, is
Maiev's former Fan of Knives shape (#272): one frame-one burst on both sides
of him that pops foes upward (85 degrees, base 75, growth 50) for 7 damage on
the ground and 9 in the air, with an intangible first frame; it holds him in
place in the air, a jump cancels it from frame 4. **Weakness:** his light hits make
him land more of them to take a stock.

**Gameplan** (smashcraft:ts/src/game/sim/illidanGameplan.ts): he fights in
the air at his glaives' length, forward air in and back air drifting out,
threatens forward smash's reach on the ground, and whittles the
opponent's mana and pressures with short-hop Eye Beams.

#### Balance record

9 Oct 2026, #359 (a defect fix, not a tuning pass): his dash attack
launched at 23° and killed sooner than his forward smash, and the forward
smash dealt 9% where this section commits to 10. Dash attack now launches
at 60° (damage 9, base 20, growth 95 unchanged); forward smash's glaive
swing deals 10%. Measured from the centre of stage 0, no DI, against
Rifleman / Mrgl & Grgl / Cairne: uncharged forward smash kills from 145 / 137 /
190% before and 131 / 124 / 173% after; fully charged Eye Blast is
unchanged at 77 / 76 / 114%. 9 Oct, #379: forward smash became Fel Lunge,
a short lunge with no beam (uncharged 128 / 122 / 171%, fully charged 94 /
90 / 125%), and Eye Blast moved to his neutral special
(smashcraft:docs/design/illidan.md; removed 2026-10-28). Dash attack kills from 115 / 115 / 170%
before and 145 / 135 / 190% after; at 120% it now sends Rifleman 180 units
up (39 before) with Illidan 22 frames ahead.

#### Eye Beam (neutral special)

Since Tom's 2026-10-28 request, Illidan's neutral special is Eye Beam, a
laser from his eyes timed like Falco's Blaster: frame 23 of 57 on the ground,
frame 13 of 42 in the air with a 4-frame landing, 3% with set knockback 5.
Mana Burn's slow orb, its percent-scaled stun and its projectile clash are
gone; no projectile clashes remain. Design, numbers and reasons:
smashcraft:docs/design/illidan.md, "Neutral special: Eye Beam".

## Implementation details for the overnight agent

### Read the real project first

Read the repository’s applicable AGENTS.md and active implementation notes, inspect the current branch/worktree and uncommitted changes, and identify the actual fighter-definition, input, simulation, animation, and presentation interfaces. This document is a design handoff, not a source audit. Do not assume a named model, animation clip, native function, or rollback primitive is available because it appears in a moveset description.

The earlier CODEX_IMPLEMENTATION_BRIEF.md and SMASHCRAFT_NETCODE_PROPOSAL.md remain architecture references. The user’s newer source and measured capability reports take precedence on current implementation status. Specifically, an observed early local polling transition is not proof that visible rollback, exact animation phase restoration, physical latency, or fairness has passed. Keep the hero rollout separate from those claims.

Preserve existing characters and established controls. If a hero already exists, compare its kit before adding a duplicate. Illidan is outside this expansion spec; integrate through the same interfaces but do not replace his moves or change Rifleman without a concrete shared-system need. Never disrupt another running development session merely to build this roster. The user is requesting this specification here; no unattended agent has been launched by writing it.

### Data required for each move

Keep move data separate from generic execution where the existing architecture permits. The equivalent of the following fields should be reviewable for each move, even if the actual language or schema differs:

| Field group | Required data |
| --- | --- |
| Identity | Stable fighter ID, move ID, input selector, grounded/air availability |
| Timing | Startup, explicit active windows, recovery, landing lag, charge behavior, cancel policy |
| Combat | Hitbox shapes by action frame, hurtbox extensions, damage, launch angle, calibrated knockback coefficients, hitlag/hitstun profile, shield behavior |
| Motion | Per-frame velocity/position instructions, collision policy, air-use limit, helpless transition |
| Resource | Cost, spend frame, cooldown, stock/round reset behavior, insufficient-resource path |
| Entities | Spawn schedule, stable IDs, cap, lifetime, durability, attack schedule, destruction and reflection rules |
| Status | Type, source, duration, expiration, immunity window, stacking policy |
| Presentation | Verified model/clip binding, phase mapping, effects, sounds, attachment points, fallback |
| Rollback | Snapshot fields, per-target hit registry, event identities, cleanup rules |

Represent multi-phase actions explicitly. “End f40” means next actionable frame is f41. For a projectile move, the actor’s recovery ends independently of the projectile’s lifetime. For a single-stage move specified as active fX–Y and RZ, actionability begins at Y+Z+1. Use inclusive frame ranges everywhere.

Charge, mana regeneration, statuses, ultimate timers, and projectile life use simulation ticks. No render-delta time, wall time, native unit orders, or engine RNG may determine a gameplay outcome. Input repeat is not a new B press. A neutral/down B choice is captured when the action starts and cannot be changed during replay.

### Action defaults and edge cases

Match-frame timers advance once per executed fighting frame and stop during an agreed match pause; never advance them during repeated replay of the same frame as external time. Keep the existing hitlag policy for action animation counters. Buff, status, immunity, and lifetime countdowns advance by one per simulation frame even during individual hitlag unless the existing project has an explicit different shared rule, which must be recorded.

All listed normals have one hit per target per action, with the front/back phases sharing a hit registry. They do not chain automatically; jab is a complete single-hit normal in this initial roster. Existing universal combo/input-buffer rules can allow the next move once the action is free, but no new character-specific cancel is implied. The damage variants in a row choose the strongest intersecting hitbox, never sum overlapping volumes.

If a special’s row omits a radius for an attached melee strike, use its fighter’s M reach and the visible attacking limb/weapon as the initial geometry. The radius is not a license to hit behind the fighter. Use the same angle mirroring and one-hit rules as normals. A spell marked ground-only does not activate while airborne and spends no mana. Other non-mobility specials can be used in air, retain normal gravity, provide no stall, and terminate on landing with 20 landing-lag frames unless already completed. Completed projectile casts leave their projectiles alive; interrupted pre-spawn casts spawn nothing. Healing and buff casts remain ground-only if specified.

For up B, the movement curve must reach the listed unobstructed displacement through the documented travel window; choose a deterministic eased or ballistic curve consistent with current collision. The listed distances are maximum travel in empty space, not teleport-through-terrain distances. No double-jump reset. Shield stops grounded dash specials before overlap; a successful body hit does not automatically cross through the victim. Use consistent separation on trades. For air side B moves, consume an airtime-use flag on entry and end in helplessness even on hit; a wall collision ends travel early but does not remove recovery.

For reflected projectiles, change owner/source to the reflector, preserve remaining lifetime and current speed magnitude, reverse the horizontal direction (or use an existing deterministic reflect normal), reset only the hit registry needed to permit hitting the previous owner, and prevent repeated reflections on the same frame. Original-owner caps must release the reflected slot; the global projectile cap still bounds storage. Reflection may transfer a projectile status such as a heat mark, but never credits two sources for one hit.

Damage-over-time packets cannot trigger armor, guard success, projectile reflection, summon commands, or additional on-hit statuses. A shielded projectile is destroyed without status. When multiple acceleration-slow effects overlap, apply only the strongest, not their product. Hex and silence share one 180-frame post-effect immunity group so two casters cannot alternate permanent special denial. Silence never blocks up B; Hex does (#521), and its mash-out, never before frame 36, is what keeps recovery open.

Every summon and ward has a readable creation tell. Destroying a caster before a deferred burst cancels that burst only where the kit states that the caster is channeling or that the marker is cancelled on interruption. Ordinary already-emitted projectiles persist through hitstun and disappear on owner stock loss. A summoned object cannot start a new attack while its owner is grabbed or in hitstun; already-emitted projectiles continue. This default applies to all autonomous attacking objects unless an ultimate explicitly specifies a channel.

For minimum implementation, entities do not attack during the owner’s grab/throw animation and throw recovery. If a later design permits coordinated pet throws, it must separately demonstrate counterplay and regrab safety. Pets do not escape or cancel owner hitstun simply because a remote input arrived late.

Clear all owner buffs, marks, status effects on the respawning body, stock healing counters, pet state, and mobility-use flags on stock loss/respawn according to their stock scope. Clear the old owner’s marks on other targets when that owner loses a stock. The ultimate readiness timer belongs to the player and persists across stock loss. Match/round reset clears everything, including input buffers and epoch-owned entities, and seeds the ultimate timer consistently.

### Deterministic simulation and presentation

The moves execute in the custom numerical fighting simulation. Their outcome must not depend on Warcraft’s native armor, damage, spell targeting, unit AI, pathfinding, or attack cooldowns. Preallocate presentation objects consistently if the current native backend requires it. Native handles and animation playback positions do not determine canonical combat state.

Snapshot, restore, and hash at least fighter action/frame, movement, damage/stocks, resources, resource-delay timer, buffs/debuffs, status immunity, grab relationship and timers, regrab protection, recovery flags, pending input, charge duration, entity pools/allocation counters, entity state, per-target hit registries, and ultimate state. Avoid local Wurst allocations that share allocator state with replicated objects. Use stable entity ordering and stable numeric operations supported by the target runtime.

An attack instance can be identified by epoch, fighter ID, move ID, and action-start frame; spawned entity/event IDs add a deterministic spawn or hit ordinal. Replaying a frame cannot send another network message, create duplicate sound, or create extra persistent effects. Reconcile model poses and persistent visuals once after replay. Confirm stock loss and match victory before publishing irreversible results.

Default simultaneous-hit policy should preserve the project’s established behavior. If unspecified, collect same-frame candidates from the same pre-resolution state and resolve symmetric melee trades before applying resulting knockback; do not allow the first player in an array to delete the other’s valid hit. Within one attack, pick the strongest applicable hitbox. Document grab-versus-hit and projectile-clash priority explicitly in code and tests. No tie-breaking by packet arrival, lobby creator, or player slot.

Every model needs a verified animation map: action, native clip/index if available, authored duration, runtime playback rate, and pose handling after correction. A model’s single attack animation is not itself a moveset. If exact phase seeking is unsupported, report that limitation and use a tested presentation fallback; do not claim a correct full animation while showing an already-finished hitbox as a fresh windup. Never create a hidden weapon-size hitbox solely because its visual animation is inconvenient.

### Minimum work sequence

1. **Inventory and checkpoint:** establish the known playable baseline, current netcode milestone, existing heroes, available models, verified animation bindings, and actual input actions. Record what is implemented versus proposed.
2. **Reusable primitives:** confirm or add frame-defined melee volumes, projectile motion, swept hits, grabs/throws, per-airtime recovery flags, short statuses, and deterministic owned entities. Do not add every future mechanic at once.
3. **First complete hero:** Blademaster, using the full base kit and basic cosmetic effects. Ultimates stay disabled. Validate normals, shield interaction, throws, recovery, death, replay, and model alignment.
4. **Second contrasting hero:** Mountain King. Compare a compact heavy against the existing ranged fighters and Blademaster; do not tune only a mirror matchup.
5. **Mobility and defense:** Warden, Brewmaster, Uther. Exercise teleport endpoints, temporary intangibility, armor, and healing caps.
6. **Caster kits:** Lich, Dreadlord, Shadow Hunter, then Pit Lord. Introduce a status or summon only after the required common primitive passes replay checks.
7. **More complex setup characters:** Tinker, Alchemist, Naga, Beastmaster, Dark Ranger, Firelord. Keep each behind an explicit development toggle until playable and verified.
8. **Optional ultimates and visual polish:** only after base kits pass. No production-ready label for untested ultimates.

If the current source requires a different safe dependency order, retain the design priorities but explain the change. Commit or checkpoint complete units of work using the repository’s existing conventions. The deliverable is a playable, tested increment with honest gaps, not a roster count.

## Balance gate

Decided by Tom on 7 Oct 2026 (#105); tightened from 40–60% on 9 Oct 2026. The roster is balanced when **every
fighter's win rate against the field is between 45% and 55%**, with both
computers at **Wren Expert** and at least **400 matches a pair**: every pair
of different fighters, both orders, on every soak stage, over seeded
matches. The numbers live in one constant, `BALANCE_GATE` in
smashcraft:ts/scripts/cpuField.ts. smashcraft:ts/test/cpu-field.test.ts
checks that this section states the constant's numbers, so changing the gate
means changing the code and this section together.

Tom's fuller balance spec (8 Oct), which adds the spam probe, the move-share
ceiling, play-style profiles and the balance score on top of this band, is
smashcraft:docs/design/balance.md.

Matchup parity is reported but not gated. Each matchup's win rate, the
count inside 45-55%, the count whose 95% interval overlaps that band and
the median distance from 50% are printed beside the verdict. The computers
play nearly deterministically, so a small edge in one matchup becomes a
lopsided result over hundreds of matches, and tuning one matchup moves
others. At 100 matches a pair the 45-55% band is also within one standard
error, so even an even matchup often lands outside it. A fighter's rate
against the field averages over eleven opponents and reflects its
strength, which is what tuning can move without making kits alike.

A change that passes the gate must also keep each fighter's identity: it
works the fighter's declared strength or weakness (its section above and
its gameplan) and is recorded in the Balance record with its before and
after numbers.

Check (from ts/, in shards under the capacity helper; each shard is a
`--pairs` list, about 0.15 s a match):

```text
bun scripts/cpuField.ts --per-pair 400 --seeds 100 --pairs <pairs> --json shard.N.json
bun scripts/cpuField.ts --merge shard.0.json,shard.1.json,...
```

The merged table ends with "Balance gate (...): passes", "fails" or "not a
gate run" (a different level or fewer matches a pair), and lists any fighter
outside the band. Latest run:
smashcraft:evidence/balance-105-20261007/n400-after-arrow-defile.md.

A fighter failing the gate when a release build is cut is hidden from
selection rather than holding the release (Tom, 7 Oct 2026): `bun
scripts/releaseRoster.ts FIELD.json` writes the hidden slugs into
smashcraft:ts/src/game/sim/heroes/releaseRoster.ts, compiled into the map so
every client agrees. Measurement still plays the whole roster.

## Balance and feel measurement

### Measure interactions rather than assign a power score

Do not sum damage, reach, and startup into a single “balance value.” A weapon’s extra reach depends on movement, hurtbox exposure, active path, recovery, shield pushback, and the options available to the other fighter. A long disjoint is acceptable if it has a readable commitment and meaningful answers.

For each character pair under test, sweep starting distance in 0.1H increments and defender response offsets in 1-frame increments. Start at 0, 30, 60, 100, and 140 damage percent; include both facings, neutral DI, and the supported extreme DI directions. Use a flat stage first, then a ledge and one platform layout. Extend only where a concrete issue appears.

| Question | Experiment and reported result |
| --- | --- |
| Can a whiff be punished | Attacker misses at each spacing; defender runs/jumps into candidate punish. Report earliest actual hit versus attacker’s earliest shield/escape frame |
| Is a move safe on shield | Resolve real contact frame, shieldstun, hitlag, pushback, landing, and defender response. Report actual punish options at close and tip range |
| Is a link guaranteed | Replay the follow-up against each legal DI/escape. A positive result proves only tested states and options, not all play |
| Does a projectile dominate | Compare jump, shield, retreat, attack through/clash if supported, and punish during its recovery; include ammo/entity caps and mana limits |
| Does a recovery have counterplay | Sweep launch positions and angles, test ledge access, wall collisions, endpoint vulnerability, and mana-free variant |
| Does a trap create a loop | Repeat optimal shield/escape/grab defense and measure whether at least one legal exit remains at plausible timings |
| Do large characters function | Check platforms, ledges, blast zones, combo escape, shield coverage, and the difference between visible model and actual hurtbox |

A simplified whiff test is travel-to-range plus defender startup versus attacker remaining recovery, but use the simulator for the final answer because acceleration, hitbox travel, and displacement matter. For aerials, contact height and landing lag can change the answer by many frames. Report those conditions with every finding.

### Keep simulation fairness separate from readability

Run moves first with complete input tapes and no network, then with the real supported input-delay/rollback profiles. Do not slow all attacks just to hide an unknown delivery problem. Measure skipped remote startup, correction depth, and false speculative hits separately from move balance. A 20-frame total animation can still have a 3-frame startup; recovery frames do not restore a missed warning.

Use the same assigned-frame input tapes with player sides swapped. Confirm identical combat results after remapping player IDs. For network testing, swap machine/slot/room creator where supported and record per-side capture-to-response, input age, rollback depth, stalls, and confirmed state agreement. Existing native capability findings and current measured delivery determine supported settings; this document makes no claim of an optimal buffer or zero host advantage.

### Human feel checklist

Ask whether each character has a usable jab, a credible anti-air, a reason to grab shield, a way to approach, a way to recover with depleted mana, and at least one move that expresses their identity. Then play short matches. Check that important attacks can be visually distinguished before becoming active, effects do not hide hurtboxes, hit confirmation is readable, and weapon range matches the animation.

The roster can have different difficulty levels and some tier variation. Avoid one character owning the fastest startup, longest range, strongest kill options, safest recovery, and best zoning simultaneously. Do not impose identical frame data on everyone to make a spreadsheet look balanced.

## Acceptance and morning handoff

A hero is ready for playtesting when all 13 normal actions, grab, pummel, four throws, four B specials and mana-free recovery work with no missing input route. An ultimate may remain disabled and must be labeled separately. Character-select icon and model presence alone do not meet this bar.

Required checks for each completed hero:

- Move entry, interruption, end frames, landing lag, facing, and charge behavior match the recorded data.
- Hitboxes and hurtboxes match visible weapon/body movement at startup, active, and recovery frames.
- Shields, trades, grabs, throw escape, regrab protection, DI, and techs still follow shared rules.
- No unlimited air stall, recovery refresh, teleport through solid terrain, or free ledge invulnerability.
- No negative mana, duplicated resource spending on replay, orphaned grab, or retained old-stock entities.
- Replaying the same input tape produces the same confirmed state, including summons, statuses, and entity allocation state.
- A delayed-input replay with a correction around the new move converges to the complete-input result. For a purely cosmetic unsupported feature, report the presentation gap separately.
- Two-client runtime evidence covers the completed hero when the current networking build is available. If it is not available, label the hero locally tested only; do not invent a multiplayer result.

Run focused checks for actual new risk rather than duplicating the implementation with hundreds of superficial tests. Reuse the project’s established replay/canary suite. Preserve useful failing traces and the exact input tape that reproduces them.

The morning report should include the source revision/worktree, build artifact location, heroes completed, moves omitted, screenshots or short captures, measured test outcomes, known defects, balance observations, and next action. Distinguish implemented, locally tested, two-client tested, inferred, and not tested. Report actual physical latency only if measured with an independent reference.

## Prompt to give the implementation agent

Read the attached Smashcraft Hero Expansion Specification and the repository’s current instructions. Preserve ongoing netcode work and existing fighters. Audit existing character/move interfaces and available assets, then implement the recommended roster incrementally, starting with one complete Blademaster base kit and then Mountain King if time permits. Treat all numbers as initial tuning, not proof of balance. Use the existing deterministic simulation and replay architecture; do not substitute native Warcraft combat or add a second unsynchronized gameplay path. Validate actual moves, hitboxes, throws, mana-free recovery, and replay correctness. Keep optional ultimates disabled until base kits pass. Continue through the build order as time permits, checkpoint complete work, and leave a morning report with exact completed work, evidence, and gaps. Do not claim a hero finished solely because its data or selection entry exists.

## Sources and design provenance

The proposed movesets are original adaptations for this project. Warcraft ability names, identities, and themes are reference material; they are not a requirement to reproduce RTS mechanics literally. No numerical table above is extracted Melee data. When consulting Melee, use the actual versioned reference data already in the repository and compare whole interactions rather than copy isolated damage or startup values.

Relevant Blizzard character references:

- [Blademaster](https://classic.battle.net/war3/orc/units/blademaster.shtml), [Shadow Hunter](https://classic.battle.net/war3/orc/units/shadowhunter.shtml), [Warden](https://classic.battle.net/war3/nightelf/units/warden.shtml)
- [Lich](https://classic.battle.net/war3/undead/units/lich.shtml), [Dreadlord](https://classic.battle.net/war3/undead/units/dreadlord.shtml), [Paladin](https://classic.battle.net/war3/human/units/paladin.shtml), [Mountain King](https://classic.battle.net/war3/human/units/mountainking.shtml)
- [Pandaren Brewmaster](https://classic.battle.net/war3/neutral/pandarenbrewmaster.shtml), [Pit Lord](https://classic.battle.net/war3/neutral/pitlord.shtml), [Goblin Tinker](https://classic.battle.net/war3/neutral/goblintinker.shtml), [Goblin Alchemist](https://classic.battle.net/war3/neutral/goblinalchemist.shtml)
- [Naga Sea Witch](https://classic.battle.net/war3/neutral/nagaseawitch.shtml), [Beastmaster](https://classic.battle.net/war3/neutral/beastmaster.shtml), [Dark Ranger](https://classic.battle.net/war3/neutral/darkranger.shtml), [Firelord](https://classic.battle.net/war3/neutral/firelord.shtml)

Architecture reference: the project’s CODEX_IMPLEMENTATION_BRIEF.md and SMASHCRAFT_NETCODE_PROPOSAL.md dated 30 September 2026, read for this handoff, plus the current implementation agent’s actual source, logs, and tests. This expansion document does not certify those earlier technical claims or supersede newer measured findings.


## Grom Hellscream

**Identity:** reckless, furious, tragic. Grom runs into the fight with Gorehowl
raised and commits his whole body to killing swings. He earns pressure by
closing distance; his recovery and missed axe swings leave him exposed. He
has no rage meter, counted bonus or hidden bonus. Unlike Thrall he fights
on foot with no wolves or lightning; unlike Blademaster he never vanishes,
leaves images or plays a safe outer-blade spacing game.

Initial values are original, provisional tuning: weight 1.16H, run 1.04H,
air drift 0.92H, width 1.12H, height 1.10H. Normal axe reach is 95–132 world
units; fast hilt checks reach 52. His upward leap travels 384 units before
gravity, costs his aerial jump and ends helpless. Predictable recovery is
his edge-guard weakness.

### Normals

| Input | Action and decision | Startup / active / total | Damage |
|---|---|---|---|
| Jab, jab 2 | Hilt check, then a short axe chop; keep a close foe honest | 4/2/14; 6/2/20 | 3; 6 |
| Forward tilt, angled | Gorehowl chop, with the chosen high or low contact | 9/3/28 | 12 |
| Up tilt | Haul the axe overhead to start a juggle | 8/4/26 | 9 |
| Down tilt | Low haft sweep; a launcher into a chase | 7/3/24 | 8 |
| Dash attack | Shoulder-first entry; shield stops its reward | 9/5/32 | 12 |
| Forward smash | Planted execution chop; punish the long miss | 18/4/46 | 22 |
| Up smash | Two-handed rising axe swing | 14/4/42 | 17 |
| Down smash | Low front-and-back sweep | 15/6/44 | 16 |
| Neutral air | Broad turning axe cut | 8/6/28, landing 16 | 10 |
| Forward air | Heavy overhead cleave | 12/3/34, landing 20 | 14 |
| Back air | Furious reverse chop | 10/3/30, landing 18 | 13 |
| Up air | Axe held overhead, upward cut | 8/4/26, landing 16 | 10 |
| Down air | Gorehowl downward spike, with a grounded launch instead | 15/3/38, landing 24 | 15 |

### B specials

All four base specials are free;
there is no Grom-specific resource or cooldown.

| Input | Base move |
|---|---|
| Neutral | **Warsong Cry:** brace and roar; a close body burst at frames 12–15 launches foes upward for a chase, ending frame 34. Air version lands with 20 lag. |
| Side | **Gorehowl Rush:** run axe-first on frames 8–20, hit at 10–17, stop at shields and recover through frame 40. Air version is once per airtime and ends helpless. |
| Up | **Blood Leap:** spring upward on frames 7–22, axe rising through 7–14; ends frame 36 in helpless fall. No invulnerability. |
| Down | **Mannoroth's Bane:** visible two-handed execution, active 20–23, recovery through frame 50; ground and air cleave, 24 landing lag. |

### Grab and throws

Reach the empty hand at frame 8, ending frame 27 on a miss. One headbutt
pummel deals 3. Forward throw is a 9-damage bodily shove at frame 14;
back throw is an 11-damage heave at frame 16; up throw is an 8-damage axe-haft
lift at frame 14; down throw is a 7-damage slam at frame 18 that starts a tech
chase. Shared mash escape, regrab protection, DI and techs apply. Follow-ups
are chase opportunities, with the victim's DI and defensive inputs active.

### Play-style profile

Rush-down bruiser: ground approach 65%, aerial approach 35%, ranged damage
0%, special damage target 20–35%. Signature is Gorehowl Rush into a committed
cleave. No single move should exceed 40% of damage. Low sweep, up tilt and
Warsong Cry open launch-and-chase play; execution chops finish it. The issue's
one balance probe must place him at 45–55% against the field.

```balance-profile
fighter: grom-hellscream
archetype: rushdown
aerials: nair 10-40, fair 15-45, bair 10-40, uair 5-35, dair 0-25
air-share: 20-40
approach: 55-80
ranged: 0-0
specials: neutral 2-15, side 10-30, up 0-10, down 2-15
```

Path draft for Tom to correct (#358):

```ceiling-plan
fighter: grom-hellscream
path: execution
basic-moves: forward-tilt,down-tilt,neutral-air
```

Basic gameplan: Poke with the axe and use simple neutral aerials. Keep one approach, use the listed moves, no read-based punishes or advanced kit sequences. Recovery keeps the normal up special.

Expert gameplan: Time war-cry pressure, rush confirms and leap routes into axe kills. Use the full authored kit and gameplan at the same CPU skill.


Stock campaign Grom model, textures, portrait, cries and Orc spell effects
are the first inputs. Authored clips reshape that stock rig to make each
contact point readable; no third-party model.

### Signature strong/weak move (#389)

Forward smash, split by position: strong hit sweetspot, frames 18-21, 18%; weak hit sourspot, frames 18-21, 12.6%. Gorehowl bites with its blade; the haft only shoves.
The roster table is in [gameplay-design.md](../gameplay-design.md#strong-and-weak-hits-389) and every split in the [move list](../move-list.md).

## Anub'arak (#341)

**Identity:** an ancient insect king who treats the stage as his crypt. He advances with a low, six-legged scuttle, skewers ankles with his tusks, disappears under the floor and erupts beneath prey. His carrion beetles do the undignified chasing for him. Heavy ground control and frightening eruptions cost slow turns, a broad body and committed recovery. No damage reflection, resource or hidden stat bonus.

### Normals

Original provisional values; F/A/R counts start at simulation frame zero. Volumes are tusk, claw and carapace capsules authored for his broad body.

| Input and move | F/A/R; landing | Damage | Gesture and purpose |
|---|---|---:|---|
| Jab — Royal Rebuke | 6/3/17 | 4 | Coiled lunge with a crossing right-claw rake; another tap hooks the left claw down over the target and rakes it under the shell (8/3/20, 6%) |
| Forward tilt — Mandible Spear | 10/4/24 | 11 | Rearing pounce that rakes the pincers wide and low in front; angled forms chop overhead or hook down to rake ankles |
| Up tilt — Crown Lift | 9/5/23 | 10 | Horn lifts prey into a juggle, narrow near the ground |
| Down tilt — Grave Rake | 8/4/20 | 8 | Claw hooks down from above the head onto the floor in front and rakes back under him; launches a tech chase |
| Dash attack — King’s Advance | 12/5/28 | 12 | Coiled spring into a wide, low claw sweep |
| Forward smash — Execution Tusk | 20/4/34 | 20 | Claws reared overhead; one hooks down over the target, rakes to the floor and drags back under the shell, with exposed recovery |
| Up smash — Crown of Spines | 17/5/31 | 18 | Raise both pincers above the shell |
| Down smash — Crypt Sweep | 16/6/32 | 16 | Both claws reared overhead; the right hooks down in front, then the left rakes behind; one hit per target |
| Neutral air — Carapace Wheel | 10/7/24; L18 | 10 | Broad shell twist clears nearby bodies |
| Forward air — Royal Skewer | 13/4/27; L20 | 13 | Claw raised overhead scythes forward and down through the target |
| Back air — Hindclaw | 11/4/27; L20 | 14 | Shell drives backward as the claws rake through behind it |
| Up air — Horn of the King | 9/4/23; L16 | 10 | Coiled rise that lifts both claws in a rising overhead rake |
| Down air — Tombstone | 14/5/32; L24 | 15 | Both claws raised overhead drive straight down under his shell; airborne spike |

### Four specials

All four specials are free; no beetle count or burrow meter is shown or banked.

| Input | Ordinary move | Counterplay |
|---|---|---|
| Neutral — **Impale** | Stamp at f18; a floor-level spine line travels at 10 units/frame for 36 frames, 9%, upward launch; end f48. Air cast sends the same line forward at foot height, L24. | Jump over the low line, shield or punish the stamp |
| Side — **Burrow Hunt** | Coil f1–9, burrow f10–25 while moving 10 units/frame, erupt with a 12% launcher f26–29; end f64. Ground only. | Track the moving mound and meet the slow eruption with shield or a jump |
| Up — **Crypt Eruption** | Charge aim f1–8, launch along the chosen direction for 28 frames over a 400-unit route; narrow 8% horn hit f9–16, stop then fall helpless; end f46. | The broad shell is exposed before launch and during helpless fall |
| Down — **Carrion Beetle** | Plant a beetle nest f22, end f46; one fragile 24-HP nest lasts 180 frames and sends three floor-running beetles (5% each) at ages 1/49/97. Down again recalls it. | Destroy the nest, jump the beetles or reflect a beetle back; block the first beetle up close and punish the cast |

### Grab and throws

Standing grab starts f10, the shared 96-unit envelope is active for three frames, total 37; dash and pivot use the shared extensions. Both front pincers clasp the victim. One short pummel dents them for 3%.

| Throw | Gesture | Contact / total | Damage and launch |
|---|---|---|---|
| Forward | Pincers push prey from the crypt | 16 / 40 | 9%, 40 degrees |
| Back | Shell pivots and flings prey behind | 19 / 46 | 11%, 40 degrees, kill throw |
| Up | Crown impales then tosses overhead | 15 / 36 | 8%, 90 degrees, juggle |
| Down | Pin prey and drive a tusk into the floor | 21 / 48 | 7%, 70 degrees, tech chase |

**Body and risk:** weight 1.28, ground speed 0.82 and air drift 0.75 of reference; stock Crypt Lord scale and visible shell define his hurt body. Burrow changes his visible pose and matching hurt parts rather than silently granting invulnerability. His opponent can react to the mound and emergence. No guaranteed grab loop: up/down throw follow-ups are positional choices with DI, jump and tech escape checks.

### Field retune (#788, 30 October 2026)

Balance run 41005739256 (b23aabef8a) put Anub'arak at 74.8% in the field and his dash attack spam at 94% against Expert, with the dash attack carrying 27% of his damage and 9,868 of his stocks taken. His dash attack drops to ×0.65 damage and ×0.65 knockback growth (14.87% to 9.66%, growth 80.9 to 52.6; first set to ×0.75, which the farm field read at 61%); every other move keeps its authored values. A local 120-match sample over twelve opponents read his field at 70% before the change and 55% at ×0.77, his dash spam 100% before and 37% at ×0.77.

### Play-style profile

Ground-control draft: Impale makes prey jump into the crown; beetles pressure approaches while Burrow Hunt punishes a stationary guard. Slow aerials cover space, not repeated rushdown.

```balance-profile
fighter: anub'arak
archetype: trapper
aerials: nair 10-35, fair 15-40, bair 10-35, uair 10-35, dair 0-25
air-share: 10-35
approach: 20-50
ranged: 15-45
specials: neutral 5-20, side 3-15, up 0-8, down 3-15
```

Path draft for Tom to correct (#358):

```ceiling-plan
fighter: anub'arak
path: decision
basic-moves: forward-tilt,down-tilt,neutral-special
```

Basic gameplan: Use claw pokes and simple impales. Keep one approach, use the listed moves, no read-based punishes or advanced kit sequences. Recovery keeps the normal up special.

Expert gameplan: Choose burrow approaches, beetle pressure and impale/grab conversion routes. Use the full authored kit and gameplan at the same CPU skill.

### Signature strong/weak move (#389)

Forward smash, split by position: strong hit sweetspot, frames 20-23, 20%; weak hit sourspot, frames 20-23, 14%. The impaling claw's point.
The roster table is in [gameplay-design.md](../gameplay-design.md#strong-and-weak-hits-389) and every split in the [move list](../move-list.md).


## Fighter identity audit (#148, Tom 9 Oct 2026)

The old counted effects are cut. Existing standard actions carry these identities;
none of the current kits needs a replacement effect. Archer is removed by #339; the roster cap is 26.

| Fighter | Keep: expressive actions learned in play | Cut: counted or hidden effect |
|---|---|---|
| Rifleman | Rifle strikes, recoil steering, bear and freeze trap | Every fourth Long Rifle shot |
| Illidan | Warglaive chain, Fel Rush shortened or spiking, wing dive and plunge | Ordinary-hit and throw meter drain |
| Blademaster | Outer-blade spacing, plunge drill and deliberate sword specials | Counted Critical Strike |
| Mountain King | Hammer-and-axe chain, hammer lift and Thunder Leap | Counted Bash hitstun bonus |
| Warden | Fan of Knives, glaive drill and chosen Blink | Aerial-hit jump refund |
| Lich | Frost zones, deliberate ice armour and hovering cast poses | Counted reactive Frost Armour |
| Uther | Hammer spacing, Devotion Aura armour and Divine Shield | Counted launch reduction |
| Dreadlord | Corkscrew bite and wing-led close moves | Counted automatic lifesteal |
| Shadow Hunter | Glaive drill, ward placement and crossfire | Banked Voodoo damage |
| Pit Lord | Wide cleaver swings and armoured charge move | Third-contact cleave bonus |
| Beastmaster | Commanded bear, Quilbeast and hawk positions | Timed Pack Hunt bonus |
| Lich King | Frostmourne reach, Val'kyr carry and growing Defile | Banked souls and soul forms |
| Thrall | Mounted hammer reach, lightning and wolves | Counted Windfury |
| Jaina | Staff strikes, Blizzard placement and Water Elemental | Faster hidden meter regeneration |
| Sylvanas | Bow-and-dagger actions, Silence and chosen escape | Banked Black Quiver damage |
| Cairne | Large visible body, halberd swings and guard read | Timed Endurance speed and stock heal bank |
| Chen | Heavy staff actions and chosen Earth/Fire/Storm branch | Counted Drunken Brawler |
| Peon | Tool strikes, a heaved log and chosen building | Pillage meter refund and stock heal bank |
| Tinker | Claw pack, factory placement and tracking Laser | Banked Engineering Upgrade |
| Kael'thas | Sphere gestures and explicit spell choices | Ordinary-hit meter steal |
| Mrgl & Grgl | Small visible body, quick claws and leap pressure | Ordinary-hit meter steal |

| Cairne move | Gesture and purpose | Startup / active / recovery; damage and launch |
| --- | --- | --- |
| Down smash — Twin Stomp | Both feet up, a heavy front stomp, both feet up again, a heavy rear stomp; Captain Falcon's clock with Ganondorf's look (#84) | 19 / 14 / 13 (45 total, no separate tail); front frames 19–22 at 18%, 80°, base 30, growth 100, an upward pop-up; rear frames 29–32 at 16%, 80° behind him, base 20, growth 100; no set-knockback trap hit |

Move healing restores its authored amount on a successful action, capped by
current damage; it keeps no hidden per-stock bank.
Which special carries which trait (a status, a heal or a meter drain) is
one table, smashcraft:ts/src/game/sim/identityTraits.ts;
contacts, command grabs, guards and armour read it, so an ordinary move, throw
or pummel carries no trait. The same file classifies every contact for
Banish (#360): a spell comes from a special or ultimate or what one spawned,
and lands on a Banished fighter for 30% more; an attack (normal, grab, pummel,
throw) passes through them. One #148 property over the roster checks every
ordinary move adds no counted damage, healing, status, meter effect or jump
refund, and every declared trait fires on its special and matches the kit's
data. Existing normal, special and command-grab checks continue to pin the
kept actions in Bun and emitted Lua.

## Lady Vashj (#663)

**Identity:** an imperious serpent queen who lets her foes exhaust themselves against her. A zoner with meter as armour: Mana Shield pays half of each hit from her ultimate meter before her percent, cold arrows chill, and a bouncing water serpent drains the foe's ultimate meter. Slow and wide up close. Kit, frame data, play-style profile and ceiling plan: [lady-vashj.md](lady-vashj.md).

## Medivh (#343)

**Identity:** a mad prophet who knows the punchline before anyone else. Cryptic,
theatrical staff flourishes bait a chase; he disappears and returns where the
opponent committed. Mobility trickster, light body (0.90 reference weight),
ordinary run (0.98), strong air drift (1.20), narrow 0.90-wide, 1.10-high body.
His staff is honest close-range contact; blink endpoints have visible recovery.
No charge system, second resource or automatic counter.

| Normal | Gesture and purpose | First / active / recovery; damage |
| --- | --- | --- |
| Jab, jab 2 | Two impatient staff taps | 5/2/13, 6/3/16; 3, 4 |
| Forward tilt, angled variants | Pointed staff rebuke, aiming high or low | 9/3/20; 7 |
| Up tilt | Lift the staff into a vertical launcher | 8/4/20; 7 |
| Down tilt | Ankle hook, launching into an aerial chase | 7/3/18; 6 |
| Dash attack | Robe-first shoulder and staff shove | 10/4/24; 8 |
| Forward smash | Two-handed prophet's staff thrust | 13/3/31; 15 |
| Up smash | Sweep the staff overhead | 18/5/31; 14 |
| Down smash | Low staff sweep forward then behind | 20/4/32; 13 |
| Neutral air | Wide theatrical robe/staff sweep | 8/6/22; 6; landing 14 |
| Forward air | Staff push away | 8/3/25; 9; landing 14 |
| Back air | Blind backwards staff jab | 12/3/24; 10; landing 16 |
| Up air | Overhead staff catch | 10/4/21; 8; landing 14 |
| Down air | Pointed staff plunge; airborne spike | 15/3/29; 11; landing 20 |
| Get-up / ledge attack | Staff sweep / climbing shove | 17/3/30, 17/3/21; 7 |

| Special | Ordinary version (all free) |
| --- | --- |
| Neutral: Arcane Omen | f12 launches one slow purple bolt, 9 damage, 40-frame cast. Shield or jump it. |
| Side: Vanishing Act | f10 blink 180 units forward, f12–14 staff strike for 7, end f38; intangible only f9–10. Read the arrival and punish recovery. |
| Up: Raven Flight | Compress f1–8, raven-form aimed flight f9–28 at 16 units/frame, 5-damage wing contact f9–15; end f36 helpless, spends air jump. |
| Down: Last Word | f10 blink 120 units backwards, f13–15 outward arcane burst for 5, end f38; intangible f9–10. Bait the pursuit or lose ground. |

**Grab and throws:** shared grab envelope; one 3-damage staff pummel. Forward
throw pushes at f14 for 7; back throw vanishes behind the victim then sweeps at
f17 for 9; up throw lifts with the staff at f16 for 7 (juggle); down throw
presses down at f18 for 6 (tech chase). No guaranteed string is assumed; DI,
air dodge and tech remain the victim's replies.

**Play-style profile:** mobility trickster; target 45–55% field wins, aerial
share 35–55%, approach 20–40%, ranged 10–25%, special 20–40%. Signature is
Vanishing Act's punishable arrival; no move should exceed 40% of total damage,
and single-move spam should win at most 45%. Explosive openings come from down
tilt/up throw into an aerial chase. Stock campaign Medivh and raven model,
Warcraft spell art and voice only.

```balance-profile
fighter: medivh
archetype: mobility trickster
signature: side-special 40
air-share: 35-55
approach: 20-40
ranged: 10-25
specials: neutral 5-20, side 10-25, up 0-10, down 0-15
```

Path draft for Tom to correct (#358):

```ceiling-plan
fighter: medivh
path: mixed
basic-moves: neutral-special,forward-tilt,neutral-air
```

Basic gameplan: Use staff pokes and a simple spell. Keep one approach, use the listed moves, no read-based punishes or advanced kit sequences. Recovery keeps the normal up special.

Expert gameplan: Choose and execute blink/raven movement, aerial routes and spell conversions. Use the full authored kit and gameplan at the same CPU skill.

### Signature strong/weak move (#389)

Neutral air, split by timing: strong hit clean, frames 8-9, 6%; weak hit late, frames 10-13, 4.2%. An arcane ring strongest as it forms, lingering as weak cover.
The roster table is in [gameplay-design.md](../gameplay-design.md#strong-and-weak-hits-389) and every split in the [move list](../move-list.md).

## Archimonde the Defiler (#664)

Down air: first active frame 18 to 16, so 16/4/30 (was 18/4/32); damage, angles, hit regions and the 26-frame landing lag are unchanged. At 18 a short hop pressed on frame 2 or 3 after takeoff (20 airborne frames) landed before the first active frame, so the shared short-hop down-air check in `ts/src/game/sim/shortHopAerials.tests.ts` failed for him in both facings (#762). The two hit regions and the hurtbox pose move two frames earlier with it; 17/4/31 still missed on press 3.
