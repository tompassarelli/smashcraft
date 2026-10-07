// Renders every fighter in RENDERED_FIGHTERS from the model the game draws, with
// one camera direction, lighting and background for all of them, into the grid
// tile, card, HUD bust and stock icon textures the map imports (fighterPortrait). Models and textures
// come from the installed game, the generated fighter assets and ASSETS/imported-models; the renders
// stay outside the repository.
// Usage: bun tools/selection/render-fighters.ts --extract CASC_EXTRACT --assets ASSETS [--storage WARCRAFT_DIR] [--only NAME,...] [--reuse] [--team N] [--check RED_WORK]
// Fighters render in the neutral team colour (NEUTRAL_TEAM_COLOR), so no portrait shows a player's colour;
// --team renders another. --check RED_WORK compares each render with the same fighter rendered with
// --team 0 (its work/NAME.png in RED_WORK) and fails if a team-colour pixel shows a player colour.
// Writes ASSETS/fighter-renders/; the map build imports from there.
// (tools/animations/extract.sh builds CASC_EXTRACT into build/animation-assets/.)
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { Character } from '../../ts/src/game/sim/codes';
import { RENDERED_FIGHTERS, fighterRenderName, heroDefinition } from '../../ts/src/game/sim/heroes/registry';
import { heroModelSource, importedModelFile } from '../../ts/scripts/heroModelSource';
import { CARD_TEXTURE_PX, TILE_TEXTURE_PX } from '../../ts/src/game/ui/portraitFrames';
import { STOCK_ICON_PX } from '../../ts/src/game/ui/plateLayout';
import { NEUTRAL_TEAM_COLOR } from '../../ts/src/game/ui/slotColors';
import { readRgba, teamColourPixels } from './team-colour-check';

const option = (name: string) => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
const extract = option('--extract');
const assets = option('--assets');
if (extract === undefined || assets === undefined) throw new Error('usage: bun tools/selection/render-fighters.ts --extract CASC_EXTRACT --assets ASSETS [--storage WARCRAFT_DIR] [--only NAME,...]');
const storage = option('--storage') ?? `${process.env.HOME}/.local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/Program Files (x86)/Warcraft III`;
const only = option('--only')?.split(',');
/** Recrop the renders already in the work folder instead of rendering again. */
const reuse = process.argv.includes('--reuse');
const team = Number(option('--team') ?? NEUTRAL_TEAM_COLOR);
const check = option('--check');
const addon = option('--addon') ?? '/home/tom/code/mdl-exporter4/worktrees/blender5';
const project = resolve(import.meta.dir, '../..');
const output = join(assets, 'fighter-renders');
const work = join(output, 'work');
const resources = join(work, 'textures');
mkdirSync(resources, { recursive: true });

/** The original fighters' generated models; heroes use the game's own. */
const ORIGINAL_MODELS: { readonly [character: number]: string | undefined } = {
  [Character.archer]: 'animation-assets/archer-fighter.mdl',
  [Character.rifleman]: 'animation-assets/rifleman-fighter.mdl',
  [Character.demonHunter]: 'illidan-animation/demonhunter-fighter.mdl',
};
/** Behind every grid tile, so the tiles read as one set. */
const TILE_BACKGROUND = ['-size', `${TILE_TEXTURE_PX}x${TILE_TEXTURE_PX}`, 'radial-gradient:#3a5378-#0c1422'];
const teamIndex = String(team).padStart(2, '0');
const TEAM_TEXTURES = [`ReplaceableTextures\\TeamColor\\TeamColor${teamIndex}.blp`, `ReplaceableTextures\\TeamGlow\\TeamGlow${teamIndex}.blp`];

