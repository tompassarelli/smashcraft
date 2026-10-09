import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checksFor } from "../scripts/prePush";
import { newFailures, refusal } from "../scripts/newFailures";
import { failedTest } from "../scripts/mainRed";

test("Bun and Lua failures share a full title, including colons, while a new title still blocks [repro #345]", () => {
  const title = "every hero special form's cue windows lie in its action: startup from frame 1, then active [spec #144]";
  const bun = `game/presentation/specialCues > ${title}`;
  const lua = `Lua32: ${title}`;
  const runs = [
    { command: "bun test test/game.test.ts", exitCode: 1, output: `(fail) ${bun} [1.00ms]` },
    { command: "bun scripts/lua-tests.ts", exitCode: 1, output: `fail ${title}: expected true: got false` },
  ];
  expect(failedTest(runs[1]!.output)).toBe(lua);
  expect(newFailures(runs, new Set([bun]))).toEqual([]);
  expect(newFailures(runs, new Set([lua]))).toEqual([]);
  expect(newFailures([{ ...runs[1]!, output: "fail a newly broken special: stays active [spec #144]: expected true" }], new Set([bun])).map(({ test }) => test)).toEqual(["Lua32: a newly broken special: stays active [spec #144]"]);
});

test("the pre-push gate type-checks and audits a push that changes TypeScript, and skips one that doesn't [spec AGENTS.md]", () => {
  expect(checksFor(["ts/scripts/wisp/buildInputs.ts"]).map(({ name }) => name)).toEqual(["clean room", "type-check ts", "type escapes and source shapes"]);
  expect(checksFor(["docs/play.md", "controller/src/main.rs"]).map(({ name }) => name)).toEqual(["clean room"]);
  expect(checksFor([])).toEqual([]);
});

test("a push that changes clips or model build inputs checks the model facts, and its refusal names the refresh command [spec AGENTS.md]", () => {

  const checks = checksFor(["build-inputs.json", "tools/animations/thrall-clips.ts", "ts/src/game/presentation/heroes/thrallClips.ts"]);
  expect(checks.map(({ name }) => name)).toContain("model facts fresh");
  expect(checks.find(({ name }) => name === "model facts fresh")?.fix).toContain("bun wisp view models");
  expect(checksFor(["build-inputs.json"]).map(({ name }) => name)).toEqual(["clean room", "model facts fresh", "generated models stored"]);
});

test("a push that regenerates stage decks checks the stored family holds them (#338: 350ade3d1 landed a deck the store lacked) [spec AGENTS.md]", () => {
  expect(checksFor(["ts/src/game/assets/stageAssetInfo.ts"]).map(({ name }) => name)).toContain("generated models stored");
});


test("a push to main is refused for an affected test that main's CI run doesn't fail, naming it and its rerun, and not for one main already fails [spec AGENTS.md]", () => {
  const game = "GAME_MODULES=game/sim/combat.tests.ts bun test test/game.test.ts";
  const x = "src/game/sim/combat > X shield breaks at zero [spec #1]";
  const y = "src/game/sim/combat > Y knockback grows with damage [spec #2]";
  const output = (...failing: string[]) => ["test/game.test.ts:", "(pass) src/game/sim/combat > hitstun [0.20ms]", ...failing.map((name) => `(fail) ${name} [1.00ms]`), "", " 1 pass", ` ${failing.length} fail`].join("\n");
  const known = new Set([x, "Lua32: X shield breaks at zero [spec #1]"]);

  const broken = newFailures([
    { command: game, exitCode: 1, output: output(x, y) },
    { command: "GAME_MODULES=src/game/sim/combat.tests.ts bun scripts/lua-tests.ts", exitCode: 1, output: "fail X shield breaks at zero [spec #1]: expected 0\nfail Y knockback grows with damage [spec #2]: expected 3\n0 of 2 passed" },
  ], known);
  expect(broken.map(({ test }) => test)).toEqual([y, "Lua32: Y knockback grows with damage [spec #2]"]);
  const message = refusal(broken, "main 958e793180: 1 failing");
  expect(message).toContain(y);
  expect(message).toContain(`reproduce: cd ts && ${game} -t '^src/game/sim/combat Y knockback grows with damage \\[spec #2\\]'`);
  expect(message).not.toContain("X shield");

  expect(newFailures([{ command: game, exitCode: 1, output: output(x) }], known)).toEqual([]);

  expect(newFailures([{ command: game, exitCode: 134, output: "Segmentation fault" }], known).map(({ test }) => test)).toEqual([`process: ${game} exited 134`]);
});

test("a gate step past its budget dies with everything it started, so git's push isn't held open by an orphan on the hook's pipe [spec #240]", async () => {

  const directory = mkdtempSync(join(tmpdir(), "pre-push-reap-"));
  const pidFile = join(directory, "grandchild.pid");


  const record = `while read key first rest; do [ "$key" = NSpid: ] && echo "$first $rest" > ${pidFile}; done < /proc/self/status; exec sleep 30`;
  const step = ["sh", "-c", `sh -c '${record}' & sleep 30`];
  const hook = `import { Effect } from "effect"; import { run } from ${JSON.stringify(join(import.meta.dir, "../scripts/prePush.ts"))};
    await Effect.runPromise(run(${JSON.stringify(step)}, ".").pipe(Effect.timeoutOption("1 second")));`;
  const gate = Bun.spawn([process.execPath, "-e", hook], { cwd: join(import.meta.dir, ".."), stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  const alive = (pid: number) => existsSync(`/proc/${pid}`) && !/^\d+ \(.*\) Z/.test(readFileSync(`/proc/${pid}/stat`, "utf8"));
  let procPid = 0;
  let ownPid = 0;
  try {

    const ended = await Promise.race([gate.exited.then(() => true), Bun.sleep(11_000).then(() => false)]);
    const pids = readFileSync(pidFile, "utf8").trim().split(/\s+/).map(Number);
    [procPid, ownPid] = [pids[0]!, pids.at(-1)!];
    expect(ended).toBe(true);

    for (let waited = 0; alive(procPid) && waited < 5000; waited += 50) await Bun.sleep(50);
    expect(alive(procPid)).toBe(false);
  } finally {
    gate.kill("SIGKILL");
    if (procPid > 0 && alive(procPid)) process.kill(ownPid, "SIGKILL");
    rmSync(directory, { recursive: true, force: true });
  }
}, 20_000);
