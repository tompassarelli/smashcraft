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

No critical-hit RNG, random evasion, chance-on-hit stuns, passive lifesteal, or automatic spell counters. Warcraft passive identities become deliberate moves or temporary states. Damage is Smash-style percent damage; healing reduces damage percent and is tightly bounded. Damage-over-time ticks do not cause hitlag, hitstun, or knockback. A status applies only on an actual body hit, not on shield.

### Proposed resource profile

If the current resource policy differs, expose this profile as configuration and report the difference rather than quietly rewriting existing fighters. Starting profile: 100 mana, full on spawn; regenerate 6 mana per second after 120 frames without spending, while actionable on the ground. No mana regeneration while airborne, shielding, grabbed, stunned, or using a move. Accumulate fractional regeneration with a deterministic remainder (for example, one mana per ten eligible frames); snapshot that remainder. Each B row lists its total cost; deduct once on move entry, with no refund on interruption. An unaffordable move does not start or consume input as an attack. Show insufficient mana feedback once per press, not every poll.

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
| Dreadlord | 1.04 | 1.00 | 1.12 | 1.10 | 1.15 |
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

**Identity:** a disciplined sword fighter who wins by spacing the outer blade and punishing misses. He gets strong reach and ground speed, not unrestricted teleportation or automatic critical hits. His exposed hands and torso remain hittable.

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
| Neutral air — Blade Wheel | 7/5/20; L12 | 8 | M, 50, POKE | One rotating sword arc; no continuous full-body shield |
| Forward air — Long Cut | 10/3/22; L14 | 11 inner, 14 outer | L, 40, EDGE | Primary spacing aerial; outer 0.20H sweetspot |
| Back air — Reverse Edge | 8/3/23; L13 | 12 | L, 35, KILL | Strong behind, commits facing |
| Up air — High Thrust | 6/3/19; L11 | 8 | M, 85, LAUNCH | Narrow upward poke |
| Down air — Plunging Point | 13/4/28; L20 | 12 | M, 270, SPIKE | No forced downward velocity; tip only spikes airborne targets |

### B specials

| Input | Proposed move and behavior | Timing and cost |
| --- | --- | --- |
| Neutral B | **Wind Cutter:** short traveling blade wave. 6 damage, POKE at 35 degrees; speed 0.14H/frame, life 24 frames, radius 0.16H. Reflectable; only one owned wave at a time. | Spawn f18, action ends f40; 0 mana |
| Side B | **Wind Walk Strike:** visibly translucent 1.4H dash, then a slash for 11 damage at 40 degrees, EDGE. No invisibility, invulnerability, or crossing through shields. Vulnerable during approach. In air gives horizontal travel once, then helpless. | Dash f10–19, slash f20–22, 26 recovery; 18 mana |
| Up B | **Rising Blade:** upward sword leap, 2.0H maximum ascent and 0.5H lateral travel; one hit for 9 damage at 80 degrees, LAUNCH. No intangibility. Mana-free version travels 1.4H with no attack. | Starts f7, hit f7–12, movement through f25, then helpless; 15 mana |
| Down B | **Mirror Feint:** after a visible tell, move 0.5H backward and leave one cosmetic afterimage for 24 frames. A second B press within 12 frames of departure requests a real forward slash, not an autonomous clone attack: 10 damage, L reach, 40 degrees, EDGE. A missed read is punishable; no intangibility. | Departure f8, base action ends f24; follow-up first active 9 frames after second press, active 3, recovery 25; 15 mana |

### Grab and throws

Standing grab 7/2/22, reach 0.55H, one-handed collar catch. Pummel: pommel strike using shared values.

| Throw | Animation and release | Damage | Release and recovery | Launch |
| --- | --- | --- | --- | --- |
| Forward | Shoulder shove with blade hilt | 7 | f12, R18 | 35, EDGE |
| Back | Pivot and kick behind | 8 | f15, R22 | 40, EDGE |
| Up | Hilt lifts target overhead | 6 | f13, R10 | 85, JUGGLE |
| Down | Knee check and low toss | 5 | f16, R20 | 65, CHASE |

