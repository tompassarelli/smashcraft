// A stage's day/night lighting model: the MDL that tools/stage/package.ts
// compiles, named after its text so a test can tell whether the shipped model
// is the one the stage's light declares (smashcraft:docs/design/visual-quality.md).
import type { StageLight } from "../src/game/assets/stageLighting";

const hash = (text: string) => new Bun.CryptoHasher("sha256").update(text).digest("hex");
/** A colour as the MDL text writes it: war3-model reads MDL colours red first and stores them blue first, as the game reads them. */
const colour = ([red, green, blue]: readonly [number, number, number]) => `{ ${[red, green, blue].map((channel) => Number((channel / 255).toFixed(4))).join(", ")} }`;
const EXTENT = "MinimumExtent { -1, -1, -1 }, MaximumExtent { 1, 1, 1 }, BoundsRadius 1,";
/**
 * The classic sun's direction (the stock Lordaeron lighting's rotation), so
 * fighters keep the shading their models were painted for.
 */
const SUN_ROTATION = "{ 0.3815, -0.2159, -0.4426, 0.7823 }";

/**
 * A directional light with constant colours over the whole day: the game
 * samples the model at the time of day, which the shell freezes at noon.
 */
export function stageLightMdl({ key, ambient, intensity = 1 }: StageLight): string {
  return `Version { FormatVersion 800, }
Model "Smashcraft stage light" { BlendTime 150, ${EXTENT} }
Sequences 1 { Anim "Stand" { Interval { 333, 60333 }, ${EXTENT} } }
Light "StageSun" {
  ObjectId 0,
  Directional,
  static AttenuationStart 80,
  static AttenuationEnd 200,
  static Intensity ${intensity},
  static Color ${colour(key)},
  static AmbIntensity ${intensity},
  static AmbColor ${colour(ambient)},
  Rotation 1 { DontInterp, 333: ${SUN_ROTATION}, }
}
PivotPoints 1 { { 0, 0, 0 }, }
`;
}

/** The lighting model's file name. */
export const stageLightModelFile = (mdl: string) => `StageLight-${hash(mdl)}.mdx`;
