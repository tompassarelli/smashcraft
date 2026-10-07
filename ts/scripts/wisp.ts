// Wisp: Smashcraft's host tools as one program (#37). Each command is
// composed from the services in smashcraft:ts/scripts/wisp/ and prints how
// long each of its steps took.
// Usage (from ts/): bun wisp COMMAND [ARGUMENTS]
import { Cause, Effect, Exit, Option } from "effect";
import type { Command } from "wisp/scripts/wisp/command";
import { step, timingsLayer } from "wisp/scripts/wisp/timings";

/** Each command loads on demand, so it loads only the modules it uses. */
const COMMANDS: Record<string, { readonly usage: string; readonly load: () => Promise<Command> }> = {
  hot: { usage: "hot --data DIR [--data DIR ...] [--watch] [--profile main|integrity|playable|physics-probe|frame-cost|stack-trace]", load: async () => (await import("./wisp/commands/hot")).hot },
  build: { usage: "build --base BASE.w3m --container MAP.w3x --assets DIR --summon DIR --name NAME --out OUT.w3x [--packager PATH] [--profile main|integrity|playable|physics-probe|frame-cost|stack-trace]", load: async () => (await import("./wisp/commands/map")).build },
  rebuild: { usage: "rebuild MAP.w3x [--profile main|integrity|playable|physics-probe|frame-cost|stack-trace]", load: async () => (await import("./wisp/commands/map")).rebuild },
  fresh: { usage: "fresh MAP.w3x [--rebuild] [--no-quick] [--profile main|integrity|playable|physics-probe|frame-cost|stack-trace]", load: async () => (await import("./wisp/commands/fresh")).fresh },
  tapes: { usage: "tapes   (LUA=<stock 32-bit lua>; TOWARD_ZERO_LUA=<32-bit lua rounding + - * toward zero>, else built with nix)", load: async () => (await import("./wisp/commands/tapes")).tapes },
  oracle: { usage: "oracle", load: async () => (await import("./wisp/commands/oracle")).oracle },
  agency: { usage: "agency [--attacker Archer|Rifleman|Illidan]... [--out FILE]", load: async () => (await import("./wisp/commands/agency")).agency },
  interactions: { usage: "interactions [--check | --move FIGHTER:MOVE]", load: async () => (await import("./wisp/commands/interactions")).interactions },
  parity: { usage: "parity numeric [RESULT_FILE ...] | capture OPTIONS... | result CAPTURE_DIR | headless --helper BINARY --out DIR", load: async () => (await import("./wisp/commands/parity")).parity },
  integrity: { usage: "integrity capture OPTIONS... | result CAPTURE_DIR | headless --helper BINARY --out DIR", load: async () => (await import("./wisp/commands/parity")).integrity },
  "four-fighters": { usage: "four-fighters capture OPTIONS... | result CAPTURE_DIR", load: async () => (await import("./wisp/commands/fourFighters")).fourFighters },
  playable: { usage: "playable capture OPTIONS... | result CAPTURE_DIR", load: async () => (await import("./wisp/commands/playable")).playable },
  client: { usage: "client look|read|click|keys CLIENT ... | state CLIENT | wait CLIENT STATE... [--seconds N]", load: async () => (await import("./wisp/commands/client")).client },
  watch: { usage: "watch [CLIENT...] [--once] [--json] [--record FILE]   (each client's state from its events: wisp:docs/watch.md)", load: async () => (await import("wisp/scripts/wisp/commands/watch")).makeWatch((await import("./wisp/project")).clientState, { filePrefix: "smashcraft" }) },
  engine: { usage: "engine desync A B | poll --client a,b | diff A.log B.log | actions --client lan0a,lan0b | watch --client a | locate --client a   (read-only engine debugger for native desyncs, dev clients only: wisp:docs/engine.md)", load: async () => (await import("wisp/scripts/wisp/commands/engine")).makeEngine((await import("./wisp/project")).clientState) },
  lan: { usage: "lan setup --from INSTALL [--pairs N] | pool [--pairs N] [--profile parity|visual] | fresh MAP.w3x [--pair K] | status [--pair K] | end --pair K   (offline clients in loopback-only pairs on Wisp's own LAN host; your own maps only: wisp:docs/lan.md)", load: async () => (await import("wisp/scripts/wisp/commands/lan")).lan },
  doctor: { usage: "doctor [CLIENT...]   (recovers dropped, crashed, login-stuck, loading-stuck or lobby-stuck clients; wisp:docs/doctor.md)", load: async () => (await import("./wisp/commands/doctor")).doctor },
  menus: { usage: "menus host|join|start|leave [OPTIONS]", load: async () => (await import("wisp/scripts/wisp/commands/menus")).makeMenus() },
  online: { usage: "online setup | host | join CODE [--client NAME] [--repair]   (direct play by join code, the client's Online page: scripts/wisp/online.ts)", load: async () => (await import("./wisp/commands/online")).online },
  view: { usage: "view scene DATA_DIR... | frame FRAME.ppm... | models --assets DIR --summon DIR --extractor CASC_EXTRACT --storage WARCRAFT_DIR", load: async () => (await import("./wisp/commands/view")).view },
  headless: { usage: "headless [quick-match|desync] [--clients N] [--cost]", load: async () => (await import("./wisp/commands/headless")).headless },
  soak: { usage: "soak [--matches N] [--seed N] [--workers N<=4] [--minutes N<=30] [--fighter NAME]... [--stage NAME]... [--policy NAME]... [--out DIR] | --repro FILE | --helper BINARY [--matches N<=20] [--seconds S<=90] [--seed N] [--out DIR]", load: async () => (await import("./wisp/commands/soak")).soak },
  dev: { usage: "dev [--data DIR --data DIR]", load: async () => (await import("./wisp/commands/dev")).dev },
  play: { usage: "play   (Tom's desktop: Battle.net, Play, the map hosted after Warcraft's ladder scan, the controller helper, a match against a computer)", load: async () => (await import("./wisp/commands/play")).play },
  controller: { usage: "controller   (Tom's Xbox controller for any Smashcraft session on his desktop: points the always-on controller service at main's helper, or runs it here)", load: async () => (await import("./wisp/commands/controller")).controller },
  tune: { usage: "tune --data DIR [--data DIR ...] [--port N] [--profile main|integrity|playable|physics-probe|frame-cost|stack-trace]", load: async () => (await import("./wisp/commands/tune")).tune },
  repro: { usage: "repro FILE [--test NAME]", load: async () => (await import("./wisp/commands/repro")).repro },
  replay: { usage: "replay FILE [--out JOINED]   (LUA=<32-bit lua>)", load: async () => (await import("./wisp/commands/replay")).replay },
  pad: { usage: "pad SCRIPT --helper BINARY --build BUILD --out DIR --app-id a=ID --app-id b=ID [--chat=TEXT] [--map MAP.w3x [--retries N]] | pad SCRIPT --headless --helper BINARY --out DIR [--chat=TEXT] [--compare NATIVE_DIR] | pad SCRIPT|DIR... --helper BINARY --out DIR (--map MAP.w3x [--pairs N | --pair K...] [--fresh-each] | --headless) [--headless-jobs N]   (timed virtual-pad edges through the real helpers; native vs headless parity; scripts/integrity/padScript.ts)", load: async () => (await import("./wisp/commands/pad")).pad },
  accept: { usage: "accept [--only ID...] [--dry-run] [--out DIR]   (the declared native checks, batched: scripts/wisp/acceptChecks.ts)", load: async () => (await import("./wisp/commands/accept")).accept },
  farm: { usage: "farm balance [--ref REF] [--level N] [--per-pair N] [--seeds N] [--wait] | farm pads [--ref REF] [--wait] | farm perf [\"RUN ARGS\" ...] [--ref REF] [--out DIR]   (headless work on GitHub's free runners: .github/workflows/balance.yml, headless-pads.yml, perf.yml)", load: async () => (await import("./wisp/commands/farm")).farm },
  perf: { usage: "perf [quick-match|bot|bot-four|playable-bot-four] [--frames N] [--samples] [--out FILE] | perf compare A B [--threshold SHARE] | perf budget RUN_FILE [--p99 MS] [--worst MS] | perf census [--fighter NAME] [--stage ID] [--limit MS] [--jobs N] [--profile] [--out FILE]   (LUA=<32-bit lua>)", load: async () => (await import("./wisp/commands/perf")).perf },
};