**Ultimate — Bladestorm:** f24 startup, 120-frame active spin on f24–143 with ground speed capped at half normal run speed, reach L, six possible 3-damage LINK hits at 70 degrees per target at least 18 frames apart, then a single 10-damage KILL finisher at 45 degrees on f144–146; R40. No invulnerability or armor, no grab, and no ledge travel off solid ground. One activation ID tracks all hit limits. Avoid literal uninterruptible Warcraft Bladestorm.

**Required counterplay test:** forward smash whiff must give a fast fighter at its outer edge a plausible approach punish; Mirror Feint cannot reset its own recovery or create a true 50/50 without prior advantage.

**As implemented** (smashcraft:ts/src/game/sim/heroes/blademasterMoves.ts, blademasterSpecials.ts, blademasterClips.ts). Every row above is authored; these are the departures:

- Forward tilt also has up- and down-angled forms with the row's timing and damage; only the blade path changes.
- Down air's tip spikes airborne targets only; it sends grounded targets at 55 degrees, as the shared notation directs.
- Dash grab uses the shared rule (startup +3, recovery +8) on the standing grab's volumes.
- Wind Cutter, Mirror Feint and Wind Walk Strike keep their grounded timing in the air; Wind Cutter and Mirror Feint end on landing with 20 frames of lag, and the airborne Wind Walk Strike is once per airtime and ends helpless.
- Rising Blade climbs evenly over f7-24 and stops at its peak on f25 (2.0H up, 0.5H forward), so the helpless fall starts from rest; its free form climbs 1.4H and drifts 0.35H (the row's distance ratio) with no hit.
- Wind Walk Strike's dash stops before a raised shield or a body (`stopsAtBody`) and halts on the slash frame. Mirror Feint's back step stops at 0.5H; its slash replaces the rest of the feint on a second special press in f8-19 (`followUp`) and spends nothing more.
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
| Neutral B | **Storm Bolt:** straight hammer projectile; 7 damage, LAUNCH at 65 degrees, speed 0.12H/frame, life 35, radius 0.18H. Reflectable. Uses normal hitstun rather than an extra stun status; one bolt active. | Spawn f20, end f48; 8 mana |
| Side B | **Storm Rush:** shoulder dash 1.2H; 12 damage, EDGE at 35 degrees. No armor, no command grab, stops at shield. Air version has no upward lift and ends helpless. | f13–18 active/moving, R28; 18 mana |
| Up B | **Thunder Leap:** arcing 1.8H rise and up to 0.7H horizontal travel; hammer attack during ascent for 8 damage, LAUNCH at 80 degrees. Free version reaches 1.3H, no attack. | Rise/hit f9–14, movement through f28, then helpless; 15 mana |
| Down B | **Thunder Clap:** grounded circle radius 0.85H, 10 damage, LAUNCH at 70 degrees. Air version swings hammer underneath with 0.55H reach, no large shockwave and no landing burst. | f18–21 active, R32; 20 mana |

### Grab and throws

Standing grab 8/2/25, reach 0.50H. Pummel: helmet headbutt.

| Throw | Animation and release | Damage | Release and recovery | Launch |
| --- | --- | --- | --- | --- |
| Forward | Hammer-hilt shove | 9 | f14, R22 | 35, EDGE |
| Back | Over-the-shoulder heave | 10 | f18, R27 | 40, KILL |
| Up | Hammer-assisted toss | 8 | f16, R13 | 90, JUGGLE |
| Down | Ground slam with rebound | 7 | f20, R26 | 75, CHASE |

**Ultimate — Avatar:** f30 vulnerable transformation, R12, then 480 frames at weight multiplier 1.15 and damage multiplier 1.10. No permanent armor, immunity, heal, size change, or knockback cleanse. Existing knockback at activation is not retroactively recomputed. Visual stone overlay must preserve silhouette.

**Required counterplay test:** blocked Storm Bolt must not guarantee a grab from its full travel distance; Thunder Clap cannot cover both a retreat and a jump without a read.

**Implemented kit** (smashcraft:ts/src/game/sim/heroes/mountainKingMoves.ts, mountainKingSpecials.ts, presentation/heroes/mountainKingClips.ts). Every row above is implemented; nothing is omitted. Deliberate additions and choices where the table is silent:

- Forward tilt also has up- and down-angled paths with the same timing and damage.
- Hammer Drop's head and Double Boot launch grounded targets at 55 degrees (the shared grounded spike rule).
- Air Thunder Clap reuses the ground form's 10 damage and 70-degree LAUNCH on its 0.55H under-hammer path.
- Thunder Clap is a ground-level ring 30 units tall, so a jump clears it while it still covers both sides.
- Thunder Leap puts half its exact rise into the f9-14 hit window and eases over f15-28 so it peaks at the listed height; the free form peaks at 1.3H with 0.5H drift.
- Storm Rush stops at a raised shield or a body (shared `stopsAtBody`) and stops dead after its 1.2H dash; its lowered shoulder carries a hurt volume while it strikes.
- Mountain King's hurt volumes add the arm, leg or boots behind each normal from late startup through early recovery; hammer and axe stay outside them.
- The stock model has thirteen usable sequences and no jump, hit, dodge, ledge or grab clips: hits play the opening of Death, jumps and techs the opening of Stand - 3, ledge and grab holds a held Stand Ready.

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
| Up air — Sky Crescent | 5/3/17; L10 | 7 | M, 85, LAUNCH | Juggle move, little lateral coverage |
| Down air — Execution Point | 12/3/27; L19 | 11 | M, 270, SPIKE | Narrow downward blade; no dive velocity |

### B specials

| Input | Proposed move and behavior | Timing and cost |
| --- | --- | --- |
| Neutral B | **Shadow Strike:** one slow thrown blade; 5 impact damage, POKE at 35 degrees, plus 3 damage over 90 frames in three 1-damage ticks. Speed 0.11H/frame, life 30, radius 0.13H. Reflectable; poison never flinches and does not stack. | Spawn f16, end f37; 5 mana |
| Side B | **Pursuit Lunge:** 1.0H dash slash, 10 damage, EDGE at 35 degrees. Hold up/down on entry for a shallow +20/−20 degree air trajectory; no late steering. Air use once per airtime and ends helpless. No invulnerability. | f11–14 active, R26; 15 mana |
| Up B | **Blink:** choose one of eight directions from held input at entry, travel up to 1.7H; f1–7 vulnerable, f8–10 intangible, endpoint vulnerable from f11. No hitbox. Sweep against terrain and stop at the last legal position, never cross solid stage. Free version is upward-only 1.1H, no intangibility. | Displacement f9; f11–30 endpoint recovery then helpless; 20 mana |
| Down B | **Fan of Knives:** a single radial attack reaching 0.85H around Warden for 7 damage, POKE at 45 degrees outward. Knives are short-lived hit volumes attached to this move, not eight independent full-range projectiles. No invulnerability, reflect, or cancel. | f9–11 active, R27; 18 mana |

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
- Execution Point spikes airborne targets only; it sends grounded targets at 55 degrees, as the shared notation directs.
- Warden's arm reaches each blade's hand from two frames before the strike to four after, in held poses; only the blades are disjoint. Heel Blade's leg is exposed on frames 5-13.
- Pursuit Cut and Pursuit Lunge stop dead after their travel instead of sliding on. Pursuit Lunge's 20-degree air tilt reads the stick held through frame 4.
- Blink reads its eight directions from the stick held through frame 8, because an up special is always entered holding up. A grounded endpoint keeps the full recovery to frame 30, and a displacement into the stage stops at its body or lands on the deck.
- Shadow Strike's poison is its own status slot beside sleep-like conditions: it never replaces or blocks one, ignores immunity groups and refreshes rather than stacks.
- Presentation uses the stock Warden model. It has twelve sequences and no hit, jump, roll or ledge animations: blade swings play Attack - 1 and Attack - 2, overhead strikes Spell Slam, rising strikes and Fan of Knives Spell, Shadow Strike Spell Throw, and Blink, spot dodge and air dodge Dissipate. Knockdowns and tumbles play Death.
- Spirit of Vengeance is not implemented; ultimates stay off in competitive play.

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
| Neutral air — Frost Halo | 9/6/23; L16 | 8 | M, 50, POKE | Brief circular zone around torso |
| Forward air — Shard Fan | 12/3/27; L17 | 11 | L, 40, EDGE | Attached fan-shaped magic hitbox |
| Back air — Bone Spike | 10/3/25; L15 | 12 | M, 35, KILL | Short rear burst |
| Up air — Cold Star | 8/4/23; L14 | 9 | M, 85, LAUNCH | Precise overhead hit |
| Down air — Falling Crystal | 16/4/31; L22 | 12 | M, 270, SPIKE | Attached downward crystal, not a projectile |

### B specials

| Input | Proposed move and behavior | Timing and cost |
| --- | --- | --- |
| Neutral B | **Frost Shard:** 6 damage, POKE at 35 degrees; speed 0.10H/frame, life 45, radius 0.16H. One active shard, reflectable. No slow status on this cheap move. | Spawn f20, end f45; 0 mana |
| Side B | **Frost Nova:** place a visible marker 1.5H ahead, or 0.9H if back is held on entry. At f30 a radius 0.65H burst hits once for 11 damage, LAUNCH at 70 degrees. Marker stays fixed in world space, is cancelled by interruption before detonation, and must have line of sight at placement. No remote instant targeting. | Marker f8, burst f30–32, R26; 20 mana |
| Up B | **Spectral Ascent:** visible upward glide, 2.1H height and up to 0.4H lateral drift, no hitbox or intangibility. Free version 1.4H. | Movement f10–34, helpless afterward; 15 mana |
| Down B | **Frost Armor:** f22 cast grants a 180-frame shell that absorbs the hit reaction of one hit of at most 6 damage. Damage still applies; the hit consumes the shell. Grabs bypass it. Cannot recast while active; no retaliation or slow. | Cast f22, end f45; 25 mana |

### Grab and throws

Standing grab 10/2/28, reach 0.70H. Visible spectral hand, no tether recovery or remote grab. Pummel: cold pulse.

| Throw | Animation and release | Damage | Release and recovery | Launch |
| --- | --- | --- | --- | --- |
| Forward | Ice-palm discharge | 7 | f14, R23 | 35, EDGE |
| Back | Rotate target in spectral hand | 8 | f18, R26 | 40, EDGE |
| Up | Raise on an ice pillar | 7 | f17, R13 | 90, JUGGLE |
| Down | Drop and burst beneath target | 6 | f19, R26 | 75, CHASE |

**Ultimate — Death and Decay:** ground-only, f36 telegraph to a marked 2.0H-radius region centered 1.0H ahead; channel for up to 180 frames. Six 3-damage ticks per target at least 30 frames apart, no flinch, then a 12-damage LAUNCH burst at 80 degrees if the channel completes. Hitting or grabbing Lich ends the field without finisher. R35 after release. No percentage-health damage or unavoidable map-wide effect.

**Required counterplay test:** a fast fighter already inside Lich’s forward-tilt range must be able to challenge a missed shard or nova. Frost Armor may help one trade but cannot permit casting through an entire combo.

### As built

Source: smashcraft:ts/src/game/sim/heroes/lichHero.ts, lichMoves.ts and
lichSpecials.ts. Every normal, grab, pummel, throw and special above is
implemented; the ultimate is not (there is no ultimate action). Changes from
the tables:

- **Frost Nova** "back held on entry" is a side special pressed toward
  Lich's back: Lich keeps facing and places the marker 0.9H ahead instead of
  turning. A marker whose line from Lich crosses solid stage geometry is not
  placed (the cast and its cost still happen).
- **Spectral Ascent** steers with the live stick at up to 0.4H/25 per frame
  over its window, in place of air drift; with a neutral stick it rises
  straight up.
- **Frost Armor**'s shell protects from frame 22 for 180 frames, even after
  the cast ends; any hit spends it, and only a hit of at most 6 damage loses
  its reaction. Casting again fails without spending while any armor remains.
- **Bodies:** Lich has no weapon, so the conjured frost beyond the hand is
  each move's disjoint; the casting arm extends the hurt volume from late
  startup through early recovery of every normal, the grab, Frost Shard and
  Frost Nova.
- **Presentation:** the stock HeroLich model has ten sequences (Stand, Stand
  Ready, Stand - 2, Stand - 3, Walk, Stand Channel, Attack, Spell, Death,
  Dissipate). Hand strikes play Attack, frost casts Spell, sustained magic
  Stand Channel; hit reactions use the Stand - 3 sway and knockdowns Death.
- Knockback classes use provisional growth/base values, not the
  displacement-calibrated bands.

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
| Neutral B | **Holy Bolt:** aimed straight or 30 degrees up by holding up on entry; 7 damage, POKE at 40 degrees. Speed 0.12H/frame, life 30, radius 0.17H, one active, reflectable. Deals the same damage to every race. | Spawn f22, end f47; 5 mana |
| Side B | **Crusader Rush:** advance 0.9H with a hammer check, 11 damage at 45 degrees, LAUNCH. Armor against one hit of at most 5 damage only on f12–15; grabs ignore it. Air version has no armor, no rise, and ends helpless. | Active/movement f12–17, R30; 20 mana |
| Up B | **Ascension:** rising hammer leap, 1.9H rise and 0.45H horizontal drift; one 8-damage hit, LAUNCH at 80 degrees. Free version 1.3H without hitbox. | Hit f10–15, travel through f29, then helpless; 15 mana |
| Down B | **Divine Guard:** ground-only timed stance, intangible f6–9, vulnerable otherwise, no automatic counter. If the guard overlaps a would-be damaging melee/projectile hit during those frames, record a successful guard and restore 3 damage percent once, with an 8-percent total healing cap per stock. Does not heal shield or mana; grabs beat it. | End f36; 25 mana. Air version fails without spending |

### Grab and throws

Standing grab 8/2/25, reach 0.55H. Pummel: hammer-hilt tap.

| Throw | Animation and release | Damage | Release and recovery | Launch |
| --- | --- | --- | --- | --- |
| Forward | Palm of judgment | 8 | f14, R23 | 40, EDGE |
| Back | Shoulder turn and toss | 9 | f18, R26 | 40, EDGE |
| Up | Lift with a shaft of light | 7 | f16, R9 | 90, JUGGLE |
| Down | Kneeling hammer slam beside target | 6 | f20, R26 | 70, CHASE |

**Ultimate — Guardian of the Light:** f30 vulnerable activation, R15, then 360 frames of +10 percent damage and three visible protective charges. A charge absorbs one hit reaction up to 6 damage while still taking damage; at most one charge consumed per 30 frames. Grabs and larger hits bypass the protection. No resurrection, extra stocks, unlimited heal, or prolonged invulnerability.

**Required counterplay test:** Uther can be grabbed or baited during Divine Guard and punished afterward. Optimal healing cannot outpace plausible damage indefinitely because the stock cap is absolute.

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
  fall) and lands with 20 frames of lag; Holy Bolt cast in the air does too.
