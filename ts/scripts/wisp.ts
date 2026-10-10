



import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Cause, Effect, Exit, Layer } from "effect";
import { ChildProcess } from "effect/process";
import { runProcess } from "./hostProcess";
import type { Teardown } from "effect/Runtime";
import type { Command } from "wisp/scripts/wisp/command";
import { step, timingsLayer } from "wisp/scripts/wisp/timings";
import { platformLayer } from "wisp/scripts/platform/layer";
import { profiles } from "./wisp/profiles";

const PROFILE = `[--profile ${profiles.join("|")}]`;

const COMMANDS: Record<string, { readonly usage: string; readonly load: () => Promise<Command> }> = {
  hot: { usage: `hot --data DIR [--data DIR ...] [--watch] ${PROFILE}`, load: async () => (await import("./wisp/commands/hot")).hot },
  map: { usage: "map build --name NAME --out OUT.w3x [--base BASE.w3m] [--container MAP.w3x] [--assets DIR] [--summon DIR] [--packager PATH] [--profile NAME] | map rebuild MAP.w3x [--profile NAME]", load: async () => (await import("./wisp/commands/map")).map },
  inputs: { usage: "inputs add FAMILY PATH | check | path [base|container|assets|summon]   (content-addressed private build inputs named by build-inputs.json: docs/build-inputs.md)", load: async () => (await import("./wisp/commands/inputs")).inputs },
  fresh: { usage: `fresh MAP.w3x [--rebuild] [--no-quick] ${PROFILE} [--clients-file FILE]`, load: async () => (await import("./wisp/commands/fresh")).fresh },
  anim: { usage: "anim score [--fighter NAME]... [--graphics classic|definitive] [--assets DIR] | anim judge fetch | anim judge prepare --out PRIVATE_DIR [--fighter NAME]... [--move FIGHTER:MOVE]... [--graphics classic|definitive] | anim judge record SCORES.jsonl...   (the animation scorecard: docs/animation-scorecard.md)", load: async () => (await import("./wisp/commands/anim")).anim },
  judge: { usage: "judge DIR --rubric FILE", load: async () => (await import("./wisp/commands/judge")).judge },
  oracle: { usage: "oracle", load: async () => (await import("./wisp/commands/oracle")).oracle },
  agency: { usage: "agency [--attacker Illidan|Rifleman|Illidan]... [--out FILE]", load: async () => (await import("./wisp/commands/agency")).agency },
  interactions: { usage: "interactions [--check | --move FIGHTER:MOVE]", load: async () => (await import("./wisp/commands/interactions")).interactions },
  envelope: { usage: "envelope [--ranges] [--json] [--top N]   (advisory: every move of the 26 fighters outside its genre frame-data class envelope, ranked by distance: docs/move-data.md, \"Genre envelope\")", load: async () => (await import("./wisp/commands/envelope")).envelope },
  strengths: { usage: "strengths FIELD.json   (per-fighter KO direction, KO percent, edge-guard and spacing profile against tools/move-data/fighter-strengths.json)", load: async () => (await import("./wisp/commands/strengths")).strengths },
  combos: { usage: "combos [--fighter NAME]... [--jobs N] [--advantage]", load: async () => (await import("./wisp/commands/combos")).combos },
  parity: { usage: "parity numeric [RESULT_FILE ...] | tapes | corpus [DIR ...] | corpus keep RECORDING...   (native recordings replayed headless: scripts/wisp/corpus.ts)", load: async () => (await import("./wisp/commands/parity")).parity },
  integrity: { usage: "integrity capture [--four-fighters | --playable] OPTIONS... | capture --screen --clients-file FILE --client NAME --out PRIVATE_DIR [--count N] [--region X,Y,WIDTH,HEIGHT] | result CAPTURE_DIR | headless --helper BINARY --out DIR | delay RUN_DIR...   (input delay and rollback depth per client from saved integrity rows, #396)", load: async () => (await import("./wisp/commands/parity")).integrity },
  client: { usage: "client [--clients-file FILE] look|read|click|keys CLIENT ... | watch [CLIENT...] [--once] [--json] [--record FILE] | doctor [CLIENT...] | wait CLIENT STATE... [--seconds N]", load: async () => (await import("./wisp/commands/client")).client },
  lan: { usage: "lan setup --from INSTALL [--pairs N] | pool [--pairs N] [--pool-profile parity|visual] | fresh MAP.w3x [--pair K] | status [--pair K] | end --pair K   (offline clients in loopback-only pairs on Wisp's own LAN host; your own maps only: wisp:docs/lan.md)", load: async () => (await import("wisp/scripts/wisp/commands/lan")).lan },
  menus: { usage: "menus host|join|start|leave [OPTIONS]", load: async () => (await import("wisp/scripts/wisp/commands/menus")).makeMenus() },
  online: { usage: "online setup | host | join CODE [--client NAME] [--repair]   (direct play by join code, the client's Online page: scripts/wisp/online.ts)", load: async () => (await import("./wisp/commands/online")).online },
  view: { usage: "view scene DATA_DIR... | frame FRAME.ppm... | cues [--move FIGHTER:MOVE]... [--graphics classic|definitive] | models --assets DIR --summon DIR --extractor CASC_EXTRACT --storage WARCRAFT_DIR | motion --assets DIR", load: async () => (await import("./wisp/commands/view")).view },
  headless: { usage: "headless [quick-match|desync|cpu-expert|computer-match] [--clients N] [--cost] [--journey FILE] [--render DIR --frames N...] | headless text-match [--seed N] [--you SLUG] [--cpu SLUG] [--level TIER] [--stage NAME] [--delay N] [--every N] [--frames N] [--stocks N] [--minutes N] [--input FILE]", load: async () => (await import("./wisp/commands/headless")).headless },
  soak: { usage: "soak memory [--minutes N] [--out FILE] | soak handles | soak [--matches N] [--seed N] [--workers N<=4] [--minutes N<=30] [--fighter NAME]... [--stage NAME]... [--policy NAME]... [--out DIR] | --repro FILE | --helper BINARY [--matches N<=20] [--seconds S<=90] [--seed N] [--out DIR]", load: async () => (await import("./wisp/commands/soak")).soak },
  dev: { usage: "dev [--data DIR --data DIR]", load: async () => (await import("./wisp/commands/dev")).dev },
  play: { usage: "play [--install-green | --standalone [--script FILE] [--presentation native|pool-confirmed|pool-predicted] [--headless --frames N --out DIR] [--capture-frames N,N]]   (standalone browser player, Tom's Warcraft desktop, or --install-green: build and install the newest green main without launching Warcraft)", load: async () => (await import("./wisp/commands/play")).play },
  controller: { usage: "controller   (Tom's Xbox controller for any Smashcraft session on his desktop: points the always-on controller service at main's helper, or runs it here)", load: async () => (await import("./wisp/commands/controller")).controller },
  tune: { usage: `tune --data DIR [--data DIR ...] [--port N] ${PROFILE}`, load: async () => (await import("./wisp/commands/tune")).tune },
  repro: { usage: "repro FILE [--view] [--test NAME] [--shrink [--out FILE]] [--frame N --out FILE] [--diff-frame N|previous]", load: async () => (await import("./wisp/commands/repro")).repro },
  replay: { usage: "replay FILE [--out JOINED]", load: async () => (await import("./wisp/commands/replay")).replay },
  net: {
    usage: "net host [--port N] | join ADDRESS:PORT | pair  --script FILE.pad --frames N [--delay FRAMES] [--freeze-at F] [--quit-at F] [--rtt MS] [--loss P] [--seed N] | proxy --listen PORT --to ADDRESS:PORT [--rtt MS] [--loss P]   (one slot per process over Wisp's UDP lockstep; wisp:docs/network-model.md)",
    load: async () => (await import("wisp/scripts/wisp/commands/net")).makeNet(async (args) => {
      const { flagValues } = await import("wisp/scripts/wisp/command");
      const [script] = flagValues(args, "script");
      if (script === undefined) throw new Error("net needs --script FILE.pad");
      return (await import("./wisp/net")).padNetGame(await Bun.file(script).text());
    }, "Smashcraft", ["script"]),
  },
  "net-accept": { usage: "net-accept --out DIR [--four-fighters] [--matches 20] [--frames 7200] [--jobs 5] [--rtts 0,60,120] [--loss 0.01] [--seed 112]   (wisp#112: full three-stock matches between two processes through the delay and loss proxy; checksums and rollback depth per round trip)", load: async () => (await import("./wisp/commands/netAccept")).netAccept },
  pad: { usage: "pad SCRIPT --helper BINARY --build BUILD --out DIR --app-id a=ID --app-id b=ID [--chat=TEXT] [--map MAP.w3x [--retries N]] [--clients-file FILE] | pad SCRIPT --headless --helper BINARY --out DIR [--chat=TEXT] [--compare NATIVE_DIR] [--replay-arrivals NATIVE_DIR] [--render DIR --frames N...] | pad SCRIPT|DIR... --helper BINARY --out DIR (--map MAP.w3x [--pairs N | --pair K... | --clients-file FILE] [--fresh-each] [--hot] | --headless) [--headless-jobs N]   (timed virtual-pad edges through the real helpers; native vs headless parity; scripts/integrity/padScript.ts)", load: async () => (await import("./wisp/commands/pad")).pad },
  accept: { usage: "accept [--only ID...] [--pair K...] [--solo] [--map MAP.w3x] [--dry-run] [--out DIR]   (the declared native checks, batched: scripts/wisp/acceptChecks.ts)", load: async () => (await import("./wisp/commands/accept")).accept },
  farm: { usage: "farm test [--ref REF] [--wait] | farm balance [--ref REF] [--lane NAME] [--opponent ID] [--tier TIER] [--per-pair N] [--seeds N] [--wait] | farm pads [--ref REF] [--only DIR]... [--wait] | farm perf [\"RUN ARGS\" ...] [--ref REF] [--out DIR] | farm memory [--ref REF] [--lane NAME] [--minutes N] [--wait]   (headless work on GitHub's free runners: .github/workflows/farm-test.yml, balance.yml, headless-pads.yml, perf.yml, memory-soak.yml)", load: async () => (await import("./wisp/commands/farm")).farm },
  perf: { usage: "perf [quick-match|bot|bot-four|playable-bot-four] [--frames N] [--samples] [--out FILE] | perf compare A B [--threshold SHARE]   (A and B as census --pairs files: fails when a fighter pair's worst frame rises past 5%) | perf native READINGS [RUN] [--samples FILE] | perf fit SAMPLES=READINGS ... | perf budget RUN_FILE [--p99 MS] [--top MS] | perf profile RUN [--worst-frames N] | perf census [--fighter NAME] [--stage ID] [--rise-ms MS] [--jobs N] [--functions] [--out FILE] [--pairs FILE]", load: async () => (await import("./wisp/commands/perf")).perf },
};

