






const DEVELOPMENT_SOURCE = "development";


const SOURCE_STAMP = "%%SOURCE%%%%";
const UNSTAMPED = ["%%SOURCE", "%%%%"].join("");

export function sourceVersion(): string {
  return SOURCE_STAMP === UNSTAMPED ? DEVELOPMENT_SOURCE : SOURCE_STAMP;
}
