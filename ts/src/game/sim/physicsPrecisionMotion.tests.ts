import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Character, ContactKind } from "./codes";
import { beginDamageContacts, finishDamageContacts, queueDamageContact } from "./contacts";
import { createFighter } from "./fighter";
import { controls, hitEffect, soloWorld, testWorld } from "./testWorld";
import { advanceFighter } from "./step";
import { setMeleeKnockback, setMeleePosition, setMeleeRecoil, setMeleeVerticalVelocity, totalVelocityX } from "./motion";
import { melee } from "./tuning";

test("#9 RECORDED_FALL_TEN_FRAMES_BINARY32_EXACT_PASS [reference]", () => {
  const positions = [
    9.872425079345703, 9.532424926757812, 9.022424697875977, 8.342424392700195,
    7.492424488067627, 6.472424507141113, 5.282424449920654, 3.922424554824829,
    2.3924245834350586, 0.6924247741699219,
  ];
  for (const character of [Character.archer, Character.rifleman]) {
    const f = createFighter(character, -360.0, 1);
    f.tuning.physics = {
      ...f.tuning.physics,
      gravity: melee(0.17000000178813934),
      terminalSpeed: melee(3.0999999046325684),
    };
    f.motion.grounded = false;
    f.motion.surface = undefined;
    setMeleePosition(f, -60.0, 10.042425155639648);
    setMeleeVerticalVelocity(f, 0.0);
    const world = soloWorld(f);
    for (const position of positions) {
      advanceFighter(world, 0, 0, controls(), 0.0);
      assertEquals(f.motion.meleeZ.original, position);
      assertEquals(f.motion.z, melee(position));
      assertEquals(f.motion.grounded, false);
      assertEquals(f.motion.x, -360.0);
    }
  }
});

type AxisDecrementCase = readonly [number, number, number, number, number];

test("#9 AIR_DECREMENT_BINARY32_EXACT_PASS [reference]", () => {
  const launchCases: AxisDecrementCase[] = [
    [1, 0, 0.9490000009536743, 0, -58.80099868774414],
    [0, 1, 2.838408397209946e-9, 0.9490000009536743, -59.75],
    [-1, 0, -0.9490000009536743, 4.4585615199821405e-9, -60.69900131225586],
    [0, -1, 2.838408397209946e-9, -0.9490000009536743, -59.75],
    [4, 3, 3.959199905395508, 2.969399929046631, -55.790802001953125],
    [3, 4, 2.969399929046631, 3.959199905395508, -56.780601501464844],
    [1, 1, 0.9639375805854797, 0.9639375805854797, -58.78606414794922],
    [1, -1, 0.9639375805854797, -0.9639375805854797, -58.78606414794922],
    [-1, 1, -0.9639375805854797, 0.9639375805854797, -60.71393585205078],
    [-1, -1, -0.9639375805854797, -0.9639375805854797, -60.71393585205078],
    [1, 0.05000000074505806, 0.9490636587142944, 0.04745318368077278, -58.80093765258789],
  ];
  const recoilCases: AxisDecrementCase[] = [
    [1, 0, 0.949999988079071, 0, -58.79999923706055],
    [0, 1, 2.782753361074697e-9, 0.949999988079071, -59.75],
    [-1, 0, -0.949999988079071, 4.371139006309477e-9, -60.70000076293945],
    [0, -1, 2.782753361074697e-9, -0.949999988079071, -59.75],
    [4, 3, 3.9600000381469727, 2.9700000286102295, -55.790000915527344],
    [3, 4, 2.9700000286102295, 3.9600000381469727, -56.779998779296875],
    [1, 1, 0.9646446704864502, 0.9646446704864502, -58.78535461425781],
    [1, -1, 0.9646446704864502, -0.9646446704864502, -58.78535461425781],
    [-1, 1, -0.9646446704864502, 0.9646446704864502, -60.71464538574219],
    [-1, -1, -0.9646446704864502, -0.9646446704864502, -60.71464538574219],
    [1, 0.05000000074505806, 0.9500623941421509, 0.04750312119722366, -58.7999382019043],
  ];
  for (const [rows, recoil] of [[launchCases, false], [recoilCases, true]] as const) {
    for (const [index, [x, z, afterX, afterZ, afterPosition]] of rows.entries()) {
      const f = createFighter(Character.rifleman, -360.0, 1);
      f.motion.grounded = false;
      f.motion.surface = undefined;
      f.motion.z = 300.0;
      f.tuning.physics = { ...f.tuning.physics, gravity: 0.0 };
      f.launch.hitstun = 5;
      f.motion.vx = 1.5;
      if (recoil) {
        setMeleeRecoil(f, x, z);
      } else {
        setMeleeKnockback(f, x, z);
      }
      advanceFighter(soloWorld(f), 0, 0, controls(), 0.0);
      assertEquals(recoil ? f.shield.recoilX : f.launch.knockbackX, melee(afterX));
      assertEquals(recoil ? f.shield.recoilZ : f.launch.knockbackZ, melee(afterZ));
      assertEquals(f.motion.x, melee(afterPosition), `AIR_POSITION_${recoil ? "RECOIL" : "LAUNCH"}_${index}`);
    }
  }
});

