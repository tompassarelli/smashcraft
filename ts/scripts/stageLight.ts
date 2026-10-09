


import type { StageLight } from "../src/game/assets/stageLighting";
import type { StagePointLight } from "../src/game/assets/stagePointLights";

const hash = (text: string) => new Bun.CryptoHasher("sha256").update(text).digest("hex");
// war3-model reads MDL colours red first and stores them blue first, as Warcraft reads them.
const colour = ([red, green, blue]: readonly [number, number, number]) => `{ ${[red, green, blue].map((channel) => Number((channel / 255).toFixed(4))).join(", ")} }`;
const EXTENT = "MinimumExtent { -1, -1, -1 }, MaximumExtent { 1, 1, 1 }, BoundsRadius 1,";




const SUN_ROTATION = "{ 0.3815, -0.2159, -0.4426, 0.7823 }";





export function stageLightMdl({ key, ambient, intensity: binary32 = 1 }: StageLight): string {

  const intensity = Number(binary32.toPrecision(7));
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


export const stageLightModelFile = (mdl: string) => `StageLight-${hash(mdl)}.mdx`;





export function stagePointLightMdl({ color, intensity, flicker, loopMs, radius }: StagePointLight): string {
  const extent = `MinimumExtent { -${radius}, -${radius}, -${radius} }, MaximumExtent { ${radius}, ${radius}, ${radius} }, BoundsRadius ${radius},`;
  const low = Number((intensity * (1 - flicker)).toFixed(4));
  const high = Number((intensity * (1 + flicker)).toFixed(4));
  return `Version { FormatVersion 800, }
Model "Smashcraft stage point light" { BlendTime 0, ${extent} }
Sequences 1 { Anim "Stand" { Interval { 0, ${loopMs} }, ${extent} } }
Light "ForgeFire" {
  ObjectId 0,
  Omnidirectional,
  static AttenuationStart 0,
  static AttenuationEnd ${radius},
  Intensity 4 { Linear, 0: ${intensity}, ${Math.round(loopMs / 4)}: ${high}, ${Math.round(loopMs * 3 / 4)}: ${low}, ${loopMs}: ${intensity}, }
  static Color ${colour(color)},
  static AmbIntensity 0,
  static AmbColor { 0, 0, 0 },
}
PivotPoints 1 { { 0, 0, 0 }, }
`;
}


export const stagePointLightModelFile = (mdl: string) => `StagePointLight-${hash(mdl)}.mdx`;
