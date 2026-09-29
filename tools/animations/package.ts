// Foreign model boundary: encode the authored MDL and expose its clip metadata.
import { parseMDL, generateMDX } from "war3-model";
import { join } from "node:path";

const project = join(import.meta.dir, "../..");
const assetDirectory = join(project, "build/animation-assets");

const clips = [
    ["JAB", "Attack Jab"],
    ["FORWARD_TILT", "Forward Tilt"],
    ["FORWARD_TILT_UP", "Forward Tilt Up"],
    ["FORWARD_TILT_DOWN", "Forward Tilt Down"],
    ["JUMP", "Jump"],
    ["DOUBLE_JUMP", "Double Jump"],
    ["ROLL_FORWARD", "Roll Forward"],
    ["ROLL_BACKWARD", "Roll Backward"],
    ["SPOT_DODGE", "Spot Dodge"],
    ["KNOCKDOWN", "Knockdown"],
    ["GET_UP", "Get Up"],
    ["GET_UP_ATTACK", "Get Up Attack"],
];
const declarations: string[] = [];
for (const fighter of ["Archer", "Rifleman"]) {
    const prefix = fighter.toUpperCase();
    const model = parseMDL(await Bun.file(join(assetDirectory, `${fighter.toLowerCase()}-fighter.mdl`)).text());
    const metadata = clips.map(([key, name]) => {
        const index = model.Sequences.findIndex(sequence => sequence.Name === name);
        if (index < 0) throw new Error(`authored model has no ${name} sequence`);
        const sequence = model.Sequences[index];
        const seconds = (sequence.Interval[1] - sequence.Interval[0]) / 1000;
        if (!(seconds > 0)) throw new Error(`${name} sequence must have a positive duration`);
        return [key, index, seconds];
    });
    const modelBytes = generateMDX(model);
    const modelHash = new Bun.CryptoHasher("sha256").update(new Uint8Array(modelBytes)).digest("hex");
    const modelPath = `war3mapImported\\${fighter}Fighter-${modelHash}.mdx`;
    await Bun.write(join(assetDirectory, `${fighter}Fighter.mdx`), modelBytes);
    const constants = metadata.flatMap(([key, index, seconds]) => [
        `public constant int ${prefix}_${key}_INDEX = ${index}`,
        `public constant real ${prefix}_${key}_SECONDS = ${seconds.toFixed(6)}`,
    ]);
    declarations.push(`public constant string ${prefix}_MODEL_FILE = ${JSON.stringify(modelPath)}`, ...constants);
    console.log(`${fighter} model packaged:`, metadata.map(([key, index, seconds]) => `${key} ${index} ${seconds}s`).join("; "));
    console.log("Texture references:", model.Textures.map(texture => texture.Image));
}
await Bun.write(join(assetDirectory, "FighterAssetInfo.wurst"), `package FighterAssetInfo\n${declarations.join("\n")}\n`);