test("#9 AIR_CUTOFF_BINARY32_EXACT_PASS [reference]", () => {
  const cases: readonly (readonly [number, number, number, number, number])[] = [
    [0.050999999046325684, 0.050999965518713, 0.0000486582939629443, 0, 0],
    [0.050999999046325684, 0.050999965518713, 0.000050994705816265196, 0, 0],
    [0.050999999046325684, 0.050999965518713, 0.000053228664910420775, 0, 0],
    [0.050999999046325684, 0.050999965518713, 0.00005537256947718561, 0, 0],
    [0.050999999046325684, 0.050999965518713, 0.00005743650399381295, -8.94075924406934e-11, -7.598907614259076e-12],
    [0.050999999046325684, 0.050999965518713, 0.00005942880306974985, -8.94075924406934e-11, 4.982098067429774e-12],
    [0.050999999046325684, 0.050999965518713, 0.00006135644798632711, 2.9504292342608096e-9, 1.496580637194711e-12],
    [0.050999999046325684, 0.050999965518713, 0.00006322534318314865, 5.990266060962313e-9, 2.6374735728751375e-12],
    [0.050999999046325684, 0.050999965518713, 0.00006504056364065036, 9.030102887663816e-9, 1.3032380730138016e-11],
    [0.05000000074505806, 0.049999967217445374, 0.000047864938096608967, 0, 0.000047864938096608967],
    [0.05000000074505806, 0.049999967217445374, 0.00005023826452088542, 0, 0.00005023826452088542],
    [0.05000000074505806, 0.049999967217445374, 0.00005250441608950496, 0, 0.00005250441608950496],
    [0.05000000074505806, 0.049999967217445374, 0.00005467672599479556, 0, 0.00005467672599479556],
    [0.05000000074505806, 0.049999967217445374, 0.00005676596629200503, -7.45057571194252e-10, -2.301070358562418e-12],
    [0.05000000074505806, 0.049999967217445374, 0.00005878099909750745, 2.2351747119842003e-9, 3.489669490874814e-12],
    [0.05000000074505806, 0.049999967217445374, 0.000060729205870302394, 2.2351747119842003e-9, -1.77339913587371e-13],
    [0.05000000074505806, 0.049999967217445374, 0.00006261682574404404, 5.2154067731180476e-9, 9.253276964105162e-12],
    [0.05000000074505806, 0.049999967217445374, 0.00006444918835768476, 8.195639722430315e-9, 6.315589978073133e-12],
  ];
  for (const [index, [decay, x, z, afterX, afterZ]] of cases.entries()) {
    const f = createFighter(Character.rifleman, -360.0, 1);
    f.motion.grounded = false;
    f.motion.surface = undefined;
    f.motion.z = 300.0;
    f.tuning.physics = { ...f.tuning.physics, gravity: 0.0 };
    f.launch.hitstun = 5;
    if (decay === 0.050999999046325684) {
      setMeleeKnockback(f, x, z);
    } else {
      setMeleeRecoil(f, x, z);
    }
    advanceFighter(soloWorld(f), 0, 0, controls(), 0.0);
    const isLaunch = decay === 0.050999999046325684;
    assertEquals(isLaunch ? f.launch.knockbackX : f.shield.recoilX, melee(afterX), `AIR_CUTOFF_${index}_X`);
    assertEquals(isLaunch ? f.launch.knockbackZ : f.shield.recoilZ, melee(afterZ), `AIR_CUTOFF_${index}_Z`);
  }

  const stateCases = [
    [2, 3, 0.019999999552965164, 0.009999999776482582, 0, 0, 0.009999999776482582],
    [-2, -3, -0.019999999552965164, -0.009999999776482582, 0, 0, -0.009999999776482582],
    [0, 7, 0, 0.009999999776482582, 0, 0, 0.009999999776482582],
    [2, 0, 0.019999999552965164, 0, 0, 0, 0],
  ] as const;
  for (const [index, [launchX, launchZ, recoilX, recoilZ, afterLaunchZ, afterRecoilX, afterRecoilZ]] of stateCases.entries()) {
    const fighter = createFighter(Character.rifleman, 0.0, 1);
    const control = createFighter(Character.rifleman, 0.0, 1);
    for (const f of [fighter, control]) {
      f.motion.grounded = false;
      f.motion.surface = undefined;
      f.motion.z = 300.0;
      f.tuning.physics = { ...f.tuning.physics, gravity: 0.0 };
      f.launch.hitstun = 5;
      setMeleeKnockback(f, launchX, launchZ);
    }
    setMeleeRecoil(fighter, recoilX, recoilZ);
    advanceFighter(soloWorld(fighter), 0, 0, controls(), 0.0);
    advanceFighter(soloWorld(control), 0, 0, controls(), 0.0);
    assertEquals(fighter.launch.knockbackZ, melee(afterLaunchZ), `AIR_RECOIL_CUTOFF_LAUNCH_${index}_Z`);
    assertEquals(fighter.launch.knockbackX, control.launch.knockbackX, `AIR_RECOIL_CUTOFF_LAUNCH_${index}_X`);
    assertEquals(fighter.shield.recoilX, melee(afterRecoilX), `AIR_RECOIL_CUTOFF_STATE_${index}_X`);
    assertEquals(fighter.shield.recoilZ, melee(afterRecoilZ), `AIR_RECOIL_CUTOFF_STATE_${index}_Z`);
    assertTrue(control.launch.knockbackZ !== 0 || launchZ === 0);
  }
});

