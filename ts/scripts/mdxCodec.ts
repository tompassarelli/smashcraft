import { parseMDX, generateMDX, model as mdx } from './clipNodes';

export const parseModelMDX = (bytes: ArrayBuffer): mdx.Model => parseMDX(skinChunks(bytes, false));
export const generateModelMDX = (model: mdx.Model): ArrayBuffer => skinChunks(generateMDX(model), true);

export function skinChunks(bytes: ArrayBuffer, writing: boolean, omitCameras = false): ArrayBuffer {
    const data = new Uint8Array(bytes), view = new DataView(bytes);
    const chunks = [data.slice(0, 4)];
    let version = 800;
    for (let offset = 4; offset < data.length;) {
        if (offset + 8 > data.length) throw new Error('Truncated HD chunk');
        const size = view.getUint32(offset + 4, true), end = offset + 8 + size;
        if (end > data.length) throw new Error('Truncated HD chunk body');
        const tag = new TextDecoder().decode(data.subarray(offset, offset + 4));
        if (tag === 'VERS') version = view.getUint32(offset + 8, true);
        if (tag === 'GEOS' && version >= 1800) {
            const geosets: Uint8Array[] = [];
            for (let start = offset + 8; start < end;) {
                const length = view.getUint32(start, true), stop = start + length;
                if (stop > end || length < 12) throw new Error('Truncated HD geoset');
                const geoset = data.slice(start, stop);
                const skin = Buffer.from(geoset).indexOf('SKIN');
                if (skin < 0) geosets.push(geoset);
                else {
                    const count = new DataView(geoset.buffer).getUint32(skin + 4, true);
                    const width = writing ? 1 : 2, next = skin + 8 + count * width;
                    if (Buffer.from(geoset.subarray(next, next + 4)).toString() !== 'UVAS') throw new Error('Unexpected HD skin layout');
                    const packed = new Uint8Array(count * (writing ? 2 : 1));
                    for (let i = 0; i < count; i++) {
                        const value = writing ? geoset[skin + 8 + i] : new DataView(geoset.buffer).getUint16(skin + 8 + i * 2, true);
                        if (value > 255) throw new Error('HD skin value exceeds the model parser limit');
                        packed[i * (writing ? 2 : 1)] = value;
                    }
                    const changed = new Uint8Array(skin + 8 + packed.length + length - next);
                    changed.set(geoset.subarray(0, skin + 8)); changed.set(packed, skin + 8); changed.set(geoset.subarray(next), skin + 8 + packed.length);
                    new DataView(changed.buffer).setUint32(0, changed.length, true);
                    geosets.push(changed);
                }
                start = stop;
            }
            const changed = new Uint8Array(8 + geosets.reduce((sum, geoset) => sum + geoset.length, 0));
            changed.set(data.subarray(offset, offset + 4)); new DataView(changed.buffer).setUint32(4, changed.length - 8, true);
            let cursor = 8; for (const geoset of geosets) { changed.set(geoset, cursor); cursor += geoset.length; }
            chunks.push(changed);
        } else if (!(omitCameras && tag === 'CAMS')) chunks.push(data.slice(offset, end));
        offset = end;
    }
    const output = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
    return output.buffer;
}

