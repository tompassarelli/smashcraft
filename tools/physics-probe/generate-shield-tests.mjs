// Numerical observations only; no original executable or implementation is embedded.
const facts = await Bun.file('docs/smash-melee-reference/retail-analog-shield.json').json();
const real = n => Number.isInteger(n) ? `${n}.` : String(n);
let source = 'package AnalogShieldObservedTests\nimport Simulation\nimport Binary32\n\n';
const groups = new Map();
let observedAssertions = 0;
function observe(group, expression, expected) {
    observedAssertions++;
    if (!groups.has(group)) groups.set(group, new Map());
    const assertions = groups.get(group);
    if (assertions.has(expression) && assertions.get(expression) !== expected)
        throw Error(`Conflicting observations for ${expression}`);
    assertions.set(expression, expected);
}
for (const row of facts.results) {
    const strength = real(row.strength.value);
    if (row.pressure >= 77)
        observe('Pressure', `analogShieldStrength(${row.pressure})`, strength);
    observe('Drain', `(${real(row.health)} - shieldDrain(${strength})).roundToFloat32()`, real(row.healthAfterDrain.value));
    observe('Stun', `shieldstunDuration(${real(row.damage)}, ${strength})`, real(row.stunDuration.value));
    observe('Size', `shieldSizeMultiplier(${real(row.health)}, ${strength})`, real(row.sizeWithUnitBase.value));
    observe('Damage', `(${real(row.health)} - shieldContactDamage(${real(row.damage)}, ${strength})).roundToFloat32()`, real(row.healthAfterDamage.value));
    observe('Pushback', `shieldPushback(${real(row.damage)}, ${strength})`, `${real(row.pushback.value)} * WORLD_UNITS_PER_MELEE_UNIT`);
}
for (const [group, assertions] of groups) {
    source += `@Test function observedRetailShield${group}()\n`;
    for (const [expression, expected] of assertions)
        source += `\t${expression}.assertEquals(${expected})\n`;
    source += '\n';
}
await Bun.write('wurst/AnalogShieldObservedTests.wurst', source);
console.log(JSON.stringify({ observedAssertions, distinctAssertions: [...groups.values()].reduce((sum, group) => sum + group.size, 0) }));
