// Hot-reload file names, limits and the manifest shared by scripts/hot.ts and
// the map.

/** FileIO stores one chunk per tooltip level of its ability. */
export const CHUNKS_PER_FILE = 64;
/**
 * Bundle bytes per payload file. The file is raw Lua that stores them in one
 * tooltip; a 200,000-character tooltip read back intact in the game.
 */
export const PAYLOAD_FILE_BYTES = 200_000;
/** The FileIO ability ('$wsl') whose tooltips carry text from host files. */
export const FILE_IO_ABILITY = 0x2477736c;

// Preloader checks whether a file exists on every call but runs the content it
// first read from that path for the rest of the session
// (smashcraft:docs/warcraft-api-netcode-findings.md). So no name is reused for
// other content: manifests are numbered by a version that only rises and are never
// removed, and payload files are named by their bundle's checksum.
export const manifestFile = (version: number) => `smashcraft-hot-manifest-${version}.pld`;
/** Names a bundle in file names and as its Lua chunk name, which error positions carry. */
export const payloadKey = (payloadChecksum: string) => payloadChecksum.replace(":", "-");
export const payloadFile = (payloadChecksum: string, index: number) => `smashcraft-hot-${payloadKey(payloadChecksum)}-${index}.pld`;
export const ackFile = (slot: number) => `smashcraft-hot-ack-p${slot}.txt`;
export const errorFile = (slot: number) => `smashcraft-error-p${slot}.txt`;

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
