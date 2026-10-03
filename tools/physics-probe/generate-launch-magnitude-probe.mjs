// Foreign fixture boundary: independent original outputs become production assertions.
const project = new URL('../../', import.meta.url);
const corpus = await Bun.file(new URL('docs/smash-melee-reference/retail-launch-magnitude.json', project)).json();
const literal = value => {
    if (!Number.isFinite(value)) throw Error('Nonfinite launch fixture');
    return value.toFixed(30);
};
const lines = ['package LaunchMagnitudePrecisionProbe', 'import Simulation', '', 'init', '    var failures = 0'];
for (const [index, row] of corpus.results.entries()) {
    const args = row.kind === 'fixed' ? [row.fixed, row.weight, row.growth, row.base, row.scale]
        : [row.pre, row.damage, row.weight, row.growth, row.base, row.scale];
    lines.push(`    if ${row.kind === 'fixed' ? 'fixedHitKnockback' : 'ordinaryHitKnockback'}(${args.map((v, i) => row.kind === 'fixed' && i === 0 ? String(v) : literal(v)).join(', ')}) != ${literal(row.expected.value)}`,
        '        failures++', `        BJDebugMsg("LAUNCH_MAGNITUDE_${index}_MISMATCH")`);
    for (const [contextIndex, context] of row.contexts.entries()) {
        lines.push(`    if hitContextKnockback(${literal(row.expected.value)}, ${context.crouching}, ${context.charging}) != ${literal(context.expected.value)}`,
            '        failures++', `        BJDebugMsg("LAUNCH_CONTEXT_${index}_${contextIndex}_MISMATCH")`);
    }
}
lines.push('    BJDebugMsg("LAUNCH_MAGNITUDE_MISMATCH_COUNT=" + I2S(failures))',
    '    if failures != 0', '        BJDebugMsg("LAUNCH_MAGNITUDE_BINARY32_EXACT_FAIL")',
    '    else', '        BJDebugMsg("LAUNCH_MAGNITUDE_BINARY32_EXACT_PASS")', '');
await Bun.write(new URL('build/physics-probe/LaunchMagnitudePrecisionProbe.wurst', project), lines.join('\n'));
console.log(`Launch magnitude: ${corpus.results.length} original scalar observations`);
