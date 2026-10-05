// Hot-reload file names and limits shared by scripts/hot.ts and the map.

/** FileIO stores one chunk per tooltip level of its ability. */
export const CHUNKS_PER_FILE = 64;
/** Characters per chunk; a generated Preload line stays short. */
export const CHUNK_LENGTH = 200;

export const manifestFile = (version: number) => `smashcraft-hot-manifest-${version}.pld`;
export const chunkFile = (version: number, index: number) => `smashcraft-hot-${version}-${index}.pld`;
export const ackFile = (slot: number) => `smashcraft-hot-ack-p${slot}.txt`;
