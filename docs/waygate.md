# Waygate capabilities

This reference covers the compiler, standard-library and tooling operations
named in [Smashcraft #38](https://github.com/tompassarelli/smashcraft/issues/38).
It compares the selected Warcraft Lua workflow and the operations Smashcraft
uses. VS Code extension features are outside that comparison. The issue owns
its completion status; the observations below retain their original build and
sample size.

## Tool identities

The final Wurst declaration, retained in Smashcraft Git at
`9c41440^:wurst-toolchain.lock`, selected:

| Component | Immutable identity |
| --- | --- |
| Compiler | `https://github.com/tompassarelli/WurstScript`, `6b129956f6e7cf9582510f26b99d305526bf3ded` |
| Compiler jar | SHA-256 `9495b1f3ad1f1baf53335934e9152874773e6c735b0e5db819b3e7f06c82ed15` |
| Standard library | `https://github.com/tompassarelli/WurstStdlib2`, `e3714f629113ee682353c3244065fee3e7d9ae16` |
| Compiler Lua test runtime | `1f36fff43a4987bc133c676072ee396f15294aa0` |
| Execution target | Warcraft patch `v3.0`, Lua; Java 25 |
| Language server, build and `runmap` | Implementations in the same compiler revision |
| JHCR reference | `ea54ed7c86cfc13e1332dded072ab33343963c42`, `PATCH_LVL=300`; no successful local JHCR benchmark |

The JHCR revision is a separately inspected tooling reference, not a dependency
selected by the Wurst lock. Its Nix build was blocked by an input hash mismatch.
The Wurst editor extension is excluded. The historical source observations
and initial launch timings are retained in
`9c41440^:docs/wurst-toolchain.md`.

smashcraft:typescript-toolchain.lock pins Bun 1.3.13, TypeScript compiler API
6.0.2, TypeScript checker 7.0.2, TypeScriptToLua 1.37.1, Effect 4.0.1 and Effect
tsgo 0.48.0. smashcraft:ts/waygate.lock pins the consumed Waygate archive;
each dated observation below identifies the Waygate/source revision it ran.

## Comparison

“Demonstrated equivalent” means the named operation was exercised in the
reported scope. “Unmeasured” means that evidence cannot decide the comparison;
it does not mean the feature is absent. A demonstrated gap is stated directly.

| Named capability | Pinned Wurst operation | Waygate equivalent | Demonstration or measurement |
| --- | --- | --- | --- |
| Compile-time evaluation | IM interpreter evaluates `compiletime(...)` and `@compiletime` functions before emitting the map. | Bun executes typed build declarations and generators before packaging; their generated data is consumed by the emitted map. | **Demonstrated for Smashcraft's build data:** fighter definitions, FileIO ability and lobby configuration are generated from TypeScript. The retained FileIO ability byte fixture is SHA-256 `28b1c0200840165876f4feccaf5bb389a2261e7492ffb0269b23ba0cb569e994`. This compares build evaluation, not arbitrary Wurst expression syntax. |
| Object editing | WurstStdlib2 typed object definitions and compile-time natives emit object files. | Typed object declarations plus Waygate's binary object encoders emit `war3map.w3u` and `war3map.w3a`; selected fields also apply to existing units during reload. | **Demonstrated archive equivalent:** the same `$wsl` FileIO bytes are checked by smashcraft:ts/test/map-build.test.ts. Runtime field operations and full-build limits are listed below. Native live-edit acceptance is separate from byte generation. |
| Interpreter tests with emulated natives | Wurstunit executes simulation tests in the compiler interpreter with native providers; the pinned compiler also has a Lua32 test runtime. | The same registered simulation tests run in Bun and emitted Lua32, with test-only Warcraft native emulation. | **Demonstrated equivalent for the ported contracts:** #38 records 693 Bun tests, 0 failures, 1720 ms and 669/669 emitted-Lua checks at `d501016`. smashcraft:ts/test/host-natives.ts supplies scalar, conversion, string and bit natives; Waygate supplies the shared test registration. Engine input timing remains a native check. |
| Output size against Wurst's optimizer | Wurst's production pipeline can optimize emitted code; Smashcraft's retained paired benchmark used `-dev -lua -stacktraces`. | TypeScriptToLua emits the bundled map script. | **Unmeasured:** no matched optimized-Wurst/Waygate output-byte measurement is retained in the cited evidence. Map archive size would also include assets and is not a script-size substitute. |
| Frame cost against Wurst's optimizer | Optimized Wurst output is the requested baseline. | Native 4096-frame production simulation workload. | **Measured against retained development output:** `ba88e6d` gave Wurst 1.450195296 s and TypeScript 1.225585936 s, ratio 0.845118, with equal complete state. After physics changes, `5a60a9c` gave TypeScript 1.389648416 s, ratio 0.958249 against the retained Wurst sample; 874 shared fields agree and 16 added fields are zero. One sample per implementation; the post-physics full schemas differ. These numbers do not establish optimized-Wurst equivalence. See smashcraft:evidence/native-frame-cost-20261005/README.md and smashcraft:evidence/post-physics-frame-cost-20261005/README.md. |
| Stack traces in error reports | `-stacktraces` injects call frames independently of the game's Lua debug library. | Source maps already translate the failing Lua position to TypeScript; the game has no Lua `debug` library. | **Behind at this observation:** mapped error position alone does not provide the caller chain that Wurst injects. The stack-trace implementation and its native acceptance must supply that chain before this row can be called equivalent. |
| JHCR hot reload | The JHCR pipeline instruments JASS; it is not the selected Lua map's reload path. Package initializers and existing object handles do not automatically rerun. | Synchronized Lua bundle install rebinds registered callbacks and retains match state. | **Demonstrated equivalent in the selected Lua workflow:** Waygate `dd4812f` at Smashcraft `cd6f7a8` applied one edit on two retained clients in 1682.737 ms from save to both acknowledgements. All 6 paired checksum samples matched over frames 2692–2991. See smashcraft:evidence/waygate-extraction-native-20261005/README.md. JHCR's own performance is unmeasured. |
| `runmap` | Compiler build/run command; Linux launch prepends `wine` to the executable command. | `bun waygate fresh MAP --rebuild` drives the retained signed-in clients, enters a new game and waits for both quick-match receipts. | **Demonstrated launch equivalent on this machine:** the same extraction trial returned 0 with 2 receipts in 28.233 s including 7.458 s compilation. Historical Wurst initial single-client build-to-ready observations were 12.078 s and 11.269 s; those differ in client count and workflow and do not support a speed comparison. |
| Language server: definitions, references, rename, diagnostics | The pinned compiler's language-server services declare and implement all four operations. | Pinned TypeScript language-service API provides all four independently of an editor extension. | **Demonstrated equivalent operations:** a two-file typed fixture resolves 1 cross-file definition and 4 references, renames 4 locations across both files, reports invalid-assignment diagnostic 2322, and reports 0 diagnostics after rename and repair. See smashcraft:evidence/wurst-capabilities-20261005/language-service-result.json and its executable fixture. This is an API demonstration, not an editor or whole-project latency benchmark. |
| Build configuration | `wurst.build` declares patch, metadata, players and forces; the compiler's shared map pipeline injects script, imports and object data. | Typed map declaration, toolchain lock, CLI build inputs and verified archive packaging. | **Demonstrated equivalent for this map's declarations:** smashcraft:ts/scripts/mapInfo.ts preserves the 4 player slots and Players force; map build tests check toolchain identity and generated `config()` before and after script rebuild. The extraction trial exercises the packaged rebuild and fresh-match path. The asset-container mitigation and undeclared-import limit are documented in smashcraft:docs/typescript.md. |
| Standard-library wrappers | Typed natives, arithmetic/vector helpers, FileIO, frame/key/event callbacks and object definitions used by the former map. | Waygate's Warcraft declarations, binary32/integer helpers, file transport and callback dispatch; Smashcraft's typed state, frame/key presentation and build declarations. | **Demonstrated for the consumed operations:** the ported Bun/Lua32 contracts exercise arithmetic and simulation helpers; the 2-client reload/fresh trial exercises file transport and callback dispatch. UI/control observations retain their separate native evidence under smashcraft:evidence/. This is a mapping of Smashcraft's used operations, not a claim that Waygate reimplements every unused WurstStdlib2 package. |

The Wurst-side operations above were checked against the pinned compiler's
`CompiletimeFunctionRunner`, native providers, `StackTraceInjector2`, language
server services, `MapRequest` and `RunMap`, and the pinned library's Wurstunit,
FileIO, Binary32, Vectors, Framehandle and ClosureFrames packages. Source
presence identifies the comparison operation; it is not a fresh benchmark.

## Object data and hot reload

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
