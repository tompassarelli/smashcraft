// Foreign fixture boundary: original scalar observations become Wurst assertions.
const project = new URL('../../', import.meta.url);
const facts = await Bun.file(new URL('docs/smash-melee-reference/retail-signed-zero-scalars.json', project)).json();
const literal = field => field.bits === '0x80000000' ? '-0.' : field.value.toFixed(30);
const lines = ['package SignedZeroPrecisionProbe', 'import MeleeScalarMath', '', 'init'];
let comparisons = 0;
for (const [index, row] of facts.results.entries()) {
    lines.push(`    let angle${index} = ${row.kind === 'atan2' ? `meleeAtan2(${literal(row.y)}, ${literal(row.x)})` : literal(row.angle)}`);
    for (const [name, expression, expected] of [
        ...(row.kind === 'atan2' ? [['angle', `angle${index}`, row.angle]] : []),
        ['cos', `meleeCos(angle${index})`, row.cos], ['sin', `meleeSin(angle${index})`, row.sin],
    ]) {
        comparisons++;
        const value = `value${index}${name}`;
        lines.push(`    let ${value} = ${expression}`,
            `    if ${value} != ${literal(expected)}`,
            `        BJDebugMsg("SIGNED_ZERO_${index}_${name}_FAIL")`);
        if (expected.value === 0) {
            lines.push(`    if (1. / ${value} < 0.) != ${expected.bits === '0x80000000'}`,
                `        BJDebugMsg("SIGNED_ZERO_SIGN_${index}_${name}_FAIL")`);
        }
    }
}
lines.push('    BJDebugMsg("SIGNED_ZERO_SCALARS_EXACT_PASS")', '');
await Bun.write(new URL('build/physics-probe/SignedZeroPrecisionProbe.wurst', project), lines.join('\n'));
console.log(`SIGNED_ZERO_FIXTURE ${comparisons} output comparisons`);