/** Fades the bust out at its bottom and sides, where the crop cuts through the fighter. */
const BUST_FADE = 'min(min(1, (1 - j / h) / 0.3), min(i / (w * 0.1), (w - i) / (w * 0.1)))';
/** A round, soft-edged head for the stock icons. */
const STOCK_FADE = 'max(0, min(1, (0.5 - hypot(i / w - 0.5, j / h - 0.5)) / 0.1))';
/** Multiplies the image's alpha by `mask`, an fx expression over the pixel position. */
const fadeAlpha = (mask: string) => ['(', '+clone', '-alpha', 'extract', '(', '+clone', '-fx', mask, ')', '-compose', 'multiply', '-composite', ')', '-compose', 'CopyOpacity', '-composite'];

function run(command: string[]): string {
  const result = Bun.spawnSync(command, { stdout: 'pipe', stderr: 'pipe' });
  const text = result.stdout.toString();
  if (result.exitCode !== 0) throw new Error(`${command[0]} failed (${result.exitCode}):\n${text.slice(-2000)}\n${result.stderr.toString().slice(-2000)}`);
  return text;
}

const stored = (path: string) => `war3.w3mod:${path.toLowerCase().replaceAll('\\', '/')}`;

/** The game stores DDS textures even where a model names BLP; Blender reads PNG. */
function extractTexture(path: string): void {
  const png = join(resources, `${path.replaceAll('\\', '/').replace(/\.[a-z]+$/i, '')}.png`);
  if (existsSync(png)) return;
  mkdirSync(dirname(png), { recursive: true });
  // A community model's textures are imported from ASSETS/imported-models, not the game's archives.
  const imported = importedModelFile(path);
  if (imported !== undefined) {
    run(['bun', join(project, 'tools/animations/convert.ts'), join(assets!, 'imported-models', imported), png]);
    return;
  }
  const dds = png.replace(/\.png$/, '.dds');
  const found = Bun.spawnSync([extract, storage, stored(path).replace(/\.[a-z]+$/, '.dds'), dds]).exitCode === 0
    || Bun.spawnSync([extract, storage, stored(path).replace(/\.[a-z]+$/, '.blp'), dds]).exitCode === 0;
  if (!found) {
    console.warn(`texture not in storage: ${path}`);
    return;
  }
  run(['magick', `${dds}[0]`, png]);
}

/** The model without its lights: the renderer lights every fighter alike, and the importer rejects animated lights. */
function unlit(text: string): string {
  let result = "";
  let index = 0;
  for (;;) {
    const light = text.indexOf("\nLight \"", index);
    if (light < 0) return (result + text.slice(index)).replace(/NumLights \d+,/, "NumLights 0,");
    result += text.slice(index, light + 1);
    let depth = 0;
    let end = text.indexOf("{", light);
    do {
      const character = text.charAt(end++);
      if (character === "{") depth++;
      else if (character === "}") depth--;
    } while (depth > 0 && end < text.length);
    index = end;
  }
}

/** The pose render-fighter.py draws: the first of these sequences the model has. */
const POSES = ['Stand Ready', 'Stand Victory', 'Stand'];

/**
 * Material layer alpha fixed at the pose's first frame. The importer draws every
 * layer at its static alpha, so a hidden alternate skin (the Mountain King's
 * Avatar layer) would otherwise cover the fighter.
 */
function posedLayers(text: string): string {
  const sequences = [...text.matchAll(/Anim "([^"]+)" \{\s*Interval \{ (\d+), (\d+) \}/g)].map((match) => ({ name: match[1]!, start: Number(match[2]), end: Number(match[3]) }));
  const pose = POSES.map((name) => sequences.find((sequence) => sequence.name === name || sequence.name.startsWith(`${name} `))).find((sequence) => sequence !== undefined) ?? sequences[0];
  const materials = text.indexOf('\nMaterials ');
  const geosets = text.indexOf('\nGeoset ', materials);
  if (pose === undefined || materials < 0 || geosets < 0) return text;
  const posed = text.slice(materials, geosets).replace(/(\t+)Alpha \d+ \{\n([\s\S]*?)\n\1\}/g, (_block, indent: string, body: string) => {
    // Warcraft holds a sequence's first key until it is reached; a track with no key in the sequence shows fully.
    const key = [...body.matchAll(/(\d+): ([-\d.]+)/g)].find((match) => Number(match[1]) >= pose.start && Number(match[1]) <= pose.end);
    const alpha = key === undefined ? 1 : Number(key[2]);
    return `${indent}static Alpha ${alpha},`;
  });
  return text.slice(0, materials) + posed + text.slice(geosets);
}

