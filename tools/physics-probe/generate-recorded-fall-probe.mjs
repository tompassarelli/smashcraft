// Foreign fixture boundary: turn recorded JSON coordinates into Wurst assertions.
const project = new URL('../../', import.meta.url);
const recording = await Bun.file(new URL('docs/smash-melee-reference/slippi-ntsc-falco-fall.json', project)).json();
const parameters = await Bun.file(new URL('docs/smash-melee-reference/physics-parameters.json', project)).json();
const gravity = parameters.characters.Falco.values.find(value => value.field === 'gravity').retailValue;
const terminalSpeed = parameters.characters.Falco.values.find(value => value.field === 'terminal_velocity').retailValue;
if (recording.samples.length !== 10 || recording.samples.some(sample => !Number.isFinite(sample.y))) {
    throw new Error('Expected ten finite recorded fall positions');
}
const lines = [
    'package RecordedFallPrecisionProbe',
    'import Simulation',
    '',
    'init',
    '    var failures = 0',
    '    for host = 0 to 1',
    '        let fighter = new FighterState(host, -360, 1)',
    '        let input = new InputSnapshot()',
    `        fighter.physics.gravity = ${gravity} * 6`,
    `        fighter.physics.terminalSpeed = ${terminalSpeed} * 6`,
    '        fighter.grounded = false',
    '        fighter.surface = -1',
    `        setMeleePosition(fighter, -60., ${recording.initial.y})`,
    `        setMeleeVerticalVelocity(fighter, ${recording.initialSelfVelocityY}.)`,
];
for (const sample of recording.samples) {
    lines.push('        advance(fighter, 0, input, 0)',
        `        if fighter.grounded or fighter.x != -360 or fighter.z != ${sample.y} * 6 or fighter.motionZ.original != ${sample.y}`,
        `            failures++`,
        `            BJDebugMsg("RECORDED_FALL_FRAME_${sample.frame}_FAIL")`,
        `            BJDebugMsg("FALL_HOST=" + I2S(host) + " FRAME=${sample.frame} Z=" + R2SW(fighter.z, 0, 12) + " EXPECTED=" + R2SW(${sample.y} * 6, 0, 12) + " VZ=" + R2SW(fighter.vz, 0, 12))`);
}
lines.push('        destroy input', '        destroy fighter',
    '    if failures != 0', '        BJDebugMsg("RECORDED_FALL_TEN_FRAMES_BINARY32_EXACT_FAIL")',
    '    else', '        BJDebugMsg("RECORDED_FALL_TEN_FRAMES_BINARY32_EXACT_PASS")', '');
await Bun.write(new URL('build/physics-probe/RecordedFallPrecisionProbe.wurst', project), lines.join('\n'));
