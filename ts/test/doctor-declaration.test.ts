import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { smashcraftDoctor } from "../scripts/wisp/doctor";

test("offline pair aliases a and b never construct the signed-in clients' launcher commands", () => {
  const dir = mkdtempSync(join(tmpdir(), "smashcraft-doctor-"));
  try {
    const path = join(dir, "clients.json");
    writeFileSync(path, JSON.stringify({ clients: ["a", "b"].map(name => ({ name, offline: true, run: join(dir, "absent-desktop"), documents: `${dir}/${name}/pfx/drive_c/users/steamuser/Documents/Warcraft III` })) }));
    expect(smashcraftDoctor(path)).toEqual({ clientsFile: path, start: {} });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