- Ascension travels on f8-28 and stops on f29, so its helpless fall starts
  at the 1.9H (free form 1.3H) apex; both forms drift 0.45H.
- Divine Guard's success is the special's `guard` window (docs/heroes.md): an
  opponent's damaging strike or projectile overlapping Uther on f6-9 restores
  3 percent once per guard, at most 8 a stock. Its intangibility still lets
  the strike pass, so a strike active past f9 can hit him afterwards.

Presentation uses the stock classic Paladin model, which has thirteen
sequences and no punch, kick, jump, roll, ledge or grab clip. Hammer Sweep's
path follows "Attack - 1" and Final Judgment's follows "Attack - 2"; the jab,
grab, pummel and side special reuse "Attack - 1", so the drawn hammer swings
while the gauntlet strikes. Down smash's back half and Rearward Boot have no
matching clip ("Attack - 2" and "Stand Hit" play). utherClips.ts lists the
sequence table and every pose's clip.

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
| Neutral air — Batwing Turn | 7/6/22; L14 | 9 | M, 50, POKE | Wide body arc, tradeable |
| Forward air — Talon Reach | 10/4/24; L15 | 12 | L, 40, EDGE | Forward reach at cost of exposing arm |
| Back air — Wing Backhand | 9/4/25; L15 | 13 | L, 35, KILL | Wing hurtbox extends too |
| Up air — Horn Lift | 7/3/21; L12 | 8 | M, 85, LAUNCH | Short upward head attack |
| Down air — Talon Drop | 14/4/29; L20 | 12 | M, 270, SPIKE | Downward claw strike, no stall |

