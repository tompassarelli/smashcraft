// Foreign model boundary: encode Illidan and verify authored sequence bindings.
import {parseMDL,generateMDX,parseMDX} from 'war3-model';
import {join} from 'node:path';
const out=join(import.meta.dir,'../../build/illidan-animation');
const model=parseMDL(await Bun.file(join(out,'demonhunter-fighter.mdl')).text());
const clips=await Bun.file(join(out,'clips.json')).json();
const ensure=(ok:unknown,message:string)=>{if(!ok)throw new Error(message)};
const bindings=clips.map((clip:any)=>{
 const index=model.Sequences.findIndex(s=>s.Name===clip.name);ensure(index>=0,`Missing ${clip.name}`);
 const s=model.Sequences[index];const seconds=(s.Interval[1]-s.Interval[0])/1000;
 ensure(Math.abs(seconds-clip.seconds)<.003,`Wrong duration ${clip.name}: ${seconds}/${clip.seconds}`);
 return {...clip,index,seconds};
});
ensure(model.Geosets.length===18,'Expected 17 preserved geosets plus source-derived wings');
await Bun.write(join(out,'bindings.json'),JSON.stringify(bindings,null,2));
const bytes=generateMDX(model);const decoded=parseMDX(bytes);
ensure(decoded.Sequences.length===model.Sequences.length,'MDX lost sequences');
ensure(decoded.Textures.length===model.Textures.length,'MDX lost textures');
await Bun.write(join(out,'DemonHunterFighter.mdx'),bytes);
await Bun.write(join(out,'bindings.json'),JSON.stringify(bindings,null,2));
console.log('ILLIDAN_PACKAGE_PASS',bindings.length,'authored clips',model.Sequences.length,'total sequences',bytes.byteLength,'bytes');
console.log('TEXTURES',JSON.stringify(model.Textures));
const source=await Bun.file(join(out,'source-textures.json')).json();
for(const texture of source){
 ensure(model.Textures.some(t=>t.Image===texture.Image&&(t.ReplaceableId ?? 0)===texture.ReplaceableId),`Missing source texture ${texture.Image}/${texture.ReplaceableId}`);
}
console.log('SOURCE_TEXTURES_PRESERVED',source.length);
