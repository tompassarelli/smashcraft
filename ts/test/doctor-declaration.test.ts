import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { smashcraftDoctor } from "../scripts/wisp/doctor";

test("offline pair aliases a and b never construct the signed-in clients' launcher commands [spec AGENTS.md]", () => {
  const dir = mkdtempSync(join(tmpdir(), "smashcraft-doctor-"));
  try {
    const path = join(dir, "clients.json");
    writeFileSync(path, JSON.stringify({ clients: ["a", "b"].map(name => ({ name, offline: true, run: join(dir, "absent-desktop"), documents: `${dir}/${name}/pfx/drive_c/users/steamuser/Documents/Warcraft III` })) }));
    expect(smashcraftDoctor(path)).toEqual({ clientsFile: path, start: {} });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a clone starts through its launch script and signs nothing in [spec AGENTS.md]", () => {
  const dir = mkdtempSync(join(tmpdir(), "smashcraft-doctor-"));
  try {
    const path = join(dir, "clients.json");
    const run = join(dir, "desktop");
    writeFileSync(path, JSON.stringify({ clients: [{ name: "clone-a", run, documents: `${dir}/clone-a/pfx/drive_c/users/steamuser/Documents/Warcraft III` }] }));
    const declaration = smashcraftDoctor(path);
    expect(declaration.start["clone-a"]).toMatchObject({ kind: "command", command: [expect.stringMatching(/\/\.local\/share\/wisp\/online\/launch\.sh$/), "a", run] });
    expect(declaration.accounts).toBeUndefined();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
