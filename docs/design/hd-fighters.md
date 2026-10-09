# Definitive match fighters

**Definitive is the first-class look and Classic the fallback, per fighter**
([#366](https://github.com/tompassarelli/smashcraft/issues/366)). Each fighter's
moves are stored once on the canonical rig, and its Classic and Definitive bodies are
both generated from that motion. A fighter's Definitive body ships only when it
passes [Definitive approval](#definitive-approval); otherwise the fighter draws its
Classic body in both looks. [#334](https://github.com/tompassarelli/smashcraft/issues/334)
established the stock Definitive body pipeline; Cairne's dual-alias pilot passed
native model loading, team colour and a smoke round in 3.0.1.

## Canonical rig

Decided with Tom on 9 October (#366): one motion source drives both bodies, in the
manner of HumanIK or Mixamo retargeting. Edit a move once and both looks change; no
look is tuned by hand.

- **The rig.** `HUMANOID_JOINTS` (smashcraft:tools/animations/canonical-rig.ts) is
  a neutral humanoid: `root`, `pelvis`, `chest`, `neck`, `head`, and per side
  `clavicle`, `shoulder`, `elbow`, `wrist`, `hip`, `knee`, `ankle` and `toe`
  (`shoulder.L`, ...), plus `weapon` and `weapon.L`. A fighter's other animated
  parts (wings, tails, capes, mounts, beards) are its own secondary joints, named
  as in its source.
- **Canonical motion.** `canonicalMotion` stores a fighter's moves on the rig, with
  its mesh as the reference silhouette that bodies plant and fit against. Its first
  source is today's authored Classic model, so the canonical proportions are
  Classic's for now.
- **Mapping, once per fighter.** Each `hd-rigs/<fighter>.ts` exports only
  `character`, `stockPath`, `classic` (humanoid joint → Classic node), `pairs`
  (rig joint → Definitive bone, any number per joint) and the body fit
  (`fitScale`, `limbScales`, `visibilityPairs`). It names no move, sequence or frame.
  In canonical motion a rig joint's node is named `@<joint>` (`rigNode`), so it never collides with a
  source node such as Illidan's own `pelvis`; Definitive bones that no pair
  names keep their stock pose under their nearest mapped parent.
- **Both bodies are generated.** `fighterBodies` (smashcraft:tools/animations/hd-models.ts)
  writes the Classic timeline body through the Classic mapping and the Definitive
  body through #362's `retargetHd`. Gameplay timing and boxes come from the
  simulation, so they are identical in both looks.
- **Checks.** smashcraft:ts/test/canonical-rig.test.ts checks every mapping for
  per-fighter fields only, and checks that editing one canonical move changes that
  move in both exported bodies and no other move. Its per-fighter sweeps rebuild
  all 26 shipped Classic bodies and all 24 converted Definitive bodies from canonical
  motion, byte for byte against the published family.

Not yet done: sizing the gameplay boxes to the rig at Definitive proportions and
fitting Classic to them.

## Stock textures

Each body is packaged under `_de.w3mod\war3mapImported\<Classic timeline name>`
and keeps the stock Definitive texture paths, so the map carries no texture
copies ([#346](https://github.com/tompassarelli/smashcraft/issues/346)). A
body's stock texture lookup stays in its own layer: the stock Definitive
textures (for example `units\orc\herotaurenchieftain\tauren_chieftain_diffuse.dds`)
exist only in `_de.w3mod`, so the earlier `_hd.w3mod` bodies drew solid team
colours ([#334](https://github.com/tompassarelli/smashcraft/issues/334#issuecomment-6071233652)).
Anub'arak's stock body names the base-only `ReplaceableTextures\TeamGlow\TeamGlow00`;
its body names the same glow's Definitive copy, `Textures\TeamGlow0000.dds`.
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

Lich King and Malfurion have no Definitive mapping and keep their Classic body in
Definitive. The installed stock model named Lich King is a one-bone frozen throne
scene, and playable stock Arthas lacks the approved helmeted identity. The installed
Definitive Malfurion model includes a visible stag even under its `MalfurionNoStag`
name, while the approved fighter walks. These identity choices may be revisited
separately when a matching stock body is available.

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
Classic body in both looks ([#362](https://github.com/tompassarelli/smashcraft/issues/362), [Definitive approval](#definitive-approval)).

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
  as long as the Classic legs (all limbs on a rig with no feet). The rig
  can additionally calibrate `fitScale` against the rendered head and body:
  equal limb lengths do not ensure that the torso fills the shared hurt capsules.
  `limbScales` uniformly fits an arm and its attached hand or weapon about the
  shoulder when its proportions differ from Classic; it leaves the torso and legs
  in place. Legged bodies plant visible leg and foot surfaces against Classic after
  the whole-body turn. Props, glows, unused vertices and hidden meshes do not set
  foot height; a wholly hidden frame has no support to plant. Floating bodies keep
  their reference height and authored whole-body squash.
  An optional named anchor fits sibling skin branches about the same attachment;
  Thrall's tail and its three scale branches use their common tail base.
- **Rig pairs.** Map anatomy: clavicles stay with the chest, and the lower
  Definitive spine follows the Classic chest, which bends at the waist.

Every nonzero SKIN influence must address a BONE node (#319). The export bound
is unchanged: at every authored key time and sequence edge, the exported model's
mapped joints are within **0.5 Warcraft units** and **0.5 degrees** of the
transferred pose, after #314's thinning and #308's timeline export. Fail on an
unmapped required joint, singular transform, non-finite sample, empty track or
a body over 255 nodes. `bun tools/animations/hd-roster.ts PRIVATE_OUTPUT [CHARACTER...]`
writes every fighter's bodies from its canonical motion: the Classic timeline body, and
the Definitive body for each fighter in `DEFINITIVE_FIGHTERS`.

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

## Definitive approval

A fighter's Definitive body ships only if every move passes, with no hand edits (#366):
1. It reads clearly at gameplay zoom, at mainstream fighting-game quality: the
   [#367 scorecard](../animation-scorecard.md), lines 1–5, in Definitive.
2. Nothing twists, tears or slides.
3. The silhouette covers its hurt capsules at idle and key frames.
4. The hitting limb or weapon is inside the hit region on the first active frame.

Moving a fighter between looks is one entry in `DEFINITIVE_FIGHTERS`
(smashcraft:ts/src/game/assets/definitiveFighters.ts). The map imports a fighter's
`_de.w3mod` body only when it is listed; a fighter that is not listed draws its
Classic body in Definitive. The exporter writes Definitive bodies only for listed fighters.

9 October judgement of the 690fa4ef family: criteria 2–4 come from #362's textured
captures, judged by an agent that did not author the bodies. Criterion 4 fails when
the conversion leaves a gap of more than about 3 units where Classic is inside the
region (`surfaceOverlapDistance`, first active frame). Criterion 1 is
`bun wisp anim score --graphics definitive`
(smashcraft:tools/move-data/anim-score/definitive.tsv): moves passing lines 1–4, and
mean shortfall in Definitive and Classic. Line 5 has no judgement yet. No fighter
passes criterion 1 in either look: the source animations are the limit, which
[#180](https://github.com/tompassarelli/smashcraft/issues/180) tracks. Decision
(9 October): a fighter is Definitive when it passes criteria 2–4.

| ID | Fighter | 1: Definitive / Classic moves passing, shortfall | 2 | 3 | 4 | Flag |
|---|---|---|---|---|---|---|
| 1 | Rifleman | 0/16, 11.22 / 0/16, 10.02 | pass | pass | pass | Definitive |
| 2 | Illidan | 0/16, 12.69 / 0/16, 10.57 | pass | pass | pass | Definitive |
| 3 | Blademaster | 0/18, 3.53 / 0/18, 3.29 | pass | pass | pass | Definitive |
| 4 | Mountain King | 1/20, 3.04 / 0/20, 2.61 | pass | pass | **fail**: first-active reach 107 → 62 on forward tilt, hammer tucked in | Classic |
| 5 | Warden | 0/20, 5.34 / 0/20, 5.13 | pass | pass | pass | Definitive |
| 6 | Lich | 0/18, 6.72 / 0/18, 3.04 | pass | pass | **fail**: jab +6.94 (Classic −7.99), jab 2 +5.04 (−7.72) | Classic |
| 7 | Forsaken Paladin | 0/20, 2.16 / 0/20, 2.81 | pass | pass | pass (republished in c1d12775; up smash keeps its hop) | Definitive |
| 8 | Dreadlord | 0/19, 4.63 / 0/19, 4.51 | pass | pass | pass | Definitive |
| 9 | Shadow Hunter | 0/19, 13.06 / 0/19, 14.44 | pass | pass | pass | Definitive |
| 10 | Pit Lord | 0/20, 3.53 / 3/20, 3.01 | pass | pass | pass | Definitive |
| 11 | Beastmaster | 0/18, 4.79 / 0/18, 5.17 | pass | pass | **fail**: down air +4.60 (Classic −4.46), angled-up forward tilt +4.89 (−6.48) | Classic |
| 12 | Lich King | — | — | — | — | Classic (no Definitive mapping) |
| 13 | Thrall | 0/19, 3.70 / 0/19, 3.76 | pass | pass | pass | Definitive |
| 14 | Jaina | 0/18, 7.00 / 0/18, 7.51 | pass | pass | **fail**: angled-up forward tilt +9.44 (Classic −1.34), down air +3.76 (−0.63) | Classic |
| 15 | Sylvanas | 0/19, 7.88 / 0/19, 7.00 | pass | pass | pass | Definitive |
| 16 | Cairne | 0/19, 5.53 / 0/19, 5.39 | pass | pass | pass | Definitive |
| 17 | Chen | 0/20, 9.36 / 0/20, 8.58 | pass | pass | pass | Definitive |
| 18 | Peon | 0/17, 9.43 / 0/17, 9.25 | pass | pass | pass | Definitive |
| 19 | Goblin Tinker | 0/20, 7.29 / 0/20, 7.00 | pass | pass | pass | Definitive |
| 20 | Kael'thas | 0/20, 3.06 / 0/20, 2.97 | pass | pass | pass | Definitive |
| 21 | Murloc | 0/20, 4.77 / 0/20, 5.70 | pass | pass (body larger than Classic) | pass | Definitive |
| 22 | Grom | 0/20, 5.44 / 0/20, 4.71 | pass | pass | pass | Definitive |
| 23 | Anub'arak | 2/19, 2.93 / 0/19, 3.11 | pass | pass | pass | Definitive |
| 24 | Malfurion | — | — | — | — | Classic (no Definitive mapping) |
| 25 | Medivh | 0/20, 7.99 / 0/20, 5.98 | pass | pass | pass (down air +2.65, marginal) | Definitive |
| 26 | Kobold | 0/20, 3.21 / 0/20, 2.44 | pass | pass | pass | Definitive |

Forsaken Paladin's body in the 690fa4ef family was converted by a reader that ignored the
Classic model's skin weights. It was republished from the canonical motion in the c1d12775
family and judged again by a fresh agent on criteria 2–4. Its first-active hit gaps stay within
about 1 unit of Classic. Its criterion 1 numbers come from the earlier body.

Run and roll sliding was not judged for most fighters, and later active frames were
not measured. Lich's criterion 4 result overturns #362's pass.
