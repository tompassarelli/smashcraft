import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { model as mdx, parseMDL } from "war3-model";
import { quat } from "gl-matrix";
import { stageSkyMdl } from "../scripts/stageSky";
import { generateModelMDX, parseModelMDX } from "../scripts/mdxCodec";
import { DrawnModel } from "../scripts/wisp/hurtboxView";
import { INPUTS_STORE, MANIFEST, assetsView, readManifest } from "../scripts/wisp/buildInputs";
import { headlessRender } from "../scripts/wisp/headlessRender";
import { DEFINITIVE_BODY_MODELS } from "../scripts/wisp/mapInputs";
import { Character } from "../src/game/sim/codes";
import { DEFINITIVE_FIGHTERS } from "../src/game/assets/definitiveFighters";
import { originalClip } from "../src/game/assets/fighterOriginalClipInfo";
import { HUMANOID_JOINTS, RIG_FIELDS, canonicalMotion, rigNode, type FighterRig } from "../../tools/animations/canonical-rig";
import { authoredMotion, definitiveBody, fighterBodies, playedMoves } from "../../tools/animations/hd-models";
import { FIGHTER_RIGS } from "../../tools/animations/hd-rigs";
import { generateHdBody } from "../../tools/animations/hd-retarget";
import { fighters, hash } from "../../tools/animations/original-clips";
import { sweep } from "./sweep";

test("every fighter maps its Classic and Definitive skeletons onto the canonical rig with per-fighter fields only [spec #366]", () => {
  expect([...FIGHTER_RIGS.keys()].sort((a, b) => a - b)).toEqual(Object.values(Character).toSorted((a, b) => a - b));
  for (const [character, rig] of FIGHTER_RIGS) {
    expect(Object.keys(rig).filter((field) => !RIG_FIELDS.has(field)), `fighter ${character}`).toEqual([]);
    expect(Object.keys(rig.classic).filter((joint) => !(HUMANOID_JOINTS as readonly string[]).includes(joint)), `fighter ${character}`).toEqual([]);
    expect(rig.classic.head, `fighter ${character}`).toBeDefined();
    if (DEFINITIVE_FIGHTERS.has(character as Character)) {
      expect(rig.pairs.length, `fighter ${character}`).toBeGreaterThan(0);
      expect(rig.stockPath, `fighter ${character}`).toBeDefined();
    }
  }
});

/** A shoulder-to-hand arm: Classic points it forward, the stock Definitive body points it up on shorter bones. */
function arm(definitive: boolean) {
  const model = parseMDL(stageSkyMdl("stock.blp"));
  model.Sequences = [
    { ...structuredClone(model.Sequences[0]!), Name: "Stand", Interval: new Uint32Array([0, 100]) },
    { ...structuredClone(model.Sequences[0]!), Name: "Strike", Interval: new Uint32Array([200, 300]) },
  ];
  const shoulder = model.Bones[0]!;
  shoulder.Name = "Shoulder";
  shoulder.PivotPoint = new Float32Array([0, 0, 100]);
  const hand: mdx.Bone = { ...structuredClone(shoulder), Name: "Hand", ObjectId: 1, Parent: 0, PivotPoint: new Float32Array(definitive ? [0, 0, 120] : [30, 0, 100]) };
  model.Bones.push(hand); model.Nodes = [shoulder, hand]; model.PivotPoints = [shoulder.PivotPoint, hand.PivotPoint];
  const mesh = model.Geosets[0]!;
  mesh.Vertices = new Float32Array(definitive ? [0, 0, 100, 0, 0, 120, 10, 0, 120] : [0, 0, 100, 30, 0, 100, 30, 0, 110]);
  mesh.Normals = new Float32Array(9);
  mesh.TVertices = [new Float32Array(6)];
  mesh.VertexGroup = new Uint8Array([0, 1, 1]);
  mesh.Groups = [[0], [1]];
  mesh.TotalGroupsCount = 2;
  mesh.Faces = new Uint16Array([0, 1, 2]);
  if (definitive) {
    model.Version = 1800;
    mesh.SkinWeights = new Uint8Array([0, 0, 0, 0, 255, 0, 0, 0, 1, 0, 0, 0, 255, 0, 0, 0, 1, 0, 0, 0, 255, 0, 0, 0]);
    return model;
  }
  return parseModelMDX(generateModelMDX(model));
}
const turned = (degrees: number) => new Float32Array(quat.setAxisAngle(quat.create(), [0, 1, 0], -degrees * Math.PI / 180));

