// Hot-reload file names, limits and the manifest shared by scripts/hot.ts and
// the map.

/** FileIO stores one chunk per tooltip level of its ability. */
export const CHUNKS_PER_FILE = 64;
/** Characters per chunk; a generated Preload line stays short. */
export const CHUNK_LENGTH = 200;

/** One manifest whose version only rises, so neither side restarting loses track. */
export const MANIFEST_FILE = "smashcraft-hot-manifest.pld";
export const chunkFile = (version: number, index: number) => `smashcraft-hot-${version}-${index}.pld`;
export const ackFile = (slot: number) => `smashcraft-hot-ack-p${slot}.txt`;

export interface Manifest {
  version: number;
  files: number;
  checksum: string;
}

export const formatManifest = ({ version, files, checksum }: Manifest) => `${version} ${files} ${checksum}`;

export function parseManifest(text: string): Manifest | undefined {
  const [versionText, filesText, checksum] = text.split(" ");
  const version = Number(versionText);
  const files = Number(filesText);
  // Comparisons are false for NaN, which rejects non-numeric fields.
  if (!(version >= 1) || !(files >= 1) || checksum === undefined) return undefined;
  return { version, files, checksum };
}