### B specials

| Input | Proposed move and behavior | Timing and cost |
| --- | --- | --- |
| Neutral B | **Carrion Swarm:** a short bat cloud moving at 0.09H/frame for 32 frames, radius 0.25H. One hit for 7 damage, POKE at 40 degrees. Reflectable as one projectile, one cloud active. | Spawn f20, end f45; 5 mana |
| Side B | **Night Pounce:** grounded command grab with 0.8H approach; grab reach 0.45H. On catch, automatic bite-and-release at catch+16 frames, 9 damage, EDGE at 40 degrees, then 28 recovery. No heal, no carrying, shared regrab protection applies. Air version is a claw attack for 9 damage, not a grab, and ends helpless. | Catch/strike f17–19; whiff R34; 20 mana |
| Up B | **Bat Ascension:** steerable rising curve up to 2.0H high and 0.8H across, no hitbox. Visible bat-body hurtbox throughout; no intangibility. Free version 1.4H height and 0.3H across. | Movement f9–32, then helpless; 15 mana |
| Down B | **Sleep Orb:** visibly slow projectile, speed 0.06H/frame, life 35, radius 0.18H, one active and reflectable. Body hit deals 2 damage and 20 frames of sleep; sleeping target keeps velocity/gravity, cannot act, and wakes on the next damaging hit. Then gains 180-frame sleep immunity. Shield blocks it. No bonus damage on waking. | Spawn f26, end f58; 25 mana |

