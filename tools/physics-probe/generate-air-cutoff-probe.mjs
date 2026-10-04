// Foreign fixture boundary: original refinement observations become production checks.
const project = new URL('../../', import.meta.url);
const facts = await Bun.file(new URL('docs/smash-melee-reference/retail-air-cutoff-boundaries.json', project)).json();
const cutoffState = await Bun.file(new URL('docs/smash-melee-reference/retail-air-recoil-cutoff-state.json', project)).json();
let errorBound = 1 / 32;
for (const upperBound of [.00149, .00000334, .00000000001674]) {
    if (!(1.5 * errorBound ** 2 + .5 * errorBound ** 3 + 8 * 2 ** -53 < upperBound)) {
        throw new Error('Refinement error bound does not hold');
    }
    errorBound = upperBound;
}
if (!(errorBound + (1 + errorBound) * 2 ** -53 < .00000000002)) {
    throw new Error('Final multiplication error bound does not hold');
}
const view = new DataView(new ArrayBuffer(4));
const bits = value => { view.setFloat32(0, value); return view.getUint32(0); };
const denominator = 50000000000n;
for (const threshold of facts.thresholds) {
    const decayBits = bits(threshold.decay), belowBits = bits(threshold.below), aboveBits = bits(threshold.above);
    if ((decayBits >>> 23) !== 122 || (belowBits >>> 23) !== 118 || aboveBits !== belowBits + 1) {
        throw new Error('Unexpected cutoff spacing');
    }
    const midpointNumerator = BigInt(2 * ((decayBits & 0x7fffff) | 0x800000) - 1);
    const below = BigInt((belowBits & 0x7fffff) | 0x800000) << 26n;
    const above = BigInt((aboveBits & 0x7fffff) | 0x800000) << 26n;
    const midpointSquare = midpointNumerator ** 2n * denominator ** 2n;
    if (!(below * (denominator + 1n) ** 2n < midpointSquare
        && above * (denominator - 1n) ** 2n > midpointSquare)) {
        throw new Error('Exact cutoff boundary argument failed');
    }
    const spacing = 2 ** -28;
    if (Math.fround(threshold.decay * (threshold.decay - spacing) + spacing ** 2 / 4) !== threshold.above) {
        throw new Error('Derived cutoff is not the first squared speed above the midpoint');
    }
}
console.log('AIR_CUTOFF_BOUNDARY_ARGUMENT_PASS');
const literal = value => value.toFixed(40);
const lines = ['package AirCutoffPrecisionProbe', 'import Simulation', '', 'init', '    var failures = 0'];
for (const [index, row] of facts.results.entries()) {
    const axis = row.decay.value === Math.fround(.051) ? 'knockback' : 'shieldRecoil';
    lines.push(`    let fighter${index} = new FighterState(0, -360, 1)`,
        `    let input${index} = new InputSnapshot()`,
        `    fighter${index}.grounded = false`, `    fighter${index}.surface = -1`,
        `    fighter${index}.z = 300`, `    fighter${index}.physics.gravity = 0`,
        `    fighter${index}.hitstun = 5`,
        `    fighter${index}.${axis}X = ${literal(row.x.value)} * 6`,
        `    fighter${index}.${axis}Z = ${literal(row.y.value)} * 6`,
        `    advance(fighter${index}, 0, input${index}, 0)`,
        `    if fighter${index}.${axis}X != ${literal(row.afterX.value)} * 6 or fighter${index}.${axis}Z != ${literal(row.afterY.value)} * 6`,
        `        failures++`,
        `        BJDebugMsg("AIR_CUTOFF_${index}_FAIL")`,
        `    destroy input${index}`, `    destroy fighter${index}`);
}
for (const [index, row] of cutoffState.results.entries()) {
    const fighter = `stateFighter${index}`, control = `stateControl${index}`, input = `stateInput${index}`;
    lines.push(`    let ${fighter} = new FighterState(0, 0, 1)`,
        `    let ${control} = new FighterState(0, 0, 1)`, `    let ${input} = new InputSnapshot()`);
    for (const actor of [fighter, control]) {
        lines.push(`    ${actor}.grounded = false`, `    ${actor}.surface = -1`,
            `    ${actor}.z = 300`, `    ${actor}.physics.gravity = 0`, `    ${actor}.hitstun = 5`,
            `    ${actor}.knockbackX = ${literal(row.before.launchX.value)} * 6`,
            `    ${actor}.knockbackZ = ${literal(row.before.launchY.value)} * 6`);
    }
    lines.push(`    ${fighter}.shieldRecoilX = ${literal(row.before.recoilX.value)} * 6`,
        `    ${fighter}.shieldRecoilZ = ${literal(row.before.recoilY.value)} * 6`,
        `    advance(${fighter}, 0, ${input}, 0)`, `    advance(${control}, 0, ${input}, 0)`,
        `    if ${fighter}.knockbackZ != ${literal(row.after.launchY.value)} * 6 or ${fighter}.knockbackX != ${control}.knockbackX`,
        `        failures++`,
        `        BJDebugMsg("AIR_RECOIL_CUTOFF_LAUNCH_${index}_FAIL")`,
        `    if ${fighter}.shieldRecoilX != ${literal(row.after.recoilX.value)} * 6 or ${fighter}.shieldRecoilZ != ${literal(row.after.recoilY.value)} * 6`,
        `        failures++`,
        `        BJDebugMsg("AIR_RECOIL_CUTOFF_STATE_${index}_FAIL")`,
        `    if ${control}.knockbackZ == 0 and ${literal(row.before.launchY.value)} != 0`,
        `        failures++`,
        `        BJDebugMsg("AIR_RECOIL_CUTOFF_EMPTY_GUARD_${index}_FAIL")`,
        `    destroy ${input}`, `    destroy ${fighter}`, `    destroy ${control}`);
}
lines.push('    if failures != 0', '        BJDebugMsg("AIR_CUTOFF_BINARY32_EXACT_FAIL")',
    '    else', '        BJDebugMsg("AIR_CUTOFF_BINARY32_EXACT_PASS")', '');
await Bun.write(new URL('build/physics-probe/AirCutoffPrecisionProbe.wurst', project), lines.join('\n'));
