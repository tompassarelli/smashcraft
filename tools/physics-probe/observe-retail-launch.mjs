// Independently authored loader; original executable bytes remain private.
import { mkdirSync, chmodSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = '/home/tom/.local/share/smashcraft-melee-reference/launch-magnitude-runner';
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
const rows=[];
for(const weight of [75,80,100,110,97.3]) {
 for(const [pre,damage,growth,basePower] of [[0,4,100,20],[39.9,16.8,88,18],[97.99,13,105,30],[199.5,0.9,73,7],[0,0,0,20],[999,40,200,90]]) {
  rows.push({kind:'ordinary',pre,damage,weight,growth,base:basePower,fixed:0,scale:1});
 }
 for(const fixed of [1,20,97,1000]) rows.push({kind:'fixed',pre:50.5,damage:11.2,weight,growth:fixed===1000?1000:100,base:fixed===1000?500:20,fixed,scale:1});
}
const entry=0x81000000,data=entry+0x30000,stack=entry+0xff000;
const wrapper=Buffer.alloc(0x40000),words=[],stride=48;
dat.copy(wrapper,common-entry,commonFileOffset,commonFileOffset+0x818);
const emit=w=>words.push(w>>>0);
const dform=(op,rt,ra,d)=>emit((op<<26)|(rt<<21)|(ra<<16)|(d&65535));
function imm(reg,value){dform(15,reg,0,value>>>16);emit((24<<26)|(reg<<21)|(reg<<16)|(value&65535));}
function call(address){imm(12,address);emit(0x7d8903a6);emit(0x4e800421);}
imm(1,stack);imm(2,r2);imm(13,r13);imm(31,state);imm(30,hit);
for(const [i,row] of rows.entries()) {
 const offset=i*stride;
 for(const [j,key] of ['pre','damage','weight','scale'].entries()) wrapper.writeFloatBE(row[key],0x30000+offset+j*4);
 wrapper.writeFloatBE(1,0x30000+offset+16);
 imm(28,data+offset);
 dform(48,0,28,0);dform(52,0,31,0x1830);
 dform(48,0,28,4);dform(52,0,31,0x1838);
 for(const [value,field] of [[row.growth,0x24],[row.fixed,0x28],[row.base,0x2c]]) {imm(0,value);dform(36,0,30,field);}
 imm(3,state);imm(4,hit);imm(5,row.damage>0?Math.max(1,Math.trunc(Math.fround(row.damage))):0);
 dform(48,1,28,12);dform(48,2,28,16);dform(48,3,28,16);dform(48,4,28,8);
 call(0x80079ab0);dform(52,1,28,20);
 for(const [j,crouch,charge] of [[0,true,false],[1,false,true],[2,true,true]]) {
  dform(48,0,28,20);dform(52,0,31,0x1850);
  dform(48,0,28,16);dform(52,0,31,0x38);
  imm(0,crouch?39:0);dform(36,0,31,0x10);
  imm(0,charge?2:0);dform(36,0,31,0x2114);
  imm(3,state);call(0x8008d930);
  dform(48,0,31,0x1850);dform(52,0,28,24+j*4);
 }
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
const proc=Bun.spawn([qemu,'-cpu','750',elfPath],{stdout:'pipe',stderr:'pipe'});
const [binary,stderr,exitCode]=await Promise.all([new Response(proc.stdout).arrayBuffer(),new Response(proc.stderr).text(),proc.exited]);
await Bun.write(root+'/execution-stderr.txt',stderr);
if(exitCode!==0) throw Error(`Original execution failed (${exitCode}): ${stderr}`);
const output=Buffer.from(binary);
if(output.length!==rows.length*stride) throw Error('Wrong output length');
await Bun.write(root+'/numerical-output.bin',output);
const field=o=>({bits:'0x'+output.readUInt32BE(o).toString(16).padStart(8,'0'),value:output.readFloatBE(o)});


const results=rows.map((row,i)=>({...row,pre:field(i*stride).value,damage:field(i*stride+4).value,weight:field(i*stride+8).value,expected:field(i*stride+20),contexts:[{crouching:true,charging:false,expected:field(i*stride+24)},{crouching:false,charging:true,expected:field(i*stride+28)},{crouching:true,charging:true,expected:field(i*stride+32)}]}));
const facts={id:'retail-ntsc-1.02-launch-magnitude',executableSha1:sha1,commonDataSha1:datSha1,referenceRevision:'0296f009f32f710495979d30772d8332af2d411a',execution:{cpu:'QEMU PPC750',entry:'0x80079AB0',return:'0x80079C6C',contextEntry:'0x8008D930',contextReturn:'0x8008DA48',returnPatches:[],exitCode,byteCount:output.length},commonValues:Object.fromEntries([0xf4,0xf8,0x108,0x110,0x114,0x118,0x11c,0x120,0x124,0x7c4].map(o=>['0x'+o.toString(16),dat.readFloatBE(commonFileOffset+o)])),limitations:['Complete scalar routine executes with synthetic fighter and hit structures and retail common data; caller state selection, contact collection, and full gameplay are not executed.','Context routine uses ordinary or crouch action state, charge state 2 or 0, scale 1, zero armor and otherwise zeroed fighter fields. Combined crouch/charge is a synthetic arithmetic fixture, not an assertion that gameplay reaches that state.','Three multiplier arguments are neutral. Staling and freshness are deliberately omitted by Smashcraft design.','QEMU PPC750 with Linux default floating-point state, not GameCube hardware.','The uint hit-power input is supplied independently; this does not verify retail damage-to-power conversion. No original executable bytes are included.'],results};
await Bun.write(root+'/facts.json',JSON.stringify(facts,null,2)+'\n');
console.log(JSON.stringify({facts:root+'/facts.json',cases:results.length,exitCode}));

