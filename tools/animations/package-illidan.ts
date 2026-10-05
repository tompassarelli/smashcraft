// Foreign model boundary: encode Illidan and verify authored sequence bindings.
import {parseMDL,generateMDX,parseMDX} from 'war3-model';
import {join} from 'node:path';
import {typescriptAssetInfo} from './asset-info';
const out=join(import.meta.dir,'../../build/illidan-animation');
const model=parseMDL(await Bun.file(join(out,'demonhunter-fighter.mdl')).text());
interface Clip { name: string; seconds: number }
interface Binding extends Clip { index: number }
const clips=await Bun.file(join(out,'clips.json')).json() as Clip[];
const ensure=(ok:unknown,message:string)=>{if(!ok)throw new Error(message)};
const bindings: Binding[] = clips.map((clip)=>{
 const index=model.Sequences.findIndex(s=>s.Name===clip.name);ensure(index>=0,`Missing ${clip.name}`);
 const s=model.Sequences[index];const seconds=(s.Interval[1]-s.Interval[0])/1000;
 ensure(Math.abs(seconds-clip.seconds)<.003,`Wrong duration ${clip.name}: ${seconds}/${clip.seconds}`);
 return {...clip,index,seconds};
});
ensure(model.Geosets.length===18,'Expected 17 preserved geosets plus source-derived wings');
const bytes=generateMDX(model);const decoded=parseMDX(bytes);
ensure(decoded.Sequences.length===model.Sequences.length,'MDX lost sequences');
ensure(decoded.Textures.length===model.Textures.length,'MDX lost textures');
const source=await Bun.file(join(out,'source-textures.json')).json();
for(const texture of source){
 ensure(model.Textures.some(t=>t.Image===texture.Image&&(t.ReplaceableId ?? 0)===texture.ReplaceableId),`Missing source texture ${texture.Image}/${texture.ReplaceableId}`);
}
console.log('SOURCE_TEXTURES_PRESERVED',source.length);
ensure(decoded.ParticleEmitters2.length===2,'Expected both source particle emitters');
for(const emitter of decoded.ParticleEmitters2){
 ensure(emitter.TextureID!==undefined && decoded.Textures[emitter.TextureID]?.Image,
  `Missing particle texture: ${emitter.Name}`);
 const visibility=emitter.Visibility;
 ensure(visibility!==undefined && typeof visibility!=='number',`Missing visibility track: ${emitter.Name}`);
 if(visibility===undefined || typeof visibility==='number')throw new Error('Missing particle visibility track');
 for(const binding of bindings){
  const [start,end]=decoded.Sequences[binding.index].Interval;
  const keys=visibility.Keys.filter(key=>key.Frame>=start && key.Frame<=end);
  ensure(keys.some(key=>key.Frame===start)&&keys.some(key=>key.Frame===end),
   `Missing particle visibility boundaries: ${emitter.Name}/${binding.name}`);
  ensure(keys.every(key=>key.Vector[0]===0),`Stock effect in combat: ${emitter.Name}/${binding.name}`);
 }
}
await Bun.write(join(out,'DemonHunterFighter.mdx'),bytes);
await Bun.write(join(out,'bindings.json'),JSON.stringify(bindings,null,2));
const hash=new Bun.CryptoHasher('sha256').update(new Uint8Array(bytes)).digest('hex');
const modelPath=`war3mapImported\\DemonHunterFighter-${hash}.mdx`;
const clipKeys=bindings.map((binding)=>({key:binding.name.toUpperCase().replace(/[^A-Z0-9]+/g,'_'),index:binding.index,seconds:binding.seconds}));
await Bun.write(join(import.meta.dir,'../../ts/src/game/presentation/demonHunterAssetInfo.ts'),
 typescriptAssetInfo('tools/animations/package-illidan.ts',[{prefix:'DEMON_HUNTER',modelPath,clips:clipKeys}]));
console.log('ILLIDAN_PACKAGE_PASS',bindings.length,'authored clips',model.Sequences.length,'total sequences',bytes.byteLength,'bytes');
console.log('TEXTURES',JSON.stringify(model.Textures));
