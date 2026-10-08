# Definitive match fighters

[#334](https://github.com/tompassarelli/smashcraft/issues/334) keeps the authored
moves and Classic bodies, and gives Definitive the stock Definitive body seen on the
victory screen. Convert Cairne first; only a passing Cairne enables parallel
conversion of the remaining fighters. No new moves, meshes or textures.

## Rig correspondence

Map anatomical roles, never bone indices or similar-looking names alone.
The table specifies the source rig and target stock Definitive rig per fighter; each
arrow maps the corresponding Classic and Definitive joints. Arms include shoulder,
upper arm, forearm and hand; legs include hip, every knee/hock, and foot.
Chest, pelvis, neck, head and root are mapped on every humanoid. The converter
must resolve each role to a literal pair of names and reject missing pairs.

| Fighter | Classic → stock Definitive rig | Additional correspondence |
| --- | --- | --- |
| Rifleman | authored Rifleman → Human Rifleman | arms, legs, gun → gun, beard → beard |
| Illidan | authored Demon Hunter → Demon Hunter | arms, legs, both blades → both blades, wings → wings |
| Blademaster | HeroBlademaster → HeroBlademaster | arms, legs, sword → sword, banner → banner |
| Mountain King | HeroMountainKing → HeroMountainKing | arms, legs, hammer → hammer, axe → axe |
| Warden | HeroWarden → HeroWarden | arms, legs, blade → blade, cape → cape |
| Lich | HeroLich → HeroLich | arms, floating pelvis, robe → robe |
| Forsaken Paladin | authored Classic Forsaken Paladin → stock Definitive Forsaken Paladin | 121 common bones of 125 with identical parents; pivots differ, so preserve stock sword and verify the reference transforms |
| Dreadlord | HeroDreadLord → HeroDreadLord | arms, legs, each wing chain → wing chain |
| Shadow Hunter | HeroShadowHunter → HeroShadowHunter | arms, legs, glaive → glaive, mask → mask |
| Pit Lord | HeroPitLord → HeroPitLord | arms, all four leg chains, polearm → polearm, wings → wings |
| Beastmaster | Beastmaster → Beastmaster | arms, legs, both axes → both axes |
| Lich King | authored LichKing2 → stock Lich King | arms, legs, sword → sword, cape → cape; verify stock identity before export |
| Thrall | authored Thrall → Thrall | rider arms, hammer; rider pelvis → rider pelvis, mount root and all four legs → mount joints |
| Jaina | authored Jaina → Jaina | arms, legs, staff → staff, robe → robe |
| Sylvanas | authored EvilSylvanas → EvilSylvanas | arms, legs, bow → bow, cape → cape |
| Cairne | authored HeroTaurenChieftain → HeroTaurenChieftain | literal mapping below |
| Chen | authored PandarenBrewmaster → PandarenBrewmaster | arms, legs, staff → staff, keg → keg |
| Peon | authored Peon → Peon | arms, legs, tool → tool, sack → sack |
| Goblin Tinker | authored HeroTinker → HeroTinker | goblin arms/legs, pack root, every mechanical arm and claw, Robo-Goblin body |
| Kael’thas | authored HeroBloodElf → HeroBloodElf | arms, legs, cape → cape, orbiting props → orbiting props |
| Murloc | authored Murloc → Murloc | arms, legs, weapon → weapon, fins → fins |

Cairne's installed Definitive model (3.0.1) has 91 bones and is 1,726,676 bytes.
Its 27 literal pairs are `Root → root`, `Bone_Chest → bone_chest`,
`Bone_Neck → neck`, `Bone_Head → bone_head`, `Bone_Pelvis → pelvis`,
`Bone_Totum → totem`, `Axe → weapon`,
`Bone_ClavicalL/R → scapula_L/R`,
`Bone_UpperArmL/R → scapula_L/R|shoulder_l`,
`Bone_LowerArmL/R → elbow_L/R`, `Bone_HandL/R → wrist_L/R`,
`Bone_UpperlegL/R → hip_L/R`, `Bone_Leg2L/R → knee_L/R`,
`Bone_Leg3L/R → ankle_L/R`, `Bone_FootL/R → toes_L/R`, and
`Bone_Tail1..4 → tail1..4`. Only three bone names are shared between the
Classic and Definitive rigs; naming similarity is not a rig map.
Definitive fingers, facial joints, twist bones, beard and skirt branches inherit
the nearest mapped parent while keeping their reference pose.
Weapons are independent
targets, so they retain the authored hand-to-weapon relationship.

## Conversion and the measured bound

Evaluate the Classic authored source and stock Definitive reference pose. Transfer
each mapped joint's world-space motion relative to that reference, then solve
local transforms through the Definitive hierarchy. Preserve Definitive mesh, skin weights,
materials, bind matrices, and team-colour layers. Different body proportions
make raw Classic and Definitive bind positions different: compare the transferred
motion in the common reference frame, not those different bind positions.
This registration is fixed per fighter, never fitted per move or sample.

At every authored key time and sequence edge, compare the exported model's
evaluated mapped transforms against the registered Classic reference:
maximum position error **0.5 Warcraft units**, maximum quaternion angular
error **0.5 degrees**. Check the hand/weapon attachment too. Fail on an
unmapped required joint, singular transform, non-finite sample or empty track.
Use the same renderer evaluator as #308/#314, serialize and parse before
measuring, and report the worst fighter/move/joint/time. Definitive-only joints keep
their reference local transform; they are not falsely counted as Classic
correspondences. A Definitive frame and its stock victory look must also agree
on body, equipment and team colour.

Keep sequence indices and millisecond intervals. Run #314's thinning against
the unthinned retargeted reference, then #308's timeline export, with a final
comparison against the original registered motion so errors cannot accumulate
past 0.5/0.5. Keep one Definitive mesh and only production-played keys. Stock camera,
collision and emitter chunks do not belong in a match body; Cairne's version
1800 camera chunk is not accepted by the pinned 4.0.1 model parser.

## Packaging and size

Place the same Definitive body under both `_de.w3mod/war3mapImported/<Classic timeline name>`
and `_hd.w3mod/war3mapImported/<Classic timeline name>` until native captures
confirm Definitive's lookup. Each player's graphics setting chooses the look locally;
the ordinary imported path remains Classic. Use the Definitive stock texture paths
and material team-colour slots, with no copied texture imports. Keep private
inputs outside Git; publish through the existing immutable family mechanism.
Merge only owned filenames into the latest family, preserving stage art,
including TombWaterfallHD and TombWaterfallDE, and other fighters' work.

Keep the [120 MB map budget](map-size.md#proposed-budget-120-mb). The #308 map
is 53,636,568 bytes; Definitive bodies receive **60,000,000 additional compressed
bytes**, leaving 6,363,432 bytes below 120,000,000. That is 2.73 MB compressed
per fighter on average. Cairne's 1.73 MB stock file is a raw input, not a
compressed-body forecast; his pilot must measure mesh, authored keys and final
MPQ contribution before fanout. Export one mesh, reuse stock textures, remove
unused clips, and retain bounded thinning. If the pilot forecast exceeds the
allocation, stop at the measured miss instead of raising the budget.
The existing 10% growth gate remains; add an absolute 120,000,000-byte map
check and a 60,000,000-byte Definitive contribution check before shipping. Every
import reports its bytes and reason: authored moves cannot be played on the
unmodified stock Definitive model. Do not add another copy for each move or flash.