### Grab and throws

Standing grab 7/3/26, reach 0.65H. Pummel: claw squeeze. No automatic lifesteal.

| Throw | Animation and release | Damage | Release and recovery | Launch |
| --- | --- | --- | --- | --- |
| Forward | Wing-assisted shove | 8 | f12, R20 | 35, EDGE |
| Back | Spin and fling | 10 | f18, R25 | 40, KILL |
| Up | Toss into bat cloud | 7 | f15, R11 | 85, JUGGLE |
| Down | Claw pin then kick free | 6 | f19, R25 | 65, CHASE |

**Ultimate — Infernal:** f30 cast places a clearly visible marker 1.2H ahead. An infernal lands at f60 for 14 damage, LAUNCH at 75 degrees, radius 0.8H, then stays as a stationary hazard for 180 frames. It performs exactly two telegraphed swipes at spawn+60 and spawn+120, each 10 damage, EDGE at 40 degrees, reach 0.8H, with 20 durability. No autonomous chasing, invulnerable summon, or instant full-stage hit. Dreadlord’s casting action ends f75.

**Required counterplay test:** Sleep Orb from neutral must be jumpable or shieldable and cannot reset its own sleep chain. Night Pounce should lose to a preemptive attack and to a correctly spaced retreat.

**As implemented (smashcraft:ts/src/game/sim/heroes/dreadlordMoves.ts, dreadlordSpecials.ts):** every row above is present; the departures are these.

