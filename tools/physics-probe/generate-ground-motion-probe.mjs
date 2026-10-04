// Foreign fixture boundary: retained numeric observations become Wurst assertions.
const project = new URL('../../', import.meta.url);
const corpus = await Bun.file(new URL('docs/smash-melee-reference/retail-ground-motion.json', project)).json();
const literal = value => {
    if (!Number.isFinite(value)) throw Error('Nonfinite ground-motion fixture');
    return value.toFixed(30);
};
const lines = ['package GroundMotionPrecisionProbe', 'import Simulation', '', 'init', '    var failures = 0'];
for (const [index, row] of corpus.results.entries()) {
    const f = `fighter${index}`, input = `input${index}`;
    lines.push(`    let ${f} = new FighterState(0, ${literal(row.before.position.value)} * 6, 1)`,
        `    let ${input} = new InputSnapshot()`, `    ${f}.hitstun = 5`,
        `    ${f}.physics.traction = ${literal(row.before.traction.value)} * 6`);
    for (const [property, key] of [['vx','self'],['knockbackX','launch'],['shieldPushbackX','pushback'],['shieldRecoilX','recoil']])
        lines.push(`    ${f}.${property} = ${literal(row.before[key].value)} * 6`);
    lines.push(`    advance(${f}, 0, ${input}, 0)`);
    for (const [property, key] of [['x','position'],['knockbackX','launch'],['shieldPushbackX','pushback'],['shieldRecoilX','recoil']]) {
        lines.push(`    if ${f}.${property} != ${literal(row.after[key].value)} * 6`,
            '        failures++', `        BJDebugMsg("GROUND_MOTION_${index}_${key}_MISMATCH")`);
    }
    lines.push(`    destroy ${input}`, `    destroy ${f}`);
}
for (const [index, row] of corpus.guardEntries.entries()) {
    const f = `guard${index}`, attacker = `attacker${index}`, world = `world${index}`;
    const facing = Math.sign(row.afterGroundSpeed.value);
    lines.push(`    let ${f} = new FighterState(0, 0, 1)`, `    let ${attacker} = new FighterState(1, -100, 1)`,
        `    let ${world} = new FighterRoster(3)`,
        `    ${world}.fighters[0] = ${f}`, `    ${world}.fighters[1] = ${attacker}`,
        `    ${f}.vx = ${literal(row.previousGroundSpeed.value)} * 6`, `    ${f}.shield = true`,
        '    beginDamageContacts()',
        `    queueDamageContact(${attacker}, ${f}, hitEffect(4, 0, 0, 0, 0, false), ${facing}, CONTACT_LAUNCH, true, null)`,
        `    finishDamageContacts(${world})`,
        `    if ${f}.vx != 0 or totalVelocityX(${f}) != ${f}.shieldPushbackX`,
        '        failures++', `        BJDebugMsg("GROUND_SHIELD_ENTRY_${index}_MISMATCH")`,
        `    destroy ${world}`, `    destroy ${attacker}`, `    destroy ${f}`);
}
lines.push('    if failures != 0', '        BJDebugMsg("GROUND_MOTION_BINARY32_EXACT_FAIL")',
    '    else', '        BJDebugMsg("GROUND_MOTION_BINARY32_EXACT_PASS")', '');
await Bun.write(new URL('build/physics-probe/GroundMotionPrecisionProbe.wurst', project), lines.join('\n'));
console.log(`Ground motion: ${corpus.results.length} arithmetic cases and ${corpus.guardEntries.length} shield-entry cases`);
