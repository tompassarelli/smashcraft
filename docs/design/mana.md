# Super meter

Tom replaced special costs with one super meter on 8 October 2026 (#335).
Every regular special is free, including its full recovery form. Normals,
grabs and throws remain free. Shield + Special requests the EX version in
any of the four directions. The bar has three segments (33/33/34 points,
#382): an EX costs one segment and an ultimate ([ultimates.md](ultimates.md))
costs the full bar.

The simulation stores the bar in each fighter's `mana.points`; meter is part
of replay and rollback state. The rules live in
smashcraft:ts/src/game/sim/mana.ts and sim/exSpecials.ts; the body-contact
resolver awards damage gains.

| Rule | Value |
|---|---|
| Bar size | 100 integer points, one bar in three segments at 33 and 66. A new match starts at 0. |
| Damage dealt to a body | 1 point per whole percent of damage, up to 12 points per hit. Normals, specials, projectiles, summons, throws and pummels all count. |
| Damage taken to the body | 1 point per 2 whole percent, up to 6 points per hit. This earns half as much as attacking. |
| Idle, movement or shielding | 0 points per frame. No idle refill. |
| Shield damage or parry | 0 points. |
| Stock loss | Keep the current points through the KO and respawn. |
| Regular special | 0 points; always chooses its full ground or air form. Existing cooldowns, airtime limits and entity limits still apply. |
| EX special | Needs one segment (33 points); pays 33 once when the action starts. A full bar buys three. |
| Ultimate | Needs all 100 points; pays 100 once when it starts, leaving 0. |
| EX below 33, or ultimate below 100 | The ordinary free special starts. No refusal or partial spend. |
| Interrupted or missed EX | The bar stays spent. Follow-up inputs do not spend it again. |
| Full bar | Further gain stops at 100; no second bar or stored overflow. |

Examples: a 7% hit awards 7 points to its attacker and 3 to its victim; a
3.5% hit awards 3 and 1. A 20% hit awards 12 and 6 because of the per-hit
caps. Ten 10% hits fill an attacker's bar; twenty such hits fill the victim's
bar. A fighter at 98 gains only 2 more points from a 10% hit.

## Ready signal

A thin segmented blue bar sits on each fighter's HUD plate. Two marks
divide it into its three segments, one EX each. The HUD is the only meter display;
fighters carry no duplicate overhead bar or pips.

At 100 points the bar glows gold continuously until the bar is spent or
drained. Crossing from below 100 to 100 flashes the fighter white for 12
frames and plays Warcraft's stock `Sound\Interface\ItemReceived.flac` once on
the confirmed frame (GameFound until #361: a 7.5-second fanfare that was
heard mid-match as a stray music clip). Replay and prediction never play the sound. A rise of
at least 3 points also gives the bar a short 12-update glow. The old
“EX Neutral + Side” affordability label is removed: a full bar pays for any
direction, so its glow carries the whole message. The full-bar glow is
also the ultimate's ready signal.

These cues reuse the game's white fighter flash and stock sound; they add
no imported art or audio. sim/mana.tests.ts and sim/exSpecials.tests.ts pin
the resource rules in Bun and Lua32. test/mana-bar.test.ts checks the Wisp
frames, fighter flash and ready sound log.

## Drain and refunds

Authored damage drains and steals operate on the same 100-point bar; gain still comes from body damage. Illidan's Mana Burn can
drain the opponent's stored meter and its stun reads the resulting bar.
Hero-specific spell refunds remain authored move effects; they never make
an ordinary special cost meter.

## Every special has an EX form (#329)

Tom's 8 October super-bar decision (#335), with the #382 segments:
ordinary specials are free; damage dealt and taken builds one bar, and one
segment buys one EX with Shield + Special in any direction. #335 owns the bar's
earning rules and display. This section owns the move upgrades.

Each EX keeps the base move's startup, active windows, recovery, landing lag,
entity limits, status immunity, once-per-airtime limit and helpless ending.
It also keeps the existing one-light-hit protection at entry. The upgrade
below adds reach, damage or utility to that same move; it does not turn a
special into an ultimate. Damage upgrades leave launch base and growth alone.
Travel upgrades scale the authored motion, including steering, while retaining
collision stops. Reach upgrades enlarge the existing strike/projectile, not
its active time. Status durations and healing caps stay unchanged.

| Fighter | Neutral EX | Side EX | Up EX | Down EX |
|---|---|---|---|---|
| Rifleman | Blaster deals 25% more damage. | Bear's strike deals 25% more damage. | Recoil travels 25% farther, including its second shot. | Freeze Trap has 25% more trigger reach, with the same freeze and f22 placement/f38 end. |
| Illidan | On the ground, Eye Blast: a 24-frame marked windup, then a floor beam to 645 (#379, docs/design/illidan.md); in the air, the Mana Burn orb has 25% more reach, its resource denial following #335. | Fel Rush and its branches deal 25% more damage. | Wing Ascent rises 25% farther; glide choices stay intact. | Immolation/Flame Crash deals 25% more damage. |
| Blademaster | Wind Cutter deals 25% more damage. | Wind Walk's Backstab deals 25% more damage. | Rising Whirlwind travels 25% farther. | Mirror Image has twice the durability; Image Swap deals 25% more damage. |
| Mountain King | Storm Bolt deals 25% more damage. | Storm Rush and Hammerfall deal 25% more damage. | Thunder Leap travels 25% farther. | Thunder Clap and its charged forms have 25% more reach. |
| Warden | Shadow Strike deals 25% more damage. | Pursuit Lunge/marked slash deals 25% more damage. | Blink travels 25% farther. | Fan of Knives has 25% more reach. |
| Lich | Frost Nova orb/burst has 25% more reach. | Death and Decay deals 25% more damage. | Spectral Ascent travels 25% farther. | Frost Armor absorbs a hit 25% heavier; Dark Ritual gains four protected entry frames. |
| Forsaken Paladin | Cleansing Hammer deals 25% more damage. | Righteous Fury deals 25% more damage. | Ascension travels 25% farther. | Consecration has 25% more reach. |
| Dreadlord | Carrion Swarm has 25% more reach. | Vampiric Pounce's bite deals 25% more damage, with the same heal cap. | Bat Ascension travels 25% farther. | Sleep orb has 25% more reach, with unchanged sleep and immunity. |
| Shadow Hunter | Spirit Glaive deals 25% more damage in both directions. | Serpent Ward shots deal 25% more damage; recall gains four protected entry frames. | Loa Vault travels 25% farther. | Hex orb has 25% more reach, with unchanged Hex and immunity. |
| Pit Lord | Howl of Terror has 25% more reach. | Ruin Charge deals 25% more damage. | Abyssal Leap travels 25% farther. | Rain of Fire deals 25% more damage. |
| Beastmaster | Wild Axes deal 25% more damage. | Bear has 25% more durability and bite damage; Stampede deals 25% more damage. | Hawk has 25% more durability; Hawk Lift travels 25% farther; grounded dive command gains four protected entry frames. | Quilbeast has 25% more durability and shot damage; volley command gains four protected entry frames. |
| Lich King | Howling Blast, deals 25% more damage. | Val'kyr Shadowguard deals 25% more damage. | Ascension of the Damned travels 25% farther. | Defile's radius, radial growth and maximum radius increase 25%; its tick rate stays unchanged. |
| Thrall | Chain Lightning deals 25% more damage. | Feral Spirit wolves deal 25% more damage. | Far Sight travels 25% farther. | Earthquake has 25% more reach. |
| Jaina | Frostbolt deals 25% more damage. | Blizzard deals 25% more damage. | Blink travels 25% farther. | Water Elemental has 25% more durability and shot damage; recall gains four protected entry frames. |
| Sylvanas | Black Arrow deals 25% more damage. | Silence has 25% more reach, with unchanged silence duration. | Banshee Flight travels 25% farther. | Life Drain deals 25% more damage, with the same heal cap. |
| Cairne | Shockwave deals 25% more damage. | War Stomp has 25% more reach. | Spirit Lift travels 25% farther. | Reincarnation's guard and matching intangibility last four more frames, with the same heal cap. |
| Chen | Breath of Fire has 25% more reach. | Drunken Haze has 25% more reach, with unchanged slow. | Storm Rise travels 25% farther. | Earth Stance absorbs a hit 25% heavier; Fire Palm/Storm Step deal 25% more damage. |
| Peon | Lumber Toss deals 25% more damage. | Burrow has 25% more durability and spear damage; Pack Up gains four protected entry frames. | Worksite Launch travels 25% farther. | Repair's guard and matching intangibility last four more frames, with the same heal cap. |
| Tinker | Cluster Rockets deal 25% more damage. | Pocket Factory has 25% more durability and goblin damage; recall gains four protected entry frames. | Rocket Boots travels 25% farther. | Robo-Goblin deals 25% more damage. |
| Kael'thas | Flamestrike's pillar deals 25% more damage. | Drain Mana deals 25% more damage; its steal is unchanged. | Phoenix travels 25% farther and leaves a summoned phoenix that burns nearby enemies for three seconds. | Banish has 25% more reach. |
| Murloc | Ensnare has 25% more reach, with unchanged slow. | Tidal Rush deals 25% more damage. | Tide Spout travels 25% farther. | Disease Cloud has 25% more reach, with unchanged poison duration and tick rate. |
| Grom | Warsong Cry deals 25% more damage with 15% more reach. | Gorehowl Rush deals 25% more damage and travels 25% farther. | Blood Leap rises and steers 25% farther. | Mannoroth's Bane deals 25% more damage. |
| Kobold | Wick Flick deals 25% more damage. | Panic Dig deals 25% more damage. | Candle Escape rises and steers 25% farther. | Mine! has 25% more reach on both sides. |

Ground, air, marked and recall forms use their matching upgrade. A
follow-up keeps the EX cast's upgrade and never buys a second EX. Authored EX
data is immutable; the existing replayed `special.ex` selects it. Projectiles
and placed objects retain the selected authored data after the cast ends.
The native models, sounds and animations remain the move's existing ones;
there are no new imports.

## Ultimates

[ultimates.md](ultimates.md) owns the ultimate moves. They spend the whole
shared bar; there is no second resource.
