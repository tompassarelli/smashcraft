import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
