



import { mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PLAYER_COLORS } from '../../ts/src/game/ui/slotColors';
import { PARTICIPANT_CAPACITY } from '../../ts/src/game/input/participants';

const project = resolve(import.meta.dir, '../..');
const source = join(project, 'tools/selection/art');
const index = process.argv.indexOf('--out');
const output = index < 0 ? join(project, 'build/selection-assets') : resolve(process.argv[index + 1]!);
mkdirSync(output, { recursive: true });

function run(command: string[]): string {
  const result = Bun.spawnSync(command, { stdout: 'pipe', stderr: 'pipe' });
  if (result.exitCode !== 0) throw new Error(`${command[0]} failed (${result.exitCode}): ${result.stderr.toString().slice(-2000)}`);
  return result.stdout.toString();
}

const hex = (rgb: number) => `#${rgb.toString(16).padStart(6, '0')}`;

const mix = (rgb: number, target: number, amount: number) => [16, 8, 0].reduce((sum, shift) => {
  const from = (rgb >> shift) & 255;
  return sum + (Math.round(from + (((target >> shift) & 255) - from) * amount) << shift);
}, 0);


async function render(name: string, svg: string, replacements: { readonly [placeholder: string]: string }, keep: boolean): Promise<void> {
  let text = await Bun.file(join(source, svg)).text();
  for (const [placeholder, value] of Object.entries(replacements)) text = text.replaceAll(placeholder, value);
  const file = join(output, `${name}.svg`);
  await Bun.write(file, text);
  run(['magick', '-background', 'none', file, '-depth', '8', `TGA:${join(output, `${name}.tga`)}`]);
  if (!keep) rmSync(file);
}

for (const [fighter, label] of [['Rifleman', 'RIFLEMAN'], ['DemonHunter', 'ILLIDAN']] as const) {
  await render(`${fighter}Name`, 'FighterName.svg', { FIGHTER_NAME: label }, true);
}
const slots = PLAYER_COLORS.slice(0, PARTICIPANT_CAPACITY);
for (const [slot, color] of slots.entries()) {
  await render(`SelectionChipP${slot + 1}`, 'SelectionChip.svg', { CHIP_COLOR: hex(mix(color.rgb, 0x000000, 0.2)), CHIP_LABEL: `P${slot + 1}` }, true);
  await render(`SelectionCard${color.name}`, 'SelectionCard.svg', { CARD_COLOR: hex(mix(color.rgb, 0x000000, 0.4)), CARD_EDGE: hex(mix(color.rgb, 0xffffff, 0.35)), CARD_METAL: '#bbc6cf' }, false);
  await render(`HudPlate${slot}`, 'HudPlate.svg', { PLAYER_COLOR: hex(color.rgb) }, true);
}
await render('SelectionChipCPU', 'SelectionChip.svg', { CHIP_COLOR: '#626977', CHIP_LABEL: 'P2' }, true);
await render('SelectionCardGray', 'SelectionCard.svg', { CARD_COLOR: '#30353b', CARD_EDGE: '#555d65', CARD_METAL: '#687078' }, false);
for (const name of ['SelectionBackdrop', 'SelectionTileFrame', 'SelectionAction', 'StageBackdrop', 'StageChip', 'SelectionThreeBridges']) {
  run(['magick', '-background', 'none', join(source, `${name}.svg`), '-depth', '8', `TGA:${join(output, `${name}.tga`)}`]);
}
console.log(run(['magick', 'identify', ...[...new Bun.Glob('*.tga').scanSync(output)].sort().map((file) => join(output, file))]));