const [name, ...args] = process.argv.slice(2);
const entry = name === "help"
  ? { usage: "help [TOPIC]", load: async () => (await import("./wisp/commands/help")).makeHelp(Object.values(COMMANDS).map(({ usage }) => usage)) }
  : name === undefined ? undefined : COMMANDS[name];
if (name === undefined || entry === undefined) {
  console.error(`usage: bun wisp COMMAND\nrun bun wisp help for commands and topics`);
  process.exit(2);
}



const command = await entry.load();

const teardown: Teardown = (exit) => {
  if (Exit.isFailure(exit)) {
    if (!Cause.hasInterruptsOnly(exit.cause)) console.error(Cause.pretty(exit.cause));
    process.exit(Cause.hasInterruptsOnly(exit.cause) ? 130 : 1);
  }
  process.exit();
};


BunRuntime.runMain(Effect.gen(function*() {
  if (name === "play") yield* runProcess(ChildProcess.make(process.execPath, ["install", "--frozen-lockfile"], { cwd: import.meta.dir + "/..", stdout: "ignore" }));
  yield* command(args);
}).pipe(
  Effect.provide(Layer.merge(BunServices.layer, platformLayer())),
  step(name),
  Effect.provide(timingsLayer((line) => console.error(line))),
  Effect.catch((failure) => Effect.sync(() => {
    console.error(failure._tag === "UsageFailure" ? `${failure.message}\nusage: bun wisp ${entry.usage}` : failure.message);
    process.exitCode = failure._tag === "UsageFailure" ? 2 : 1;
  })),
), { disableErrorReporting: true, teardown });
