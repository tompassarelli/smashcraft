import {testMatch,executeNext} from '../../src/game/match/testMatch';
import {Character,SpecialAction} from '../../src/game/sim/codes';
import {fighterAt,copyControls} from '../../src/game/sim/roster';
import {controls} from '../../src/game/sim/testWorld';
for (const response of ['idle','shield','jump'] as const) {
 const m=testMatch(3,Character.archer),a=fighterAt(m.world,0),b=fighterAt(m.world,1);
 a.motion.x=-240;b.motion.x=0;b.facing=-1;
 const starts:number[]=[],shots:{frame:number,life:number,speed:number}[]=[],hits:object[]=[];
 let serial=-1,damage=0;
 for(let frame=1;frame<=180;frame++){
  copyControls(m.inputs.inputs[0],controls({specialPressed:frame%2===0}));
  copyControls(m.inputs.inputs[1],controls(response==='shield'?{shield:true,shieldTriggerActive:true,shieldStrength:1.0}:response==='jump'?{jumpPressed:frame===4,jumpHeld:frame<24}:{}));
  executeNext(m);
  if(a.special.action===SpecialAction.archerArrow&&a.special.frame===1)starts.push(frame);
  for(const p of a.projectiles)if(p.life>0&&p.serial!==serial){serial=p.serial;shots.push({frame,life:p.life,speed:p.velocityX});}
  if(b.status.damage!==damage){damage=b.status.damage;hits.push({frame,damage,hitlag:b.launch.hitlag,hitstun:b.launch.hitstun});}
 }
 console.log(JSON.stringify({response,starts,shots:shots.slice(0,3),hits,shield:b.shield.energy,stun:b.shield.stun}));
}
