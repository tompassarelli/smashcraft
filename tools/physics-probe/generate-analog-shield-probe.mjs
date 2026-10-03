// Foreign fixture boundary: retained original numeric outputs become production comparisons.
const project = new URL('../../', import.meta.url);
const corpus = await Bun.file(new URL('docs/smash-melee-reference/retail-analog-shield.json', project)).json();
const real = n => {
    if (!Number.isFinite(n)) throw Error('Invalid analog shield observation');
    return n.toFixed(30);
};
const lines = ['package AnalogShieldPrecisionProbe', 'import Simulation', 'import Binary32', '', 'init', '    var failures = 0'];
for (const [index, row] of corpus.results.entries()) {
    const strength = real(row.strength.value);
    const comparisons = [
        ['drain', `(${real(row.health)} - shieldDrain(${strength})).roundToFloat32()`, row.healthAfterDrain.value],
        ['stun', `shieldstunDuration(${real(row.damage)}, ${strength})`, row.stunDuration.value],
        ['size', `shieldSizeMultiplier(${real(row.health)}, ${strength})`, row.sizeWithUnitBase.value],
        ['damage', `(${real(row.health)} - shieldContactDamage(${real(row.damage)}, ${strength})).roundToFloat32()`, row.healthAfterDamage.value],
        ['pushback', `shieldPushback(${real(row.damage)}, ${strength}) / WORLD_UNITS_PER_MELEE_UNIT`, row.pushback.value],
    ];
    if (row.pressure >= 77) comparisons.push(['pressure', `analogShieldStrength(${row.pressure})`, row.strength.value]);
    for (const [name, expression, expected] of comparisons)
        lines.push(`    if ${expression} != ${real(expected)}`, '        failures++',
            `        BJDebugMsg("ANALOG_SHIELD_${index}_${name}_MISMATCH")`);
}
lines.push('    if failures != 0', '        BJDebugMsg("ANALOG_SHIELD_BINARY32_EXACT_FAIL")',
    '    else', '        BJDebugMsg("ANALOG_SHIELD_BINARY32_EXACT_PASS")', '');
await Bun.write(new URL('build/physics-probe/AnalogShieldPrecisionProbe.wurst', project), lines.join('\n'));
console.log(`Analog shield: ${corpus.results.length} original pressure/drain/stun/size/damage/pushback rows`);
