import { f32 } from "wisp/src/sim/f32";
import { assertTrue, test } from "wisp/src/runtime/testing";
import { hurtCapsule } from "../physics/contactGeometry";
import { AttackStyle } from "./codes";
import { createFighter } from "./fighter";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "./hitRegions";
import { attackStartupFrames, characterAttackActiveFrames } from "./moves";
import { SELECTABLE_CHARACTERS, fighterName } from "./heroes/registry";
for (const character of SELECTABLE_CHARACTERS) {
  test(`${fighterName(character)} down air centres every active strike below the waist [spec docs/down-airs.md]`, () => {
    const fighter=createFighter(character,0.0,1),moves=fighter.tuning.moves;
    const body=hurtCapsule(character),waist=f32(f32(body.z1+body.z2)*0.5);
    const first=attackStartupFrames(AttackStyle.downAir,moves);
    const last=first+characterAttackActiveFrames(character,AttackStyle.downAir,moves)-1;
    let checked=0;
    for(let frame=first;frame<=last;frame++)for(let index=0;index<authoredHitRegionCount(AttackStyle.downAir,moves);index++) {
      const hit=authoredHitRegion(emptyHitRegion(),character,AttackStyle.downAir,frame,0,index,moves);
      if(hit.window<=0)continue;
      assertTrue(f32(f32(hit.minZ+hit.maxZ)*0.5)<waist);
      checked++;
    }
    assertTrue(checked>0);
  });
}