/** The importer swaps only a lowercase ".blp" for the PNG it reads; Kwaliti's Lich King names "LichKing.BLP". */
const lowerTextureExtensions = (text: string) => text.replace(/(Image "[^"]*)\.blp"/gi, '$1.blp"');

/**
 * The importer looks for textures beside the model before the resource folder,
 * so models sit apart from the renders: the Lich King's texture LichKing.blp
 * would otherwise load his previous render, work/LichKing.png.
 */
const models = join(work, 'models');
mkdirSync(models, { recursive: true });

async function modelFor(character: Character, name: string): Promise<string> {
  const mdl = join(models, `${name}.mdl`);
  const original = ORIGINAL_MODELS[character];
  if (original !== undefined) {
    await Bun.write(mdl, posedLayers(unlit(await Bun.file(join(assets!, original)).text())));
    return mdl;
  }
  const hero = heroDefinition(character);
  if (hero === undefined) throw new Error(`no model for ${name}`);
  const mdx = join(models, `${name}.mdx`);
  if (importedModelFile(hero.presentation.model) !== undefined) await Bun.write(mdx, Bun.file(join(assets!, heroModelSource(hero.presentation.model))));
  else run([extract, storage, stored(hero.presentation.model).replace(/\.mdl$/, '.mdx'), mdx]);
  run(['bun', join(project, 'tools/animations/convert.ts'), mdx, mdl]);
  await Bun.write(mdl, lowerTextureExtensions(posedLayers(unlit(await Bun.file(mdl).text()))));
  return mdl;
}

