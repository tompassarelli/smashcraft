import { assertEquals, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { floorMod } from "wisp/src/sim/intMath";
import { f32 } from "wisp/src/sim/f32";
import { queueAttack } from "../input/attackBuffer";
import { stateChecksum } from "../replay/canonical";
import { firstStateDifference } from "../replay/difference";
import { copyReplayState, createReplaySnapshot } from "../replay/snapshot";
import { prepareQuickMatch } from "../shell/devSettings";
import { AttackStyle, Character, GroundAction, ItemKind, LedgeState, itemBit } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { advanceGroundMovement } from "../sim/groundMovement";
import { applyItemBuff, knockbackWeight } from "../sim/itemBuffs";
import { beginJump } from "../sim/jumpsAndDodges";
import { advanceLedge } from "../sim/ledge";
import { airDriftVelocity, applyMeleeGravity, retainedOriginal, termsOfPhysics } from "../sim/motion";
import { controls, hitEffect, soloWorld, testWorld, contactBatch } from "../sim/testWorld";
import { fighterAt } from "../sim/roster";
import { advanceFighter } from "../sim/step";
import { checkBlastZone } from "../sim/stocks";
import { ContactKind } from "../sim/codes";
import { queueDamageContact } from "../sim/contacts";
import { ITEM_WARNING_FRAMES, itemWarningFrames, scheduleMatchItems } from "./centreItem";
import { createFrameControls } from "./controls";
import { createMatchState, Phase, setHumanCount } from "./rules";
import { stepMatch } from "./step";
import { sweep } from "../../runtime/sweep";

function gameAtCentre(character: Character = Character.rifleman) {
  const game = createMatchState();
  setHumanCount(game, 2);
  game.phase = Phase.match;
  game.stageChoice = 0;
  game.endless = true;
  const first = createFighter(character, 0.0, 1);
  const second = createFighter(Character.rifleman, 240.0, -1);
  return { game, first, second, world: testWorld(first, second), input: createFrameControls() };
}

function pickup(character: Character, kind: ItemKind, style: AttackStyle = AttackStyle.jab) {
  const fixture = gameAtCentre(character);
  fixture.game.items.kind = kind;
  queueAttack(fixture.input.commands[0], { style, facing: 0, frame: 1, mayCharge: false });
  stepMatch(fixture.game, fixture.world, fixture.input, 1);
  assertEquals(fixture.first.status.buff, kind, `${character} pickup`);
  assertEquals(fixture.game.items.lastTaker, 0);
  assertEquals(fixture.game.items.pickupSerial, 1);
  assertEquals(fixture.first.attack.style, undefined, "pickup spends the attack");
  assertEquals(fixture.input.commands[0].pending, undefined);
  return fixture;
}

test("centre items spawn 30–60 seconds after GO and warn exactly ten seconds ahead [k3 measure #196]", () => {
  for (let seed = -100; seed <= 100; seed++) {
    const game = createMatchState();
    setHumanCount(game, 2);
    game.matchSeed = seed;
    game.items.on = true;
    assertTrue(prepareQuickMatch(game));
    const first = game.items.nextSpawnFrame;
    assertTrue(first >= 1801 && first <= 3601);
    assertEquals(itemWarningFrames(game.items, first - ITEM_WARNING_FRAMES - 1), undefined);
    assertEquals(itemWarningFrames(game.items, first - ITEM_WARNING_FRAMES), ITEM_WARNING_FRAMES);
    assertEquals(itemWarningFrames(game.items, first - 1), 1);
    assertEquals(itemWarningFrames(game.items, first), undefined);
    game.items.enabledMask = itemBit(ItemKind.heavy);
    scheduleMatchItems(game);
    assertEquals(game.items.nextKind, ItemKind.heavy);
    game.training = true;
    scheduleMatchItems(game);
    assertEquals(game.items.nextSpawnFrame, 0);
    game.training = false;
    game.items.on = false;
    scheduleMatchItems(game);
    assertEquals(game.items.nextSpawnFrame, 0);
  }
});

sweep("every fighter takes every item with a normal attack or grab; expiry includes the pickup frame [k3 measure docs/gameplay-design.md]", () => {
  for (const character of Object.values(Character)) for (const kind of [ItemKind.speed, ItemKind.heavy]) for (const style of [AttackStyle.jab, AttackStyle.grab]) {
    const { game, first, world, input } = pickup(character, kind, style);
    assertEquals(first.status.buffFrames, 599);
    for (let frame = 2; frame < 600; frame++) stepMatch(game, world, input, frame);
    assertEquals(first.status.buff, kind, "active on frame 599");
    assertEquals(first.status.buffFrames, 1);
    stepMatch(game, world, input, 600);
    assertEquals(first.status.buff, ItemKind.none);
    assertEquals(first.status.buffFrames, 0);
    applyItemBuff(first, kind);
    first.motion.x = 10000.0;
    checkBlastZone(world, 0);
    assertTrue(first.status.out);
    assertEquals(first.status.buff, ItemKind.none);
    assertEquals(first.status.buffFrames, 0);
  }
});

test("Speed raises every fighter's walk dash run and ledge/air/ground jump, without scaling its cap twice [k3 measure docs/gameplay-design.md]", () => {
  for (const character of Object.values(Character)) {
    for (const walking of [true, false]) {
      const plain = createFighter(character, 0.0, 1);
      const buffed = createFighter(character, 0.0, 1);
      applyItemBuff(buffed, ItemKind.speed);
      const top = walking ? plain.tuning.physics.walkSpeed : plain.tuning.physics.runSpeed;
      plain.motion.vx = top;
      buffed.motion.vx = f32(top * f32(1.3));
      if (!walking) for (const fighter of [plain, buffed]) {
        fighter.ground.action = GroundAction.run;
        fighter.ground.dashDirection = 1;
        fighter.ground.dashFrame = 30;
      }
      advanceGroundMovement(plain, 1, walking);
      advanceGroundMovement(buffed, 1, walking);
      assertNear(buffed.motion.vx, f32(plain.motion.vx * f32(1.3)), f32(0.0001));
      buffed.tuning.physics = { ...buffed.tuning.physics, groundSpeedCap: 1.0 };
      buffed.motion.vx = 100.0;
      advanceGroundMovement(buffed, 1, walking);
      assertNear(buffed.motion.vx, f32(1.3), f32(0.0001));
    }
    const air = createFighter(character, 0.0, 1);
    applyItemBuff(air, ItemKind.speed);
    assertEquals(airDriftVelocity(air, 1000.0, 1), f32(air.tuning.physics.airCap * f32(1.3)));
    let airSpeed = 0.0;
    for (let frame = 0; frame < 300; frame++) airSpeed = airDriftVelocity(air, airSpeed, 1);
    assertEquals(airSpeed, Math.min(f32(air.tuning.physics.airSpeed * f32(1.3)), f32(air.tuning.physics.airCap * f32(1.3))));
    const dash = createFighter(character, 0.0, 1);
    applyItemBuff(dash, ItemKind.speed);
    advanceGroundMovement(dash, 1, false);
    assertNear(dash.motion.vx, Math.min(f32(dash.tuning.physics.dashSpeed * f32(1.3)), f32(dash.tuning.physics.groundSpeedCap * f32(1.3))), f32(0.0001));
    for (const held of [true, false]) {
      const jumper = createFighter(character, 0.0, 1);
      jumper.tuning.physics = { ...jumper.tuning.physics, gravity: 0.0 };
      applyItemBuff(jumper, ItemKind.speed);
      beginJump(jumper, 0);
      jumper.jump.held = held;
      const world = soloWorld(jumper);
      while (jumper.motion.grounded) advanceFighter(world, 0, 0, controls({ jumpHeld: held }), 0.0);
      assertNear(jumper.motion.vz, f32((held ? jumper.tuning.physics.fullJumpSpeed : jumper.tuning.physics.shortJumpSpeed) * f32(1.1)), f32(0.0001));
      beginJump(jumper, 0);
      assertEquals(jumper.motion.vz, f32(jumper.tuning.physics.aerialJumpSpeed * f32(1.1)));
    }
    const ledge = createFighter(character, 0.0, 1);
    ledge.motion.grounded = false;
    ledge.ledge.state = LedgeState.hang;
    ledge.ledge.side = -1;
    ledge.ledge.frame = 1;
    applyItemBuff(ledge, ItemKind.speed);
    advanceLedge(soloWorld(ledge), 0, 0, controls({ jumpPressed: true }));
    assertEquals(ledge.motion.vx, f32(ledge.tuning.physics.airSpeed * f32(1.3)));
    assertEquals(ledge.motion.vz, f32(ledge.tuning.physics.fullJumpSpeed * f32(1.1)));
  }
});

test("Heavy gives every fighter 1.5 weight and 1.3 gravity terminal and fast-fall speeds [k3 measure docs/gameplay-design.md]", () => {
  for (const character of Object.values(Character)) {
    const plain = createFighter(character, 0.0, 1);
    const heavy = createFighter(character, 0.0, 1);
    applyItemBuff(heavy, ItemKind.heavy);
    assertEquals(knockbackWeight(heavy), f32(heavy.tuning.physics.weight * 1.5));
    applyMeleeGravity(heavy);
    const terms = termsOfPhysics(heavy.tuning.physics);
    assertEquals(retainedOriginal(heavy.motion.meleeVelocityZ, heavy.motion.vz), -f32(terms.gravity * f32(1.3)));
    heavy.motion.vz = -10000.0;
    applyMeleeGravity(heavy);
    assertNear(heavy.motion.vz, -f32(heavy.tuning.physics.terminalSpeed * f32(1.3)), f32(0.0001));
    heavy.motion.grounded = false;
    heavy.motion.z = 300.0;
    heavy.motion.fastFalling = true;
    advanceFighter(soloWorld(heavy), 0, 0, controls(), 0.0);
    assertNear(heavy.motion.vz, -f32(heavy.tuning.physics.fastFallSpeed * f32(1.3)), f32(0.0001));
    for (const target of [plain, heavy]) {
      const attacker = createFighter(Character.rifleman, 50.0, -1);
      const world = testWorld(attacker, target);
      contactBatch(world, () => queueDamageContact(world, 0, 1, hitEffect(10.0, 100.0, 0.0, 1.0, 0.0), 1, ContactKind.launch, false, undefined));
    }
    assertTrue(heavy.launch.knockbackX < plain.launch.knockbackX);
  }
});

sweep("five minutes of seeded spawns pickups and expiry replay from a saved snapshot exactly [k1 scenario]", () => {
  const live = createReplaySnapshot();
  live.match.phase = Phase.match;
  live.match.stageChoice = 0;
  live.match.endless = true;
  live.match.matchSeed = 196;
  live.match.items.on = true;
  const first = fighterAt(live.world, 0);
  const second = fighterAt(live.world, 1);
  first.motion.x = 0.0;
  second.motion.x = 240.0;
  scheduleMatchItems(live.match);
  const seed = createReplaySnapshot();
  const replay = createReplaySnapshot();
  copyReplayState(seed, live);
  const hashes: string[] = [];
  function run(state: typeof live, frame: number): void {
    if (state.match.items.kind !== ItemKind.none) queueAttack(state.controls.commands[0], { style: AttackStyle.jab, facing: 0, frame, mayCharge: false });
    stepMatch(state.match, state.world, state.controls, frame);
  }
  for (let frame = 1; frame <= 18000; frame++) {
    run(live, frame);
    if (floorMod(frame, 600) === 0) hashes.push(stateChecksum(live));
  }
  assertTrue(live.match.items.spawnSerial >= 5);
  assertEquals(live.match.items.pickupSerial, live.match.items.spawnSerial);
  copyReplayState(replay, seed);
  let hashIndex = 0;
  for (let frame = 1; frame <= 18000; frame++) {
    run(replay, frame);
    if (floorMod(frame, 600) === 0) assertEquals(stateChecksum(replay), hashes[hashIndex++] ?? "missing", `frame ${frame}`);
  }
  assertEquals(firstStateDifference(live, replay), undefined);
});