const [name, ...args] = process.argv.slice(2);
const entry = name === undefined ? undefined : COMMANDS[name];
if (name === undefined || entry === undefined) {
  console.error(`usage: bun wisp COMMAND\n${Object.values(COMMANDS).map(({ usage }) => `  ${usage}`).join("\n")}`);
  process.exit(2);
}
// Play is Tom's path from main and the client's Play button; Bun installs nothing
// once node_modules exists, so a pull that moved the Wisp pin left play on the
// old Wisp (7 Oct: main's checkout still ran 33e44eb with e54345e pinned).
if (name === "play") {
  const install = Bun.spawnSync([process.execPath, "install", "--frozen-lockfile"], { cwd: import.meta.dir + "/..", stdout: "ignore", stderr: "pipe" });
  if (install.exitCode !== 0) {
    console.error(`couldn't install the pinned dependencies: ${install.stderr.toString().trim()}`);
    process.exit(1);
  }
}
const command = await entry.load();
const exit = await Effect.runPromiseExit(command(args).pipe(step(name), Effect.provide(timingsLayer((line) => console.error(line)))));
if (Exit.isFailure(exit)) {
  const failure = Cause.findErrorOption(exit.cause);
  if (Option.isNone(failure)) console.error(Cause.pretty(exit.cause));
  else console.error(failure.value._tag === "UsageFailure" ? `${failure.value.message}\nusage: bun wisp ${entry.usage}` : failure.value.message);
  process.exit(Option.isSome(failure) && failure.value._tag === "UsageFailure" ? 2 : 1);
}
process.exit(0);
