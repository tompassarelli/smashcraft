// The source a map or a replay viewer was built from: a digest of the
// TypeScript and the Wisp it compiled, stamped in as the global
// SMASHCRAFT_SOURCE by the playable and integrity map builds
// (smashcraft:ts/plugins/source-version.ts) and the client's simulation
// bundle. A replay plays only on the source that
// recorded it, so it carries this name. Unstamped code (the development map,
// tests, the headless runtime) is "development".
declare const SMASHCRAFT_SOURCE: string | undefined;

export const DEVELOPMENT_SOURCE = "development";

export function sourceVersion(): string {
  return typeof SMASHCRAFT_SOURCE === "string" ? SMASHCRAFT_SOURCE : DEVELOPMENT_SOURCE;
}
