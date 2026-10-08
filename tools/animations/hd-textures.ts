import { readdirSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { Effect } from '../../ts/node_modules/effect/dist/index.js';
import { ChildProcess } from '../../ts/node_modules/effect/dist/process/index.js';
import { BunServices } from '../../ts/node_modules/@effect/platform-bun/dist/index.js';
import { runProcess } from '../../ts/scripts/hostProcess';
import { hdBodyTextures } from '../../ts/scripts/hdBodyTextures';

const [family, extractor, storage = join(homedir(), '.local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/Program Files (x86)/Warcraft III')] = process.argv.slice(2);
if (family === undefined || extractor === undefined) throw new Error('usage: bun tools/animations/hd-textures.ts PRIVATE_FAMILY CASC_EXTRACTOR [STORAGE]');
if (!relative(resolve(import.meta.dir, '../..'), resolve(family)).startsWith('..')) throw new Error('Stock textures stay private');

function gameplayMips(source: Uint8Array): Uint8Array {
  const header = source.slice(0, 128);
  const view = new DataView(header.buffer);
  const fourCC = new TextDecoder().decode(header.subarray(84, 88));
  if (new TextDecoder().decode(header.subarray(0, 4)) !== 'DDS ' || !['DXT1', 'DXT5', 'ATI2'].includes(fourCC)) throw new Error(`Unsupported stock DDS ${fourCC}`);
  let height = view.getUint32(12, true), width = view.getUint32(16, true), levels = view.getUint32(28, true);
  const block = fourCC === 'DXT1' ? 8 : 16;
  let offset = 128;
  while (Math.max(width, height) > 512) {
    if (levels <= 1) throw new Error('Stock DDS has no gameplay mip chain');
    offset += Math.max(1, Math.ceil(width / 4)) * Math.max(1, Math.ceil(height / 4)) * block;
    width = Math.max(1, width >> 1); height = Math.max(1, height >> 1); levels--;
  }
  if (offset >= source.length) throw new Error('Truncated stock DDS mip chain');
  view.setUint32(12, height, true); view.setUint32(16, width, true);
  view.setUint32(20, Math.max(1, Math.ceil(width / 4)) * Math.max(1, Math.ceil(height / 4)) * block, true);
  view.setUint32(28, levels, true);
  const output = new Uint8Array(128 + source.length - offset);
  output.set(header); output.set(source.subarray(offset), 128);
  return output;
}

await Effect.runPromise(Effect.gen(function*() {
  const directory = join(family, 'imports/_hd.w3mod/war3mapImported');
  const textures = new Map<string, string>();
  const imports = new Set<string>();
  let importedBytes = 0;
  for (const name of readdirSync(directory).filter(name => name.endsWith('.mdx'))) {
    const path = join(directory, name);
    const bytes = yield* Effect.promise(() => Bun.file(path).bytes());
    for (const texture of hdBodyTextures(bytes)) {
      let replacement = textures.get(texture.image);
      if (replacement === undefined) {
        const target = join(family, 'stock-texture.tmp');
        const source = texture.image.replaceAll('\\', '/').replace(/\.[^.]+$/, '.dds');
        let found = false;
        for (const layer of ['_de.w3mod:', '_hd.w3mod:', '']) {
          found = yield* runProcess(ChildProcess.make(extractor, [storage, `war3.w3mod:${layer}${source}`, target], { stdin: 'ignore' })).pipe(Effect.as(true), Effect.catchTag('ProcessFailure', () => Effect.succeed(false)));
          if (found) break;
        }
        if (!found) return yield* Effect.fail(new Error(`No stock texture for ${texture.image} in ${name}`));
        const data = gameplayMips(yield* Effect.promise(() => Bun.file(target).bytes()));
        const filename = `DefinitiveTexture-${createHash('sha256').update(data).digest('hex')}.dds`;
        replacement = `war3mapImported\\${filename}`;
        const output = join(directory, filename);
        yield* Effect.promise(() => Bun.write(output, data));
        if (!imports.has(filename)) importedBytes += data.length;
        imports.add(filename);
        textures.set(texture.image, replacement);
      }
      bytes.fill(0, texture.offset, texture.offset + 260);
      bytes.set(new TextEncoder().encode(replacement), texture.offset);
    }
    yield* Effect.promise(() => Bun.write(path, bytes));
  }
  yield* Effect.promise(() => Bun.write(join(family, 'hd-texture-imports.txt'), [...imports].sort().join('\n') + '\n'));
  unlinkSync(join(family, 'stock-texture.tmp'));
  console.log(JSON.stringify({ textures: textures.size, imports: imports.size, importedBytes, maxDimension: 512,
    reason: 'HD body aliases cannot find stock Definitive-only textures; existing stock DDS mip bytes retain the approved materials without reencoding.' }));
}).pipe(Effect.provide(BunServices.layer)));
