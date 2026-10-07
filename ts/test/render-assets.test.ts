import { chmodSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { headlessRender } from "../scripts/wisp/headlessRender";

test("a Warcraft update cannot reuse the previous build's stock render bytes", async () => {
  const directory = mkdtempSync(join(tmpdir(), "smashcraft-render-assets-"));
  try {
    const extractor = join(directory, "extract.ts"), manifest = join(directory, "used.json");
    await Bun.write(extractor, '#!/usr/bin/env bun\nimport {join} from "node:path"; await Bun.write(process.argv[4], await Bun.file(join(process.argv[2], "payload")).bytes());\n');
    chmodSync(extractor, 0o755);
    const options = { storage: directory, cache: join(directory, "cache"), extractor, assets: directory, imports: [], manifest };
    const version = async (name: string, payload: string) => {
      await Bun.write(join(directory, ".build.info"), `Active!DEC:1|Version!STRING:0\n1|${name}\n`);
      await Bun.write(join(directory, "payload"), payload);
    };
    await version("3.0.0.24268", "old spell");
    expect(new TextDecoder().decode(await headlessRender(options).readAsset("Abilities/Spell.mdx"))).toBe("old spell");
    await version("3.0.1.24342", "retuned spell");
    expect(new TextDecoder().decode(await headlessRender(options).readAsset("Abilities/Spell.mdx"))).toBe("retuned spell");
    const used = await Bun.file(manifest).json();
    expect(used.stock.fields.Version).toBe("3.0.1.24342");
    expect(used.assets["abilities/spell.mdx"].sha256).toBe(new Bun.CryptoHasher("sha256").update("retuned spell").digest("hex"));
    expect(used.assets["abilities/spell.mdx"].bytes).toBe(13);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
