

import { RANKS } from "./fetch.ts";

const shards = Number(process.env.SHARDS ?? 6);
for (const rank of RANKS) {
  const procs = Array.from({ length: shards }, (_, i) =>
    Bun.spawn(["bun", `${import.meta.dir}/extract.ts`, rank, `${i}`, `${shards}`], { stdout: "inherit", stderr: "inherit" }));
  const codes = await Promise.all(procs.map((p) => p.exited));
  if (codes.some((c) => c !== 0)) process.exit(1);
}
