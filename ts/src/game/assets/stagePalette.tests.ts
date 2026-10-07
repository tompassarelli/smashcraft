import { assertEquals, test } from "wisp/src/runtime/testing";
import { STAGE_CATALOG } from "../menu/stageCatalog";
import { stageScenery } from "../presentation/stageScenery";
import { f32 } from "wisp/src/sim/f32";
import { STAGE_DECK_PALETTES, luma } from "./stagePalette";

// smashcraft:docs/design/stage-art.md, rule 10.
test("every selectable stage has its own deck palette", () => {
  for (const { id, name } of STAGE_CATALOG) {
    assertEquals(STAGE_DECK_PALETTES.filter(({ stage }) => stage === id).length, 1, `${name} has no deck palette`);
  }
  const tops = STAGE_DECK_PALETTES.map(({ palette }) => palette.top.join(","));
  assertEquals(new Set(tops).size, tops.length, "two stages share a deck top");
});

test("each deck's top stands apart from its fog in value and its body is darker than its top", () => {
  for (const { stage, theme, palette } of STAGE_DECK_PALETTES) {
    const top = luma(palette.top);
    assertEquals(luma(palette.body) <= top - 50, true, `${theme}: body ${luma(palette.body)} is within 50 of top ${top}`);
    const fog = stageScenery(stage).fog;
    if (fog === undefined) continue;
    const background = luma([fog.red * 255, fog.green * 255, fog.blue * 255]);
    assertEquals(Math.abs(top - background) >= 40, true, `${theme}: top ${top} is within 40 of fog ${background}`);
  }
});

type Lab = readonly [lightness: number, a: number, b: number];

/** CIELAB of an sRGB colour (D65). */
function cieLab([red, green, blue]: readonly [number, number, number]): Lab {
  const linear = (channel: number) => { const c = channel / 255; return c <= f32(0.04045) ? c / f32(12.92) : ((c + f32(0.055)) / f32(1.055)) ** f32(2.4); };
  const [r, g, b] = [linear(red), linear(green), linear(blue)];
  const f = (t: number) => (t > 216 / 24389 ? t ** (1 / 3) : (24389 / 27 * t + 16) / 116);
  const x = f((f32(0.4124) * r + f32(0.3576) * g + f32(0.1805) * b) / f32(0.95047));
  const y = f(f32(0.2126) * r + f32(0.7152) * g + f32(0.0722) * b);
  const z = f((f32(0.0193) * r + f32(0.1192) * g + f32(0.9505) * b) / f32(1.08883));
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/** CIEDE2000 colour difference, which, unlike plain Lab distance, shrinks lightness steps among dark values the way the eye does. */
function colorDifference([l1, a1, b1]: Lab, [l2, a2, b2]: Lab): number {
  const degrees = Math.PI / 180;
  const hue = (a: number, b: number) => { if (a === 0 && b === 0) return 0; const h = Math.atan2(b, a) / degrees; return h < 0 ? h + 360 : h; };
  const chromaMean = (Math.sqrt(a1 * a1 + b1 * b1) + Math.sqrt(a2 * a2 + b2 * b2)) / 2;
  const g = 0.5 * (1 - Math.sqrt(chromaMean ** 7 / (chromaMean ** 7 + 25 ** 7)));
  const [p1, p2] = [(1 + g) * a1, (1 + g) * a2];
  const [c1, c2] = [Math.sqrt(p1 * p1 + b1 * b1), Math.sqrt(p2 * p2 + b2 * b2)];
  const [h1, h2] = [hue(p1, b1), hue(p2, b2)];
  let dh = c1 * c2 === 0 ? 0 : h2 - h1;
  if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
  const dHue = 2 * Math.sqrt(c1 * c2) * Math.sin(dh * degrees / 2);
  const lMean = (l1 + l2) / 2;
  const cMean = (c1 + c2) / 2;
  const hMean = c1 * c2 === 0 ? h1 + h2 : Math.abs(h1 - h2) > 180 ? (h1 + h2 + (h1 + h2 < 360 ? 360 : -360)) / 2 : (h1 + h2) / 2;
  const t = 1 - f32(0.17) * Math.cos((hMean - 30) * degrees) + f32(0.24) * Math.cos(2 * hMean * degrees) + f32(0.32) * Math.cos((3 * hMean + 6) * degrees) - f32(0.2) * Math.cos((4 * hMean - 63) * degrees);
  const sl = 1 + f32(0.015) * (lMean - 50) ** 2 / Math.sqrt(20 + (lMean - 50) ** 2);
  const sc = 1 + f32(0.045) * cMean;
  const sh = 1 + f32(0.015) * cMean * t;
  const rt = -2 * Math.sqrt(cMean ** 7 / (cMean ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hMean - 275) / 25) ** 2)) * degrees);
  const [dl, dc, dhs] = [(l2 - l1) / sl, (c2 - c1) / sc, dHue / sh];
  return Math.sqrt(dl * dl + dc * dc + dhs * dhs + rt * dc * dhs);
}

/**
 * What the arena camera shows beside and below a deck: the sky's dark lower
 * half. The native lower-camera captures of 7 Oct measured it near lightness 4
 * on every stage (#115).
 */
const LOWER_BACKDROP = cieLab([12, 12, 12]);

test("each deck's body and underside read against the dark backdrop below it", () => {
  for (const { theme, palette } of STAGE_DECK_PALETTES) {
    for (const part of ["body", "underside"] as const) {
      const difference = colorDifference(cieLab(palette[part]), LOWER_BACKDROP);
      assertEquals(difference >= 15, true, `${theme}: ${part} differs from the lower backdrop by only ΔE ${difference}`);
    }
  }
});
