# Client interface

The Smashcraft desktop client lives in
[smashcraft-client](https://github.com/tompassarelli/smashcraft-client). It
reads Smashcraft only through this interface, which this repository owns. A
change that breaks it bumps the kit number or the record's `v=`, and updates
this page in the same commit.

## Client kit 1 (build time)

From ts/, `bun scripts/clientKit.ts OUT` writes the kit into OUT
(smashcraft:ts/scripts/clientKit.ts). The client pins a Smashcraft commit and
builds against the kit that commit writes; it imports nothing else from this
repository.

| File | What it is |
| --- | --- |
| `kit.json` | `{"kit": 1, "version": SOURCE, "viewerApi": 1}`; `version` is the source version (smashcraft:ts/scripts/sourceVersion.ts) |
| `sim.js` | ES module: the replay viewer, the replay files' format and `sourceVersion()`, stamped with `version` |
| `sim.d.ts` | its types (smashcraft:ts/src/game/replay/clientKitApi.d.ts); `viewerBundle.ts` is checked against them |
| `viewer.lua` | the viewer's Lua modules, added to an older map's `war3map.lua` to play that version's replays |
| `fixtures/tape-replay.json` | a recorded two-player replay of `version`: `serial`, the manifest's lines and each part's lines |
| `fixtures/tape-replay.txt` | the same replay joined, as version `development`, which `fixtures/map.lua` plays |
| `fixtures/map.lua` | a stand-in `war3map.lua` holding the viewer's Lua bundle, for testing `viewer.lua` without a map |

`sim.js` exports `VIEWER_API` (1), `sourceVersion`, `openReplay`,
`parseReplayHeader`, `parseReplayPart` and `joinReplay`. A client keeps the
`sim.js` of every version it has run; any kit-1 `sim.js` opens its own
version's replays.

## Files the map writes (run time)

Each Warcraft III account's CustomMapData folder holds:

- match records, `smashcraft-match-<serial>.txt`, format `v=1`
  ([client design](design/client.md#match-records-phase-2s-data));
- replays, `smashcraft-replay-<serial>.txt` and their parts
  `smashcraft-replay-<serial>-<part>.txt`
  ([client design](design/client.md#full-match-replays-phase-3)).

Both are Warcraft Preload files; each stored line is one `call Preload( "…" )`.

## Maps (run time)

Maps/00-Smashcraft in the Warcraft III documents folder holds the installed
builds (smashcraft:docs/play.md). The current map is the highest
`Smashcraft 0.0.N.w3x` directly in that folder; older/ and tests/ are not
current. Each map's `war3map.lua` carries its source version in the
`game.shell.sourceVersion` module, so a client finds the map for a replay's
version in any Maps folder (Download included).

## Commands (Smashcraft tools)

Online play drives Warcraft III's menus through Wisp, so it needs Smashcraft's
tools: a checkout's ts/ with its dependencies installed. The client runs, in
that folder:

- `bun wisp online setup`, `bun wisp online host [--repair]` and
  `bun wisp online join CODE [--repair]`
  ([direct play](design/client.md#direct-play-phase-4)). Standard output is
  lines for players, ending in a match or a failure; standard error is the
  technical log; a waiting host reads `start` on standard input.

Without the tools the client's Online page says it isn't set up; History,
Stats, Replays, the controller and Play need nothing from this repository at
run time.
