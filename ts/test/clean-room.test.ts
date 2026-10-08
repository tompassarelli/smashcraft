import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { cleanRoom } from "wisp/scripts/cleanRoom";
import { SMASHCRAFT_POLICY } from "../scripts/cleanRoom";

test("a committed .blp is refused unless the allowlist names its origin, and the refusal cites the clean-room rules [spec wisp:docs/clean-room.md]", async () => {
  const root = mkdtempSync(join(tmpdir(), "smashcraft-clean-room-"));
  try {
    writeFileSync(join(root, "Footman.blp"), "BLP1....");
    writeFileSync(join(root, "Panel.fdf"), "Frame \"TEXT\" \"Panel\" {}");
    writeFileSync(join(root, "clean-room-allowlist.tsv"), "Panel.fdf\tgenerated\tbun scripts/wisp/uiFrames.ts\n");
    Bun.spawnSync(["git", "init", "-q"], { cwd: root });
    Bun.spawnSync(["git", "add", "Footman.blp", "Panel.fdf", "clean-room-allowlist.tsv"], { cwd: root });
    const problems = await Effect.runPromise(cleanRoom(root, SMASHCRAFT_POLICY));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toStartWith("clean room: Footman.blp is a game-format file.");
    expect(problems[0]).toContain("wisp:docs/clean-room.md");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
