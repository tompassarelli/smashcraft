// Foreign fixture boundary: numeric PPC observations become production assertions.
const project = new URL('../../', import.meta.url);
const reference = await Bun.file(new URL('docs/smash-melee-reference/retail-air-axis-decrement.json', project)).json();
const literal = value => value.toFixed(30);
const lines = ['package AirDecrementPrecisionProbe', 'import Simulation', '', 'init'];
for (const [index, row] of reference.results.entries()) {
    if (![row.x, row.y, row.afterX, row.afterY].every(field => Number.isFinite(field.value))) {
        throw new Error('Nonfinite axis fixture');
    }
    lines.push('    let fighter' + index + ' = new FighterState(0, -360, 1)',
        '    let input' + index + ' = new InputSnapshot()',
        `    fighter${index}.grounded = false`,
        `    fighter${index}.surface = -1`,
        `    fighter${index}.z = 300`,
        `    fighter${index}.physics.gravity = 0`,
        `    fighter${index}.hitstun = 5`,
        `    fighter${index}.knockbackX = ${literal(row.x.value)} * 6`,
        `    fighter${index}.knockbackZ = ${literal(row.y.value)} * 6`,
        `    advance(fighter${index}, 0, input${index}, 0)`,
        `    if fighter${index}.knockbackX != ${literal(row.afterX.value)} * 6 or fighter${index}.knockbackZ != ${literal(row.afterY.value)} * 6`,
        `        BJDebugMsg("AIR_DECREMENT_CASE_${index}_FAIL")`,
        `    destroy input${index}`, `    destroy fighter${index}`);
}
lines.push('    BJDebugMsg("AIR_DECREMENT_BINARY32_EXACT_PASS")', '');
await Bun.write(new URL('build/physics-probe/AirDecrementPrecisionProbe.wurst', project), lines.join('\n'));
