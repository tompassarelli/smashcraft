// Checks every sound and track the match presentation names, and every sound
// label hit presentation plays (resolved through the game's AnimSounds.slk and
// AbilitySounds.slk to its files), against the installed game's storage and
// records the verified paths, so headless tests can hold the presentation to
// sounds that exist. Only paths are written; the audio stays in the game.
// Usage: bun tools/presentation/stock-sounds.ts --extract CASC_EXTRACT [--storage WARCRAFT_DIR]
// (tools/animations/extract.sh builds CASC_EXTRACT into build/animation-assets/.)
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {presentationSoundPaths} from '../../ts/src/game/presentation/matchAudio';
import {SELECTABLE_CHARACTERS} from '../../ts/src/game/sim/heroes/registry';
import {STAGE_CATALOG} from '../../ts/src/game/menu/stageCatalog';
import {hitPresentationSoundLabels} from '../../ts/src/game/shell/hitPresentationCases';
import {tierSoundPaths} from '../../ts/src/game/presentation/moveTiers';

const option = (name: string) => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
const extract = option('--extract');
if (extract === undefined) throw new Error('usage: bun tools/presentation/stock-sounds.ts --extract CASC_EXTRACT [--storage WARCRAFT_DIR]');
const storage = option('--storage') ?? `${process.env.HOME}/.local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/Program Files (x86)/Warcraft III`;
const project = resolve(import.meta.dir, '../..');
const scratch = mkdtempSync(join(tmpdir(), 'smashcraft-sounds.'));

/** The game resolves a script's sound path to whichever encoding and locale it stores. */
function storedNames(path: string): string[] {
  const stem = path.toLowerCase().replace(/\.[a-z0-9]+$/, '');
  const names: string[] = [];
  for (const root of ['war3.w3mod:', 'war3.w3mod:_locales\\enus.w3mod:']) {
    for (const extension of ['.flac', '.ogg', '.mp3', '.wav']) names.push(`${root}${stem}${extension}`);
  }
  return names;
}

async function stored(path: string, index: number): Promise<string | undefined> {
  for (const name of storedNames(path)) {
    const output = join(scratch, `${index}.bin`);
    const child = Bun.spawn([extract!, storage, name, output], {stdout: 'ignore', stderr: 'ignore'});
    if (await child.exited === 0) return name;
  }
  return undefined;
}

/** SoundName to FileNames (script paths) in one of the game's SoundInfo tables (SYLK). */
function soundTable(text: string): Map<string, string[]> {
  const rows = new Map<number, Map<number, string>>();
  let y = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('C;')) continue;
    const column = /;X(\d+)/.exec(line), row = /;Y(\d+)/.exec(line), value = /;K(.*)$/.exec(line);
    if (row !== null) y = Number(row[1]);
    if (column === null || value === null) continue;
    const cells = rows.get(y) ?? new Map<number, string>();
    rows.set(y, cells);
    cells.set(Number(column[1]), value[1].replace(/^"(.*)"$/, '$1'));
  }
  const header = [...(rows.get(1) ?? new Map<number, string>())];
  const nameColumn = header.find(([, name]) => name === 'SoundName')?.[0];
  const fileColumn = header.find(([, name]) => name === 'FileNames')?.[0];
  if (nameColumn === undefined || fileColumn === undefined) throw new Error('sound table without SoundName and FileNames');
  const table = new Map<string, string[]>();
  for (const [row, cells] of rows) {
    const name = cells.get(nameColumn), files = cells.get(fileColumn);
    if (row > 1 && name !== undefined && files !== undefined) table.set(name, files.split(',').map(file => file.replaceAll('/', '\\')));
  }
  return table;
}

const labelFiles = new Map<string, string[]>();
for (const table of ['AnimSounds', 'AbilitySounds']) {
  const output = join(scratch, `${table}.slk`);
  const child = Bun.spawn([extract, storage, `war3.w3mod:ui\\soundinfo\\${table.toLowerCase()}.slk`, output], {stdout: 'ignore', stderr: 'inherit'});
  if (await child.exited !== 0) throw new Error(`cannot read ${table}.slk from the installed game`);
  for (const [label, files] of soundTable(await Bun.file(output).text())) if (!labelFiles.has(label)) labelFiles.set(label, files);
}
const labels = hitPresentationSoundLabels();
// A sound given by script path is its own file.
for (const label of labels) if (label.includes('\\')) labelFiles.set(label, [label]);
const unknownLabels = labels.filter(label => !labelFiles.has(label));
if (unknownLabels.length > 0) throw new Error(`not in the game's sound tables: ${unknownLabels.join(', ')}`);

const paths = [...new Set([...presentationSoundPaths(SELECTABLE_CHARACTERS, STAGE_CATALOG.map(stage => stage.id)), ...tierSoundPaths(), ...labels.flatMap(label => labelFiles.get(label) ?? [])])];
const found: (string | undefined)[] = new Array(paths.length);
try {
  let next = 0;
  await Promise.all(Array.from({length: 4}, async () => {
    while (next < paths.length) { const index = next++; found[index] = await stored(paths[index], index); }
  }));
} finally {
  rmSync(scratch, {recursive: true, force: true});
}
const missing = paths.filter((_, index) => found[index] === undefined);
if (missing.length > 0) throw new Error(`not in the installed game: ${missing.join(', ')}`);
const lines = [
  '// Generated by tools/presentation/stock-sounds.ts from the installed game\'s storage; regenerate instead of editing.',
  '/** Script sound paths found in the game, with the stored file each resolves to. */',
  'export const VERIFIED_STOCK_SOUNDS: Readonly<Record<string, string>> = {',
  ...paths.map((path, index) => `  ${JSON.stringify(path)}: ${JSON.stringify(found[index])},`),
  '};',
  '',
  '/** Sound labels hit presentation plays, with the script paths the game\'s sound tables give each; every path is in VERIFIED_STOCK_SOUNDS. */',
  'export const VERIFIED_STOCK_SOUND_LABELS: Readonly<Record<string, readonly string[]>> = {',
  ...labels.map(label => `  ${JSON.stringify(label)}: ${JSON.stringify(labelFiles.get(label))},`),
  '};',
  '',
];
const out = join(project, 'ts/src/game/assets/stockSoundInfo.ts');
await Bun.write(out, lines.join('\n'));
console.log(`${paths.length} paths and ${labels.length} labels verified: ${out}`);
