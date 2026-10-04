// Foreign fixture boundary: numeric PPC observations become production assertions.
const project = new URL('../../', import.meta.url);
const reference = await Bun.file(new URL('docs/smash-melee-reference/retail-air-axis-decrement.json', project)).json();
const recoil = await Bun.file(new URL('docs/smash-melee-reference/retail-air-recoil-decrement.json', project)).json();
const literal = value => value.toFixed(30);
const lines = ['package AirDecrementPrecisionProbe', 'import Simulation', '', 'init', '    var failures = 0'];
const cases = [...reference.results.map(row => ({ row, axis: 'knockback' })),
    ...recoil.results.map(row => ({ row, axis: 'shieldRecoil' }))];
for (const [index, { row, axis }] of cases.entries()) {
    if (![row.x, row.y, row.afterX, row.afterY].every(field => Number.isFinite(field.value))) {
        throw new Error('Nonfinite axis fixture');
    }
    lines.push('    let fighter' + index + ' = new FighterState(0, -360, 1)',
        '    let input' + index + ' = new InputSnapshot()',
        `    fighter${index}.grounded = false`,
        `    fighter${index}.surface = -1`,
        `    fighter${index}.z = 300`,
        `    fighter${index}.physics.gravity = 0`,
        `    fighter${index}.vx = 1.5`,
        `    fighter${index}.hitstun = 5`,
        `    fighter${index}.${axis}X = ${literal(row.x.value)} * 6`,
        `    fighter${index}.${axis}Z = ${literal(row.y.value)} * 6`,
        `    advance(fighter${index}, 0, input${index}, 0)`,
        `    if fighter${index}.${axis}X != ${literal(row.afterX.value)} * 6 or fighter${index}.${axis}Z != ${literal(row.afterY.value)} * 6`,
        `        failures++`,
        `        BJDebugMsg("AIR_DECREMENT_CASE_${index}_FAIL")`,
        `    if fighter${index}.x != ${literal(Math.fround(Math.fround(-60 + 0.25) + row.afterX.value))} * 6`,
        `        failures++`,
        `        BJDebugMsg("AIR_POSITION_CASE_${index}_FAIL")`,
        `    destroy input${index}`, `    destroy fighter${index}`);
}
lines.push('    if failures != 0', '        BJDebugMsg("AIR_DECREMENT_BINARY32_EXACT_FAIL")',
    '    else', '        BJDebugMsg("AIR_DECREMENT_BINARY32_EXACT_PASS")', '');
await Bun.write(new URL('build/physics-probe/AirDecrementPrecisionProbe.wurst', project), lines.join('\n'));
