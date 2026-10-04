// Foreign fixture boundary: recorded retail classifications exercise production geometry.
const project = new URL('../../', import.meta.url);
const read = path => Bun.file(new URL(path, project));
const boundaryRows = (await read('docs/smash-melee-reference/retail-shield-capsule-boundaries.jsonl').text()).trim().split('\n').map(line => JSON.parse(line));
const ordinaryRows = (await read('docs/smash-melee-reference/retail-shield-capsule.json').json()).results;
const translatedRows = (await read('docs/smash-melee-reference/retail-shield-capsule-translated.json').json()).results;
const scaledRows = (await read('docs/smash-melee-reference/retail-shield-capsule-scaled.json').json()).results;
const scaledTranslatedRows = (await read('docs/smash-melee-reference/retail-shield-capsule-scaled-translated.json').json()).results;
const rows = [...ordinaryRows, ...boundaryRows, ...translatedRows, ...scaledRows, ...scaledTranslatedRows];
const literal = value => value.toFixed(40);
const lines = ['package CapsuleShieldPrecisionProbe', 'import Simulation', '', 'init', '    var failures = 0'];
for (const [index, row] of rows.entries()) {
    const args = [row.startX, row.startZ, row.endX, row.endZ, Math.fround(row.hitRadius * row.hitScale), row.centerX ?? 0, row.centerZ ?? 0, row.shieldRadius, row.jointScale ?? 1];
    lines.push(`    if capsuleCircleIntersects(${args.map(literal).join(', ')}) != ${row.intersects}`,
        '        failures++', `        BJDebugMsg("CAPSULE_SHIELD_${index}_MISMATCH")`);
}
lines.push('    if failures != 0', '        BJDebugMsg("CAPSULE_SHIELD_CLASSIFICATION_FAIL")',
    '    else', '        BJDebugMsg("CAPSULE_SHIELD_CLASSIFICATION_PASS")', '');
await Bun.write(new URL('build/physics-probe/CapsuleShieldPrecisionProbe.wurst', project), lines.join('\n'));
console.log(`Capsule shield: ${rows.length} original classifications`);
