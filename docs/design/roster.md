# Smashcraft Hero Expansion Specification

Adopted by the owner on 6 October 2026 from the 2 October expansion brief.
The requested roster is Blademaster, Mountain King, Warden, Lich, Uther,
Dreadlord and Shadow Hunter, in that order. The eight Tavern kits remain
optional candidates. Their tuning tables are starting values, not shipped
balance measurements. Existing fighters and newer gameplay decisions remain
authoritative; in particular, the throw-hitstun regrab rule adopted in #85
replaces this brief's earlier fixed protection timer.

This is a proposed expansion roster and implementation brief for Tom Passarelli’s Smashcraft, a Warcraft III platform fighter. It defines complete initial movesets for the seven requested heroes and all eight Tavern candidates, with a recommended build order. The goal is distinct, readable fighters with measurable counterplay and moves that can be replayed correctly by the custom simulation.

All move designs and numbers below are proposals, not existing implementation facts, copied Melee frame data, or a claim of proven balance. Preserve the existing Rifleman, Archer, and any implemented Illidan. The current source tree was not inspected for this document; the implementation agent must map this specification onto the real project rather than assume module or animation names.

## Scope and priorities

“Shadow shaman” is interpreted as Warcraft III’s Shadow Hunter, with Rokhan as the character reference. If Tom intended a different character, preserve this design under Shadow Hunter rather than silently rename another hero. Uther uses the Paladin identity. The eight Tavern kits are recommended candidates, not a commitment to ship all of them at once.

| Order | Hero | Distinct purpose | Main weakness |
| --- | --- | --- | --- |
| 1 | Blademaster | Grounded sword spacing and whiff punishment | Exposed recoveries and weak ranged pressure |
| 2 | Mountain King | Compact heavy with hammer and axe | Slow approach and limited air drift |
| 3 | Warden | Precision mobility and edge pressure | Light body and punishable teleport endpoints |
| 4 | Pandaren Brewmaster | Staff brawler with brew and fire combinations | Slow commitments and limited ranged reach |
| 5 | Lich | Deliberate projectile placement | Frail body and slow attacks at close range |
| 6 | Uther | Defensive hammer fighter | Weak chase and punishable defensive reads |
| 7 | Dreadlord | Air movement, grabs, and close pressure | Large hurtbox and no safe long-range approach |
| 8 | Shadow Hunter | Totem placement and angles | Setup can be destroyed or bypassed |
| 9 | Pit Lord | Extreme heavy with long cleaves | Very large target and slow recovery |
| 10 | Goblin Tinker | Gadgets, mechanical reach, and rockets | Long setup and exposed body |
| 11 | Goblin Alchemist | Ogre brawler with potion preparation | Slow body and buffs that require commitment |
| 12 | Naga Sea Witch | Ground control and arcing projectiles | Slow air movement and exposed recovery |
| 13 | Beastmaster | Fighter and bear coordination | Shared resources and punishable pet commands |
| 14 | Dark Ranger | Marked targets and a single skeletal helper | Requires setup and cannot replace Archer’s neutral game |
| 15 | Firelord | Fire zones and one short-lived summon | Zones have startup and can be escaped vertically |

Build order is a recommendation, not permission to delete or overwrite ongoing work. Finish or checkpoint the current synchronization milestone before integrating new gameplay into that branch. A first overnight pass should finish one or two complete heroes and reusable move primitives; it should not report all fifteen finished because character-select entries exist.

## Shared combat contract

### Controls and move inventory

Use logical actions rather than hardcoded physical keys. A is normal attack; direction and the existing tilt modifier choose tilts versus smashes. In the air, A plus direction selects neutral, forward, back, up, or down aerial. B is special: neutral B, side B, up B, and down B. Grab is the existing grab binding. Throws are forward, back, up, or down after grabbing. Ultimate is the existing dedicated logical action, not a new overloaded B combination.

Every fighter has jab, three tilts, dash attack, three smashes, five aerials, standing and dash grab, pummel, four throws, four specials, and an optional ultimate. Preserve the existing jump, shield, roll, dodge, ledge, tech, DI, and fastfall rules. No attack L-cancel requirement. Do not invent one-frame links as a requirement for a basic kit to function.

### Timing and geometry notation

The simulation runs at 60 ticks per second. Timings are simulation frames, not render frames or Warcraft network callbacks. An action begins on frame 1. In normal tables, F/A/R means first active frame, active duration, and recovery after the last active frame. For 6/3/15, the hitbox is active on frames 6 through 8 and the action is free on frame 24. Unless overridden, one target can be hit once per action even if volumes overlap. L is landing lag for an aerial; no autocancel windows in the initial implementation. Landing ends the aerial hitboxes and starts its listed landing lag. Aerials do not gain landing hitboxes unless specified.

H is a fixed reference height taken from the standing combat hurtbox of the current baseline fighter, not from model bounds. Reach is measured from fighter center to the furthest hit volume: S = 0.55H, M = 0.80H, L = 1.10H, XL = 1.40H. These are initial outer extents, not solid rectangles. Construct capsules or circles along the described swing and inspect the full path. Do not fill the entire arc with a huge active volume. Mirroring uses logical facing.

Weapon-only extensions can be disjointed; hands, feet, wings, tails, and bodies retain attached hurtboxes. A glowing effect does not justify an invisible extra hitbox. Unarmed magic has only the explicit reach in the table. Calibrate model scale to hurtboxes and weapon positions; do not stretch all heroes to identical silhouettes.

Angles are degrees relative to the attack direction: 0 horizontal, 45 diagonal outward, 90 upward, 270 downward. A back aerial or back throw points away from facing. For up/down throws, use facing only to break horizontal ties. Downward aerial angles become 55 degrees against grounded targets in the first pass, unless a row explicitly specifies a grounded effect. Use existing meteor-cancel behavior if present; this document does not add or remove it.

Smash timings describe an uncharged move. Hold charging immediately before its first active frame, up to 45 additional frames; scale damage linearly from 1.00 to 1.25 and use the existing knockback relationship. No armor or invulnerability while charging. Input release continues the move; it does not restart startup.

### Knockback and hitstun

