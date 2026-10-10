import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { resolveAttacks } from "../attacks";
import { Character } from "../codes";
import { beginDamageContacts, finishDamageContacts } from "../contacts";
import { createFighter } from "../fighter";
import { controls, testWorld } from "../testWorld";
import { advanceSpecials, startFighterSpecial } from "../specials";
import { updateProjectiles } from "../projectiles";
import { advanceFighter } from "../step";
import { fighterAt, type Controls, type Roster } from "../roster";
import { MEDIVH_SPECIALS } from "./medivhSpecials";
import { strikeMeets } from "../../match/botHeroKit";

function pair(x: number, facing = 1) {
  const owner = createFighter(Character.medivh, 0.0, facing);
  const target = createFighter(Character.rifleman, f32(x * facing), -facing);
  for (const fighter of [owner, target]) { fighter.motion.grounded = true; fighter.motion.surface = 0; }
  owner.mana.points = 40; target.mana.points = 60;
  return { owner, target, world: testWorld(owner, target) };
}

function frame(world: Roster, input: Readonly<Controls> = controls(), targetInput: Readonly<Controls> = controls()): void {
  const rows = [input, targetInput];
  for (let slot = 0; slot < 2; slot++) advanceFighter(world, slot, 0, rows[slot] ?? controls(), slot === 0 ? -240.0 : 240.0);
  beginDamageContacts();
  for (let slot = 0; slot < 2; slot++) startFighterSpecial(fighterAt(world, slot), 0, 0, rows[slot] ?? controls());
  resolveAttacks(world); advanceSpecials(world, 0, 0, rows); updateProjectiles(world); finishDamageContacts(world);
}

test("Medivh computer's blink strike prediction agrees with where the real blink lands its hit [k1 scenario]", () => {
 for(const [x,specialX,specialZ,form] of [[80.0,1,0,MEDIVH_SPECIALS.side.ground],[240.0,1,0,MEDIVH_SPECIALS.side.ground],[40.0,0,-1,MEDIVH_SPECIALS.down.ground],[-120.0,0,-1,MEDIVH_SPECIALS.down.ground]] as const){
  const {target,world}=pair(x);
  const predicted=strikeMeets(form,target,x,0.0);
  frame(world,controls({specialPressed:true,specialX,specialZ}));
  for(let tick=2;tick<=30;tick++)frame(world);
  assertEquals(predicted,target.status.damage>0.0,`blink at ${x}`);
 }
});
