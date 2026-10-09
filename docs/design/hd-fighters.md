# Definitive match fighters

[#334](https://github.com/tompassarelli/smashcraft/issues/334) keeps the authored
moves and Classic bodies, and gives Definitive the stock Definitive body seen on the
victory screen. Cairne's dual-alias pilot passed native model loading,
team colour and a smoke round on Classic and Definitive clients in 3.0.1.
That establishes the body pipeline for parallel roster conversion.

## Stock textures

Each body is packaged under `_de.w3mod\war3mapImported\<Classic timeline name>`
and keeps the stock Definitive texture paths, so the map carries no texture
copies ([#346](https://github.com/tompassarelli/smashcraft/issues/346)). A
body's stock texture lookup stays in its own layer: the stock Definitive
textures (for example `units\orc\herotaurenchieftain\tauren_chieftain_diffuse.dds`)
exist only in `_de.w3mod`, so the earlier `_hd.w3mod` bodies drew solid team
colours ([#334](https://github.com/tompassarelli/smashcraft/issues/334#issuecomment-6071233652)).
Anub'arak's stock body names the base-only `ReplaceableTextures\TeamGlow\TeamGlow00`;
its body names the same glow's Definitive copy, `Textures\TeamGlow0000`.
Classic (`hd=0`) ignores `_de.w3mod` and draws the Classic body.

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
| Shadow Hunter | HeroShadowHunter → HeroShadowHunter | arms, legs, glaive → glaive, mask → mask; lower spine → chest |
| Pit Lord | HeroPitLord → HeroPitLord | arms, all four leg chains, polearm → polearm, wings → wings |
| Beastmaster | Beastmaster → Beastmaster | arms, legs, both axes → both axes |
| Lich King | authored LichKing2 → same approved Classic body | approved exception: helmet, cape and Frostmourne retain the existing custom identity in both graphics modes |
| Thrall | authored Thrall → Thrall | rider arms, hammer; rider pelvis → rider pelvis, mount root and all four legs → mount joints |
| Jaina | authored Jaina → Jaina | arms, legs, staff → staff, robe → robe |
| Sylvanas | authored EvilSylvanas → EvilSylvanas | arms, legs, bow → bow, cape → cape |
| Cairne | authored HeroTaurenChieftain → HeroTaurenChieftain | literal mapping below |
| Chen | authored PandarenBrewmaster → PandarenBrewmaster | arms, legs, staff → staff, keg → keg |
| Peon | authored Peon → Peon | arms, legs, tool → tool, sack → sack |
| Goblin Tinker | authored HeroTinker → HeroTinker | goblin arms/legs, pack root, every mechanical arm and claw, Robo-Goblin body |
| Kael’thas | authored HeroBloodElf → HeroBloodElf | arms, legs, cape → cape, orbiting props → orbiting props |
| Murloc | authored Murloc → Murloc | arms, legs, weapon → weapon, fins → fins |
| Grom | authored Hellscream → Hellscream | arms, legs, axe → axe, hair → hair |
| Anub’arak | authored Crypt Lord → Crypt Lord | root, chest, head, all leg chains, claws → claws, shell → shell |
| Malfurion | authored walking Furion → same approved Classic body | approved exception: walking staff fighter in both graphics modes |
| Medivh | authored Medivh → Medivh | arms, legs, staff → staff, cloak → cloak, raven → raven |
| Kobold | authored Kobold → Kobold | arms, legs, pick → pick, candle → candle |

The two approved exceptions keep their existing body in Definitive. The installed
stock model named Lich King is a one-bone frozen throne scene; playable stock
Arthas lacks the approved helmeted identity. The installed Definitive Malfurion
model includes a visible stag even under its `MalfurionNoStag` name, while the
approved fighter walks. Neither receives a replacement alias. These identity
choices may be revisited separately when a matching stock body is available.

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

Classic and Definitive share hit regions and hurt capsules, so each Definitive body
must visibly fill the same hurt capsules as Classic and put its hitting weapon or
limb inside the same hit regions on active frames. A body that can't takes its
Classic body in both looks, like the Lich King and Malfurion ([#362](https://github.com/tompassarelli/smashcraft/issues/362)).

`registerRig` (smashcraft:tools/animations/hd-retarget.ts) fixes each fighter's
registration from the two rest poses alone (Classic and stock Definitive Stand
Ready): the rig pairs, each mapped joint's rest alignment, the size fit and the
ground height. `transferMotion` applies it to the authored motion. #334's first
conversion pinned each Definitive joint to its Classic joint with the offset
between the two different Stand Ready poses, so Definitive limbs swung on long
levers, tore at the joints and pointed elsewhere: Shadow Hunter's forearm stood
94 degrees off Classic at rest and 143 degrees off at the forward tilt's hit (#362).

- **Rotation, not position.** Each mapped joint takes its Classic joint's turn from
  Stand Ready. Its rest direction (to the centroid of its mapped child joints) is
  first swung onto the Classic rest direction, and each frame the limb aims where
  its Classic child joint is, because Classic rigs also bend limbs by moving
  joints. Positions come from the Definitive skeleton's own bone lengths, so limbs
  keep their length and joints stay joined.
- **Ends.** A joint with no aimable child keeps its rest angle to its limb (hands,
  head); a joint in the floor band keeps its stock world stance (feet). A long rigid
  prop (weapon, staff, gun) points along its Classic counterpart's long axis, read
  from the vertices each carries, since its direction is the strike.
- **Whole-body helpers.** The Classic helper chain above the mapped skeleton
  (Attack Gesture, Jump/Drill/Recovery Motion: flips, squashes, drills) is the only
  copied part; it carries the body unchanged. The body keeps the stock node count
  plus that chain, under Warcraft's 255-node limit ([#346](https://github.com/tompassarelli/smashcraft/issues/346)).
- **Size fit and planting.** A fixed per-fighter scale makes the Definitive legs
  as long as the Classic legs (all limbs on a rig with no feet). Each frame the
  lowest skin of the mapped joints stands where the Classic body's does, so planted
  feet stay on the floor and a body lying down lies on it.
- **Rig pairs.** Map anatomy: clavicles stay with the chest, and the lower
  Definitive spine follows the Classic chest, which bends at the waist.

Every nonzero SKIN influence must address a BONE node (#319). The export bound
is unchanged: at every authored key time and sequence edge, the exported model's
mapped joints are within **0.5 Warcraft units** and **0.5 degrees** of the
transferred pose, after #314's thinning and #308's timeline export. Fail on an
unmapped required joint, singular transform, non-finite sample, empty track or
a body over 255 nodes. `bun tools/animations/hd-roster.ts PRIVATE_OUTPUT [CHARACTER...]`
converts every retargeted fighter from its stock Definitive model; one fighter
is `bun tools/animations/hd-models.ts`.

## Packaging and size

Place one Definitive body under `_de.w3mod/war3mapImported/<Classic timeline name>`.
The 3.0.1 native one-alias captures confirmed that Definitive accepts either
prefix alone; only `_de.w3mod` resolves the stock Definitive textures. Each player's graphics setting chooses the look locally;
the ordinary imported path remains Classic. Use the Definitive stock texture paths
and material team-colour slots, with no copied texture imports. Keep private
inputs outside Git; publish through the existing immutable family mechanism.
Merge only owned filenames into the latest family, preserving stage art,
including TombWaterfallHD and TombWaterfallDE, and other fighters' work.

Keep the [120 MB map budget](map-size.md#proposed-budget-120-mb). The #308 map
is 53,636,568 bytes; Definitive bodies receive **60,000,000 additional compressed
bytes**, leaving 6,363,432 bytes below 120,000,000. That is 2.31 MB compressed
per fighter for the 26-fighter roster. Cairne's passing pilot retained all three
geosets and 11,463 vertices across 85 clips and 3,309 pose samples. Its final
error was 0.305434 units / 0.281172 degrees, and its thinned timeline occupies
963,118 compressed bytes per alias. Export one mesh, reuse stock textures, remove
unused clips, and retain bounded thinning. If the pilot forecast exceeds the
allocation, stop at the measured miss instead of raising the budget.
The existing 10% growth gate remains; add an absolute 120,000,000-byte map
check and a 60,000,000-byte Definitive contribution check before shipping. Every
import reports its bytes and reason: authored moves cannot be played on the
unmodified stock Definitive model. Do not add another copy for each move or flash.