Use the project’s existing knockback, hitlag, hitstun, DI, shieldstun, and staling formulas. Do not replace core physics to make this document’s estimates match. Each attack names a tuning class: LINK for a short follow-up opportunity, POKE for separation without a strong launch, LAUNCH for an aerial chase, EDGE for a low outward launch, KILL for a finisher, or SPIKE for an airborne downward launch. Throws add two (#107): JUGGLE for an up throw's guaranteed short juggle and CHASE for a down throw's tech chase, tuned per kit until `bun wisp interactions` reports the role in smashcraft:tools/move-data/interactions/throws.md.

Calibrate classes in an empty test stage against a reference weight at 60 percent, no DI and no walls. Indicative displacement along the launch direction after 30 ticks: LINK 0.6–1.2H; POKE 1.2–2.0H; LAUNCH 2.0–3.0H; EDGE 2.5–3.5H; KILL 3.5–5.0H; SPIKE downward 2.5–3.5H before gravity. These are test bands, not a second knockback formula. Publish the actual coefficients and measured outcomes once calibrated. Adjust hitstun separately through the established formula rather than assuming distance proves a true combo. LINK never guarantees a follow-up without testing DI, percentage, weight, and move timing.

No critical-hit RNG, random evasion, chance-on-hit stuns, or automatic spell counters. Warcraft passive identities become deliberate moves, temporary states, or one counted passive per fighter whose stacks both players see ([hero passives](passives.md), Tom, 7 Oct 2026): a crit, bash or lifesteal only as a deterministic, capped proc, never a chance. Damage is Smash-style percent damage; healing reduces damage percent and is tightly bounded. Damage-over-time ticks do not cause hitlag, hitstun, or knockback. A status applies only on an actual body hit, not on shield.

### Proposed resource profile

Mana is every fighter's one resource for specials; its rules, numbers and bar are in [mana.md](mana.md): 100, full each stock, earned by landing normals and throws and (capped) by taking hits, plus a steady trickle, faster on the ground. Each B row lists its total cost, deducted once on move entry with no refund on interruption. An unaffordable move does not start or consume input as an attack, and the bar flashes once per press.

Every up B has a weaker zero-mana version described in its kit; being depleted must not remove basic recovery. If current mana is below the full up B cost, automatically select the free version and spend zero mana; this is the explicit exception to the unaffordable-move rule. If sufficient mana exists, use the full version. Full-strength up B uses its listed cost. One up B use per airtime; it resets only on grounded actionable state or stock respawn, not on ledge regrab. Up B and mobility specials marked helpless prohibit attacks, specials, and double jump until landing or the existing hitstun escape rules. They do not confer ledge invulnerability. Non-mobility specials never refresh jumps or recovery availability.

Offensive specials may be interrupted by being hit normally. No generic B-to-B or B-to-A cancels. Any exception must be stated in the move. Neutral B is usually cheap or free; normals and grabs are always free. Maintain a separate shield resource for this proposal. Do not grant characters separate passive mana or shield economies without a stated kit rule.

### Grabs and throws

The grab line for each fighter gives standing F/A/R and reach. Dash grab uses standing startup +3 frames and recovery +8 frames; active duration and reach are unchanged unless implemented geometry requires movement. A successful grab latches one target at a defined anchor and ends grab hitboxes. Grabs beat shield, but never intangible opponents. Mutual grabs on the same frame break both grabs with symmetric separation and 12 frames of recovery.

Use the existing escape system if one exists. Otherwise use a deterministic 45-frame base hold plus min(30, floor(victim percent / 5)) frames, reduced by validated new input edges at most once every three frames. Each accepted edge removes two hold frames. Throw input starts immediately and locks out pummel. Each kit authors its pummel's look (no launch; no mana gain or healing); its 3 percent damage, hold length, mashing and the pummel's timing and single use are shared (smashcraft:docs/gameplay-design.md, "Grab holds and pummels", #101). Throws list damage, release frame counted from throw entry, thrower recovery after release, launch angle, and knockback class. Every up throw is a JUGGLE and every down throw a CHASE; forward and back throws follow the kit's identity (smashcraft:docs/gameplay-design.md, "Throw roles"). The tables of kits not yet built keep their first-pass rows until the kit is measured. Targets are held until release and then enter normal hitstun. Do not add a second guaranteed hit via throw animation contact.

Use #85's adopted regrab rule: a fighter cannot be grabbed while its remaining hitstun comes from a throw, including remaining hitstun after a gentle landing. This restriction ends with that throw hitstun or a replacing hit, and does not block ordinary attacks. Do not add a fixed post-throw protection timer. Throws cannot be cancelled or redirected after entry. Thrower movement is limited to the scripted anchor motion; no walk-off carrying. In multiplayer, an external hit breaks the hold before release and clears both actors consistently. Resolve same-frame external hits, throw releases, and grabs with stable rules; do not let player-slot iteration decide.

### Projectiles and summons

All speeds are H per simulation frame. Projectiles use swept collision, stable IDs, bounded lifetimes, one hit per target unless otherwise specified, and explicit reflectability. Default ordinary bolts reflect and are destroyed on solid stage geometry or a body/shield hit; no penetration. Shields stop status application. Persistent puddles and zones cannot be reflected and do not hit through solid terrain. No homing unless a move explicitly defines it. Predicted entities live in snapshot state, not divergent native unit simulation.

Per fighter, cap ordinary traveling projectiles at 3 and persistent owned objects at 2 unless the kit states a smaller limit. Summons are at most one active bear, skeleton, or lava spawn for their respective owner. Cosmetic clones cannot collide, grab, body-block, or consume hitboxes. Ultimates receive a separate reserved pool of at most six combat objects per competitor, so activating one cannot silently evict a normal pet or trap. Destroy owned combat entities on stock loss and clear them on round reset. A new cast beyond an entity cap must fail before spending mana, unless that move explicitly recalls or replaces an object.

Summon durability is a separate damage pool. Attacks can hit a fighter and a summon on the same frame if their volumes intersect; the summon never shields the owner by intercepting a melee hit. Summons cannot grab, take stocks, activate items, or trigger native Warcraft orders. Their hits do not refill the owner’s resources. Totems and gadgets are targetable by normal attacks; shields cannot be placed around them.

### Defense and status limits

Armor, when explicitly listed, absorbs hit reaction from one hit up to its listed damage threshold, but damage still applies; grabs ignore armor. A stronger hit breaks it. No passive armor from being heavy. Intangibility is only on the explicitly listed frames and cannot be reused to refresh ledge invulnerability. Never let a defensive transformation clear existing hitstun.

At most one copy of each status per target; reapplication refreshes duration but does not stack strength. Hex and sleep count down in simulation frames, not wall time. Their timers, active source IDs, immunity windows, and any damage counters belong in snapshots. No status disables ordinary jumping, shielding, DI, or recovery unless its exact short effect states otherwise.

### Ultimates

Ultimates are optional and disabled in the default competitive preset until the base kits work. Proposed casual profile: each player’s ultimate becomes ready after 3600 active match frames, then has a 3600-frame cooldown after use. Death does not reset or refresh the timer. Pause and countdown do not advance it. No resource from kills and no refill from damage. Activation is a separate action, normally ground-only, and cannot cancel hitstun. Each kit defines its effect below. Do not let cinematic effects hide opponents or shift their camera.

## Baseline fighter properties

Weight is relative to the current reference fighter at 1.00. Run and air speed are multipliers on the existing reference; hurtbox dimensions are relative width and height. All fighters start with the same two jumps, with jump velocity and gravity inherited from the reference unless later testing explicitly changes them. Air speed does not change jump height. Size must match the visible model; trim collision capsules rather than counting weapons or flames as torso.

| Hero | Weight | Run speed | Air speed | Width | Height |
| --- | --- | --- | --- | --- | --- |
| Blademaster | 1.00 | 1.08 | 1.00 | 1.00 | 1.05 |
| Mountain King | 1.12 | 0.88 | 0.82 | 1.10 | 0.85 |
| Warden | 0.88 | 1.14 | 1.10 | 0.90 | 1.00 |
| Brewmaster | 1.13 | 0.98 | 0.90 | 1.20 | 1.10 |
| Lich | 0.85 | 0.90 | 0.95 | 0.90 | 1.05 |
| Uther | 1.10 | 0.92 | 0.88 | 1.08 | 1.02 |
| Dreadlord | 1.24 | 1.10 | 1.22 | 1.10 | 1.15 |
| Shadow Hunter | 0.94 | 1.04 | 1.00 | 0.92 | 1.08 |
| Pit Lord | 1.28 | 0.80 | 0.70 | 1.65 | 1.35 |
| Tinker | 1.05 | 0.94 | 0.86 | 1.20 | 0.95 |
| Alchemist | 1.20 | 0.86 | 0.80 | 1.35 | 1.25 |
| Naga Sea Witch | 1.02 | 0.94 | 0.76 | 1.20 | 1.05 |
| Beastmaster | 1.10 | 0.97 | 0.88 | 1.15 | 1.10 |
| Dark Ranger | 0.90 | 1.08 | 1.04 | 0.90 | 1.00 |
| Firelord | 0.98 | 0.94 | 0.94 | 1.02 | 1.10 |

The individual hero sections below specify all attacks. Their counterplay descriptions are acceptance goals to test, not claims established by these numbers.

## Blademaster

**Identity:** a disciplined sword fighter who wins by spacing the outer blade and punishing misses. He gets strong reach and ground speed, not unrestricted teleportation or random critical hits; his Critical Strike is a counted passive ([hero passives](passives.md)). His exposed hands and torso remain hittable.

### Normals

| Input and move | F/A/R and landing | Damage | Reach and launch | Behavior |
| --- | --- | --- | --- | --- |
| Jab — Hilt Check | 4/2/13 | 3 | S, 35, POKE | Quick pommel strike; no sword-length disjoint |
| Forward tilt — Measuring Cut | 8/3/19 | 8 inner, 10 outer | L, 35, POKE | Outer final 0.20H of blade rewards spacing |
| Up tilt — Rising Crescent | 7/5/20 | 8 | M, 90, LAUNCH | Arc above and slightly behind; weak directly low in front |
| Down tilt — Ankle Cut | 7/3/17 | 6 | L, 75, LINK | Low thin sweep; a starter rather than a kill move |
| Dash attack — Advancing Slash | 10/4/26 | 10 | L, 45, LAUNCH | Moves 0.55H forward during startup; cannot pass through shield |
| Forward smash — Execution Cut | 17/3/32 | 15 inner, 19 outer | XL, 40, KILL | Large horizontal cut; outer 0.20H is sweetspot |
| Up smash — Sky Splitter | 15/4/30 | 16 | L, 90, KILL | Narrow vertical blade with no broad ground scoop |
| Down smash — Low Circle | 14/6/31 | 14 | L, 25, EDGE | Front frames 14–16, back 17–19; one hit total per target |
| Neutral air — Blade Wheel | 7/9/17; L12 | 3 + 6 | M, 50, POKE | Two turns ([multi-hit](aerials.md)): a wide pull-in link, then a tighter launcher |
| Forward air — Long Cut | 10/3/22; L14 | 11 inner, 14 outer | L, 40, EDGE | Primary spacing aerial; outer 0.20H sweetspot |
| Back air — Reverse Edge | 8/3/23; L13 | 12 | L, 35, KILL | Strong behind, commits facing |
| Up air — High Thrust | 6/3/19; L11 | 8 | M, 85, LAUNCH | Narrow upward poke |
| Down air — Bladestorm | 10/25/12; L20 | 6×2 + 4 landing | M, drill | Longest [drill](aerials.md): hangs, plunges, landing hit pops up; punishable on shield |

### B specials

| Input | Proposed move and behavior | Timing and cost |
| --- | --- | --- |
| Neutral B | **Wind Cutter:** short traveling blade wave. 6 damage, POKE at 35 degrees; speed 0.14H/frame, life 24 frames, radius 0.16H. Reflectable; only one owned wave at a time. | Spawn f18, action ends f40; 0 mana |
| Side B | **Wind Walk** (#124, smashcraft:docs/design/kit-review-1.md): a 7-frame fade, then a 2.2H walk that passes bodies and stops at a raised shield. In f10–31 an attack press is **Backstab**, a slash for 12 damage at 40 degrees, EDGE, toward the held stick (back turns him: the cross-up); a special press steps out; nothing recovers. No invisibility or invulnerability. In air once per airtime, then helpless. | Walk f8–31, end f44; Backstab active f6–8 of its press, end f30; step out ends 8 frames after its press; 18 mana |
| Up B | **Rising Blade:** upward sword leap, 2.0H maximum ascent and 0.5H lateral travel; one hit for 9 damage at 80 degrees, LAUNCH. No intangibility. Mana-free version travels 1.4H with no attack. | Starts f7, hit f7–12, movement through f25, then helpless; 15 mana |
| Down B | **Mirror Image** (#124): after a visible tell, an image stays where he stood (one hit of any kind shatters it; 150 frames) and he steps 1.0H back (down with a side turns him to that side first). Down special while the image stands **swaps**: he takes the image's place facing its way and slashes for 10 damage at 40 degrees, EDGE. The image never attacks; no intangibility. | Image and step f8, end f24, 15 mana; swap f6, slash f8–10, end f30, free |

### Grab and throws

Standing grab 7/2/22, reach 0.55H, one-handed collar catch. Pummel: pommel strike using shared values.

| Throw | Animation and release | Damage | Release and recovery | Launch |
| --- | --- | --- | --- | --- |
| Forward | Shoulder shove with blade hilt | 7 | f12, R18 | 35, EDGE |
| Back | Pivot and kick behind | 8 | f15, R22 | 40, EDGE |
| Up | Hilt lifts target overhead | 6 | f13, R10 | 85, JUGGLE |
| Down | Knee check and low toss | 5 | f16, R20 | 65, CHASE |

**Ultimate — Bladestorm:** f24 startup, 120-frame active spin on f24–143 with ground speed capped at half normal run speed, reach L, six possible 3-damage LINK hits at 70 degrees per target at least 18 frames apart, then a single 10-damage KILL finisher at 45 degrees on f144–146; R40. No invulnerability or armor, no grab, and no ledge travel off solid ground. One activation ID tracks all hit limits. Avoid literal uninterruptible Warcraft Bladestorm.

**Required counterplay test:** forward smash whiff must give a fast fighter at its outer edge a plausible approach punish; Mirror Image cannot reset its own recovery or create a true 50/50 without prior advantage.

**As implemented** (smashcraft:ts/src/game/sim/heroes/blademasterMoves.ts, blademasterSpecials.ts, blademasterClips.ts). Every row above is authored; these are the departures:

- Forward tilt also has up- and down-angled forms with the row's timing and damage; only the blade path changes.
- Down air's tip spikes airborne targets only; it sends grounded targets at 55 degrees, as the shared notation directs.
- Dash grab uses the shared rule (startup +3, recovery +8) on the standing grab's volumes.
- Wind Cutter, Mirror Image and Wind Walk keep their grounded timing in the air; Wind Cutter and Mirror Image end on landing with 20 frames of lag, and the airborne Wind Walk is once per airtime and ends helpless, Backstab and step out included.
- Rising Blade climbs evenly over f7-24 and stops at its peak on f25 (2.0H up, 0.5H forward), so the helpless fall starts from rest; its free form climbs 1.4H and drifts 0.35H (the row's distance ratio) with no hit.
- Wind Walk's walk stops before a raised shield but passes bodies (`stopsAtShield`); Backstab and step out are its attack and special branches (`followUps`). Mirror Image's image is a placed object drawn as his see-through model; the swap is its recall form (`relocate`).
- Presentation uses the stock Blademaster model. It has fourteen sequences and no hit, jump, roll or ledge animations: thrusts play Attack 2, cuts Attack, rising strikes Stand - 4, and spinning moves, rolls and the double jump the Bladestorm spin; hit reactions play the start of Death. Attack Slam is unused because its leap moves the body about 130 units away from the hurtbox.
- Bladestorm is not implemented; ultimates stay off in competitive play.

## Mountain King

**Identity:** a compact heavy whose hammer, axe, and deliberate stun setups reward close reads. He has strong burst force and a projectile, but poor chase and limited air drift. No random Bash.

### Normals

| Input and move | F/A/R and landing | Damage | Reach and launch | Behavior |
| --- | --- | --- | --- | --- |
| Jab — Hammer Butt | 5/2/15 | 4 | S, 35, POKE | Short body check with hammer hilt |
| Forward tilt — Axe Hook | 9/3/21 | 10 | M, 35, EDGE | Wide frontal chop with exposed hand |
| Up tilt — Hammer Lift | 8/4/22 | 9 | M, 90, LAUNCH | Head-level scoop, limited rear reach |
| Down tilt — Boot and Axe | 7/3/18 | 7 | S, 70, LINK | Low kick; no trip RNG |
| Dash attack — Dwarf Charge | 11/5/28 | 12 | M, 40, LAUNCH | Body hitbox; completely tradeable |
| Forward smash — Mountain Breaker | 20/3/36 | 21 | L, 40, KILL | Heavy overhead hammer; head is sweetspot, handle 16 damage |
| Up smash — Twin Lift | 17/5/32 | 17 | M, 85, KILL | Axe and hammer form one hit above |
| Down smash — Stone Sweep | 16/6/34 | 16 | M, 25, EDGE | Front then back, one hit per target |
| Neutral air — Barrel Turn | 8/6/22; L15 | 10 | M, 50, POKE | Body rotation, no disjoint |
| Forward air — Hammer Drop | 16/3/30; L21 | 16 | M, 270, SPIKE | Hammer head spikes; handle launches 45 degrees for 11 |
| Back air — Backhand Axe | 10/3/25; L15 | 13 | M, 35, KILL | Strong short rear swing |
| Up air — Headbutt | 7/4/22; L13 | 10 | S, 85, LAUNCH | Body hurtbox stays exposed |
| Down air — Double Boot | 12/5/29; L20 | 13 | S, 270, SPIKE | No automatic stall or bounce |

### B specials

| Input | Proposed move and behavior | Timing and cost |
| --- | --- | --- |
| Neutral B | **Storm Bolt** (#125, smashcraft:docs/design/kit-review-1.md): thrown hammer; 5 damage, LAUNCH at 65 degrees, speed 0.12H/frame for 45 frames, then back to his body at 0.14H/frame (life 90), launching toward him on the way back. Neutral special while it flies calls it back at once. Reflectable (a reflected hammer flies on and never returns); one bolt active. | Spawn f20, end f58; 8 mana; recall 10 frames, free |
| Side B | **Storm Rush:** shoulder dash 1.2H; 12 damage, EDGE at 35 degrees. No armor, no command grab, stops at shield. Air version has no upward lift and ends helpless. | f13–18 active/moving, R28; 18 mana |
| Up B | **Thunder Leap:** arcing 1.8H rise and up to 0.7H horizontal travel; hammer attack during ascent for 8 damage, LAUNCH at 80 degrees. Free version reaches 1.3H, no attack. **Hammerfall** (#125): special in f16–28 of the full leap hangs 3 frames, then plunges straight down at 0.16H/frame: 12 damage SPIKE against airborne targets, 10 at 55 degrees against grounded ones; landing lag 24, helpless if it ends airborne. | Rise/hit f9–14, movement through f28, then helpless; 15 mana; Hammerfall free |
| Down B | **Thunder Clap, charged** (#125): he raises the hammer f1–9 and holds the charge f10–49. Special in f10–29: Clap, ground ring of 0.85H both sides, 9 damage LAUNCH 70 degrees; special in f30–49 or running out (slam f53): Thunder Clap, the ring at 12 plus a reflectable ground wave each way (0.10H/frame, 24 frames, active from its 6th, 7 damage LAUNCH 75 degrees); shield in f10–49 drops the charge. No armor. Air version swings hammer underneath with 0.55H reach, no charge, no shockwave. | Slam active f4–7 after the release, end 28 (Clap) or 32 (Thunder Clap) frames after it; run-out ends f81; 20 mana |

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

**Implemented kit** (smashcraft:ts/src/game/sim/heroes/mountainKingMoves.ts, mountainKingSpecials.ts, presentation/heroes/mountainKingClips.ts). Every row above is implemented; nothing is omitted. Deliberate additions and choices where the table is silent:

- Forward tilt also has up- and down-angled paths with the same timing and damage.
- Hammer Drop's head and Double Boot launch grounded targets at 55 degrees (the shared grounded spike rule).
- Air Thunder Clap reuses 10 damage and 70-degree LAUNCH on its 0.55H under-hammer path.
- Thunder Clap is a ground-level ring 30 units tall, so a jump clears it while it still covers both sides; its release and shield cancel are follow-up branches (`followUps`), and the waves start just past the ring.
- Thunder Leap puts half its exact rise into the f9-14 hit window and eases over f15-28 so it peaks at the listed height; the free form peaks at 1.3H with 0.5H drift.
- Storm Rush stops at a raised shield or a body (shared `stopsAtBody`) and stops dead after its 1.2H dash; its lowered shoulder carries a hurt volume while it strikes.
- Mountain King's hurt volumes add the arm, leg or boots behind each normal from late startup through early recovery; hammer and axe stay outside them.
- The stock model has thirteen usable sequences and no jump, hit, dodge, ledge or grab clips: hits play the opening of Death, jumps and techs the opening of Stand - 3, ledge and grab holds a held Stand Ready.

**Balance** (#105, all-pairs computer field, 3 stocks): Storm Bolt 7 → 5 damage, so it covers his slow approach instead of winning neutral from range: field win rate 71% (b2ed6109, 100/pair) → 66% (20/pair), self-destructs 1%.

**Gameplan** (smashcraft:ts/src/game/sim/heroes/mountainKingGameplan.ts, #105): he keeps 0.6-1.0H, at Axe Hook's tip, spacing with Axe Hook and Boot and Axe and covering his slow approach with Storm Bolt from 1.5H out; he shoots or runs in with grab, Boot and Axe and Dwarf Charge, never jumps in, and meets an attack with his shield or a spot dodge. Boot and Axe, Hammer Lift and the down throw start his strings; Mountain Breaker, Twin Lift, Backhand Axe and the back throw finish. His limited air drift is the weakness he plays around: he fights on the ground and keeps his spot 160 units inside the edge, so a launch leaves the shortest way back, and returns to the ledge with his jump before Thunder Leap.

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
| Down smash — Twin Crescent | 12/5/28 | 12 | M, 25, EDGE | Front then rear arcs |
| Neutral air — Cloak Spin | 5/5/18; L10 | 6 | M, 50, POKE | Short circular blade sweep |
| Forward air — Pursuer | 8/3/20; L12 | 10 | M, 40, EDGE | Fast approach aerial with limited reach |
| Back air — Heel Blade | 7/3/22; L12 | 11 | M, 35, KILL | Exposed leg before weapon tip |
| Up air — Sky Crescent | 5/9/15; L10 | 2 + 2 + 5 | M, 85, LAUNCH | Three rising kicks ([multi-hit](aerials.md)); the last launches |
| Down air — Falling Knives | 7/7/14; L10 | 2×3 + 3 | M, drill | Fan of Knives in miniature: a short fast [drill](aerials.md) that drags down; no landing hit; safe, sets up a grab or her Fan of Knives mark |

### B specials

| Input | Proposed move and behavior | Timing and cost |
| --- | --- | --- |
| Neutral B | **Shadow Strike:** one slow thrown blade; 5 impact damage, POKE at 35 degrees, plus 3 damage over 180 frames in three 1-damage ticks; the poison is the **mark** for Shadow Pursuit (#126, smashcraft:docs/design/kit-review-1.md). Speed 0.11H/frame, life 30, radius 0.13H. Reflectable; poison never flinches and does not stack. | Spawn f16, end f37; 5 mana |
| Side B | **Pursuit Lunge:** 1.0H dash slash, 10 damage, EDGE at 35 degrees. Against a marked opponent within 2.5H it is **Shadow Pursuit** (#126): a 14-frame tell, then on f15 she appears just behind the target facing it, spending the mark, and slashes f18–20 for 10, EDGE at 35 degrees; ends f40; no intangibility. Hold up/down on entry for a shallow +20/−20 degree air trajectory; no late steering. Air use once per airtime and ends helpless. No invulnerability. | f11–14 active, R26; 15 mana |
| Up B | **Blink:** choose one of eight directions from held input at entry, travel up to 1.7H; f1–7 vulnerable, f8–10 intangible, endpoint vulnerable from f11. No hitbox. Sweep against terrain and stop at the last legal position, never cross solid stage. Free version is upward-only 1.1H, no intangibility. | Displacement f9; f11–30 endpoint recovery then helpless; 20 mana |
| Down B | **Fan of Knives:** a single radial attack reaching 0.85H around Warden for 7 damage, POKE at 45 degrees outward; every body it hits is marked as Shadow Strike marks (#126). Knives are short-lived hit volumes attached to this move, not eight independent full-range projectiles. No invulnerability, reflect, or cancel. | f9–11 active, R27; 18 mana |

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

**As implemented** (smashcraft:ts/src/game/sim/heroes/wardenMoves.ts, wardenSpecials.ts, wardenHero.ts; clips in smashcraft:ts/src/game/presentation/heroes/wardenClips.ts). Every row above is authored; these are the departures:

- Forward tilt also has up- and down-angled forms with the row's timing and damage; only the blade path changes.
- Warden's arm reaches each blade's hand from two frames before the strike to four after, in held poses; only the blades are disjoint. Heel Blade's leg is exposed on frames 5-13.
- Pursuit Cut and Pursuit Lunge stop dead after their travel instead of sliding on. Pursuit Lunge's 20-degree air tilt reads the stick held through frame 4.
- Blink reads its eight directions from the stick held through frame 8, because an up special is always entered holding up. A grounded endpoint keeps the full recovery to frame 30, and a displacement into the stage stops at its body or lands on the deck.
- Shadow Pursuit is the side kit's `marked` form, chosen while a poisoned opponent is within 2.5H; its move to the target's back is a `relocate` motion that also spends the poison. Fan of Knives applies the poison through `strikeStatus`.
- Shadow Strike's poison is its own status slot beside sleep-like conditions: it never replaces or blocks one, ignores immunity groups and refreshes rather than stacks.
- Presentation uses the stock Warden model. It has twelve sequences and no hit, jump, roll or ledge animations: blade swings play Attack - 1 and Attack - 2, overhead strikes Spell Slam, rising strikes and Fan of Knives Spell, Shadow Strike Spell Throw, and Blink, spot dodge and air dodge Dissipate. Knockdowns and tumbles play Death.
- Spirit of Vengeance is not implemented; ultimates stay off in competitive play.

**Gameplan** (smashcraft:ts/src/game/sim/heroes/wardenGameplan.ts, #105): she keeps 0.7-1.4H, just past her blades, and spaces with Crescent Slice, Pursuer and Pursuit Lunge; she runs in with dash attack, lunge and grab or jumps in with aerials, and never camps at long range. Up tilt, down tilt, up air and the up and down throws start her strings; Heel Blade, Judgment Edge, Moon Arc and the low outward Pursuer and Twin Crescent finish. She spends her jump before Blink, so its punishable endpoint is her last resort, and stays out from under a target.

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
| Neutral B | **Frost Nova** (#130, [kit review 2](kit-review-2.md#lich-130)): a slow orb, speed 0.07H/frame, life 80, radius 0.16H; 8 damage, POKE at 35 degrees and Chill on a body. Neutral B again while it flies stops it on the gesture's frame 4; 6 frames later it bursts for 3 frames: radius 0.7H, 10 damage, LAUNCH at 70 degrees, Chill. One orb, reflectable until burst. **Chill:** 75 frames at 60% walk, dash, run and air-drift top speed; a shield stops it; 120 frames of immunity. | Orb f18, end f37; 10 mana. Burst gesture end f14, free |
| Side B | **Death and Decay** (#130): a field placed 1.5H ahead, or 0.9H if pressed backward, only with line of sight; radius 0.75H. It strikes the first body or shield in it from f30 (5 damage, POKE at 80 degrees) and again from f70 (9 damage, LAUNCH at 70 degrees), and is gone after f97. Interrupting Lich before f30 removes it. | Field f8, end f50; 25 mana |
| Up B | **Spectral Ascent:** visible upward glide, 2.1H height and up to 0.4H lateral drift, no hitbox or intangibility. Free version 1.4H. | Movement f10–34, helpless afterward; 15 mana |
| Down B | **Frost Armor** (#130): f22 cast grants a 240-frame shell that absorbs the hit reaction of one hit of at most 8 damage and chills the melee striker. Damage still applies; grabs bypass it. **Dark Ritual:** down B while the shell holds shatters it on f6 into a 0.6H burst around Lich (5 damage, POKE at 60 degrees) and restores 30 mana. | Cast f22, end f45; 20 mana. Ritual end f24, free |

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

Source: smashcraft:ts/src/game/sim/heroes/lichHero.ts, lichMoves.ts and
lichSpecials.ts. Every normal, grab, pummel, throw and special above is
implemented; the ultimate is not (there is no ultimate action). Changes from
the tables:

- **Death and Decay** "pressed backward" is a side special pressed toward
  Lich's back: Lich keeps facing and places the field 0.9H ahead instead of
  turning. A field whose line from Lich crosses solid stage geometry is not
  placed (the cast and its cost still happen). Its two strikes are two
  stationary zones, so with Frost Nova's orb Lich owns three projectiles.
- **Frost Nova's burst** press is accepted once the 40-frame cast has ended,
  so the nearest burst is about 1.9H ahead.
- **Spectral Ascent** steers with the live stick at up to 0.4H/25 per frame
  over its window, in place of air drift; with a neutral stick it rises
  straight up.
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

**Gameplan** (smashcraft:ts/src/game/sim/heroes/lichGameplan.ts, #105): he keeps 1.5-2.4H, where Death and Decay lands on the target and Frost Nova still flies, and never runs in: he advances behind his shots and covers a run-in with Ice Spear. A threat close by he mostly answers by backing out to range. Death and Decay, down tilt, up tilt and the down throw start his strings; Ice Spear, Bone Spike and a late Death and Decay finish. He jumps before Spectral Ascent, aims for the ledge, and stays off the edge, out of close range and out from under a target.

## Uther

**Identity:** a defensive paladin with a substantial hammer, deliberate protection, and limited healing. He wins by holding space and reading approaches, not by infinitely stalling with invulnerability. Divine Shield must be a short defensive action in a fighter.

### Normals

| Input and move | F/A/R and landing | Damage | Reach and launch | Behavior |
| --- | --- | --- | --- | --- |
| Jab — Gauntlet Check | 5/2/15 | 4 | S, 35, POKE | Short front punch |
| Forward tilt — Hammer Sweep | 10/3/23 | 11 | L, 35, EDGE | Good spacing, exposed recovery |
| Up tilt — Guiding Light | 9/4/22 | 9 | M, 85, LAUNCH | Hammer rises above head |
| Down tilt — Low Judgment | 8/3/20 | 7 | M, 70, LINK | Low hammer handle sweep |
| Dash attack — Shoulder of Justice | 12/5/29 | 12 | M, 45, LAUNCH | Body charge, no armor |
| Forward smash — Final Judgment | 21/3/36 | 20 | L, 40, KILL | Overhead hammer, head 20 and handle 15 damage |
| Up smash — Beacon Strike | 18/4/33 | 17 | L, 90, KILL | Tall narrow swing |
| Down smash — Consecrated Sweep | 17/6/34 | 15 | M, 25, EDGE | Front then back hammer arc |
| Neutral air — Hammer Guard | 8/5/23; L15 | 9 | M, 50, POKE | One surrounding swing, no block property |
| Forward air — Holy Hammer | 13/4/28; L18 | 14 | L, 40, KILL | Slow spacing aerial |
| Back air — Rearward Boot | 9/3/24; L14 | 11 | M, 35, EDGE | Exposed leg |
| Up air — Radiant Lift | 8/4/23; L14 | 9 | M, 85, LAUNCH | Hammer-head hit above |
| Down air — Falling Judgment | 15/4/31; L22 | 13 | M, 270, SPIKE | Narrow downward hammer, no forced dive |

### B specials

| Input | Proposed move and behavior | Timing and cost |
| --- | --- | --- |
| Neutral B | **Holy Light** (#131, [kit review 2](kit-review-2.md#uther-131)): aimed straight or 30 degrees up by holding up on entry; speed 0.11H/frame out for 26 frames, then back toward Uther's chest at the same speed; life 80, radius 0.17H, one active. Outbound 5 damage, POKE at 40 degrees; returning 5 damage, POKE toward Uther. Reaching Uther untouched restores 3 percent, at most 9 a stock. A reflected orb flies straight. | Spawn f20, end f56; 10 mana |
| Side B | **Crusader Rush:** advance 0.9H with a hammer check, 11 damage at 45 degrees, LAUNCH. Armor against one hit of at most 5 damage only on f12–15; grabs ignore it. Air version has no armor, no rise, and ends helpless. | Active/movement f12–17, R30; 20 mana |
| Up B | **Ascension:** rising hammer leap, 1.9H rise and 0.45H horizontal drift; one 8-damage hit, LAUNCH at 80 degrees. Free version 1.3H without hitbox. | Hit f10–15, travel through f29, then helpless; 15 mana |
| Down B | **Divine Shield** (#131): ground-only timed stance, intangible f6–9, vulnerable otherwise, no automatic counter. A damaging melee or projectile hit overlapping it on those frames raises Divine Shield: 45 frames in which strikes and projectiles pass through Uther; starting an attack, special or grab ends it. Grabs beat both the guard and the shield. No healing. | End f36; 25 mana. Air version fails without spending |

### Grab and throws

Standing grab 8/2/25, reach 0.55H. Pummel: hammer-hilt tap.

| Throw | Animation and release | Damage | Release and recovery | Launch |
| --- | --- | --- | --- | --- |
| Forward | Palm of judgment | 8 | f14, R23 | 40, EDGE |
| Back | Shoulder turn and toss | 9 | f18, R26 | 40, EDGE |
| Up | Lift with a shaft of light | 7 | f16, R9 | 90, JUGGLE |
| Down | Kneeling hammer slam beside target | 6 | f20, R26 | 70, CHASE |

**Ultimate — Guardian of the Light:** f30 vulnerable activation, R15, then 360 frames of +10 percent damage and three visible protective charges. A charge absorbs one hit reaction up to 6 damage while still taking damage; at most one charge consumed per 30 frames. Grabs and larger hits bypass the protection. No resurrection, extra stocks, unlimited heal, or prolonged invulnerability.

**Required counterplay test:** Uther can be grabbed or baited during Divine Shield and punished afterward. Optimal healing cannot outpace plausible damage indefinitely because the stock cap is absolute.

### Uther as built

Source: smashcraft:ts/src/game/sim/heroes/utherMoves.ts (normals, grabs,
throws, body), utherSpecials.ts and utherClips.ts. Every row above is
implemented with its listed timing, damage, angle and reach; launch classes
use provisional coefficients. Deliberate differences:

- Unarmed strikes are limbs, not disjoints: the jab's gauntlet and the grab's
  hand reach 0.55H and Rearward Boot reaches 0.8H behind, each with a matching
  hurt part from late startup through early recovery. Shoulder of Justice
  strikes with the torso and reaches 0.8H by travelling during startup.
- Grab contact sits at hand height (about 24-56 above the feet), not at the
  shins.
- Crusader Rush in the air holds its height during the rush (no rise, no
  fall) and lands with 20 frames of lag; Holy Light cast in the air does too.
- Ascension travels on f8-28 and stops on f29, so its helpless fall starts
  at the 1.9H (free form 1.3H) apex; both forms drift 0.45H.
- Divine Shield's success is the special's `guard` window: an opponent's
  damaging strike or projectile overlapping Uther on f6-9 raises the shield
  (`status.divineFrames`, sim/transitions.ts `endDivineShield`). The
  strike that triggered it passes through him. Holy Light's heal and the cap
  share `status.guardHealed`.

Presentation uses the stock classic Paladin model, which has thirteen
sequences and no punch, kick, jump, roll, ledge or grab clip. Hammer Sweep's
path follows "Attack - 1" and Final Judgment's follows "Attack - 2"; the jab,
grab, pummel and side special reuse "Attack - 1", so the drawn hammer swings
while the gauntlet strikes. Down smash's back half and Rearward Boot have no
matching clip ("Attack - 2" and "Stand Hit" play). utherClips.ts lists the
sequence table and every pose's clip.

**Gameplan** (smashcraft:ts/src/game/sim/heroes/utherGameplan.ts, #105): he holds 0.9-1.3H, at Hammer Sweep's tip, spacing with Hammer Sweep and Low Judgment and making the target come to him with Holy Light from 1.7H out; he shoots, or walks in only for Hammer Sweep or a grab. He answers an attack with Divine Shield as often as with his shield and spot dodge together. Low Judgment, Guiding Light and the up throw start his strings; Final Judgment, Holy Hammer and Beacon Strike finish. His weak chase is the weakness he plays around: he never follows a target overhead, keeps off the edge and returns to the ledge with his jump before Ascension.

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
| Neutral air — Batwing Turn | 7/10/19; L9 | 3 + 3 + 7 | M, 50, POKE | Three wing beats ([multi-hit](aerials.md)); wide, tradeable |
| Forward air — Talon Reach | 10/4/24; L10 | 14 | L, 40, EDGE | Forward reach at cost of exposing arm |
| Back air — Wing Backhand | 9/4/25; L10 | 15 | L, 35, KILL | Wing hurtbox extends too |
| Up air — Horn Lift | 7/3/21; L12 | 8 | M, 85, LAUNCH | Short upward head attack |
| Down air — Talon Drop | 14/4/29; L20 | 12 | M, 270, SPIKE | Downward claw strike, no stall |

### B specials

| Input | Proposed move and behavior | Timing and cost |
| --- | --- | --- |
| Neutral B | **Carrion Swarm:** a short bat cloud moving at 0.09H/frame for 32 frames, radius 0.25H. One hit for 7 damage, POKE at 40 degrees. Reflectable as one projectile, one cloud active. | Spawn f20, end f45; 5 mana |
| Side B | **Vampiric Pounce** (#132, [kit review 2](kit-review-2.md#dreadlord-132)): grounded command grab with 0.8H approach; grab reach 0.45H. On catch, automatic bite-and-release at catch+16 frames, 13 damage, EDGE at 40 degrees, then 28 recovery. No heal, no carrying, shared regrab protection applies. Air version is a claw attack for 13 damage, not a grab, and ends helpless. | Catch/strike f17–19; whiff R34; 20 mana | The bite heals Dreadlord 4 percent, at most 12 a stock. **Feint:** side B again on approach frames 3–12 cancels into a free backward bat-hop, 0.7H over its frames 1–10, ending f18. |
| Up B | **Bat Ascension:** steerable rising curve up to 2.0H high and 0.8H across, no hitbox. Visible bat-body hurtbox throughout; no intangibility. Free version 1.4H height and 0.3H across. | Movement f9–32, then helpless; 15 mana |
| Down B | **Sleep** (#132): visibly slow projectile, speed 0.06H/frame, life 50, radius 0.18H, one active and reflectable. Body hit deals 2 damage and 100 frames of sleep (24 if the target is airborne); the sleeper keeps velocity/gravity, cannot act, mashes out with the grab and freeze rule (8 frames a press or new stick direction, never before frame 24) and wakes on the next damaging hit. Then 240-frame sleep immunity. Shield blocks it. No bonus damage on waking. | Spawn f26, end f58; 25 mana |

### Grab and throws

Standing grab 7/3/26, reach 0.65H. Pummel: claw squeeze. No automatic lifesteal.

| Throw | Animation and release | Damage | Release and recovery | Launch |
| --- | --- | --- | --- | --- |
| Forward | Wing-assisted shove | 10 | f12, R20 | 35, EDGE |
| Back | Spin and fling | 12 | f18, R25 | 40, KILL |
| Up | Toss into bat cloud | 9 | f15, R11 | 85, JUGGLE |
| Down | Claw pin then kick free | 8 | f19, R25 | 65, CHASE |

**Ultimate — Infernal:** f30 cast places a clearly visible marker 1.2H ahead. An infernal lands at f60 for 14 damage, LAUNCH at 75 degrees, radius 0.8H, then stays as a stationary hazard for 180 frames. It performs exactly two telegraphed swipes at spawn+60 and spawn+120, each 10 damage, EDGE at 40 degrees, reach 0.8H, with 20 durability. No autonomous chasing, invulnerable summon, or instant full-stage hit. Dreadlord’s casting action ends f75.

**Required counterplay test:** Sleep from neutral must be jumpable or shieldable and cannot reset its own sleep chain. Vampiric Pounce should lose to a preemptive attack and to a correctly spaced retreat.

**As implemented (smashcraft:ts/src/game/sim/heroes/dreadlordMoves.ts, dreadlordSpecials.ts):** every row above is present; the departures are these.

- Nothing Dreadlord swings is disjointed: each claw, wing, horn and elbow path is also his body, fully out from a frame before its first active frame to two after its last, drawn out and folded back through held 3-frame poses. His standing body adds folded wings behind the shoulders to the roster capsule.
- Vampiric Pounce's grounded approach stops at a body or shield and holds his height while it runs. The air version has no approach travel; it is the claw strike alone, once per airtime, ending helpless.
- Bat Ascension steers with the live stick (`driftSpeed`): a full side held through the rise gives 0.8H (free form 0.3H), a neutral stick rises straight. His spread wings are part of his body throughout; it has no intangibility.
- Sleep's 2-damage hit stops his target's momentum like any hit; the sleep that follows leaves velocity and gravity alone and discards the sleeper's inputs.
- Presentation uses the classic HeroDreadLord model's eleven usable sequences: claws on Attack - 1/2, wings and horns on Spell and Stand - 3, the low sweep and down air on Spell Slam, jumps and Bat Ascension on the Stand - 2 wing spread. Dissipate draws no body and is not used.

## Shadow Hunter

**Identity:** Rokhan-inspired trap and angle specialist with a glaive, a destructible serpent ward, and brief hex pressure. His zoning is built from placed objects rather than another Archer moveset. He retains functional normals when his setup is gone.

### Normals

| Input and move | F/A/R and landing | Damage | Reach and launch | Behavior |
| --- | --- | --- | --- | --- |
| Jab — Glaive Handle | 5/2/14 | 3 | S, 35, POKE | Quick close check |
| Forward tilt — Crescent Chop | 9/3/21 | 9 | L, 35, POKE | Long glaive front cut |
| Up tilt — Totem Lift | 8/4/21 | 8 | M, 85, LAUNCH | Weapon shaft above |
| Down tilt — Low Crescent | 7/3/19 | 6 | M, 70, LINK | Low safe-distance poke, modest stun |
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
| Down B | **Hex** (#133): short visible orb, speed 0.07H/frame, life 26, radius 0.18H. 2 damage, POKE at 40 degrees. For 50 frames the target cannot attack, grab or start neutral, side or down specials, but keeps movement, jump, shield, dodges, DI and up special (recovery). It mashes out with the grab and freeze rule, never before frame 36 (20 before #105 pass 4: a point-blank Hex ran out during his own cast). No hurtbox change. 240-frame hex immunity after it ends. Reflectable; one active. | Spawn f24, end f40 (f53 before #105 pass 4); 25 mana |

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

**Implemented kit notes.** Source: smashcraft:ts/src/game/sim/heroes/shadowHunterMoves.ts (normals, grab, throws), shadowHunterSpecials.ts (specials, ward and Hex values) and shadowHunterHero.ts (registration and clip map). The model is the classic `units\orc\HeroShadowHunter\HeroShadowHunter.mdl` at scale 1.0 (Stand Ready is 138 units tall against 1.08H). It has fourteen sequences and one attack clip, so moves share clips by motion: glaive cuts play Attack, overhead moves Spell, the low lunge and the overhand release Spell Throw, Twin Totems and Serpent Ward the hopping Stand Channel, jumps and Loa Vault the leap in Stand Victory, knockdown Death, and a KO the rising spirit of Dissipate. The model has no kick, so Heel Hook plays the rear arm-and-glaive sweep of Stand -2; its hit volume keeps the listed M reach and the swinging arm carries an exposed hurt volume, preserving the move's no-disjoint trade-off. No move is omitted.

## Pit Lord

**Identity:** the largest heavy, with a huge cleaver and wide body attacks. Long reach is offset by startup, recovery, and a large target. His size must not require native pathing changes or give him passive armor.

### Normals

| Input and move | F/A/R and landing | Damage | Reach and launch | Behavior |
| --- | --- | --- | --- | --- |
| Jab — Haft Check | 7/3/19 | 6 | M, 35, POKE | Slow close-range jab |
| Forward tilt — Cleaving Sweep | 13/4/35 | 12 | XL, 35, EDGE | Main space claim; blade disjoint only |
| Up tilt — Horn and Cleaver | 12/5/27 | 12 | L, 85, LAUNCH | Broad overhead arc with weak low front |
| Down tilt — Front Hoof | 10/3/24 | 9 | M, 65, LINK | Exposed hoof attack |
| Dash attack — Demonic Bulk | 15/6/34 | 16 | L, 40, EDGE | Body charge, no armor |
| Forward smash — Annihilating Cleave | 27/4/43 | 25 head, 19 inner | XL, 40, KILL | Longest commitment, cleaver tip sweetspot |
| Up smash — Abyssal Lift | 24/5/39 | 22 | XL, 85, KILL | Tall slow anti-air |
| Down smash — Rear and Front Stomp | 22/7/41 | 19 | L, 25, EDGE | Front f22–24, rear f26–28; one hit total |
| Neutral air — Hellish Turn | 12/7/29; L20 | 13 | L, 50, POKE | Body rotation with huge vulnerable torso |
| Forward air — Falling Cleaver | 19/4/36; L25 | 19 | XL, 40, KILL | Large slow arc, no meteor |
| Back air — Tail Lash | 14/4/31; L20 | 15 | L, 35, EDGE | Tail hurtbox extends with attack |
| Up air — Horn Thrust | 11/4/28; L18 | 12 | M, 85, LAUNCH | Narrow overhead body attack |
| Down air — Four Hooves | 20/5/38; L28 | 18 | L, 270, SPIKE | No landing shockwave or bounce |

### B specials

| Input | Proposed move and behavior | Timing and cost |
| --- | --- | --- |
| Neutral B | **Fel Spit:** heavy arcing projectile, 8 damage, POKE at 40 degrees, velocity (0.10H, 0.04H)/frame, gravity 0.003H/frame squared, life 35, radius 0.22H. One active and reflectable. | Spawn f25, end f57; 5 mana |
| Side B | **Ruin Charge:** 1.5H grounded charge, 15 damage, EDGE at 35 degrees. One-hit armor up to 6 damage on f19–24; no armor on startup or recovery. Stops at shield. Air version travels 0.8H horizontally, no armor, helpless afterward. | Active/movement f19–26, R38; 22 mana |
| Up B | **Abyssal Leap:** slow arcing leap, 1.7H rise and 0.7H horizontal reach, hoof hit for 10 damage at 80 degrees, LAUNCH. Free version 1.2H and 0.4H, no hit. | Hit f13–18, movement through f32, then helpless; 15 mana |
| Down B | **Howl of Terror:** roar radius 1.0H, 5 damage, POKE at 45 degrees, body-hit targets deal 10 percent less damage for 180 frames. No knockback/hitstun modifier, silence, or shield application. Air use has identical commitment and no stall. | f23–26 active, R34; 20 mana |

### Grab and throws

Standing grab 11/3/31, reach 0.80H. Pummel: horn jab, shared 3 damage despite huge size.

| Throw | Animation and release | Damage | Release and recovery | Launch |
| --- | --- | --- | --- | --- |
| Forward | Cleaver-haft heave | 11 | f17, R27 | 35, EDGE |
| Back | Tail-assisted fling | 12 | f22, R32 | 40, KILL |
| Up | Toss from the horns | 10 | f20, R29 | 85, KILL |
| Down | Hoof pin and release | 8 | f23, R31 | 65, LINK |

**Ultimate — Doom:** f32 startup, a visible straight curse projectile with speed 0.08H/frame, life 35, radius 0.25H. On body hit, 10 impact damage with LAUNCH at 60 degrees, then 10 more damage over 240 frames, no flinch and no ability lock. No instant kill or Doom Guard. It is shieldable and reflectable. Action ends f75; missing still spends the cooldown.

**Required counterplay test:** fast characters can get inside a missed cleave and punish it. Pit Lord must have a usable close escape, but cannot turn jab into a fast long-range wall. Check that size does not make standard platforms impossible to traverse.

### Pit Lord as built

Source: smashcraft:ts/src/game/sim/heroes/pitLordMoves.ts (normals, grabs,
throws, body), pitLordSpecials.ts and pitLordHero.ts (#121). Every row
above is implemented with its listed timing, damage, angle and reach. Launch
classes use provisional coefficients. Deliberate differences:

- The up throw is a JUGGLE and the down throw a CHASE (#107), released on
  f20 and f23. Their totals are 30 and 50 frames.
- The standing grab is 10/3/32, one frame earlier than 11/3/31 with the
  same total, so it still catches a jump out of shield in the early-ascent
  window (#107).
- Down air's hooves reach about 60 below his feet, so the attached hoof
  volume stays inside the legible-hurtbox limit. Tail Lash's tail is body to
  its full length, a named rule-6 departure (smashcraft:docs/gameplay-design.md).
- His shield is the reference shield scaled by his 1.35 height (centre and
  radius). The reference shield would leave his 1.65-wide body outside it, and
  an arcing Fel Spit then struck him through it.
- Fel Spit leaves at 0.45H and falls 0.003H a frame faster each frame
  (`gravity` on the projectile). Its arc stays within a raised shield's reach
  at 240 and 480 units, so a powershield reflects it.
- Howl of Terror applies Terror (`HeroStatusKind.terror`, its own immunity
  group, no immunity window): for 180 frames every hit the target deals does
  0.9 of its damage, including its knockback and hitlag. Nothing else
  changes. A shield stops it.
- Ruin Charge's armor lapses during his own hitlag, like every special's
  armor window, so the charge's contact frame does not extend it.

Presentation uses the stock classic HeroPitLord model, scale 0.95. It has
seventeen sequences and no hit, ready or jump clip, so flinches play
"Stand - 2". The cleaver normals map to "Attack" (thrust), the "Attack Slam"
pair (overhead) and "attack - 2" (both-sides sweep). pitLordHero.ts lists
every pose's clip.

**Gameplan** (smashcraft:ts/src/game/sim/heroes/pitLordGameplan.ts, #105):
he holds 120-190 units at Cleaving Sweep's tip. He makes the target act with
Fel Spit from range and runs in behind Ruin Charge's armor. Down tilt and the
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
| Forward tilt — Piston Arm | 10/3/24 | 10 | L, 35, POKE | Disjointed metal tip; extension visibly retracts |
| Up tilt — Gear Lift | 9/4/23 | 8 | M, 85, LAUNCH | Mechanical arm above head |
| Down tilt — Low Spanner | 7/3/20 | 6 | M, 65, LINK | Thin ground poke |
| Dash attack — Wheel Ram | 11/5/28 | 11 | M, 45, LAUNCH | Body collision, not armored |
| Forward smash — Hydraulic Punch | 21/3/37 | 20 | XL, 35, KILL | Slow long piston; handle 14 damage |
| Up smash — Spring Hammer | 18/4/33 | 17 | L, 90, KILL | Strong vertical tool |
| Down smash — Dual Pistons | 17/5/35 | 14 | L, 25, EDGE | Front/rear extensions, one hit |
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

**Identity:** a serpentine midrange caster using her bow, tail, and water. Distinct from Archer through grounded space control and a vulnerable water recovery, not simply stronger arrows. Her tail remains a hittable body part when extended.

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

**Identity:** Rexxar-inspired axe fighter with one bear partner. The player still controls one fighter directly; the bear has a small deterministic command set rather than independent Warcraft AI. Bear timing is the primary complexity, so defer this hero until ordinary projectiles and rollback work.

### Normals

| Input and move | F/A/R and landing | Damage | Reach and launch | Behavior |
| --- | --- | --- | --- | --- |
| Jab — Axe Hilt | 5/2/15 | 4 | S, 35, POKE | Short hit |
| Forward tilt — Broad Axe | 10/3/23 | 11 | L, 35, EDGE | Weapon head disjoint |
| Up tilt — Antler Lift | 9/4/23 | 9 | M, 85, LAUNCH | Axe rises above shoulder |
| Down tilt — Low Chop | 8/3/20 | 7 | M, 65, LINK | Short axe sweep |
| Dash attack — Hunter’s Shoulder | 11/5/28 | 12 | M, 45, LAUNCH | Body advance 0.5H |
| Forward smash — Twin Axe Hew | 21/4/36 | 20 | L, 40, KILL | Both axes strike as one action |
| Up smash — Hunting Horns | 18/5/33 | 17 | L, 85, KILL | Twin upward arcs |
| Down smash — Clearing Sweep | 17/6/34 | 15 | L, 25, EDGE | Front then back |
| Neutral air — Axe Circle | 8/6/23; L15 | 10 | M, 50, POKE | One hit around torso |
| Forward air — Overhand Chop | 13/4/28; L18 | 14 | L, 40, KILL | Slow weapon arc |
| Back air — Hunter’s Boot | 9/3/24; L14 | 11 | M, 35, EDGE | Exposed leg |
| Up air — Axe Lift | 8/4/23; L14 | 9 | M, 85, LAUNCH | Narrow above |
| Down air — Downward Hew | 16/4/32; L22 | 13 | M, 270, SPIKE | No forced descent |

### B specials

| Input | Proposed move and behavior | Timing and cost |
| --- | --- | --- |
| Neutral B | **Throwing Axe:** straight thrown axe, 9 damage, POKE at 40 degrees, speed 0.11H/frame, life 28, radius 0.17H, one active and reflectable. No boomerang return. | Spawn f20, end f39; 0 mana |
| Side B | **Bear Command:** without a bear, ground-only summon at 0.6H ahead, 30 durability and 600-frame life. With a bear, issue a lunge in owner-facing direction: travel 1.2H, bite for 16 damage, EDGE at 40 degrees. Owner commits to command animation; commands fail while bear is attacking or stunned. Bear cannot attack during owner hitstun and does not auto-counter a combo. | Summon f30, end f56, cost 25. Command end f24, cost 8; bear startup 10, active 4, recovery 30 |
| Up B | **Hawk Lift:** a cosmetic hawk lifts Beastmaster 2.0H with 0.5H drift. No independent hawk AI or attack. Free version 1.4H. | Lift f10–32, then helpless; 15 mana |
| Down B | **Bear Recall or Quilbeast Dart:** with a bear, recalls it along the ground toward the owner at 0.06H/frame, cancelling only its idle/follow state; no teleport, attack, invulnerability, or durability reset. Without a bear, throw one short quill at speed 0.14H/frame, life 20, radius 0.10H; 4 damage, POKE at 35 degrees, reflectable. | Recall action 20 frames, 0 mana. Dart spawn f18, end f40, 3 mana |

**Bear movement:** when idle, follow to a point 0.8H behind the owner at 0.035H/frame; use the same deterministic stage collision as fighters, no pathfinding, no jumps. Stop at platform edges, never body-block, and despawn if outside a blast zone. If separated by more than 6H for 120 frames, despawn with no mana refund. Bear attacks are cancelled on taking a hit and use 18 frames of stun. On owner grab or hitstun, cancel pending bear attacks and suppress new attacks until the owner is actionable. No bear grab, stock, ledge snap, invulnerability, or autonomous attack.

### Grab and throws

Standing grab 8/2/25, reach 0.60H. Pummel: axe-hilt strike. Bear attacks are suppressed while owner holds a target or performs a throw, through throw recovery.

| Throw | Animation and release | Damage | Release and recovery | Launch |
| --- | --- | --- | --- | --- |
| Forward | Hunter’s shove | 8 | f13, R22 | 35, EDGE |
| Back | Shoulder toss | 9 | f17, R26 | 40, EDGE |
| Up | Twin-hilt launch | 7 | f15, R22 | 85, LAUNCH |
| Down | Wrestling trip | 6 | f19, R25 | 70, LINK |

**Ultimate — Stampede:** f36 ground startup, then six beasts emitted at 24-frame intervals, each moving at 0.10H/frame for 50 frames and stopping at terrain. One beast deals 6 damage, EDGE at 40 degrees; at most three hits per target per activation, with at least 24 frames between hits. Owner channels and is vulnerable until the last emission; R35 afterward. Interruption stops future spawns. No individual AI; use pooled projectiles with a special cap of six for this ultimate only.

**Required counterplay test:** opponents can separate Beastmaster from bear and punish the command animation. No bear-plus-throw sequence bypasses regrab protection or produces a guaranteed infinite. Solo Beastmaster must remain playable while the bear is absent.

### Beastmaster as built

Source: smashcraft:ts/src/game/sim/heroes/beastmasterMoves.ts (normals, grabs,
throws, body), beastmasterSpecials.ts, beastmasterHero.ts and the partner
rules in smashcraft:ts/src/game/sim/companions.ts (#122). Every row above is
implemented with its listed timing, damage, angle and reach. Launch classes
use provisional coefficients. Deliberate differences:

- The bear is his placed object with a `companion` record. Side special
  summons it (25 mana, ground only). While it stands, side special is Bear
  Command (8 mana): the bear lunges the way he faces after 10 frames of
  warning, with a 4-frame bite. Down special is Bear Recall (free), and the
  Quillbeast Dart only when no bear stands. A lunge order refuses, spending
  nothing, while the bear is lunging or stunned.
- The bear follows to 0.8H behind him on the deck it was set down on, and
  stops at that deck's ends instead of falling. With no fall, it never
  crosses a blast zone. It also leaves after 120 frames more than 6H from him
  (or while he is out).
- A lunge is cancelled while he is in hitstun, held, holding or throwing.
  Any opponent's hit on the bear mid-lunge spends durability and stuns it for
  18 frames. The bear never blocks a body or a strike meant for him.
- The up throw is a JUGGLE and the down throw a CHASE (#107).
- Hawk Lift's free form drifts 0.35H; the brief gives only its 1.4H rise.

Presentation uses the stock classic BeastMaster model (Rexxar), scale 0.85,
and the classic GrizzlyBear model for the bear. The bear walks while it moves,
bites while it lunges and fades as its durability runs down. The model has
ten sequences and no hit, jump or kick clip, so flinches play "Stand Ready".
His voice is the game's Beastmaster set (OgreBeastMaster).

**Gameplan** (smashcraft:ts/src/game/sim/heroes/beastmasterGameplan.ts, #105):
he sets the bear down from range, then walks in behind it with Broad Axe and
Low Chop and sends it lunging. The free Throwing Axe makes the target act.
He keeps out of close brawls and off the edge, where being split from the
bear costs him most.

## Dark Ranger

**Identity:** a deliberate archer-necromancer built around one marked target and one fragile skeleton. Preserve Archer’s faster direct arrow identity: Dark Ranger gets slower shots, curse pressure, and setup. No permanent possession of another fighter.

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

**Ultimate — Banshee’s Wail:** replaces literal Charm. f36 visible ground startup, a 70-degree frontal cone reaching 1.5H, active 4 frames, 18 damage, KILL at 45 degrees, R42. Shieldable, no control reversal, mind control, full-screen silence, or unavoidable hit. Spectral faces make the startup easy to read.

**Required counterplay test:** her basic arrow must not dominate Archer on startup, rate, and angle coverage simultaneously. Skeleton destruction meaningfully removes pressure; silence cannot take away recovery or create a permanent status loop.

## Firelord

**Identity:** a caster who leaves brief fire zones and builds pressure with a single lava spawn. Flame trails are visually clear and mechanically bounded. The floating model still follows normal jumps and gravity.

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
| Side B | **Lava Spawn:** ground-only summon 0.6H ahead, 10 durability, 240-frame life. Remains stationary and fires in placement-facing direction at ages 60 and 150: speed 0.08H/frame, life 25, radius 0.15H, 5 damage, POKE at 40 degrees, reflectable. One spawn, no splitting; recast recalls it. | Summon f30, end f57; 22 mana initial, 0 recall |
| Up B | **Flame Jet:** 2.0H upward movement, up to 0.45H lateral, attached one-hit flame attack for 8 damage, LAUNCH at 80 degrees. Free version 1.4H with no hitbox. | Hit f11–16, movement through f31, then helpless; 15 mana |
| Down B | **Molten Patch:** ground-only place a visible 0.65H-radius zone 0.7H ahead. Arms after 24 frames, lasts 120 more. Target can take one hit per 60 frames, maximum two total, each 4 damage, POKE at 70 degrees. One patch, cannot be refreshed while active, does not pass through platforms, no damage to shields beyond ordinary hit behavior. | Place f26, end f52; 20 mana |

Lava Spawn has no body collision or auto-aim and uses the same owner-stun/grab attack suppression as the other pets. Existing projectiles remain independent after firing. Heat marks are per source and target; reflected Embers belong to the reflector and cannot consume someone else’s marks.

### Grab and throws

Standing grab 9/2/26, reach 0.60H. Pummel: ember squeeze, no extra heat mark.

| Throw | Animation and release | Damage | Release and recovery | Launch |
| --- | --- | --- | --- | --- |
| Forward | Flame-palm shove | 7 | f13, R22 | 35, EDGE |
| Back | Pivoting eruption | 8 | f17, R25 | 40, EDGE |
| Up | Vent beneath target | 7 | f16, R23 | 90, LAUNCH |
| Down | Cinder slam and pop-up | 6 | f20, R27 | 70, LINK |

**Ultimate — Volcano:** ground-only f40 startup creates a volcano 1.3H ahead, 25 durability, life 180. Three eruptions at ages 30, 90, and 150, radius 0.85H, each 9 damage, LAUNCH at 80 degrees. No random rocks or full-map targeting. Destroying the volcano ends later eruptions. Owner’s casting action ends f78. Each eruption has a 20-frame visible warning; cannot hit through solid platforms.

**Required counterplay test:** lava fire plus Molten Patch leaves an aerial route and cannot cause indefinite shieldstun. Heat marks create a readable incentive to avoid the third hit without giving normals hidden passive explosions.

## Original fighters

Archer and Rifleman were built before this specification. Their kits live in
the shared move tables (smashcraft:ts/src/game/sim/hitRegions.ts,
smashcraft:ts/src/game/sim/specials.ts, smashcraft:ts/src/game/sim/summons.ts)
and their gameplans (#105) in smashcraft:ts/src/game/sim/originalGameplans.ts.
Their normals still share one set of frame data and hitboxes (Rifleman's down
tilt is the exception), so physics and specials carry their identities.

### Archer

**Identity:** a hit-and-run archer: the fastest run (13.20) and jump start
(3 frames) on the lightest body (weight 62; the roster table's 1.00 is 75). Arrows and the homing arrow add damage
from range without hitstun or interruption. Her spaced fade-back forward air
is safe on shield. One hippogryph serves both remaining specials
([Archer's hippogryph specials](archer-specials.md)): her down special calls
it swooping through the gap to a perch (with a side, she hops back from it,
the old Disengage), and her next down special dives it from the perch at
her, through anyone between; her up special is a steerable ride with a high
or low line, ending helpless or leaping off to act, which leaves the
hippogryph flying on as a strike. **Weakness:** her weight loses stocks
early, her arrows can't stop an approach, and hitting her scares the
hippogryph off its perch.

**Gameplan:** keeps 180–460 units away. Her spacing tools are forward air at
110–240, the arrow at 200–700 and the homing arrow at 160–520. Her speed is her
edge: she runs in with grab, down tilt or up tilt or jumps in with forward or
neutral air (weight 2 each) more than she shoots (weight 1). She answers threats by
retreating or jumping, and sometimes by shield or spot dodge. Up tilt leads
into up air or up smash, down tilt into forward air or up tilt, and up throw
into up air. She kills with forward smash from 90%, up smash from 100% and back
air from 110%. She returns to the ledge or the deck and keeps the hippogryph
ride until her jump is gone. She avoids the edge. The perch and dive are her
stage control: a dive line through the gap she keeps, or through a recovery
path while she holds the ledge.

### Rifleman

**Identity:** a gunner who holds ground. He is slow on the ground (run 9.00)
and late off it (5-frame jump squat), but floaty, heavier than Archer (80) and
harder-hitting: his down tilt deals 10. The blaster shoots with hitstun from
range, but a grounded shot leaves on frame 9 and holds him until frame 39, and a short-hop shot (#117) costs a landing,
so his wall costs a commitment his slow body can't cover. The bear walks ahead as cover. The freezing trap guards the gap in
front of him and sets up a smash. **Weakness:** he can't chase, and in close
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

### Illidan

**Identity:** the original fighter with the highest air speed and the
longest glaives (forward and back air reach 175 units, forward smash 195).
He reaches farther and deals less: the twin-glaive forward air 3 + 4, back air 6, forward
smash 10, all at 85 knockback growth, and his smashes start from 20 base
knockback like everyone's ordinary hits. Every hit he lands drains the
target's mana, more for big hits and combo enders, and his side special is
Fel Rush ([Illidan](illidan.md), #147). **Weakness:** his light hits make
him land more of them to take a stock.

**Gameplan** (smashcraft:ts/src/game/sim/illidanGameplan.ts): he fights in
the air at his glaives' length, forward air in and back air drifting out,
threatens forward smash's reach on the ground, and whittles the
opponent's mana before a Mana Burn stun.

#### Mana Burn (neutral special)

Delegated design, 7 Oct 2026 (#116). Tom asked for a slower B, "like a Ryu
thing", with a stun that is more devastating when it hits, or a longer cast.
In the fireball game, a slow projectile is a wall its thrower walks behind.
Ultimate's Ryu throws the slow Hadoken at speed 0.8 from frame 12, and it
lasts 82 frames ([SmashWiki](https://www.ssbwiki.com/Ryu_(SSBU)/Neutral_special)).
Street Fighter V's light Hadoken starts in 13 frames and recovers in 32
([Prima](https://primagames.com/eguides/street-fighter-v-eguide/fighters/ryu/special-moves)).

- **Cast** 16 frames, during which the mana glow shows on his hand.
  Recovery is 30 frames, 46 in all. He can't cast a second orb while one is
  out, and that includes one he reflected.
- **Orb**: speed 12 for 90 frames (1080 units), at the shield's centre
  height. His run speed is 11.1, so he can follow just behind the orb, and a
  short hop clears it.
- **Hit**: 5 damage and a flinch with no knockback, then a stun. The stunned
  fighter can't act, plays its dizzy clip with Mana Burn's glow over its
  head, and shows the locked-state marker. The stun lasts 20 frames, plus
  2 frames for every 5% after the hit, up to 80. That is 22 at a fresh hit,
  40 at 50%, 60 at 100% and 80 from 150%. The next damaging hit ends it.
  When it ends, the fighter is immune to stun and sleep for 300 frames, so
  stuns never chain.
- **Reward**: a low-percent hit gives Illidan a free poke. A high-percent
  hit gives him a free smash, but only if he followed the orb in. Thrown
  from far away and left alone, the orb's stun runs out before he arrives.
- **Counterplay**: jump the orb. Powershield it, and it returns at 0.7 speed
  and stuns Illidan instead. Shield it: no stun, and point blank he is
  punished by shield grab and jump-out-of-shield aerials. The orb and an
  opposing traveling projectile cancel each other. This is the one
  projectile clash in the game; others pass through each other.

Rejected:
- **A charged orb** (Samus's Charge Shot, Lucario's Aura Sphere). A stored
  charge is a safe standing threat, the camping #98 rejects.
- **The old fast orb with a stun added.** It would be a safe long-range
  poke with a bigger reward and no screen control.

Source: smashcraft:ts/src/game/sim/specials.ts and projectiles.ts (stun
`MANA_BURN_STUN`), and the contract tests in
smashcraft:ts/src/game/sim/demonHunterContracts.tests.ts.

### Balance record

Measured with `bun scripts/cpuField.ts` (both fighters computers, every
ordered pair with a different fighter, every soak stage, 3 stocks, 4-minute
clock, one spawn variant: 180 matches for each of Archer and Rifleman). The
win rate counts decisive matches against the field. A no-hit loss is a stock
lost with no hit taken in the previous 3 s.

| Change (build) | Archer win rate / no-hit losses | Rifleman win rate / no-hit losses |
| --- | --- | --- |
| Before gameplans (9e57c43a) | 82% / 21% | 88% / 31% |
| Gameplans declared | 54% / 26% | 82% / 27% |

From #105's balance pass the field is every pair of the ten fighters, both
computers, every soak stage, 3 stocks: before at 100 matches a pair, tuning
steps at 20 a pair (spawn variant 0). A self-destruct is a stock lost with no
hit taken since the fighter last stood on a deck or held the ledge.

| Change (build) | Archer | Rifleman | Illidan |
| --- | --- | --- | --- |
| Before the pass (b2ed6109, 100/pair) | 27%, self-destructs 1% | 85%, 0% | 82%, 1% |
| Archer runs in on his speed; blaster 32/20 frames (was 24/15); Illidan's glaives deal less (forward/back air 8→6, forward smash 15→12, growth 100→85, smash base 28→20); Storm Bolt 7→5 | 51%, 1% | 74%, 0% | 58%, 0% |

After the kit redesigns, mana, passives and hero tilts, the field is twelve
fighters (66 pairs) at computer level 9, 100 matches a pair (spawn variant
0, seeds 0-4, every soak stage, both orders). Each change works a fighter's
own strength or weakness lever. Cells are the win rate against the field,
then self-destructs as a share of stocks lost. Matrices:
smashcraft:evidence/balance-105-20261007/.

| Fighter | Lever (identity) | Before (d5994278) | After |
| --- | --- | --- | --- |
| Archer | none yet | 79%, 1% | 85%, 1% |
| Rifleman | bear as cover: swipe 6→10 every 14 frames (was 18), lifetime 100→150 | 17%, 3% | 56%, 6% |
| Illidan | none | 42%, 5% | 46%, 5% |
| Blademaster | Backstab punishable on shield: 12→10 damage, end f28→f38 | 66%, 4% | 52%, 4% |
| Mountain King | close reads over the thrown hammer: Storm Bolt end f48→f58 | 65%, 3% | 50%, 3% |
| Warden | none | 56%, 13% | 52%, 11% |
| Lich | projectile placement: Frost Nova 6→8 damage, end f40→f32 (f37 after pass 2: f32 left it safe on shield point blank, #98 rule 2); launch growth +10 (LAUNCH 105, EDGE 110, KILL 120) | 33%, 2% | 48%, 2% |
| Uther | holds space rather than zoning: Holy Light end f44→f66, outbound 7→5 | 78%, 3% | 55%, 3% |
| Dreadlord | grabs and air pressure: throws +2 (10/12/9/8), forward air 12→14, back air 13→15, launch growth +10, KILL base 26→28 | 20%, 2% | 27%, 2% |
| Shadow Hunter | none yet | 39%, 2% | 26%, 2% |
| Pit Lord | caught inside a whiffed cleave: Cleaving Sweep 14→12 damage, recovery 29→35 | 80%, 5% | 71%, 4% |
| Beastmaster | bear coordination: lunge startup 16→12, bite 8→11, bear durability 22→30; launch growth +10 | 23%, 5% | 32%, 6% |

Matchups: 5 of 66 inside 45-55% before, 10 after; 95% intervals
overlapping the band 13 → 19; median distance from 50% 33.5 → 22 points.

Pass 2, same field (after pass 1 → after pass 2):

| Fighter | Lever (identity) | After pass 1 | After pass 2 |
| --- | --- | --- | --- |
| Shadow Hunter | totem placement: Serpent Ward fires 5 shots of 6 (ages 45-205, was 3 of 4), shot life 24→36, ward durability 12→20; launch growth +10 | 26%, 2% | 40%, 2% |
| Beastmaster | bear coordination: lunge travel 0.9H→1.2H, bite 11→14; Throwing Axe 7→9, end f44→f39 (f36 measured; f39 keeps it punishable on shield point blank, #98 rule 2) | 32%, 6% | 48%, 6% |
| Dreadlord | air movement and close pressure: air speed 1.12→1.22, weight 1.04→1.14, Batwing Turn 3+3+7 (was 2+2+5), Sleep 70→100 frames, Vampiric Pounce 9→13 | 27%, 2% | 39%, 3% |
| Pit Lord | his KILL and EDGE classes lose some growth (KILL 110→100, base 26→24; EDGE 100→95) | 71%, 4% | 65%, 4% |
| Archer | arrows can't stop an approach: homing arrow 6→4; her computer now counts both arrows as Trueshot's cashing moves (it already counted the plain arrow) | 85%, 1% | 74%, 1% (her row alone, 100 a pair, after the rest of pass 2) |
| Rifleman, Illidan, Blademaster, Mountain King, Warden, Lich, Uther | unchanged | 56, 46, 52, 50, 52, 48, 55% | 52, 42, 49, 43, 48, 43, 51% |

Matchups after pass 2 (before the Archer change): 13 of 66 inside 45-55%,
27 intervals overlapping the band, median distance from 50% 17 points.

Pit Lord's rate barely moves with his own recovery: Annihilating Cleave
4 frames slower and 7 longer, or Ruin Charge 10 frames longer with less
armor, each left him at 70% in row probes. The computer answers threats
but never times an attack into an opponent's recovery, so a slow swing
costs nothing against it; his CPU rate measures that gap as much as his kit.

Pass 3, after the computer learned to punish whiffs (#157, measured on its
first version 5de334c9, 100 a pair). Whiff punishing reshuffled the field:
Illidan's long glaives punish from range, and Blademaster and Beastmaster
lost the most (whiff punish → after pass 3):

| Fighter | Lever (identity) | Whiff punish | After pass 3 |
| --- | --- | --- | --- |
| Illidan | reaches farther, deals less: twin-glaive launcher 5→4, forward smash 12→10 | 67%, 1% | 57%, 1% |
| Blademaster | whiff punisher, now punished himself: Backstab back to 12 damage, end f30 | 38%, 5% | 46%, 4% |
| Beastmaster | bear coordination: lunge startup 12→10, bite 14→16 | 38%, 6% | 44%, 5% |
| Uther | Holy Light end f66→f56 (whiff punish makes the long end costly on its own) | 41%, 4% | 50%, 3% |
| Shadow Hunter | Serpent Ward durability 20→26 | 41%, 1% | 42%, 1% |
| Archer | her weight is her weakness: 75→68 (heroes keep the 75 reference); homing arrow 4→3 | 73%, 1% | 69%, 1% (her row alone, 40 a pair) |

Matchups: whiff punish alone 9 of 66 inside 45-55%, 31 intervals
overlapping, median 16.5 points; after pass 3 (before the Archer change)
11, 27, 17.0. Field rates moved toward even (mean distance from 50%
9.8 → 7.1 points) while the matchup median stayed put: at level 9 the
computers turn a small edge in one matchup into a lopsided result.

Pass 4 brings every fighter inside 40-60% against the field at 400 a pair
(main 4776861a, after pass 3, → after pass 4). Dreadlord and Shadow Hunter
were first checked for computer skill. Dreadlord's computer converted only a
quarter of his Sleeps, because whiff punishing didn't count a sleeper as a
window. It does now, for any grounded fighter asleep or stunned
(smashcraft:ts/src/game/match/botPunish.ts), and conversion rose to 42%, but
his rate barely moved. Both fighters lost on damage per hit (Dreadlord 6.8,
Shadow Hunter 5.9, against 7.5-9 for their opponents), so the kit changes
follow. Shadow Hunter's Hex had a kit defect: the target mashed out at frame
20 while he was still in his 53-frame cast, so no one, human or computer,
could cash it. The cast now ends on frame 40 and Hex holds at least 36
frames, which leaves him at least 20 frames after a point-blank Hex.

| Fighter | Lever (identity) | After pass 3 | After pass 4 |
| --- | --- | --- | --- |
| Dreadlord | close pressure and deceptive aerial approach: run 1.00→1.10, Raking Claw 10→12, Batwing Turn, Talon Reach and Wing Backhand landing lag 14/15/15 → 9/10/10; weight 1.14→1.24 | 33%, 3% | 49%, 3% |
| Shadow Hunter | glaive angles: thrusts 9→11, Low Crescent 5→7; Hex cashable (cast end f53→f40, mash floor 20→36) | 33%, 1% | 45%, 2% (Hex fix: his row alone, 400 a pair; 44% before it) |
| Archer | her weight is her weakness: 68→62; her dash attack, a speed tool, 8→6 | 67%, 1% | 56%, 1% |
| The other nine | unchanged | 43-60% | Rifleman 57, Illidan 53, Blademaster 59, Mountain King 51, Warden 45, Lich 42, Uther 47, Pit Lord 53, Beastmaster 45% |

Matchups after pass 4 (before the Hex fix): 14 of 66 inside 45-55%, 26
intervals overlapping, median distance from 50% 12.9 points.

## Implementation details for the overnight agent

### Read the real project first

Read the repository’s applicable AGENTS.md and active implementation notes, inspect the current branch/worktree and uncommitted changes, and identify the actual fighter-definition, input, simulation, animation, and presentation interfaces. This document is a design handoff, not a source audit. Do not assume a named model, animation clip, native function, or rollback primitive is available because it appears in a moveset description.

The earlier CODEX_IMPLEMENTATION_BRIEF.md and SMASHCRAFT_NETCODE_PROPOSAL.md remain architecture references. The user’s newer source and measured capability reports take precedence on current implementation status. Specifically, an observed early local polling transition is not proof that visible rollback, exact animation phase restoration, physical latency, or fairness has passed. Keep the hero rollout separate from those claims.

Preserve existing characters and established controls. If a hero already exists, compare its kit before adding a duplicate. Illidan is outside this expansion spec; integrate through the same interfaces but do not replace his moves or change Rifleman/Archer without a concrete shared-system need. Never disrupt another running development session merely to build this roster. The user is requesting this specification here; no unattended agent has been launched by writing it.

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

Damage-over-time packets cannot trigger armor, guard success, projectile reflection, summon commands, or additional on-hit statuses. A shielded projectile is destroyed without status. When multiple acceleration-slow effects overlap, apply only the strongest, not their product. Hex and silence share one 180-frame post-effect immunity group so two casters cannot alternate permanent special denial. They never block up B.

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
- No negative mana, duplicated resource spending on replay, healing above stock cap, orphaned grab, or retained old-stock entities.
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
