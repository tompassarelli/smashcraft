/** Texture names from the MDX TEXS chunk; other chunks, including HD skin, stay opaque. */
export function hdBodyTextures(bytes: Uint8Array): { image: string; offset: number }[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const textures: { image: string; offset: number }[] = [];
  for (let offset = 4; offset < bytes.length;) {
    const size = view.getUint32(offset + 4, true);
    const end = offset + 8 + size;
    if (end > bytes.length) throw new Error("Truncated MDX chunk");
    if (new TextDecoder().decode(bytes.subarray(offset, offset + 4)) === "TEXS") {
      if (size % 268 !== 0) throw new Error("Truncated MDX texture");
      for (let record = offset + 8; record < end; record += 268) {
        if (view.getUint32(record, true) !== 0) continue;
        const start = record + 4;
        const image = new TextDecoder().decode(bytes.subarray(start, start + 260)).split("\0")[0] ?? "";
        if (image !== "") textures.push({ image, offset: start });
      }
    }
    offset = end;
  }
  return textures;
}

export function unresolvedHdTexture(bytes: Uint8Array, entries: ReadonlySet<string>): string | undefined {
  return hdBodyTextures(bytes).find(({ image }) => !entries.has(image.replaceAll("/", "\\").toLowerCase()))?.image;
}
