// Foreign asset check: compare the packaged clips and preserve pre-existing motion.
import {parseMDX, parseMDL, generateMDL} from 'war3-model';
import {join} from 'node:path';
const assets=join(import.meta.dir,'../../build/animation-assets');
const clips=[['Neutral',25],['Forward',31],['Back',33],['Up',34],['Down',38]] as const;
const preservationFailures:string[]=[];
function ensure(ok: unknown, message: string): asserts ok {if(!ok) throw new Error(message);}
for(const fighter of ['Archer','Rifleman']) {
 const model=parseMDX(await Bun.file(join(assets,`${fighter}Fighter.mdx`)).arrayBuffer());
 // Compare unchanged source scenes through the same repaired exporter. The old
 // MDX used globally selected interpolation and is retained as defect evidence.
 const prior=parseMDL(await Bun.file(join(assets,`${fighter.toLowerCase()}-before-aerial-repaired.mdl`)).text());
 const root=[...model.Bones,...model.Helpers].find(b=>b.Name==='Bone_Root')!;
 for(const [kind,frames] of clips) {
  const name=`Aerial ${kind}`, s=model.Sequences.find(s=>s.Name===name)!;
  ensure(s && s.NonLooping,`${fighter} ${name} missing/looping`);
  ensure(Math.abs(s.Interval[1]-s.Interval[0]-frames*1000/24)<2,`${name} duration`);
  const keys=(track:any)=>track?.Keys?.filter((k:any)=>k.Frame>=s.Interval[0]&&k.Frame<=s.Interval[1])??[];
  ensure(keys(root.Translation).length===0,`${name} root translation`);
  for(const bone of [...model.Bones,...model.Helpers]) ensure(keys(bone.Rotation).length>0,`${name} missing bone ${bone.Name}`);
  if(fighter==='Archer') {
   ensure(model.Geosets.length===3,'Archer projectile geometry restored');
   const bow=model.Bones.find(b=>b.Name==='Cylinder02')!;
   ensure(keys(bow.Rotation).every((k:any)=>Math.abs(k.Vector[3])<.9),'Bow grip lost');
  }
  for(const ga of model.GeosetAnims) {
   const old=prior.GeosetAnims.find(a=>a.GeosetId===ga.GeosetId);
   if(old && typeof ga.Alpha!=='number') {
    const values=keys(ga.Alpha);
    ensure(values.length>0,`${name} missing visibility ${ga.GeosetId}`);
    const names=model.Geosets[ga.GeosetId].Groups.flat().map(id=>model.Bones.find(b=>b.ObjectId===id)?.Name);
    const hidden=names.every(n=>n==='shell'||n==='gutz00');
    ensure(values.every((k:any)=>k.Vector[0]===(hidden?0:1)),`${fighter} ${name} geoset visibility ${ga.GeosetId}`);
   }
  }
 }
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
