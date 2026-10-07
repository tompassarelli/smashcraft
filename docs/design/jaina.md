# Jaina Proudmoore

Jaina is a zoner: she gives up ground speed and close-range pressure for a
straight frost bolt, a delayed patch of Blizzard and a destructible Water
Elemental. The opponent can jump the bolt, leave the marked patch or hit the
elemental; Jaina must choose which route to cover. Every number below is an
original provisional Smashcraft value except the explicitly named body facts.

## Sources and body

The Warcraft source is the [Archmage on Wowpedia][archmage], checked 8 October
2026: Blizzard is a maintained area spell; Summon Water Elemental creates a
temporary ranged ally; Brilliance Aura restores mana; Mass Teleport moves the
caster and allies. [Liquipedia's Archmage][liquipedia] independently describes
the elemental and mana regeneration as the hero's central combination. Jaina
uses the Reign of Chaos campaign model `units\\human\\Jaina\\Jaina.mdl`, the
Water Elemental, and existing Warcraft spell effects and sounds.

Her physical counterpart is [NTSC Melee Zelda][zelda]: weight **90**, run
speed **1.1**, air speed **0.95** in Smash units. Smashcraft's body multipliers
are therefore weight `90/75 = 1.2`, run `1.1/2.2 = 0.5`, air `0.95/1 = 0.95`.
Width is 0.90 and height 1.05 of the reference body. Shared jump, gravity,
dodge and ledge rules remain the roster defaults. A slow run makes a lost
position expensive; ordinary air drift helps her place aerials without
turning her into a rushdown fighter.

[Din's Fire][din] informs delayed ranged threat, [Robin's tomes][robin] inform
spells sharing a finite resource, and [Ice Climbers' Blizzard][blizzard]
informs the readable cold zone. [Nayru's Love][nayru] informs the defensive
neutral-air silhouette only: Jaina's neutral air does not reflect. Her aimed,
non-damaging recovery follows [Mewtwo's Teleport][teleport] and the exposed
arrival of [Farore's Wind][farore]. These are relationships and choices, not
copied frame data, hitboxes, animation or implementation.

## Normals

Frames are displayed frames: the first action tick is 1. `first/active/recovery`
counts the first active frame, active frames and recovery; aerial landing lag
is authored, then halved by the shared rule. All regions are original narrow
staff or spell paths. Jaina's hand remains hittable during a cast; magic
beyond the hand is disjoint. Damage uses the existing knockback formula.
Staff strikes and frost spells multiply their authored knockback growth by
1.125; this gives the slow zoner stronger launches without raising damage.

| Input | Action and decision | Frames | Damage | Warcraft source | Smash reference |
|---|---|---:|---:|---|---|
| Jab 1, 2 | Two short staff checks; disengage rather than sustained lock | 5/2/13; 5/2/17 | 3, 4 | [Archmage staff attack][archmage] | [Zelda jab's close magic][zelda] |
| Forward tilt, high/low | Staff-tip frost; angles cover a jump or crouch | 9/3/22 | 8 | [Blizzard ice][archmage] | [Zelda directional magic tilt][zelda] |
| Up tilt | Small rising ice arc; starts a juggle | 8/4/21 | 7 | [Blizzard][archmage] | [Zelda overhead sweep][zelda] |
| Down tilt | Low staff sweep; pops up for a read on DI | 7/3/18 | 6 | [Archmage staff attack][archmage] | [Zelda low poke][zelda] |
| Dash attack | Both palms push forward; commits her short advance | 11/4/26 | 10 | [Water Elemental's water attack][water] | [Zelda palm dash][zelda] |
| Forward smash | Long ice lance; kill attempt with a narrow vertical gap | 19/3/34 | 17 | [Blizzard ice][archmage] | [Zelda committed forward magic][zelda] |
| Up smash | Ice pillar overhead; loses to a grounded side approach | 18/4/34 | 16 | [Blizzard][archmage] | [Zelda overhead magic][zelda] |
| Down smash | Low frost bursts front then back; one hit per target | 17/6/32 | 13 | [Blizzard][archmage] | [Zelda two-sided sweep][zelda] |
| Neutral air | Short frost ring; defensive space with punishable landing | 8/5/24; land 16 | 8 | [Blizzard][archmage] | [Nayru's Love surrounding silhouette][nayru] |
| Forward air | Narrow forward frost lance; pushes an approach out | 12/3/26; land 18 | 12 | [Blizzard][archmage] | [Zelda precise forward aerial][zelda] |
| Back air | Quick rear staff strike; protects her retreat | 9/3/24; land 16 | 11 | [Archmage staff attack][archmage] | [Zelda rear aerial][zelda] |
| Up air | Ice bloom above her; juggle finish | 10/4/25; land 16 | 11 | [Blizzard][archmage] | [Zelda overhead aerial blast][zelda] |
| Down air | Downward icicle; meteor in air, diagonal launch on floor | 16/3/30; land 22 | 12 | [Blizzard][archmage] | [Zelda down aerial][zelda] |
| Get-up / ledge attack | Staff sweeps both sides / pushes off the ledge | shared roster timing | 6 / 7 | [Archmage staff attack][archmage] | [Zelda floor/ledge attacks][zelda] |

Smashes charge up to 45 frames for 1.25 damage. No normal has extra shield
damage. Down tilt and up throw start follow-ups; neither is described as a
guaranteed string. The victim can DI the launch, jump or dodge once released,
and choose all shared tech options on landing. Throw hitstun keeps regrabs
from becoming a loop.

## Grabs and throws

The grab is a short magical hold at frame 9 for two frames with 26 recovery;
the hand reaches 0.55 reference heights. Normal, dash and shield grabs share
the roster's entry rules. Hold, escape and release use the shared grab link.

| Input | Gesture and purpose | Contact / total | Damage | Warcraft source | Smash reference |
|---|---|---:|---:|---|---|
| Pummel | Small cold palm strike; the shared one-pummel/mash-escape rule | 60 / 68 | 3 | [Blizzard cold][archmage] | [Zelda pummel][zelda] |
| Forward throw | Water push; reclaim distance | 14 / 36 | 8 | [Water Elemental attack][water] | [Zelda levitation throw][zelda] |
| Back throw | Turn and sweep the victim behind; edgeguard setup | 17 / 41 | 9 | [Water Elemental attack][water] | [Zelda reverse throw][zelda] |
| Up throw | Lift on a water spout; short juggle launcher | 15 / 25 | 7 | [Water Elemental attack][water] | [Zelda up throw][zelda] |
| Down throw | Press onto ice; diagonal tech chase | 19 / 43 | 6 | [Blizzard][archmage] | [Zelda down throw][zelda] |

## Specials, passive and ultimate

| Input | Behavior and cost | Risk and response | Warcraft source | Smash reference |
|---|---|---|---|---|
| Neutral: Frostbolt | 6 mana, bolt at frame 17, end 37; 7 damage, 0.12H/frame, life 64, radius 0.12H; ground/air, air landing 20 | One live bolt; reflectable; jump, shield or close before release | [Archmage ranged magic / Blizzard][archmage] | [Robin's Thunder and spell resource][robin] |
| Side: Blizzard | 18 mana; mark at frame 8, 1.6H ahead; first ice at frame 28, second at 52; 5 then 8 damage, radius 0.55H; end 48, air landing 20 | The visible mark precedes damage by 20 frames; interrupt Jaina or leave it; first hit does not freeze | [Blizzard's maintained area spell][archmage] | [Din's Fire delayed placement][din], [Ice Climbers' Blizzard][blizzard] |
| Up: Blink | 15 mana; choose one of eight directions through frame 13, move 2.4H on frame 14, end 34; intangible frames 14–17, no attack | Startup and arrival exposed; spends aerial jump, once per airtime, then helpless; empty-mana form moves 1.65H | [Mass Teleport adapted to personal recovery][archmage] | [Mewtwo Teleport][teleport], [Farore's Wind][farore] |
| Down: Summon Water Elemental | Ground only; 24 mana, place at frame 27, end 52; 24 durability, life 240; four 5-damage straight shots at ages 36/84/132/180; free recast recalls | Long exposed setup; opponent can destroy it; one elemental, shots stop when Jaina is held or in hitstun | [Summon Water Elemental][water] | [Robin resource commitment][robin], [Zelda delayed coverage][din] |
| Passive: Brilliance Aura | Eligible idle/movement frames regenerate 6 mana/sec grounded and 2 airborne, versus roster 4/1.5 | Still stops while casting, shielding, grabbed or stunned; spells cannot fund endless casting | [Brilliance Aura][archmage] | [Robin finite spell resource][robin] |
| Ultimate: Mass Teleport | Design for optional ultimates: take Jaina and nearby allies to her elemental after a visible channel | Same roster shape as existing heroes: named design only; the shared game has no ultimate action and competitive ultimates remain off | [Mass Teleport][archmage] | [Farore's Wind location change][farore] |

The computer keeps 1.6–2.8H spacing, alternates bolt and Blizzard, establishes
an elemental when safe, uses staff checks when rushed and saves Blink for
recovery. It chooses the teleport direction toward the stage and uses its
jump before a last-chance teleport. All actions use the shared simulation,
projectile/placement limits, mana and snapshot state.

## Distinct place in the roster

Unlike Archer and Rifleman, Jaina pays for persistent positional threats.
Unlike Illidan, Blademaster and Warden, she cannot chase on foot. Mountain
King and Uther survive close exchanges; Jaina must escape them. Lich detonates
an orb and manages a shell; Jaina layers a straight shot with an independent,
destructible elemental. Dreadlord grabs, Shadow Hunter debuffs, Pit Lord
pressures with size, Beastmaster commands a melee companion and Lich King
spends souls; Jaina does none of those. Her gains come from occupying space
before the opponent enters it, not trapping input or winning trades.

[archmage]: https://wowpedia.fandom.com/wiki/Archmage_(Warcraft_III)
[liquipedia]: https://liquipedia.net/warcraft/Archmage
[water]: https://wowpedia.fandom.com/wiki/Water_Elemental_(Warcraft_III)
[zelda]: https://www.ssbwiki.com/Zelda_(SSBM)
[din]: https://www.ssbwiki.com/Din%27s_Fire
[nayru]: https://www.ssbwiki.com/Nayru%27s_Love
[farore]: https://www.ssbwiki.com/Farore%27s_Wind
[teleport]: https://www.ssbwiki.com/Teleport
[blizzard]: https://www.ssbwiki.com/Blizzard
[robin]: https://www.ssbwiki.com/Robin_(SSBU)
