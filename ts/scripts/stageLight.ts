


import type { StagePointLight } from "../src/game/assets/stagePointLights";

const hash = (text: string) => new Bun.CryptoHasher("sha256").update(text).digest("hex");
// war3-model reads MDL colours red first and stores them blue first, as Warcraft reads them.
const colour = ([red, green, blue]: readonly [number, number, number]) => `{ ${[red, green, blue].map((channel) => Number((channel / 255).toFixed(4))).join(", ")} }`;
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
