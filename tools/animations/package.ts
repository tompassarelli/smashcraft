// Foreign model boundary: encode the authored MDL and expose its clip metadata.
import { parseMDL, generateMDX } from "war3-model";
import { join } from "node:path";

const project = join(import.meta.dir, "../..");
const assetDirectory = join(project, "build/animation-assets");
const model = parseMDL(await Bun.file(join(assetDirectory, "archer-fighter.mdl")).text());
const clips = [
    ["JAB", "Attack Jab"],
    ["ROLL_FORWARD", "Roll Forward"],
    ["ROLL_BACKWARD", "Roll Backward"],
    ["SPOT_DODGE", "Spot Dodge"],
];
const metadata = clips.map(([key, name]) => {
    const index = model.Sequences.findIndex(sequence => sequence.Name === name);
    if (index < 0) throw new Error(`authored model has no ${name} sequence`);
    const sequence = model.Sequences[index];
    const seconds = (sequence.Interval[1] - sequence.Interval[0]) / 1000;
    if (!(seconds > 0)) throw new Error(`${name} sequence must have a positive duration`);
    return [key, index, seconds];
});
const modelBytes = generateMDX(model);
const modelHash = new Bun.CryptoHasher("sha256").update(new Uint8Array(modelBytes)).digest("hex").slice(0, 12);
const modelPath = `war3mapImported\\ArcherFighter-${modelHash}.mdx`;
await Bun.write(join(assetDirectory, "ArcherFighter.mdx"), modelBytes);
const constants = metadata.flatMap(([key, index, seconds]) => [
    `public constant int ARCHER_${key}_INDEX = ${index}`,
    `public constant real ARCHER_${key}_SECONDS = ${seconds.toFixed(6)}`,
]);
await Bun.write(join(assetDirectory, "FighterAssetInfo.wurst"), `package FighterAssetInfo\npublic constant string ARCHER_MODEL_FILE = ${JSON.stringify(modelPath)}\n${constants.join("\n")}\n`);
console.log("Archer model packaged:", metadata.map(([key, index, seconds]) => `${key} ${index} ${seconds}s`).join("; "));
console.log("Texture references:", model.Textures.map(texture => texture.Image));
