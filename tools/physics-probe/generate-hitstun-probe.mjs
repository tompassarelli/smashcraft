// Foreign fixture boundary: original numeric observations become Wurst assertions.
const project = new URL('../../', import.meta.url);
const corpus = await Bun.file(new URL('docs/smash-melee-reference/retail-hitstun-boundaries.json', project)).json();
const lines = ['package HitstunPrecisionProbe', 'import Simulation', '', 'init', '    var failures = 0'];
for (const [index, row] of corpus.results.entries()) {
    const knockback = row.knockback.value;
    if (!Number.isFinite(knockback) || knockback < 0) throw Error('Invalid hitstun observation');
    lines.push(`    if ordinaryHitstunFrames(${knockback.toFixed(30)}) != ${row.frames.value} or damageLevelForKnockback(${knockback.toFixed(30)}) != ${row.damageLevel}`,
        '        failures++', `        BJDebugMsg("HITSTUN_BOUNDARY_${index}_MISMATCH")`);
}
lines.push('    if failures != 0', '        BJDebugMsg("HITSTUN_BOUNDARIES_EXACT_FAIL")',
    '    else', '        BJDebugMsg("HITSTUN_BOUNDARIES_EXACT_PASS")', '');
await Bun.write(new URL('build/physics-probe/HitstunPrecisionProbe.wurst', project), lines.join('\n'));
console.log(`Hitstun: ${corpus.results.length} original duration and damage-level observations`);
