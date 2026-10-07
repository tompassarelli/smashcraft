# Down airs

A down air attacks below the fighter's waist and presents its attacking limb,
weapon or spell downward. It need not spike. Position is in world units relative
to the fighter's foot origin: positive x is forward and positive z is up. The
standing capsule's midpoint `(z1 + z2) / 2` is the measured waist. The table
includes all airborne active strike regions, including secondary drill hits.

References supply the gesture, without imported animations or matching combat
numbers. Seven stock swings/casts were replaced by original preparation,
downward contact and recovery poses, fitted to the existing move frames.

| Fighter | Strike centre x | Strike centre z / waist | Clip | Reference gesture | Before → current |
| --- | ---: | ---: | --- | --- | --- |
| Archer | 0 | -95 / 46 | Aerial Down #1 | Melee Ganondorf stomp | Pass → Pass: extended boot |
| Rifleman | 0 | -95 / 32.5 | Aerial Down #1 | Melee Link thrust, adapted to rifle | Pass → Pass: muzzle-first stamp |
| Illidan | 0 | -100 / 68.875 | Aerial Down #1 | Melee Link thrust, adapted to glaives | Pass → Pass: blades below torso |
| Blademaster | -42.24…42.24 | -51 / 49.30 | Down Air Sword Plunge #54 | Melee Link downward sword | Fail → Pass: horizontal spin replaced by downward sword |
| Mountain King | 0 | -26.8 / 33.7 | Down Air Boot Stomp #66 | Melee Ganondorf double-foot stomp | Fail → Pass: cast replaced by boots driven down |
| Warden | -37.19…37.19 | -37 / 48.4 | Drill Down Air #38 | Melee Fox drill | Pass → Pass: leading leg down, opposite knee folded |
| Lich | 0 | -53.8 / 66.88 | Down Air Frost Press #49 | Ultimate Ivysaur burst below body | Fail → Pass: coiled hands and body dive into a downward cast |
| Uther | -12…17 | -41.8…-32.5 / 45.4 | Down Air Hammer Drop #52 | Melee Link thrust, adapted to hammer | Fail → Pass: hammer down, opposite knee tucked |
| Dreadlord | 0…12 | -47.8 / 53.5 | Down Air Claw Dive #51 | Melee Ganondorf contact below torso, adapted to claws | Fail → Pass: claws driven down from coil |
| Shadow Hunter | -45.09…45.09 | -42 / 53.2 | Drill Down Air #40 | Melee Fox drill, adapted to glaive | Pass → Pass: leading leg below torso |
| Pit Lord | -20…20 | -26 / 53.5 | Down Air Four Hooves #56 | Melee Ganondorf stomp, adapted to four hooves | Fail → Pass: cleave replaced by hoof stomp |
| Beastmaster | -7.5…15 | -35.3…-32.8 / 59.56 | Down Air Twin Axe Drop #49 | Melee Link thrust, adapted to axes | Fail → Pass: axe heads below torso |
| Lich King | 4…8 | -20…-15 / 60.28 | Aerial Down #40 | Melee Link downward sword | Pass → Pass: authored downward blade |

Sources: [Link in Melee](https://www.ssbwiki.com/Link_(SSBM)),
[Ganondorf in Melee](https://www.ssbwiki.com/Ganondorf_(SSBM)),
[Fox's Melee down air](https://www.ssbwiki.com/Fox_(SSBM)/Down_aerial),
[Ivysaur's Ultimate down air](https://www.ssbwiki.com/Ivysaur_(SSBU)/Down_aerial).
The current verdict records the authoring and headless silhouette review in both
facings. The Lich casts through a 60-degree body dive at contact, with the existing shoulder and palm coil; its other 50 clips remain unchanged.

From ts/, `GAME_TESTS=downAir bun test test/game.test.ts` checks every selectable
fighter's active strike centres and exact downward clip. Both checks also run
in `LUA=PATH bun scripts/lua-tests.ts`. This repair changes no combat values.

From the root, `bun tools/animations/down-air-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT`
appends seven clips and generates downAirClipInfo.ts. Store hero-models, then
Use `--character 6` to reauthor only Lich while keeping later appended clips and all other fighters unchanged.
refresh the original clip pool through the existing exporter.
`bun tools/animations/down-air-captures.ts PRIVATE_ASSETS PRIVATE_OUTPUT` samples
the real simulation and pose selection at preparation, first/middle/last active
and early recovery in both facings, writing one private sheet per fighter and
a numerical inventory. Images remain outside Git.
