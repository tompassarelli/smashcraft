// Independently authored loader; original executable bytes remain private.
import { mkdirSync, chmodSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = '/home/tom/.local/share/smashcraft-melee-reference/shield-capsule-runner';
const source = '/home/tom/.local/share/smashcraft-melee-reference/ntsc-1.02/main.dol';
const interpreter = '/home/tom/.local/share/smashcraft-melee-reference/di-vector-runner/interpreter-host';
mkdirSync(root, { recursive: true, mode: 0o700 });
const dol = Buffer.from(await Bun.file(source).arrayBuffer());
const sha1 = createHash('sha1').update(dol).digest('hex');
if (sha1 !== '08e0bf20134dfcb260699671004527b2d6bb1a45') throw Error('Wrong executable');
const u32 = o => dol.readUInt32BE(o);
const sections = Array.from({length:18}, (_, i) => ({offset:u32(i*4), address:u32(0x48+i*4), size:u32(0x90+i*4)})).filter(s => s.size);
const base = 0x80003000, align = n => Math.ceil(n/4096)*4096;
const end = Math.max(...sections.map(s => s.address+s.size), u32(0xd8)+u32(0xdc));
const original = Buffer.alloc(align(end-base));
for (const s of sections) dol.copy(original, s.address-base, s.offset, s.offset+s.size);
const instruction = a => original.readUInt32BE(a-base);
function register(address, reg) {
    const hi = instruction(address), lo = instruction(address+4);
    if ((hi>>>16)!==(0x3c00|(reg<<5)) || (lo>>>16)!==(0x6000|(reg<<5)|reg)) throw Error('Startup register');
    return (((hi&65535)*65536)+(lo&65535))>>>0;
}
const r2 = register(0x80005348, 2), r13 = register(0x80005350, 13);


const rows=[];
for(const shieldRadius of [1,2]) for(const x of [0,2,2.999999761581421,3,3.000000238418579,4]) rows.push({startX:x,startZ:0,endX:x,endZ:0,hitRadius:1,shieldRadius,hitScale:1,shieldScale:1});
for(const z of [0,3,3.000000238418579,4]) for(const reverse of [false,true]) rows.push({startX:reverse?5:-5,startZ:z,endX:reverse?-5:5,endZ:z,hitRadius:1,shieldRadius:2,hitScale:1,shieldScale:1});
for(const hitScale of [0.5,2]) for(const x of [2.5,3,4]) rows.push({startX:x,startZ:0,endX:x,endZ:0,hitRadius:1,shieldRadius:2,hitScale,shieldScale:1});
for(const edge of [4.242640018463135,4.242640495300293,4.242640972137451]) for(const reverse of [false,true]) rows.push({startX:reverse?0:-edge,startZ:reverse?edge:0,endX:reverse?-edge:0,endZ:reverse?0:edge,hitRadius:1,shieldRadius:2,hitScale:1,shieldScale:1});
for(const reverse of [false,true]) rows.push({startX:reverse?6:4,startZ:0,endX:reverse?4:6,endZ:0,hitRadius:1,shieldRadius:2,hitScale:1,shieldScale:1});
if (Bun.argv[2]) {
    rows.length = 0;
    rows.push(...await Bun.file(Bun.argv[2]).json());
}
if(rows.length*40>1392)throw Error('Interpreter export limit');
const entry=0x81000000,data=entry+0x30000,stack=entry+0xff000;
const joint=entry+0x2a000,capsule=entry+0x28000,result=entry+0x28200,stride=40;
const wrapper=Buffer.alloc(0x40000),words=[];
wrapper.writeUInt32BE(joint,result-entry);
wrapper.writeUInt8(0x80,result-entry+4);
wrapper.writeUInt32BE(0x02000000,joint-entry+0x14);
for(let i=0;i<3;i++) wrapper.writeFloatBE(1,joint-entry+0x44+i*20);
wrapper.writeFloatBE(1,capsule-entry+0x1c);
const emit=w=>words.push(w>>>0);
const dform=(op,rt,ra,d)=>emit((op<<26)|(rt<<21)|(ra<<16)|(d&65535));
function imm(reg,value){dform(15,reg,0,value>>>16);emit((24<<26)|(reg<<21)|(reg<<16)|(value&65535));}
function call(address){imm(12,address);emit(0x7d8903a6);emit(0x4e800421);}
imm(1,stack);imm(2,r2);imm(13,r13);imm(30,capsule);imm(29,result);
for(const [i,row] of rows.entries()) {
 const offset=i*stride;
 for(const [j,key] of ['startX','startZ','endX','endZ','hitRadius','shieldRadius','hitScale','shieldScale'].entries()) wrapper.writeFloatBE(row[key],data-entry+offset+j*4);
 wrapper.writeFloatBE(0,data-entry+offset+32);
 imm(28,data+offset);
 for(const [j,field] of [0x4c,0x50,0x58,0x5c,0x1c].entries()){dform(48,0,28,j*4);dform(52,0,30,field);}
 dform(48,0,28,20);dform(52,0,29,0x20);
 dform(48,1,28,24);dform(48,2,28,28);dform(48,3,28,32);
 imm(3,capsule);imm(4,result);imm(5,0);imm(6,0);call(0x80007bcc);
 dform(36,3,28,36);
}
imm(12,0x817ffffc);emit(0x7d8803a6);emit(0x4e800020);
words.forEach((w,i)=>wrapper.writeUInt32BE(w,i*4));
const originalOffset=0x1000,wrapperOffset=originalOffset+original.length;
const elf=Buffer.alloc(wrapperOffset+wrapper.length);
elf.set([0x7f,0x45,0x4c,0x46,1,2,1]);
const w16=(o,v)=>elf.writeUInt16BE(v,o),w32=(o,v)=>elf.writeUInt32BE(v>>>0,o);
w16(16,2);w16(18,20);w32(20,1);w32(24,entry);w32(28,52);w16(40,52);w16(42,32);w16(44,2);
function segment(i,offset,address,filesz,memsz){[1,offset,address,address,filesz,memsz,7,4096].forEach((v,j)=>w32(52+i*32+j*4,v));}
segment(0,originalOffset,base,original.length,original.length);
segment(1,wrapperOffset,entry,wrapper.length,0x100000);
original.copy(elf,originalOffset);wrapper.copy(elf,wrapperOffset);
const elfPath=root+'/private-original.elf';
await Bun.write(elfPath,elf);chmodSync(elfPath,0o700);
const outputPath=root+'/interpreter-results.bin';
const proc=Bun.spawn([interpreter,elfPath,outputPath],{cwd:root,stdout:'pipe',stderr:'pipe'});
const [binary,stderr,exitCode]=await Promise.all([new Response(proc.stdout).arrayBuffer(),new Response(proc.stderr).text(),proc.exited]);
await Bun.write(root+'/execution-stderr.txt',stderr);
if(exitCode!==0)throw Error(`Original execution failed (${exitCode}): ${stderr}`);
const output=Buffer.from(await Bun.file(outputPath).arrayBuffer()).subarray(0,rows.length*stride);
if(output.length!==rows.length*stride)throw Error('Wrong output length');
await Bun.write(root+'/numerical-output.bin',output);
if(rows.length*stride>1392)throw Error('Interpreter export limit');
const results=rows.map((row,i)=>({...row,intersects:output.readUInt32BE(i*stride+36)!==0}));
const facts={id:'retail-ntsc-1.02-shield-capsule',executableSha1:sha1,inputs:{plane:'original x/y; z=0',shieldCenter:[0,0,0],forceContact:false},referenceRevision:'0296f009f32f710495979d30772d8332af2d411a',execution:{cpu:'private Gekko interpreter',routine:'0x80007BCC',returnPatches:[],exitCode},limitations:['Synthetic capsule endpoints, cached shield position and identity joint matrix.','Interpreter host exports a fixed larger buffer; only the authored result rows are consumed.','Does not establish shield-versus-body priority, animation placement or native execution.'],results};
await Bun.write(root+'/facts.json',JSON.stringify(facts,null,2)+'\n');
console.log(JSON.stringify(facts));
