# The Smashcraft client

Tom's goal is "a Slippi type of client": one desktop app that owns the
controller, starts matches, keeps every match's history, stats and replay,
and finds online opponents. Smashcraft runs as a Warcraft III custom map, so
the client sits beside Warcraft the way the Slippi Launcher sits beside
Dolphin and the W3Champions launcher sits beside Warcraft. Epic
[#143](https://github.com/tompassarelli/smashcraft/issues/143) tracks the
phases; each phase's issue holds its acceptance and status.

## Prior art

### Project Slippi (Melee)

Slippi has three parts: the Launcher, Slippi Dolphin and Nintendont-Slippi
for consoles ([SmashWiki](https://www.ssbwiki.com/Project_Slippi)).

- **Launcher** ([source](https://github.com/project-slippi/slippi-launcher),
  Electron, React and TypeScript). It updates Dolphin, has a Play button,
  a replay browser with a stats page, settings such as the game path,
  Slippi.gg sign-in, and broadcast/spectate. It installs two Dolphins: one
  for netplay and one for playback. It drives the playback Dolphin through a
  small JSON file (`mode: normal|mirror|queue`, `replay`, `startFrame`,
  `endFrame`, `queue[]`, `isRealTimeMode`) in `src/dolphin/types.ts`.
- **Matchmaking** (Ishiiruka `SlippiMatchmaking.cpp`). The client opens a
  ticket on a matchmaking server over ENet (`CREATE_TICKET` with the search
  mode and local address). The answer names the opponents and how to reach
  them. Modes are `RANKED`, `UNRANKED`, `DIRECT` (connect codes) and
  `TEAMS`. Players then connect peer to peer over UDP, trying the LAN
  address first. No relay was found in that file.
- **Ranked.** It uses a rating with ranks from Bronze to Grandmaster.
  Leaderboards refresh every two minutes and are split by region. Ranked
  launched to paying subscribers ($5–$40 a month) and became free about
  three months later
  ([Upcomer](https://upcomer.com/what-is-slippi-ranked-how-to-use-the-online-super-smash-bros-melee-tool/)).
  No server cost figures are public.
- **Replays (.slp)**
  ([spec](https://github.com/project-slippi/slippi-wiki/blob/master/SPEC.md)).
  A file is UBJSON with a `raw` stream of events and a `metadata` block
  (start time, last frame, players).
  - Game Start holds the settings, RNG seed and version.
  - Every frame records each player's inputs before the frame and their state
    after it.
  - A Frame Bookend marks the frame final, because rollback re-runs frames.
  - Playback re-runs the game from the recorded inputs.
- **Stats** ([slippi-js](https://github.com/project-slippi/slippi-js)).
  It computes stocks, conversions, combos, openings per kill, neutral wins,
  counter hits, damage per opening, inputs per minute, kill count and
  L-cancel rate. It can read a replay while it is still being written.
- **Spectating.** The broadcaster's launcher forwards the live replay stream
  over a WebSocket to a Slippi server. A viewer's launcher feeds it into its
  playback Dolphin. Slippi Lab's `slippi-viewer` web component shows replays
  in a browser.

### Rivals of Aether 2 and Smash Ultimate

- **Rivals 2** has rollback on dedicated servers run through Edgegap, which
  is billed per use
  ([Edgegap](https://edgegap.com/blog/rivals-of-aether-2-how-is-its-online-experience-is-so-good-netcode-rollback-dedicated-server-orchestration)).
  Replays can record always, online only or offline only, and have a camera
  and keyframe tool for exporting video. The first Rivals had replay speed
  control, frame advance, hitbox and DI overlays, and "take control" from a
  replay.
- **Ultimate's** replays are inputs only, so a balance patch breaks them;
  Nintendo tells players to convert replays to video before updating. Shared
  videos go to Smash World.

The lesson: an input replay plays only on the build that recorded it. Every
replay must name its build, and the client must keep the builds its replays
need.

### Warcraft III community tools

- **W3Champions**
  ([components](https://w3champions.atlassian.net/wiki/spaces/AV/pages/2654209/Components)).
  It is an Electron launcher that updates itself and runs `flo-worker`. A
  private matchmaking service (Node and MongoDB) runs the queue and records
  results, which feed a statistics website. Ratings use "Glicko2 with
  improvements". Its menus are injected into Warcraft's own Chromium menu
  page: an `index.html` in `_retail_\webui\` plus the `Allow Local Files`
  registry switch. That is the same mechanism Wisp's menu page uses
  (wisp:docs/driving-warcraft.md).
- **flo** (Rust, MIT). Its parts are a controller, nodes around the world
  (about 26), a worker on each player's machine, an observer and a replay
  writer. The worker makes a remote flo node look like a LAN game to
  Warcraft, so game traffic goes through flo instead of Battle.net.
  W3Champions runs custom-map ladders this way (Legion TD, Castle Fight,
  Survival Chaos), so custom maps over flo work. **Warcraft 3.0.0 (12 Sept
  2026, the build Smashcraft's clients run) removed LAN from Reforged and
  must stay online.** How flo works on 3.0 is not public. #19 found no LAN or
  direct-connect path on these Battle.net clients either.
- **W3MMD** ([Hive](https://www.hiveworkshop.com/threads/w3mmd.251087)).
  It is the custom-map statistics convention.
  - The map stores messages in an `MMD.Dat` game cache and synchronizes
    them, so they travel as player actions and end up in the `.w3g` replay.
  - Messages declare players, variables, events and each player's result
    (`FlagP winner|loser|drawer|leaver`).
  - [wc3stats.com](https://wc3stats.com) builds player and map statistics
    from uploaded replays. Its open-source auto-uploader watches for
    `LastReplay.w3g`.
- **Native replays (.w3g).** These hold only player actions in time slots,
  and playback re-runs the map. They include `BlzSendSyncData` payloads
  (action 0x78 in [w3gjs](https://github.com/PBug90/w3gjs)). Smashcraft's
  input rows travel as `SC_GP` sync messages, so a Warcraft replay of a
  Smashcraft match should carry every input. This is inferred from the
  parser and not yet tried. Replays are saved under
  `Documents\Warcraft III\BattleNet\<account>\Replays`, and `LastReplay.w3g`
  is rewritten after every game.
- **Map file output.** Preload files land in `CustomMapData` (subfolders
  allowed; paths up to 259 characters). The map can write them but reads
  each name only once a session
  (smashcraft:docs/warcraft-api-netcode-findings.md, "Preloader reads in the
  game").

### What fits Smashcraft

| Feature | Fit | How |
| --- | --- | --- |
| Launcher with Play, controller and settings | Yes | Phase 1: Tauri app owns the helper and `wisp play`'s flow |
| Match history and stats page | Yes | Phase 2: map-written records plus client-side stats |
| Deterministic input replays, browser, sharing | Yes | Phase 3: the moment-repro format extended to whole matches |
| Replay viewer outside the game | Yes | Phase 3: the client runs the same TypeScript simulation headlessly and draws it |
| Direct connect by code | Yes | Phase 4: host/join a password lobby through the menu page |
| Unranked queue | Possible | Phase 4: needs a small server (Tom decides) |
| Ranked, leaderboards, profiles website | Later | Needs accounts and servers; after unranked proves demand |
| Live spectating | Yes, natively | Warcraft observer slots; streaming replays to the client later |
| Own netplay transport (Slippi's peer to peer, flo) | No for now | Battle.net carries the game on 3.0; flo on 3.0 is unknown (#19, #142) |
| W3MMD results in .w3g | Optional | Cheap at match end; makes wc3stats.com work. Not needed for the client |

## What Smashcraft already has

- **Moments ("repro" files).** K, or View held on a controller, saves the
  last ten to twelve seconds (smashcraft:ts/src/game/replay/moment.ts).
  - The file is `smashcraft-repro-p<slot>-f<frame>-<n>.txt` in
    CustomMapData, in Wisp's repro format (wisp:docs/repro.md): a header
    with build, frame and checksum; a snapshot as record text; every frame's
    input rows, run-length encoded; and checkpoint checksums.
  - `bun wisp repro FILE` replays it in simulated clients to the recorded
    checksum.
  - The recorder keeps six snapshots, one every 120 frames, and a ring of
    rows. It is a full-match replay limited to a window.
- **Confirmed-frame funnel.** Every confirmed frame, in both callback and
  rollback matches, passes through `applyFrame`
  (smashcraft:ts/src/platform/shell/frame.ts). That is where moments record
  rows, the results tally counts KOs and falls
  (smashcraft:ts/src/game/presentation/matchCues.ts), and the match-end
  hook runs. Predicted frames never reach it.
- **Journal receipts.** With a controller helper, the end-of-match
  journal file names the winner
  (smashcraft:ts/src/game/shell/journalFiles.ts, `endFile`). The dev
  receipt names the setup and the stage receipt names the drawn stage. These
  are protocol for the helper and automation, not for players.
- **Headless runtime.** `bun wisp headless` runs the map's TypeScript in
  simulated clients in about a second. Effects report their model, position
  and pose (`client.effectPoses()`), and `wisp view scene` checks what a
  player would see. That is enough to run a replay outside Warcraft and draw
  fighters from the replayed state.
- **Tapes and the oracle.** These replay recorded operations in Bun and
  32-bit Lua and compare canonical state, so a replay can be trusted to
  reproduce the match where Bun and Lua agree.
- **Menu page.** `wisp menus` drives Warcraft's lobby screens over the
  page's WebSocket: `CreateLobby` with a password, `JoinGameByGameName`,
  `LobbyStart` and leave. `wisp play` already hosts through it. A client can
  host and join Battle.net custom games without clicks.

## Match records (Phase 2's data)

At every match result each client writes its player's record. Nothing is
synchronized and the simulation is unchanged.

- **Code.** smashcraft:ts/src/game/shell/matchRecord.ts builds the lines and
  smashcraft:ts/src/platform/shell/matchRecords.ts writes the file.
- **When.** At the result of a finished match in `applyFrame`, and when a
  player leaves mid-match in `playerLeft`.
- **File name.** `smashcraft-match-<serial>.txt`.
- **Serial.** It counts across sessions through
  `smashcraft-match-index.pld`. The map reads that file once a session,
  because Preloader keeps the first content it read, and writes it before
  each record so a serial is never reused.

```text
smashcraft-match v=1 build=BUILD serial=12 local=P1 mode=versus
rules stocks=3 minutes=7
result frames=4521 winner=P1 timed-out=0 interrupted=0
stage id=2 name=Frozen Throne
fighter slot=P1 kind=human player=Tom#1234 character=4 stocks=2 damage=37 kos=3 falls=1 left=0 name=Mountain King
fighter slot=P2 kind=computer character=6 stocks=0 damage=112 kos=1 falls=3 left=0 name=Lich
end lines=6
```

**Reading the lines:**

- Each line is a word followed by `key=value` fields. A `name=` field comes
  last and runs to the end of its line.
- `local` is the player who wrote the record, or `none` for an observer.
  Values hold no spaces, `"` or `\`.
- `frames` counts 60ths of a second. `damage` is the fighter's final percent.
- KOs go to the fighter who last hit the fighter that fell. `mode` is
  `versus`, `practice`, `training` or `endless`.
- `end lines=N` counts the lines before it. The client refuses a record whose
  count doesn't match, as one cut short.
- A record is identified by its `build`, `serial` and the writer's
  `player`.

Phase 2's stats need counters the map doesn't keep yet. They are computed in
presentation from confirmed frames, as the tally is:

- damage dealt;
- openings (the first hit that starts hitstun);
- damage per opening and openings per KO;
- techs and missed techs;
- ledge grabs.

L-cancel stats don't apply, because Smashcraft removed L-cancelling (#54).

## Full-match replays (Phase 3)

A full match needs the moment's ingredients for the whole match:

- the match-start snapshot;
- every frame's rows;
- a checksum every 120 frames;
- the build.

Computers need no rows, because their controls come from the state
(`produceScenarioComputerInput`).

Two ways to watch were considered:

1. **In the client, headless.** The client runs the map's simulation, the
   same TypeScript, in Bun or in its webview. It restores the snapshot, runs
   the rows and draws each fighter from the replayed state: position,
   action, hurtboxes and active hits. This needs no Warcraft, so seeking,
   frame stepping and overlays are cheap. It is the recommended viewer.
2. **Inside Warcraft, as a replay mode in the map.** A replay file can't
   reach the simulation in a multiplayer game without synchronizing it,
   which competes with input for sync bandwidth. A single-player replay
   mode could read it locally, but Preloader's once-a-session reads and
   Preload's escaping limits make large files fragile. Warcraft's own
   `.w3g` replay (above) may already play Smashcraft matches with the real
   models. Phase 3's native box checks that before anyone builds an
   in-map mode.

**Recording cost.** A row is 17 numbers. One-to-one rows don't fit Preload
lines: a seven-minute two-player match is about 25,000 rows. Rows
run-length encoded as moments do (`count:mask:row`) stay small while inputs
are held. To avoid one end-of-match spike over the frame-cost gate (#48),
the map writes the replay in parts during the match: a part file every few
seconds of confirmed frames, and a manifest at the end. The client joins
the parts.

A replay plays only on its build. The client keeps the simulation bundle of
every build it has played and names the version an unknown replay needs.

## Phases

| Phase | Issue | What it delivers | Feasibility | Owner decisions |
| --- | --- | --- | --- | --- |
| 1 Controller and Play | [#139](https://github.com/tompassarelli/smashcraft/issues/139) | Tauri v2 app (Rust core, Bun/TypeScript page): tray icon, controller page, helper, Play | In progress (lanes controller-app-20261007, controller-service-20261007) | None |
| 2 Match history and stats | [#140](https://github.com/tompassarelli/smashcraft/issues/140) | Map records at every result; client ingests them into a local store; history list; win rate per fighter and matchup, KOs, damage, tech and opening stats | Map side done; the rest is local code | None (local only) |
| 3 Replays | [#141](https://github.com/tompassarelli/smashcraft/issues/141) | Every match recorded; browse, watch in the client's viewer, step, seek, share a file | Proven pieces: moments, `wisp repro`, headless runtime. Risk: frame cost of recording | None; video export is later |
| 4 Online | [#142](https://github.com/tompassarelli/smashcraft/issues/142) | Host or join by code through the menu page; observers; then a queue | Direct codes need no server. A queue needs one | Servers and their cost, accounts, menu-page install on players' machines |

**Cost and accounts (Tom).**

- **Direct codes** need no server: the host's client creates a
  password-protected lobby and shows its game name and password as a code.
- **Unranked queue** needs a small always-on matchmaking service, a
  WebSocket server that pairs tickets and tells one client to host and the
  other to join. That is a hosted process and domain, about the price of
  one small virtual machine a month.
- **Ranked and profiles** add a database and a website.
- **Identity.** Players can be identified by their Battle.net names, which
  the records already carry, or by a Smashcraft account. An account adds
  sign-in and stored personal data.
- **Billing is Tom's decision.** Each of these is billable or a commitment.
  Nothing is provisioned until he decides.
