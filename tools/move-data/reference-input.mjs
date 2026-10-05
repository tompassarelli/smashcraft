// Foreign boundary only: JSON scalars become typed Wurst inputs unchanged.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const [root, output] = process.argv.slice(2);
const readRows = async path => (await readFile(resolve(root, path), 'utf8')).trim().split('\n').map(JSON.parse);
const [moves, references, comparisons] = await Promise.all([
  readRows('tools/move-data/moves.jsonl'),
  readRows('references/melee-frame-data/records.jsonl'),
  readRows('tools/move-data/comparisons.jsonl'),
]);
const string = value => JSON.stringify(value);
const row = value => string(JSON.stringify(value));
const integer = value => {
  if (!Number.isInteger(value)) throw new Error('Expected integer input');
  return String(value);
};
const real = value => {
  if (!Number.isFinite(value)) throw new Error('Expected finite input');
  return Number.isInteger(value) ? `${value}.` : String(value);
};
const lines = ['package MoveReferenceInput', 'import MoveReference', '', 'init'];
lines.push(`    BJDebugMsg(${row({kind:'context', schema:1,
  productionInput:'smashcraft:tools/move-data/moves.jsonl',
  comparisonInput:'smashcraft:tools/move-data/comparisons.jsonl',
  referenceInput:'smashcraft:references/melee-frame-data/records.jsonl',
  productionContext:moves.find(r=>r.kind==='context'),
  comparisonContext:comparisons.find(r=>r.kind==='context'),
  join:'action family across distinct identities; never fighter equivalence',
  declaredMeaning:'verbatim exported facts, including previously derived production measurements',
  referenceFieldMeanings:{start:'reported first active, one-based',end:'reported last active bound; gaps unknown',total:'reported action boundary; recovery not inferred',stun:'shieldstun, not hitstun',percent:'reported strongest rounded base damage; not multihit total'},
  projection:{damage:'maximize shieldDamage on shield, percentDamage on body',attackerReady:'minimize',defenderReady:'maximize',pairing:'different production fighters; same category, spacing, percent, shielding; fixed Rifleman defender and shared fixture'},
  excludedFromOrder:['separation','launch direction','hurtbox geometry','approach and startup','escape choices','whole moveset'],
  tuningDecision:'No supported parameter change: partial-order findings alone do not establish an unwanted trade-off or target.',
})})`);
for (const value of moves) {
  if (value.kind === 'move') lines.push(`    acceptMove(${row(value)}, ${integer(value.style)}, ${integer(value.chargeFrames)}, ${integer(value.startup)})`);
}
for (const value of references) {
  // The category/action selection and null-sensitive comparisons are Wurst-owned.
  lines.push(`    acceptReference(${row(value)}, ${string(value.character)}, ${string(value.category)}, ${string(value.action ?? '')}, ${integer(value.values.start ?? -1)}, ${integer(value.frame_index_origin)})`);
}
lines.push('    finishReferenceJoins()');
for (const value of comparisons) {
  if (value.kind === 'contact') {
    lines.push(`    acceptContact(contactFact(${row(value)}, ${integer(value.character)}, ${string(value.category)}, ${real(value.spacing)}, ${real(value.percent)}, ${value.shielding}, ${value.connected}, ${integer(value.attackerReady)}, ${integer(value.defenderReady)}, ${real(value.shieldDamage)}, ${real(value.percentDamage)}))`);
  }
}
await writeFile(output, lines.join('\n') + '\n');
