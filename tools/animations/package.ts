// Foreign model boundary: encode the authored MDL and expose its clip metadata.
import { parseMDL, generateMDX } from "war3-model";
import { join } from "node:path";

const project = join(import.meta.dir, "../..");
const assetDirectory = join(project, "build/animation-assets");

const clips = [
    ["GRAB", "Grab"],
    ["GRAB_HOLD", "Grab Hold"],
    ["GRABBED", "Grabbed"],
    ["PUMMEL", "Pummel"],
    ["THROW_FORWARD", "Throw Forward"],
    ["THROW_BACK", "Throw Back"],
    ["THROW_UP", "Throw Up"],
    ["THROW_DOWN", "Throw Down"],
    ["VICTIM_PUMMEL", "Victim Pummel"],
    ["VICTIM_THROW_FORWARD", "Victim Throw Forward"],
    ["VICTIM_THROW_BACK", "Victim Throw Back"],
    ["VICTIM_THROW_UP", "Victim Throw Up"],
    ["VICTIM_THROW_DOWN", "Victim Throw Down"],
    ["DAMAGE_GROUND", "Damage Ground"],
    ["DAMAGE_AIR", "Damage Air"],
    ["DAMAGE_TUMBLE", "Damage Tumble"],
    ["DAMAGE_SHIELD", "Damage Shield"],
    ["SPECIAL_NEUTRAL", "Special Neutral"],
    ["SPECIAL_NEUTRAL_AIR", "Special Neutral Air"],
    ["SPECIAL_SIDE", "Special Side"],
    ["SPECIAL_UP", "Special Up"],
    ["SPECIAL_DOWN", "Special Down"],
    ["AERIAL_NEUTRAL", "Aerial Neutral"],
    ["AERIAL_FORWARD", "Aerial Forward"],
    ["AERIAL_BACK", "Aerial Back"],
    ["AERIAL_UP", "Aerial Up"],
    ["AERIAL_DOWN", "Aerial Down"],
    ["JAB", "Attack Jab"],
    ["FORWARD_TILT", "Forward Tilt"],
    ["FORWARD_TILT_UP", "Forward Tilt Up"],
    ["FORWARD_TILT_DOWN", "Forward Tilt Down"],
    ["UP_TILT", "Up Tilt"],
    ["DOWN_TILT", "Down Tilt"],
    ["JUMP", "Jump"],
    ["DOUBLE_JUMP", "Double Jump"],
    ["ROLL_FORWARD", "Roll Forward"],
    ["ROLL_BACKWARD", "Roll Backward"],
    ["SPOT_DODGE", "Spot Dodge"],
    ["KNOCKDOWN", "Knockdown"],
    ["DOWN_DAMAGE", "Down Damage"],
    ["GET_UP", "Get Up"],
    ["GET_UP_ATTACK", "Get Up Attack"],
    ["LEDGE_HANG", "Ledge Hang"],
    ["LEDGE_CLIMB", "Ledge Climb"],
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
