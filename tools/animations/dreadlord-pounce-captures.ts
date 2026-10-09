
import { join, resolve } from "node:path";
import { DrawnModel, capture, sheet } from "../../ts/scripts/wisp/hurtboxView";
import { advanceFighterPose, createFighterPose } from "../../ts/src/game/presentation/fighterPose";
import { characterModelScale } from "../../ts/src/game/presentation/modelScale";
import { Character, SpecialAction } from "../../ts/src/game/sim/codes";
import { createFighter } from "../../ts/src/game/sim/fighter";
import { createRoster, neutralControls } from "../../ts/src/game/sim/roster";
import { ensure, fighters } from "./original-clips";
const [assets,output]=process.argv.slice(2).map(p=>resolve(p)); ensure(assets&&output,"usage: bun tools/animations/dreadlord-pounce-captures.ts PRIVATE_ASSETS PRIVATE_OUTPUT");
const source=fighters.get(Character.dreadlord)!; ensure(source,"Dreadlord source missing");
const drawn=new DrawnModel(await Bun.file(join(assets,source.source)).arrayBuffer(),characterModelScale(Character.dreadlord));
for(const phase of ["travel","bite","recovery"] as const) {
 const frames=[];
 for(const facing of [1,-1]) for(const frame of phase==="travel"?[1,5,9,13,17]:phase==="bite"?[17,21,25,29,32]:[18,26,35,43,52]) {
  const f=createFighter(Character.dreadlord,0.0,facing), world=createRoster(3,[f]),pose=createFighterPose();
  f.special.action=SpecialAction.heroSide; f.special.duration=53;f.special.frame=frame;
  if(phase==="bite")f.special.grabFrame=17;
  advanceFighterPose(pose,f,world,neutralControls(),false,false,false,false);
  frames.push({...capture(f,pose),frame,parts:[],strikes:[]});
 }
 await Bun.write(join(output,`Dreadlord-production-${phase}.png`),sheet(`Dreadlord ${phase}`,drawn,frames,5).png);
 console.log(`POUNCE_CAPTURE_PASS ${phase}: 10 production poses, both facings`);
}