for (const character of RENDERED_FIGHTERS) {
  const name = fighterRenderName(character);
  if (only !== undefined && !only.includes(name)) continue;
  const raw = join(work, `${name}.png`);
  const logFile = join(work, `${name}.log`);
  if (!reuse || !existsSync(raw) || !existsSync(logFile)) {
    const model = await modelFor(character, name);
    const images = [...(await Bun.file(model).text()).matchAll(/Image "([^"]+)"/g)].map((match) => match[1]!);
    for (const texture of [...images, ...TEAM_TEXTURES]) if (!texture.toLowerCase().startsWith('war3mapimported')) extractTexture(texture);
    await Bun.write(logFile, run(['blender', '--background', '--threads', '4', '--python-exit-code', '1', '--python', join(project, 'tools/selection/render-fighter.py'), '--', model, resources, raw, addon, String(team)]));
  }
  const log = await Bun.file(logFile).text();
  const pose = log.match(/RENDER_POSE (.*)/)?.[1];
  const head = log.match(/RENDER_HEAD (-?\d+) (-?\d+)/);
  // The fighter's extent, ignoring faint antialiasing and haze at the edges.
  const silhouette = run(['magick', raw, '-alpha', 'extract', '-threshold', '10%', '-format', '%@', 'info:']).trim();
  // The card: the whole fighter, its height filling the frame.
  const card = join(output, `FighterCard${name}.tga`);
  const inner = Math.round(CARD_TEXTURE_PX * 0.94);
  run(['magick', raw, '-crop', silhouette, '+repage', '-resize', `${inner}x${inner}`, '-background', 'none', '-gravity', 'center', '-extent', `${CARD_TEXTURE_PX}x${CARD_TEXTURE_PX}`, '-depth', '8', '-compress', 'none', card]);
  // The tile: head and shoulders, centered on the head bone where the model has one.
  const box = silhouette.match(/(\d+)x(\d+)\+(\d+)\+(\d+)/);
  const silhouetteHeight = box ? Number(box[2]) : 1024;
  const silhouetteTop = box ? Number(box[4]) : 0;
  const silhouetteBottom = silhouetteTop + silhouetteHeight;
  const headX = head ? Number(head[1]) : 512;
  const headY = head ? Number(head[2]) : silhouetteTop + silhouetteHeight / 5;
  // Head to waist whatever the fighter's build: the crop follows the head's height above the feet.
  // A crouching fighter (Shadow Hunter) keeps at least half its height in frame.
  const crop = Math.round(Math.max(256, 0.55 * silhouetteHeight, Math.min(1024, 0.8 * (silhouetteBottom - headY))));
  const left = Math.max(0, Math.min(1024 - crop, Math.round(headX - crop / 2)));
  const cropTop = Math.max(0, Math.min(1024 - crop, Math.round(headY - crop * 0.38)));
  const tile = join(output, `FighterTile${name}.tga`);
  run(['magick', ...TILE_BACKGROUND, '(', raw, '-crop', `${crop}x${crop}+${left}+${cropTop}`, '+repage', '-resize', `${TILE_TEXTURE_PX}x${TILE_TEXTURE_PX}`, ')', '-composite', '-alpha', 'off', '-depth', '8', '-compress', 'none', tile]);
  // The HUD bust: the tile's crop on a clear background, breaking out of the plate.
  const bust = join(output, `FighterBust${name}.tga`);
  run(['magick', raw, '-crop', `${crop}x${crop}+${left}+${cropTop}`, '+repage', '-resize', `${TILE_TEXTURE_PX}x${TILE_TEXTURE_PX}`, ...fadeAlpha(BUST_FADE), '-depth', '8', '-compress', 'none', bust]);
  // The stock icon: the head alone.
  const head64 = Math.round(Math.max(64, Math.min(1024, 0.3 * (silhouetteBottom - headY))));
  const stockLeft = Math.max(0, Math.min(1024 - head64, Math.round(headX - head64 / 2)));
  const stockTop = Math.max(0, Math.min(1024 - head64, Math.round(headY - head64 * 0.62)));
  const stock = join(output, `FighterStock${name}.tga`);
  run(['magick', raw, '-crop', `${head64}x${head64}+${stockLeft}+${stockTop}`, '+repage', '-resize', `${STOCK_ICON_PX}x${STOCK_ICON_PX}`, ...fadeAlpha(STOCK_FADE), '-depth', '8', '-compress', 'none', stock]);
  console.log(`${name}: ${pose ?? '?'}; head ${head ? `${head[1]},${head[2]}` : 'none'}; ${card}, ${tile}, ${bust}, ${stock}`);
}

if (check !== undefined) {
  let failed = 0;
  for (const character of RENDERED_FIGHTERS) {
    const name = fighterRenderName(character);
    if (only !== undefined && !only.includes(name)) continue;
    const result = teamColourPixels(readRgba(join(work, `${name}.png`)), readRgba(join(check, `${name}.png`)));
    const found = Object.entries(result.found).map(([color, count]) => `${color} ${count}`).join(', ');
    // A model without a team-colour texture shows none; one with it must show some, or the check saw nothing.
    const teamColoured = /ReplaceableId 1\b/.test(await Bun.file(join(models, `${name}.mdl`)).text());
    const samePose = result.silhouetteMismatch <= result.silhouette / 100;
    if (found !== '' || (teamColoured && result.masked === 0) || !samePose) failed++;
    console.log(`${name}: ${result.masked} team-colour pixels, player colours: ${found === '' ? 'none' : found}${samePose ? '' : `; the renders differ in ${result.silhouetteMismatch} silhouette pixels`}`);
  }
  if (failed > 0) throw new Error(`${failed} renders show a player colour`);
}
