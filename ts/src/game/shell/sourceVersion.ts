// The source a map or a replay viewer was built from: a digest of the
// TypeScript and the Wisp it compiled (smashcraft:ts/scripts/sourceVersion.ts).
// Every map build replaces SOURCE_STAMP's text with it
// (smashcraft:ts/plugins/source-version.ts), as does the client's simulation
// bundle. A replay plays only on the source that recorded it, so it carries
// this name. Unstamped code (tests, the headless runtime, a module sent by a
// hot reload) is "development".
export const DEVELOPMENT_SOURCE = "development";

/** Twelve characters, as long as a version, so stamping moves no column of the source map. */
const SOURCE_STAMP = "%%SOURCE%%%%";
const UNSTAMPED = ["%%SOURCE", "%%%%"].join("");

export function sourceVersion(): string {
  return SOURCE_STAMP === UNSTAMPED ? DEVELOPMENT_SOURCE : SOURCE_STAMP;
}
