// The map's war3mapPostProcessing.txt (#288; docs/design/visual-quality.md,
// "Map-level post-processing"). The game reads it over its own
// war3.w3mod:PostProcessingConfig.txt, so only the keys listed here change;
// Blizzard's Forgotten Hollow scenario ships such a partial file. Every value
// starts from a Blizzard file in the 3.0.1.24342 storage:
// - [ASSAO] Radius 6, ShadowMultiplier 3: war3.w3mod:maps\forsakenkingdom\scenario\
//   (1)forgottenhollow.w3x war3mapPostProcessing.txt, the only Blizzard map that
//   ships one (the 96 Reforged campaign maps and other stock maps ship none).
//   Stock is Radius 40, ShadowMultiplier 1.2: a wide soft crease; 6 keeps the
//   darkening to where a fighter meets the deck.
// - [Bloom] Enabled 1 with BloomThreshold 0.9: stock PostProcessingConfig.txt has
//   Enabled 0 and BloomThreshold 0.72. Lit fighters and decks stay under 0.9
//   because stage lights cap intensity at 1 (stage light rule 5); additive sparks,
//   fel and fire accents and ice glints exceed it. Intensity, saturation and blur
//   stay stock (0.9, 1, 3.75).
// Classic has no ASSAO or bloom pass, so it draws as before.
import type { GeneratedFile } from "wisp/scripts/wisp/mapBuild";

export const POST_PROCESSING = {
  ASSAO: { Radius: "6.000000", ShadowMultiplier: "3.000000" },
  Bloom: { Enabled: "1", BloomThreshold: "0.900000" },
} as const;

/** The file in Blizzard's own layout: CRLF lines and a blank line after each section. */
export function postProcessingText(): string {
  return Object.entries(POST_PROCESSING)
    .map(([section, keys]) => [`[${section}]`, ...Object.entries(keys).map(([key, value]) => `${key}=${value}`), ""].join("\r\n"))
    .join("\r\n");
}

export const POST_PROCESSING_FILE: GeneratedFile = { entry: "war3mapPostProcessing.txt", contents: new TextEncoder().encode(postProcessingText()) };
