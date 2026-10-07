import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("native contrast reader measures white/black correctly and rejects an empty mask", async () => {
  const dir = mkdtempSync(join(tmpdir(), "smashcraft-contrast-"));
  try {
    const image = (fighter: boolean) => {
      const pixels = new Uint8Array(100 * 100 * 3);
      if (fighter) for (let y = 40; y < 60; y++) for (let x = 40; x < 60; x++) pixels.fill(255, (y * 100 + x) * 3, (y * 100 + x) * 3 + 3);
      return new Blob(["P6\n100 100\n255\n", pixels]);
    };
    const mask = join(dir, "mask.ppm"), frame = join(dir, "frame.ppm"), empty = join(dir, "empty.ppm");
    await Promise.all([Bun.write(mask, image(true)), Bun.write(frame, image(true)), Bun.write(empty, image(false))]);
    const command = join(import.meta.dir, "../../tools/stage/contrast.ts");
    const run = Bun.spawn([process.execPath, command, mask, frame], { stdout: "pipe", stderr: "pipe" });
    const output = await new Response(run.stdout).text();
    expect(await run.exited).toBe(0);
    expect(output).toContain("fighters 400 px in 1 blobs");
    expect(output).toContain("frame.ppm\t100.0\t0.0\t100.0\t100.0\t");
    const invalid = Bun.spawn([process.execPath, command, empty, frame], { stdout: "pipe", stderr: "pipe" });
    expect(await invalid.exited).not.toBe(0);
    expect(await new Response(invalid.stderr).text()).toContain("no fighter silhouette found");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