- Nothing Dreadlord swings is disjointed: each claw, wing, horn and elbow path is also his body, fully out from a frame before its first active frame to two after its last, drawn out and folded back through held 3-frame poses. His standing body adds folded wings behind the shoulders to the roster capsule.
- Night Pounce's grounded approach stops at a body or shield and holds his height while it runs. The air version has no approach travel; it is the claw strike alone, once per airtime, ending helpless.
- Bat Ascension steers with the live stick (`driftSpeed`): a full side held through the rise gives 0.8H (free form 0.3H), a neutral stick rises straight. His spread wings are part of his body throughout; it has no intangibility.
- Sleep Orb's 2-damage hit stops his target's momentum like any hit; the sleep that follows leaves velocity and gravity alone and discards the sleeper's inputs.
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
| Down air — Totem Point | 14/4/29; L20 | 11 | M, 270, SPIKE | Glaive point downward |

### B specials

| Input | Proposed move and behavior | Timing and cost |
| --- | --- | --- |
| Neutral B | **Spirit Glaive:** one straight projectile, 6 damage, POKE at 35 degrees, speed 0.12H/frame, life 28, radius 0.15H. It does not return or bounce in v1; one active and reflectable. | Spawn f18, end f40; 0 mana |
| Side B | **Serpent Ward:** ground-only placement 0.65H ahead; one ward, 12 durability, 240-frame life. It fires straight in its placement-facing direction at age 45, 105, and 165, never auto-aiming. Shots: 4 damage, POKE at 35 degrees, speed 0.10H/frame, life 24, radius 0.12H, reflectable. Recasting with a ward active recalls it after the same vulnerable animation, costs 0, and grants no refund. | Ward appears f26, action ends f52; initial cast 20 mana |
| Up B | **Loa Vault:** a spirit-assisted arc 2.0H high and 0.6H lateral, no hitbox or intangibility. Free version 1.4H and 0.3H lateral. | Movement f8–30, then helpless; 15 mana |
| Down B | **Hex:** short visible orb, speed 0.07H/frame, life 18, radius 0.18H. 2 damage, POKE at 40 degrees. For 45 frames target cannot start B specials but keeps normals, grab, movement, jump, shield, and DI; up B remains available as a recovery exception. No hurtbox change. 180-frame hex immunity after expiration. Reflectable; one active. | Spawn f24, end f53; 25 mana |

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
| Forward tilt — Cleaving Sweep | 13/4/29 | 14 | XL, 35, EDGE | Main space claim; blade disjoint only |
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
| Neutral B | **Throwing Axe:** straight thrown axe, 7 damage, POKE at 40 degrees, speed 0.11H/frame, life 28, radius 0.17H, one active and reflectable. No boomerang return. | Spawn f20, end f44; 0 mana |
| Side B | **Bear Command:** without a bear, ground-only summon at 0.6H ahead, 22 durability and 600-frame life. With a bear, issue a lunge in owner-facing direction: travel 0.9H, bite for 8 damage, EDGE at 40 degrees. Owner commits to command animation; commands fail while bear is attacking or stunned. Bear cannot attack during owner hitstun and does not auto-counter a combo. | Summon f30, end f56, cost 25. Command end f24, cost 8; bear startup 16, active 4, recovery 30 |
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
