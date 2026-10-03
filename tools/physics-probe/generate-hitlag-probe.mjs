// Foreign fixture boundary: independent numeric observations become Wurst assertions.
const project = new URL('../../', import.meta.url);
const corpus = await Bun.file(new URL('docs/smash-melee-reference/retail-hitlag-scalars.json', project)).json();
const lines = ['package HitlagPrecisionProbe', 'import Simulation', '', 'init', '    var failures = 0'];
for (const [index, row] of corpus.results.entries()) {
    if (!Number.isInteger(row.power) || row.power <= 0 || !Number.isInteger(row.capped.value))
        throw Error('Invalid positive-power hitlag observation');
    lines.push(`    if victimHitlagFrames(${row.power}., ${row.electric}, ${row.crouching}) != ${row.capped.value}`,
        '        failures++', `        BJDebugMsg("HITLAG_SCALAR_${index}_MISMATCH")`);
}
lines.push('    if failures != 0', '        BJDebugMsg("HITLAG_SCALARS_EXACT_FAIL")',
    '    else', '        BJDebugMsg("HITLAG_SCALARS_EXACT_PASS")', '');
await Bun.write(new URL('build/physics-probe/HitlagPrecisionProbe.wurst', project), lines.join('\n'));
console.log(`Hitlag: ${corpus.results.length} original scalar and cap observations`);
