// Foreign model boundary: encode the authored MDL and expose its clip metadata.
import { parseMDL, generateMDX } from "war3-model";
import { join } from "node:path";

const project = join(import.meta.dir, "../..");
const assetDirectory = join(project, "build/animation-assets");
const model = parseMDL(await Bun.file(join(assetDirectory, "archer-jab.mdl")).text());
const jabIndex = model.Sequences.findIndex(sequence => sequence.Name === "Attack Jab");
if (jabIndex < 0) throw new Error("authored model has no Attack Jab sequence");
const jab = model.Sequences[jabIndex];
const duration = (jab.Interval[1] - jab.Interval[0]) / 1000;
if (!(duration > 0)) throw new Error("jab sequence must have a positive duration");
await Bun.write(join(assetDirectory, "ArcherFighter.mdx"), generateMDX(model));
await Bun.write(join(assetDirectory, "FighterAssetInfo.wurst"),
    `package FighterAssetInfo\npublic constant int ARCHER_JAB_INDEX = ${jabIndex}\npublic constant real ARCHER_JAB_SECONDS = ${duration.toFixed(6)}\n`);
console.log(`Archer model packaged: jab sequence ${jabIndex}, ${duration}s`);
console.log("Texture references:", model.Textures.map(texture => texture.Image));
