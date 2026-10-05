# Object data and hot reload

smashcraft:ts/src/game/objectData.ts declares the three fighter units and the
FileIO ability. smashcraft:ts/scripts/objectData.ts encodes the same declaration
as war3map.w3u and war3map.w3a. The running map applies the fighter fields at
unit creation and reapplies them to retained units during each synchronized
bundle install. FileIO's tooltip buffers are initialized at start and reset
between complete reads on each install. Reload creates no unit or ability
handles.

| Declared field | Runtime application |
| --- | --- |
| Unit name (`unam`) | `BlzSetUnitName` |
| Model scale (`usca`) | `SetUnitScale` |
| Animation blend time (`uble`) | `SetUnitBlendTime` |
| Selection scale (`ussc`) | `BlzSetUnitRealField` with `UNIT_RF_SELECTION_SCALE` |
| Movement speed (`umvs`, integer) | `SetUnitMoveSpeed` |
| First attack cooldown (`ua1c`, seconds) | `BlzSetUnitAttackCooldown`, weapon index 0 |
| FileIO tooltip (`atp1`) | `BlzSetAbilityTooltip`; archive levels start at 1, native levels at 0 |

The fighter units are paused presentation handles. Smashcraft's movement and
combat rules live in its simulation; native speed and attack cooldown do not
retune those rules.

The following declaration changes still require a full build and fresh match.
These limits come from Waygate's installed Warcraft native declarations.

| Field | Missing runtime operation |
| --- | --- |
| Object ID and base (`id`, `base`) | No native creates or rebases a unit/ability *type*. `CreateUnit` only instantiates an existing type. |
| Model path (`umdl`) | No `BlzSetUnitModel` or model-path `unitstringfield`. `BlzSetUnitSkin` selects another existing type's skin, not an arbitrary imported model. |
| Art version (`uver`) | No art-version `unitintegerfield` or corresponding unit setter. |
| FileIO level count (`alev`) | No type-level ability-level-count setter. `BlzSetAbilityIntegerField` with `ABILITY_IF_LEVELS` requires an ability instance and does not replace the global FileIO type declaration. The level count is also Waygate's shared transport capacity. |

The archive's `wurs` value is retained encoder metadata, not a gameplay field.
Warcraft also has no unit collision-size setter or `UNIT_RF_COLLISION_SIZE`;
`SetUnitPathing` only toggles pathing. Smashcraft keeps native collision off and
uses its simulation's collision volumes, so collision size is not a declared
object override. New models, textures and sounds still require packaging.

For native acceptance, start a development build with two clients and a match,
then run `bun waygate hot --watch` with both clients' CustomMapData directories.
In smashcraft:ts/src/game/objectData.ts, change `moveSpeed` and
`attackCooldown`. Each install writes
`smashcraft-object-data-pSLOT.txt` in that client's CustomMapData directory:
the simulation frame, object-field checksum, confirmed match checksum, and the
native-read speed/cooldown for each retained handle. Compare both clients'
receipts and the hot command's edit-to-running duration. Handle IDs before and
after an edit establish that reload updated the original units. Restore the
declaration through the same hot reload after the trial.
