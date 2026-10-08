# HD match fighters

[#334](https://github.com/tompassarelli/smashcraft/issues/334) keeps the authored
moves and Classic bodies, and gives Reforged the stock HD body seen on the
victory screen. Convert Cairne first; only a passing Cairne enables parallel
conversion of the remaining fighters. No new moves, meshes or textures.

## Rig correspondence

Map anatomical roles, never bone indices or similar-looking names alone.
The table specifies the source rig and target stock HD rig per fighter; each
arrow maps the corresponding Classic and HD joints. Arms include shoulder,
upper arm, forearm and hand; legs include hip, every knee/hock, and foot.
Chest, pelvis, neck, head and root are mapped on every humanoid. The converter
must resolve each role to a literal pair of names and reject missing pairs.

| Fighter | Classic → stock HD rig | Additional correspondence |
| --- | --- | --- |
| Archer | authored Archer → Night Elf Archer | arms, legs, bow → bow, cape → cape |
| Rifleman | authored Rifleman → Human Rifleman | arms, legs, gun → gun, beard → beard |
| Illidan | authored Demon Hunter → Demon Hunter | arms, legs, both blades → both blades, wings → wings |
| Blademaster | HeroBlademaster → HeroBlademaster | arms, legs, sword → sword, banner → banner |
| Mountain King | HeroMountainKing → HeroMountainKing | arms, legs, hammer → hammer, axe → axe |
| Warden | HeroWarden → HeroWarden | arms, legs, blade → blade, cape → cape |
| Lich | HeroLich → HeroLich | arms, floating pelvis, robe → robe |
| Forsaken Paladin | authored ForsakenPaladin → stock Forsaken Paladin | arms, legs, added hammer → stock hammer; verify stock identity before export |
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

Cairne's installed HD model (3.0.1) has 131 bones and is 5,340,522 bytes.
Its literal pairs are `Bone_Chest → bone_chest`, `Bone_Neck → neck_bind_jnt`,
`Bone_Head → bone_head`, `Bone_Pelvis → pelvis_bind_jnt`,
`Bone_Totum → totem_bind_jnt`, `Axe → weapon_bind_jnt`,
`Bone_ClavicalL/R → L/R_shoulder_bind_jnt`,
`Bone_UpperArmL/R → L/R_upr_arm_bind_jnt`,
`Bone_LowerArmL/R → L/R_lwr_arm_bind_jnt`,
`Bone_HandL/R → bone_hand_left/right`,
`Bone_UpperlegL/R → L/R_leg_01_bind_jnt`,
`Bone_Leg2L/R → L/R_leg_02_bind_jnt`,
`Bone_Leg3L/R → L/R_leg_03_bind_jnt`,
`Bone_FootL/R → bone_leg_left/right`, and
`Bone_Tail1..4 → tail_01..04_bind_jnt`.
The Classic `Main`/`Root` chain supplies motion to both separate HD body roots
(`bone_turret`, `pelvis_bind_jnt`) through world-space evaluation. HD fingers,
facial joints, twist bones, tassels and skirt branches inherit the nearest
mapped parent while keeping their HD reference pose. Weapons are independent
targets, so they retain the authored hand-to-weapon relationship.

## Conversion and the measured bound

Evaluate the Classic authored source and stock HD reference pose. Transfer
each mapped joint's world-space motion relative to that reference, then solve
local transforms through the HD hierarchy. Preserve HD mesh, skin weights,
materials, bind matrices, and team-colour layers. Different body proportions
make raw Classic and HD bind positions different: compare the transferred
motion in the common reference frame, not those different bind positions.
This registration is fixed per fighter, never fitted per move or sample.

At every authored key time and sequence edge, compare the exported model's
evaluated mapped transforms against the registered Classic reference:
maximum position error **0.5 Warcraft units**, maximum quaternion angular
error **0.5 degrees**. Check the hand/weapon attachment too. Fail on an
unmapped required joint, singular transform, non-finite sample or empty track.
Use the same renderer evaluator as #308/#314, serialize and parse before
measuring, and report the worst fighter/move/joint/time. HD-only joints keep
their reference local transform; they are not falsely counted as Classic
correspondences. A Reforged frame and its stock victory look must also agree
on body, equipment and team colour.

Keep sequence indices and millisecond intervals. Run #314's thinning against
the unthinned retargeted reference, then #308's timeline export, with a final
comparison against the original registered motion so errors cannot accumulate
past 0.5/0.5. Keep one HD mesh and only production-played keys. Stock camera,
collision and emitter chunks do not belong in a match body; Cairne's version
1800 camera chunk is not accepted by the pinned 4.0.1 model parser.

## Packaging and size

Place the HD body under `_hd.w3mod/war3mapImported/<Classic timeline name>`;
the ordinary imported path remains Classic. Use the HD stock texture paths
and material team-colour slots, with no copied texture imports. Keep private
inputs outside Git; publish through the existing immutable family mechanism.
Merge only owned filenames into the latest family, preserving stage art,
including TombWaterfallHD and TombWaterfallDE, and other fighters' work.

Keep the [120 MB map budget](map-size.md#proposed-budget-120-mb). The #308 map
is 53,636,568 bytes; HD bodies receive **60,000,000 additional compressed
bytes**, leaving 6,363,432 bytes below 120,000,000. That is 2.73 MB compressed
per fighter on average. Cairne's 5.34 MB stock file is a raw input, not a
compressed-body forecast; his pilot must measure mesh, authored keys and final
MPQ contribution before fanout. Export one mesh, reuse stock textures, remove
unused clips, and retain bounded thinning. If the pilot forecast exceeds the
allocation, stop at the measured miss instead of raising the budget.
The existing 10% growth gate remains; add an absolute 120,000,000-byte map
check and a 60,000,000-byte HD contribution check before shipping. Every
import reports its bytes and reason: authored moves cannot be played on the
unmodified stock HD model. Do not add another copy for each move or flash.
