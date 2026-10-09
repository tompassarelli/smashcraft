import { chmodSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { headlessRender } from "../scripts/wisp/headlessRender";

test("a Warcraft update cannot reuse the previous build's stock render bytes [spec AGENTS.md]", async () => {
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
    expect(used.assets["classic::abilities/spell.mdx"].sha256).toBe(new Bun.CryptoHasher("sha256").update("retuned spell").digest("hex"));
    expect(used.assets["classic::abilities/spell.mdx"].bytes).toBe(13);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("[spec wisp#84] Definitive map body overrides stock while Classic keeps its imported body", async () => {
  const directory = mkdtempSync(join(tmpdir(), "smashcraft-definitive-assets-"));
  try {
    await Bun.write(join(directory, "classic"), "classic body");
    await Bun.write(join(directory, "definitive"), "definitive body");
    const renderer = headlessRender({ assets: directory, imports: [
      { entry: "Unit.mdx", source: join(directory, "classic") },
      { entry: "_de.w3mod\\Unit.mdx", source: join(directory, "definitive") },
    ] });
    const classic = await renderer.resolveAsset("Unit.mdl", "classic");
    const definitive = await renderer.resolveAsset("Unit.mdl", "definitive");
    expect(new TextDecoder().decode(classic.bytes)).toBe("classic body");
    expect(new TextDecoder().decode(definitive.bytes)).toBe("definitive body");
    expect(definitive.selected).toEqual({ source: "map", layer: "_de.w3mod", path: "_de.w3mod/Unit.mdx" });
    expect(definitive.attempts).toHaveLength(1);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("stock texture suffixes survive a missing extractor output and keep the body layer [repro wisp#82]", async () => {
  const directory = mkdtempSync(join(tmpdir(), "smashcraft-stock-suffix-"));
  try {
    const extractor = join(directory, "extract.ts");
    await Bun.write(extractor, '#!/usr/bin/env bun\nimport {join} from "node:path"; const path=process.argv[3]; const source=join(process.argv[2],path === "war3.w3mod:weather/rays.dds" ? "dds" : path.endsWith(":_de.w3mod:cave.blp") ? "blp" : "missing"); if(await Bun.file(source).exists()) await Bun.write(process.argv[4],await Bun.file(source).bytes());\n');
    chmodSync(extractor, 0o755);
    await Bun.write(join(directory, ".build.info"), "Active!DEC:1\n1\n");
    const dds = new Uint8Array(136), header = new DataView(dds.buffer);
    dds.set(new TextEncoder().encode("DDS ")); header.setUint32(4, 124, true);
    for (const [offset, value] of [[8, 0x81007], [12, 4], [16, 4], [20, 8], [76, 32], [80, 4], [108, 0x1000]]) header.setUint32(offset, value, true);
    dds.set(new TextEncoder().encode("DXT1"), 84); header.setUint16(128, 0xffff, true);
    await Bun.write(join(directory, "dds"), dds);
    await Bun.write(join(directory, "blp"), "BLP selected layer");
    const renderer = headlessRender({ storage: directory, cache: join(directory, "cache"), extractor, assets: directory, imports: [] });
    expect((await renderer.readAsset("Weather/Rays.tif"))?.slice(0, 8)).toEqual(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));
    const selected = await renderer.resolveAsset("Cave.tif", "definitive", { source: "stock", layer: "_de.w3mod", path: "Cave.mdx" });
    expect(new TextDecoder().decode(selected.bytes)).toBe("BLP selected layer");
    expect(selected.selected?.layer).toBe("_de.w3mod");
    const missing = await renderer.resolveAsset("Weather/Rays.tif", "definitive", { source: "map", layer: "_de.w3mod", path: "Imported.mdx" });
    expect(missing.bytes).toBeUndefined();
    expect(missing.attempts.filter((attempt) => attempt.source === "stock").map((attempt) => attempt.layer)).toEqual(["_de.w3mod"]);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