test("#9 GROUND_MOTION_BINARY32_EXACT_PASS [reference]", () => {
  type GroundCase = readonly [string, number, number, number, number, number, number, number, number, number, number];
  const cases: readonly GroundCase[] = [
    ["position", -60, .25, .7562744617462158, 0, -.30000001192092896, .07999999821186066, -59.285728454589844, .6762744784355164, 0, -.2120000123977661],
    ["position", .10000000149011612, .25, .7562744617462158, 0, -.30000001192092896, .07999999821186066, .8142744302749634, .6762744784355164, 0, -.2120000123977661],
    ["position", 60, .25, .7562744617462158, 0, -.30000001192092896, .07999999821186066, 60.714271545410156, .6762744784355164, 0, -.2120000123977661],
    ["defender", 20.123455047607422, 0, 0, .45600005984306335, 0, .07999999821186066, 20.499454498291016, 0, .3760000467300415, 0],
    ["defender", 20.123455047607422, 0, 0, .09000000357627869, 0, .07999999821186066, 20.133455276489258, 0, .01000000536441803, 0],
    ["defender", 20.123455047607422, 0, 0, .07999999821186066, 0, .07999999821186066, 20.123455047607422, 0, 0, 0],
    ["defender", 20.123455047607422, 0, 0, .009999999776482582, 0, .07999999821186066, 20.123455047607422, 0, 0, 0],
    ["attacker", 20.123455047607422, 0, 0, 0, .30000001192092896, .07999999821186066, 20.3354549407959, 0, 0, .2120000123977661],
    ["attacker", 20.123455047607422, 0, 0, 0, .08800000697374344, .07999999821186066, 20.123455047607422, 0, 0, 7.450580596923828e-9],
    ["attacker", 20.123455047607422, 0, 0, 0, .08799999952316284, .07999999821186066, 20.123455047607422, 0, 0, 0],
    ["attacker", 20.123455047607422, 0, 0, 0, .009999999776482582, .07999999821186066, 20.123455047607422, 0, 0, 0],
    ["position", -60, -.25, -.7562744617462158, 0, .30000001192092896, .07999999821186066, -60.714271545410156, -.6762744784355164, 0, .2120000123977661],
    ["position", .10000000149011612, -.25, -.7562744617462158, 0, .30000001192092896, .07999999821186066, -.6142745018005371, -.6762744784355164, 0, .2120000123977661],
    ["position", 60, -.25, -.7562744617462158, 0, .30000001192092896, .07999999821186066, 59.285728454589844, -.6762744784355164, 0, .2120000123977661],
    ["defender", -20.123455047607422, 0, 0, -.45600005984306335, 0, .07999999821186066, -20.499454498291016, 0, -.3760000467300415, 0],
    ["defender", -20.123455047607422, 0, 0, -.09000000357627869, 0, .07999999821186066, -20.133455276489258, 0, -.01000000536441803, 0],
    ["defender", -20.123455047607422, 0, 0, -.07999999821186066, 0, .07999999821186066, -20.123455047607422, 0, 0, 0],
    ["defender", -20.123455047607422, 0, 0, -.009999999776482582, 0, .07999999821186066, -20.123455047607422, 0, 0, 0],
    ["attacker", -20.123455047607422, 0, 0, 0, -.30000001192092896, .07999999821186066, -20.3354549407959, 0, 0, -.2120000123977661],
    ["attacker", -20.123455047607422, 0, 0, 0, -.08800000697374344, .07999999821186066, -20.123455047607422, 0, 0, -7.450580596923828e-9],
    ["attacker", -20.123455047607422, 0, 0, 0, -.08799999952316284, .07999999821186066, -20.123455047607422, 0, 0, 0],
    ["attacker", -20.123455047607422, 0, 0, 0, -.009999999776482582, .07999999821186066, -20.123455047607422, 0, 0, 0],
  ];
  for (const [index, row] of cases.entries()) {
    const [kind, position, self, launch, pushback, recoil, traction, afterPosition, afterLaunch, afterPushback, afterRecoil] = row;
    const f = createFighter(Character.rifleman, melee(position), 1);
    f.launch.hitstun = 5;
    f.tuning.physics = { ...f.tuning.physics, traction: melee(traction) };
    f.motion.vx = melee(self);
    f.launch.knockbackX = melee(launch);
    f.shield.pushbackX = melee(pushback);
    f.shield.recoilX = melee(recoil);
    advanceFighter(soloWorld(f), 0, 0, controls(), 0.0);
    assertEquals(f.motion.x, melee(afterPosition), `GROUND_MOTION_${index}_${kind}_POSITION`);
    assertEquals(f.launch.knockbackX, melee(afterLaunch), `GROUND_MOTION_${index}_${kind}_LAUNCH`);
    assertEquals(f.shield.pushbackX, melee(afterPushback), `GROUND_MOTION_${index}_${kind}_PUSHBACK`);
    assertEquals(f.shield.recoilX, melee(afterRecoil), `GROUND_MOTION_${index}_${kind}_RECOIL`);
  }

  const guardRows = [
    [1.75, -1], [1.75, 1], [-1.75, -1], [-1.75, 1],
  ] as const;
  for (const [index, [previousGroundSpeed, direction]] of guardRows.entries()) {
    const defender = createFighter(Character.rifleman, 0.0, 1);
    const attacker = createFighter(Character.archer, -100.0, 1);
    const world = testWorld(defender, attacker);
    defender.motion.vx = melee(previousGroundSpeed);
    defender.shield.raised = true;
    beginDamageContacts();
    queueDamageContact(world, 1, 0, hitEffect(4.0, 0.0, 0.0, 0.0, 0.0), direction, ContactKind.launch, true, undefined);
    finishDamageContacts(world);
    assertEquals(defender.motion.vx, 0.0, `GROUND_SHIELD_ENTRY_${index}_SELF_SPEED`);
    assertEquals(totalVelocityX(defender), defender.shield.pushbackX, `GROUND_SHIELD_ENTRY_${index}_TOTAL`);
    assertEquals(defender.shield.pushbackX, melee(direction * 0.45600005984306335), `GROUND_SHIELD_ENTRY_${index}_PUSHBACK`);
  }
});
