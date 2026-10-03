// Numerical observations only; no original executable or implementation is embedded.
const facts = await Bun.file('docs/smash-melee-reference/retail-analog-shield.json').json();
const real = n => Number.isInteger(n) ? `${n}.` : String(n);
let source = 'package AnalogShieldObservedTests\nimport Simulation\nimport Binary32\n\n';
for (const [index, row] of facts.results.entries()) {
    const strength = real(row.strength.value);
    source += `@Test function observedRetailShield${index}()\n`;
    if (row.pressure >= 77)
        source += `\tanalogShieldStrength(${row.pressure}).assertEquals(${strength})\n`;
    source += `\t(${real(row.health)} - shieldDrain(${strength})).roundToFloat32().assertEquals(${real(row.healthAfterDrain.value)})\n`;
    source += `\tshieldstunDuration(${real(row.damage)}, ${strength}).assertEquals(${real(row.stunDuration.value)})\n`;
    source += `\tshieldSizeMultiplier(${real(row.health)}, ${strength}).assertEquals(${real(row.sizeWithUnitBase.value)})\n`;
    source += `\t(${real(row.health)} - shieldContactDamage(${real(row.damage)}, ${strength})).roundToFloat32().assertEquals(${real(row.healthAfterDamage.value)})\n`;
    source += `\tshieldPushback(${real(row.damage)}, ${strength}).assertEquals(${real(row.pushback.value)} * WORLD_UNITS_PER_MELEE_UNIT)\n\n`;
}
await Bun.write('wurst/AnalogShieldObservedTests.wurst', source);
