// Foreign fixture boundary: original numeric observations exercise production DI.
const project = new URL('../../', import.meta.url);
const corpus = await Bun.file(new URL('docs/smash-melee-reference/retail-di-vector.json', project)).json();
const literal = value => Object.is(value, -0) ? '-0.' : value.toFixed(40);
const lines = ['package DirectionalInfluencePrecisionProbe', 'import Simulation', '', 'init',
    '    var failures = 0', '    var discreteFailures = 0'];
for (const [index, row] of corpus.results.entries()) {
    const {x, z, stickX, stickZ} = row.input;
    // Inputs were stored to the original fighter as binary32 fields.
    lines.push(`    let result${index} = directionalInfluenceVector(${[x,z,stickX,stickZ].map(v=>literal(Math.fround(v))).join(', ')})`);
    const terms = [];
    for (const name of ['velocityX', 'velocityZ']) {
        const expected = row.output[name];
        terms.push(`result${index}.${name} != ${literal(expected.value)}`);
        if (expected.value === 0) terms.push(`(1. / result${index}.${name} < 0.) != ${expected.bits === '0x80000000'}`);
    }
    lines.push(`    if ${terms.join(' or ')}`, '        failures++');
    if (stickX !== 0.25) lines.push('        discreteFailures++');
    lines.push(`        BJDebugMsg("DIRECTIONAL_INFLUENCE_${index}_MISMATCH")`);
}
lines.push('    BJDebugMsg("DIRECTIONAL_INFLUENCE_MISMATCH_COUNT=" + I2S(failures))',
    '    BJDebugMsg("DIRECTIONAL_INFLUENCE_DISCRETE_MISMATCH_COUNT=" + I2S(discreteFailures))',
    '    if failures != 0', '        BJDebugMsg("DIRECTIONAL_INFLUENCE_BINARY32_EXACT_FAIL")',
    '    else', '        BJDebugMsg("DIRECTIONAL_INFLUENCE_BINARY32_EXACT_PASS")', '');
await Bun.write(new URL('build/physics-probe/DirectionalInfluencePrecisionProbe.wurst', project), lines.join('\n'));
console.log(`DI: ${corpus.results.length} original vector observations`);
