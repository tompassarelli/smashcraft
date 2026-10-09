# Client

Offline clients never construct account launchers, even when named a or b.
Clones b, c and d start through their own launch script and keep their sign-in; doctor
supplies no account to clones. The older signed-in a/b configuration alone
uses the authorized encrypted account fields described below.

- Client actions accept `--clients-file FILE`, including watch, doctor and
  keys; use the exact offline pair's file. `WISP_CLIENTS` does not select
  clients. Pixel/input actions need the pair's file with desktop tools
  (the acceptance and integrity runners prepare it through `withTools`).

- Client state: `bun wisp client watch [CLIENT...] [--once]` prints what each client
  is doing (signed in, menu screen, lobby, loading, in match, results,
  disconnected, crashed, its map's load errors, the ladder scan) from its menus,
  log, crash reports, match receipts and processes, never its screen. Run it
  before clicking or reading a client; `bun wisp client watch CLIENT --once` and
  `bun wisp client wait CLIENT STATE...` read or wait on one (wisp:docs/watch.md).

- Client recovery: `bun wisp client doctor [CLIENT...]` brings clients A and B to a
  ready state: it recovers a client that dropped from Battle.net, crashed
  with its error dialog up, sits at the empty login shell, a stale lobby or
  a stuck loading screen, or shares its prefix with a second runtime, and
  signs a launcher at its Battle.net sign-in form in with the client's account
  (A: account c, B: account b; smashcraft:ts/scripts/wisp/doctor.ts), so Tom
  never signs in by hand (wisp:docs/doctor.md). Clients named clone-b,
  clone-c or clone-d start only through ~/.local/share/wisp/online/launch.sh and keep
  their own sign-in (wisp:docs/lan.md, "Clone-a"). `bun wisp client sign-out
  CLIENT...` signs a client out; the next doctor run signs it in. `fresh`,
  `integrity capture` (bot sessions included), `play` and `accept` run it before
  they start and once after a failure; run it instead of driving a client by
  hand.

- Client driver: `bun wisp client look|read|click|keys CLIENT ...` reads and
  drives a client. Session values live in ~/.local/state/smashcraft/clients.json.
