// Independently authored loader; original executable bytes remain private.
import { mkdirSync, chmodSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = '/home/tom/.local/share/smashcraft-melee-reference/shield-selection-runner';
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
for(const radius of [1,2]) for(const x of [0,2,2.999999761581421,3,3.000000238418579,4]) rows.push({radius,x});
const entry=0x81000000,data=entry+0x30000,stack=entry+0xff000;
const joint=entry+0x2a000,capsule=entry+0x28000,defender=entry+0x20000,attacker=entry+0x24000,result=defender+0x19c0,stride=16;
// Stops before either response consumer; neither collision routine is patched.
for(const stop of [0x80079080,0x800790b4]) {original.writeUInt32BE(0x7f2803a6,stop-base);original.writeUInt32BE(0x4e800020,stop+4-base);}
const wrapper=Buffer.alloc(0x40000),words=[];
wrapper.writeUInt32BE(joint,result-entry);
wrapper.writeUInt8(0x80,result-entry+4);
wrapper.writeUInt32BE(0x02000000,joint-entry+0x14);
for(let i=0;i<3;i++) wrapper.writeFloatBE(1,joint-entry+0x44+i*20);
wrapper.writeFloatBE(1,capsule-entry+0x1c);
wrapper.writeFloatBE(1,attacker-entry+0x38);wrapper.writeFloatBE(1,defender-entry+0x38);wrapper.writeFloatBE(1,defender-entry+0x3c);
const emit=w=>words.push(w>>>0);
const dform=(op,rt,ra,d)=>emit((op<<26)|(rt<<21)|(ra<<16)|(d&65535));
function imm(reg,value){dform(15,reg,0,value>>>16);emit((24<<26)|(reg<<21)|(reg<<16)|(value&65535));}
function call(address){imm(12,address);emit(0x7d8903a6);emit(0x4e800421);}
imm(1,stack);imm(2,r2);imm(13,r13);imm(30,capsule);imm(29,result);
for(const [i,row] of rows.entries()) {
 const offset=i*stride;
 wrapper.writeFloatBE(row.x,data-entry+offset);
 wrapper.writeFloatBE(row.radius,data-entry+offset+4);
 wrapper.writeFloatBE(1,data-entry+offset+8);
 imm(27,data+offset);
 dform(48,0,27,0);dform(52,0,30,0x4c);dform(52,0,30,0x58);
 dform(48,0,27,4);dform(52,0,29,0x20);
 dform(48,1,27,8);dform(48,2,27,8);dform(48,3,27,8);
 imm(23,capsule);imm(24,attacker);imm(28,defender);imm(22,0);
 imm(25,entry+(words.length+6)*4);call(0x80079050);
 dform(36,3,27,12);
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
const results=rows.map((row,i)=>({...row,selectsShieldResponse:output.readUInt32BE(i*stride+12)!==0}));
const facts={id:'retail-ntsc-1.02-shield-selection',executableSha1:sha1,inputs:{capsuleRadius:1,capsuleEndpoints:'both (x,0,0)',shieldCenter:[0,0,0],hitScale:1,shieldScale:1,forceContact:false},referenceRevision:'0296f009f32f710495979d30772d8332af2d411a',execution:{cpu:'private Gekko interpreter',routine:'0x80079050',collisionRoutine:'0x80007BCC',returnPatches:['0x80079080','0x80079084','0x800790B4','0x800790B8'],exitCode},limitations:['Synthetic point capsule, cached shield position and identity joint matrix.','Interpreter host exports a fixed larger buffer; only the authored result rows are consumed.','Starts after shielding eligibility; stops before shield response or body checks. Does not execute body collision, response consumers, animation placement or native execution.'],results};
await Bun.write(root+'/facts.json',JSON.stringify(facts,null,2)+'\n');
console.log(JSON.stringify(facts));