test("editing one canonical move changes that move in both bodies' exported animation and no other move [spec #366]", () => {
  const rig: FighterRig = { character: Character.kobold, classic: { "shoulder.R": "Shoulder", "wrist.R": "Hand" }, pairs: [["shoulder.R", "Shoulder"], ["wrist.R", "Hand"]] };
  const motion = canonicalMotion(arm(false), rig);
  const shoulder = motion.Bones.find((bone) => bone.Name === rigNode("shoulder.R"))!;
  shoulder.Rotation = { LineType: mdx.LineType.Linear, GlobalSeqId: null, Keys: [
    { Frame: 0, Vector: turned(0) }, { Frame: 100, Vector: turned(0) },
    { Frame: 200, Vector: turned(0) }, { Frame: 300, Vector: turned(60) },
  ] };
  const stock = generateHdBody(arm(true));
  const moves = { classic: [0, 1], definitive: [0, 1] };
  const before = fighterBodies(motion, rig, stock, moves);
  const edited = structuredClone(motion);
  edited.Bones.find((bone) => bone.Name === rigNode("shoulder.R"))!.Rotation!.Keys[3]!.Vector = turned(30);
  const after = fighterBodies(edited, rig, stock, moves);
  const drawn = (bytes: ArrayBuffer, seconds: number) => Array.from(new DrawnModel(bytes, 1).triangles(0, seconds, 1));
  for (const look of ["classic", "definitive"] as const) {
    const was = look === "classic" ? before.classic : before.definitive!.bytes, now = look === "classic" ? after.classic : after.definitive!.bytes;
    expect(drawn(now, 0.05), look).toEqual(drawn(was, 0.05));
    const struck = drawn(now, 0.3), original = drawn(was, 0.3);
    expect(Math.max(...struck.map((value, index) => Math.abs(value - original[index]!))), look).toBeGreaterThan(5);
  }
});

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const family = join(INPUTS_STORE, "original-clips-static-lights", manifest["original-clips-static-lights"] ?? "missing");
for (const [character, rig] of FIGHTER_RIGS) {
  const name = fighters.get(character)?.name ?? `${character}`;
  sweep(`${name}'s shipped Classic and Definitive bodies rebuild exactly from canonical motion and its rig mapping [spec #366]`, async () => {
    if (!existsSync(family)) return;
    const assets = assetsView(await Effect.runPromise(readManifest()));
    const motion = authoredMotion(await Bun.file(join(assets, fighters.get(character)!.source)).arrayBuffer(), rig);
    const body = originalClip(character, 0)!.modelPath;
    const shipped = DEFINITIVE_FIGHTERS.has(character as Character);
    let stock: ArrayBuffer | undefined;
    if (rig.pairs.length > 0) {
      const resolved = await headlessRender({ assets }).resolveAsset(rig.stockPath!.replace(/^war3\.w3mod:_de\.w3mod:/, "").replaceAll("/", "\\"), "definitive");
      stock = resolved.bytes!.slice().buffer;
    }
    const bodies = fighterBodies(motion, rig, stock);
    expect(body).toContain(hash(bodies.classic));
    expect(bodies.definitive === undefined).toBe(!shipped);
    expect(DEFINITIVE_BODY_MODELS.includes(body)).toBe(shipped);
    if (stock !== undefined) {
      const definitive = bodies.definitive?.bytes ?? definitiveBody(motion, stock, rig, playedMoves(character, motion).definitive).bytes;
      const published = await Bun.file(join(family, "imports", "_de.w3mod", ...body.split("\\"))).arrayBuffer();
      expect(hash(definitive)).toBe(hash(published));
    }
  }, 600_000);
}
