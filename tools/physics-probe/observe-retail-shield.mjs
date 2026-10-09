
import { mkdirSync, chmodSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = '/home/tom/.local/share/smashcraft-melee-reference/analog-shield-runner';
const source = '/home/tom/.local/share/smashcraft-melee-reference/ntsc-1.02/main.dol';
const qemu = '/nix/store/7fbvcx0hwmaxv2jafvc1g6d6zg5fgm8i-qemu-10.2.4/bin/qemu-ppc';
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


const common=0x81029000, state=0x81020000, hit=0x81028800;
original.writeUInt32BE(common,(r13-20812)-base);
const datSource='/home/tom/.local/share/smashcraft-melee-reference/ntsc-1.02/PlCo.dat';
const dat=Buffer.from(await Bun.file(datSource).arrayBuffer());
const datSha1=createHash('sha1').update(dat).digest('hex');
if(datSha1!=='c904de0c4c5eb3ef65211a75d8bd70ca5b0f9f41') throw Error('Wrong common data');
const roots=32+dat.readUInt32BE(4)+4*dat.readUInt32BE(8);
const commonFileOffset=32+dat.readUInt32BE(32+dat.readUInt32BE(roots));

const returnPatches=[0x80091dbc,0x8006d2d8,0x800930d0];
for(const address of returnPatches) original.writeUInt32BE(0x4e800020,address-base);
const rows=[];
for(const pressure of [0,76,77,128,200,255]) for(const health of [60,30,1]) for(const damage of [3,10,30]) rows.push({pressure,health,damage,previousStrength:0.4});
const entry=0x81000000,data=entry+0x30000,stack=entry+0xff000;
const wrapper=Buffer.alloc(0x40000),words=[],stride=48,gobj=entry+0x28000;
dat.copy(wrapper,common-entry,commonFileOffset,commonFileOffset+0x818);
wrapper.writeUInt32BE(state,gobj-entry+0x2c);
wrapper.writeUInt8(128,state-entry+0x221b);
wrapper.writeFloatBE(1,state-entry+0x1a0);
wrapper.writeFloatBE(-1,state-entry+0x19ac);
const emit=w=>words.push(w>>>0);
const dform=(op,rt,ra,d)=>emit((op<<26)|(rt<<21)|(ra<<16)|(d&65535));
function imm(reg,value){dform(15,reg,0,value>>>16);emit((24<<26)|(reg<<21)|(reg<<16)|(value&65535));}
function call(address){imm(12,address);emit(0x7d8903a6);emit(0x4e800421);}
imm(1,stack);imm(2,r2);imm(13,r13);imm(31,state);imm(30,state);
for(const [i,row] of rows.entries()) {
 const offset=i*stride;
 for(const [j,value] of [row.pressure/255,row.health,row.previousStrength].entries()) wrapper.writeFloatBE(value,0x30000+offset+j*4);
 imm(28,data+offset);
 dform(48,0,28,0);dform(52,0,31,0x650);
 dform(48,0,28,4);dform(52,0,31,0x1998);
 dform(48,0,28,8);dform(52,0,31,0x199c);
 imm(3,gobj);call(0x800925a4);
 dform(48,0,31,0x199c);dform(52,0,28,12);
 dform(48,0,31,0x1998);dform(52,0,28,16);
 dform(48,1,31,0x199c);imm(3,row.damage);call(0x80092ed8);dform(52,1,28,20);
 dform(48,0,28,4);dform(52,0,31,0x1998);
 imm(3,state);call(0x80091d7c);dform(52,0,28,24);
 imm(0,row.damage);dform(36,0,30,0x19a0);call(0x8006d27c);
 dform(48,0,30,0x1998);dform(52,0,28,28);
 dform(48,31,28,20);imm(30,0);call(0x80093080);imm(30,state);
 dform(48,0,31,0xec);dform(52,0,28,32);
}
dform(14,0,0,4);dform(14,3,0,1);imm(4,data);dform(14,5,0,rows.length*stride);emit(0x44000002);
dform(14,0,0,1);dform(14,3,0,0);emit(0x44000002);
words.forEach((w,i)=>wrapper.writeUInt32BE(w,i*4));
if(words.length*4>=0x20000)throw Error('Wrapper overlaps state');
const originalOffset=0x1000, wrapperOffset=originalOffset+original.length;
const elf=Buffer.alloc(wrapperOffset+wrapper.length);
elf.set([0x7f,0x45,0x4c,0x46,1,2,1]);
const w16=(o,v)=>elf.writeUInt16BE(v,o), w32=(o,v)=>elf.writeUInt32BE(v>>>0,o);
w16(16,2);w16(18,20);w32(20,1);w32(24,entry);w32(28,52);w16(40,52);w16(42,32);w16(44,2);
function segment(i,offset,address,filesz,memsz) {
    [1,offset,address,address,filesz,memsz,7,4096].forEach((v,j)=>w32(52+i*32+j*4,v));
}
segment(0,originalOffset,base,original.length,original.length);
segment(1,wrapperOffset,entry,wrapper.length,0x100000);
original.copy(elf,originalOffset);wrapper.copy(elf,wrapperOffset);
const elfPath=root+'/private-original.elf';
await Bun.write(elfPath,elf);chmodSync(elfPath,0o700);
const proc=Bun.spawn([qemu,'-cpu','750',elfPath],{cwd:root,stdout:'pipe',stderr:'pipe'});
const [binary,stderr,exitCode]=await Promise.all([new Response(proc.stdout).arrayBuffer(),new Response(proc.stderr).text(),proc.exited]);
await Bun.write(root+'/execution-stderr.txt',stderr);
if(exitCode!==0) throw Error(`Original execution failed (${exitCode}): ${stderr}`);
const output=Buffer.from(binary);
if(output.length!==rows.length*stride) throw Error('Wrong output length');
await Bun.write(root+'/numerical-output.bin',output);
const field=o=>({bits:'0x'+output.readUInt32BE(o).toString(16).padStart(8,'0'),value:output.readFloatBE(o)});


const results=rows.map((row,i)=>({...row,pressureNormalized:field(i*stride),strength:field(i*stride+12),healthAfterDrain:field(i*stride+16),stunDuration:field(i*stride+20),sizeWithUnitBase:field(i*stride+24),healthAfterDamage:field(i*stride+28),pushback:field(i*stride+32)}));
const facts={id:'retail-ntsc-1.02-analog-shield',executableSha1:sha1,commonDataSha1:datSha1,referenceRevision:'0296f009f32f710495979d30772d8332af2d411a',execution:{cpu:'QEMU PPC750',guardUpdate:'0x800925A4',stun:'0x80092ED8',sizeEntry:'0x80091D7C',damageEntry:'0x8006D27C',pushbackEntry:'0x80093080',returnPatches:returnPatches.map(x=>'0x'+x.toString(16)),exitCode,byteCount:output.length},commonValues:Object.fromEntries([0x10,0x260,0x264,0x268,0x278,0x284,0x288,0x28c,0x290,0x294,0x298,0x2bc,0x2d4,0x2d8,0x2dc,0x2e0,0x2e4,0x2e8,0x2ec,0x2f0].map(o=>['0x'+o.toString(16),dat.readFloatBE(commonFileOffset+o)])),limitations:['Synthetic fighter fields; complete nonbreaking guard update and stun function, scalar-only size/contact fragments with explicit return patches before unrelated consumers. No powershield branch.','Pressure below the common threshold retains previous strength in the guard update; activation/release selection is outside this routine.','Unit shield base isolates shared size scaling; no retail fighter body or shield dimensions are adopted.','QEMU PPC750 with Linux default floating-point state, not GameCube or Warcraft native execution.','No original executable bytes or decompiled implementation are published. Staling/freshness intentionally omitted by Smashcraft design.'],results};
await Bun.write(root+'/facts.json',JSON.stringify(facts,null,2)+'\n');
console.log(JSON.stringify({facts:root+'/facts.json',cases:results.length,exitCode}));
