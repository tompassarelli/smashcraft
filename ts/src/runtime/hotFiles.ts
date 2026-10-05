// Hot-reload file names, limits and the manifest shared by scripts/hot.ts and
// the map.

/** FileIO stores one chunk per tooltip level of its ability. */
export const CHUNKS_PER_FILE = 64;
/** Characters per chunk; a generated Preload line stays short. */
export const CHUNK_LENGTH = 200;

// Preloader checks whether a file exists on every call but runs the content it
// first read from that path for the rest of the session
// (smashcraft:docs/warcraft-api-netcode-findings.md). So no name is reused for
// other content: manifests are numbered by a version that only rises and are never
// removed, and chunk files are named by their payload's checksum.
export const manifestFile = (version: number) => `smashcraft-hot-manifest-${version}.pld`;
export const chunkFile = (payloadChecksum: string, index: number) => `smashcraft-hot-${payloadChecksum.replace(":", "-")}-${index}.pld`;
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
