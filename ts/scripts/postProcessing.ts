















import type { GeneratedFile } from "wisp/scripts/wisp/mapBuild";

export const POST_PROCESSING = {
  ASSAO: { Radius: "6.000000", ShadowMultiplier: "3.000000" },
  Bloom: { Enabled: "1", BloomThreshold: "0.900000" },
} as const;


export function postProcessingText(): string {
  return Object.entries(POST_PROCESSING)
    .map(([section, keys]) => [`[${section}]`, ...Object.entries(keys).map(([key, value]) => `${key}=${value}`), ""].join("\r\n"))
    .join("\r\n");
}

export const POST_PROCESSING_FILE: GeneratedFile = { entry: "war3mapPostProcessing.txt", contents: new TextEncoder().encode(postProcessingText()) };
