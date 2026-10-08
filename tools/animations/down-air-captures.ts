import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { DrawnModel, sampleAttack, sheet } from "../../ts/scripts/wisp/hurtboxView";
import { clipFor } from "../../ts/src/game/presentation/fighterClips";
import { characterModelScale } from "../../ts/src/game/presentation/modelScale";
import { AttackStyle } from "../../ts/src/game/sim/codes";
import { createFighter } from "../../ts/src/game/sim/fighter";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../../ts/src/game/sim/hitRegions";
import { attackStartupFrames, characterAttackActiveFrames, attackDurationFramesForGrounding } from "../../ts/src/game/sim/moves";
import { SELECTABLE_CHARACTERS, fighterName } from "../../ts/src/game/sim/heroes/registry";
import { hurtCapsule } from "../../ts/src/game/physics/contactGeometry";
import { ensure, fighters, parseSource } from "./original-clips";
const [input, output] = process.argv.slice(2).map(p => resolve(p));
ensure(input && output, "usage: bun tools/animations/down-air-captures.ts PRIVATE_ASSETS PRIVATE_OUTPUT");
ensure(!output.startsWith(resolve(import.meta.dir, "../..") + "/"), "captures stay private");
mkdirSync(output, { recursive: true });
const records = [];
for (const character of SELECTABLE_CHARACTERS) {
  const fighter = createFighter(character, 0, 1), moves = fighter.tuning.moves;
  const first = attackStartupFrames(AttackStyle.downAir, moves);
  const last = first + characterAttackActiveFrames(character, AttackStyle.downAir, moves) - 1;
  const total = attackDurationFramesForGrounding(AttackStyle.downAir, false, moves);
  const clip = clipFor(character, "downAir");
  const descriptor = fighters.get(character)!; ensure(descriptor, "missing fighter");
  const bytes = await Bun.file(join(input, descriptor.source)).arrayBuffer();
  const source = parseSource(bytes), sequence = source.Sequences[clip.index]; ensure(sequence, "missing down air");
  const body = hurtCapsule(character), waist = (body.z1 + body.z2) / 2;
  const centers: number[] = [], xs: number[] = [];
  for (let frame=first;frame<=last;frame++) for (let index=0;index<authoredHitRegionCount(AttackStyle.downAir,moves);index++) {
    const region=authoredHitRegion(emptyHitRegion(),character,AttackStyle.downAir,frame,0,index,moves);
    if (region.window>0) { centers.push((region.minZ+region.maxZ)/2); xs.push((region.minX+region.maxX)/2); }
  }
  const moments = [Math.floor(first/2), first, Math.floor((first+last)/2), last, Math.min(total-1,last+4)];
  const frames = [1,-1].flatMap(facing => {
    const sampled = sampleAttack(character, AttackStyle.downAir, facing, true);
    return moments.map(frame => {
      const pose = sampled.find(p => p.frame === frame); ensure(pose, `${descriptor.name}: missing attack frame ${frame}`);
      return {...pose, x:0, z:0, parts:[], strikes:[]};
    });
  });
  await Bun.write(join(output, `${descriptor.name}-down-air.png`),sheet(fighterName(character),new DrawnModel(bytes,characterModelScale(character)),frames,5).png);
  const row={character,name:fighterName(character),clip:sequence.Name,index:clip.index,first,last,total,waist,centerMin:Math.min(...centers),centerMax:Math.max(...centers),xMin:Math.min(...xs),xMax:Math.max(...xs),below:centers.every(z=>z<waist)};
  records.push(row); console.log(JSON.stringify(row));
}
await Bun.write(join(output,"down-airs.json"),JSON.stringify(records,null,2)+"\n");
