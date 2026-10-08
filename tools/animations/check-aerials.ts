// Foreign asset check: compare the packaged clips and preserve pre-existing motion.
import {parseMDX, parseMDL, generateMDL} from 'war3-model';
import {join} from 'node:path';
import {checkGroundClips} from './ground-check';
const assets=join(import.meta.dir,'../../build/animation-assets');
const clips=[['Neutral',41],['Forward',31],['Back',37],['Up',34],['Down',38]] as const;
const groundedRecovery = new Set(['Knockdown','Down Damage','Get Up','Get Up Attack']);
const changedSourceClips = (fighter:string) => new Set([
 ...groundedRecovery,
 'Spot Dodge',
]);
const preservationFailures:string[]=[];
function ensure(ok: unknown, message: string): asserts ok {if(!ok) throw new Error(message);}
function sampleKey(track:any, sequence:any, frame:number) {
 const target=sequence.Interval[0]+Math.round(frame*1000/24);
 const key=track?.Keys?.reduce((best:any,current:any)=>!best||Math.abs(current.Frame-target)<Math.abs(best.Frame-target)?current:best,null);
 ensure(key && Math.abs(key.Frame-target)<=2,`${sequence.Name} has no key for source frame ${frame}`);
 return key;
}
function sameQuaternion(a:number[],b:number[],epsilon=0.001) {
 const len=(q:number[])=>Math.sqrt(q.reduce((sum,v)=>sum+v*v,0));
 const dot=a.reduce((sum,v,i)=>sum+v*b[i],0)/(len(a)*len(b));
 return Math.abs(dot)>=1-epsilon;
}
for(const fighter of ['Rifleman']) {
 const model=parseMDX(await Bun.file(join(assets,`${fighter}Fighter.mdx`)).arrayBuffer());
 checkGroundClips(model, fighter);
 // Compare unchanged source scenes through the same repaired exporter. The old
 // MDX used globally selected interpolation and is retained as defect evidence.
 const prior=parseMDL(await Bun.file(join(assets,`${fighter.toLowerCase()}-before-aerial-repaired.mdl`)).text());
 const root=[...model.Bones,...model.Helpers].find(b=>b.Name==='Bone_Root')!;
 for(const name of groundedRecovery) {
  const sequence=model.Sequences.find(s=>s.Name===name);
  ensure(sequence && sequence.NonLooping,`${fighter} ${name} recovery clip missing/looping`);
  const translations=root.Translation?.Keys?.filter((k:any)=>k.Frame>=sequence.Interval[0]&&k.Frame<=sequence.Interval[1])??[];
  ensure(translations.length===0,`${fighter} ${name} moves the gameplay root`);
 }
 const spot=model.Sequences.find(s=>s.Name==='Spot Dodge');
 ensure(spot && spot.NonLooping,`${fighter} Spot Dodge missing/looping`);
 ensure(Math.abs(spot.Interval[1]-spot.Interval[0]-22*1000/24)<2,`${fighter} Spot Dodge is not 22 frames`);
 ensure((root.Translation?.Keys?.filter((k:any)=>k.Frame>=spot.Interval[0]&&k.Frame<=spot.Interval[1])??[]).length===0,
        `${fighter} Spot Dodge moves the gameplay root`);
 const dodgeChest=[...model.Bones,...model.Helpers].find(b=>b.Name==='Bone_Chest')!;
 ensure(sameQuaternion(sampleKey(dodgeChest.Rotation,spot,5).Vector,sampleKey(dodgeChest.Rotation,spot,15).Vector),
        `${fighter} Spot Dodge does not hold its protected pose through frame 15`);

 for(const [kind,frames] of clips) {
  const name=`Aerial ${kind}`, s=model.Sequences.find(s=>s.Name===name)!;
  ensure(s && s.NonLooping,`${fighter} ${name} missing/looping`);
  ensure(Math.abs(s.Interval[1]-s.Interval[0]-frames*1000/24)<2,`${name} duration`);
  const keys=(track:any)=>track?.Keys?.filter((k:any)=>k.Frame>=s.Interval[0]&&k.Frame<=s.Interval[1])??[];
  ensure(keys(root.Translation).length===0,`${name} root translation`);
  for(const bone of [...model.Bones,...model.Helpers]) ensure(keys(bone.Rotation).length>0,`${name} missing bone ${bone.Name}`);

 // Compare track values relative to their owning sequence, since new clips
 // change the exporter's global sequence offsets.
 function tracks(m:any,s:any) {
  const result:any={};
  for(const collection of ['Bones','Helpers','GeosetAnims']) for(const node of m[collection]??[]) {
   const fields:any={};
   for(const [field,value] of Object.entries(node)) if(value && typeof value==='object' && 'Keys' in value) {
    const track=value as any;
    fields[field]={InterpolationType:track.InterpolationType,GlobalSeqId:track.GlobalSeqId,Keys:track.Keys.filter((k:any)=>k.Frame>=s.Interval[0]&&k.Frame<=s.Interval[1]).map((k:any)=>({...k,Frame:k.Frame-s.Interval[0]}))};
   }
   result[collection+':'+(node.Name??node.GeosetId)]=fields;
  }
  return result;
 }
 for(const s of prior.Sequences) {
  const next=model.Sequences.find(n=>n.Name===s.Name)!;
  ensure(next && next.NonLooping===s.NonLooping,`${fighter} lost ${s.Name}`);
  // Grounded recovery and spot-dodge duration are deliberate source changes.
  if(changedSourceClips(fighter).has(s.Name)) continue;
  if(Math.abs(next.Interval[1]-next.Interval[0]-s.Interval[1]+s.Interval[0])>1) preservationFailures.push(`${fighter} ${s.Name}: exported duration differs by more than 1ms`);
  const before=tracks(prior,s), after=tracks(model,next);
  ensure(JSON.stringify(Object.keys(before).sort())===JSON.stringify(Object.keys(after).sort()),`${fighter} ${s.Name}: nodes changed`);
  for(const [node,fields] of Object.entries(before) as any) {
   ensure(JSON.stringify(Object.keys(fields).sort())===JSON.stringify(Object.keys(after[node]).sort()),`${node}: track fields changed`);
   for(const [field,track] of Object.entries(fields) as any) {
    const actual=after[node][field];
    ensure(track.InterpolationType===actual.InterpolationType && track.GlobalSeqId===actual.GlobalSeqId,`${node} ${field}: interpolation changed`);
    ensure(track.Keys.length===actual.Keys.length,`${fighter} ${s.Name} ${node} ${field}: key count changed`);
    for(let i=0;i<track.Keys.length;i++) {
     const {Frame:oldTime,...oldValue}=track.Keys[i];
     const {Frame:newTime,...newValue}=actual.Keys[i];
     ensure(Math.abs(oldTime-newTime)<=1,`${fighter} ${s.Name} ${node} ${field}: time differs by more than 1ms`);
     ensure(i===0 || newTime>actual.Keys[i-1].Frame,`${node} ${field}: unordered/duplicate timestamps`);
     ensure(JSON.stringify(oldValue)===JSON.stringify(newValue),`${fighter} ${s.Name} ${node} ${field}: key value changed`);
    }
   }
  }
 }
 await Bun.write(join(assets,`${fighter.toLowerCase()}-aerial-roundtrip.mdl`),generateMDL(model));
 console.log('AERIAL_PACKAGE_PASS',fighter, 'five nonlooping clips; complete rotations; no root travel; previous sequence names and loop flags retained');
}
ensure(preservationFailures.length===0,preservationFailures.join('\n'));
