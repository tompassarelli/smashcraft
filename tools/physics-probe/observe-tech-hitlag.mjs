
import { mkdirSync, chmodSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = '/home/tom/.local/share/smashcraft-melee-reference/tech-hitlag-runner';
mkdirSync(root, { recursive: true, mode: 0o700 });
const dol = Buffer.from(await Bun.file('/home/tom/.local/share/smashcraft-melee-reference/ntsc-1.02/main.dol').arrayBuffer());
const hash = b => createHash('sha1').update(b).digest('hex');
if (hash(dol) !== '08e0bf20134dfcb260699671004527b2d6bb1a45') throw Error('Wrong retail executable');
const sections = Array.from({length:18}, (_, i) => ({offset:dol.readUInt32BE(i*4), address:dol.readUInt32BE(0x48+i*4), size:dol.readUInt32BE(0x90+i*4)})).filter(s => s.size);
const base=0x80003000, align=n=>Math.ceil(n/4096)*4096;
const end=Math.max(...sections.map(s=>s.address+s.size),dol.readUInt32BE(0xd8)+dol.readUInt32BE(0xdc));
const original=Buffer.alloc(align(end-base));
for(const s of sections)dol.copy(original,s.address-base,s.offset,s.offset+s.size);
function startup(address,reg){const hi=original.readUInt32BE(address-base),lo=original.readUInt32BE(address+4-base);if((hi>>>16)!==(0x3c00|(reg<<5))||(lo>>>16)!==(0x6000|(reg<<5)|reg))throw Error('Startup register');return (((hi&65535)*65536)+(lo&65535))>>>0;}
const r2=startup(0x80005348,2),r13=startup(0x80005350,13);
const dat=Buffer.from(await Bun.file('/home/tom/.local/share/smashcraft-melee-reference/ntsc-1.02/PlCo.dat').arrayBuffer());
if(hash(dat)!=='c904de0c4c5eb3ef65211a75d8bd70ca5b0f9f41')throw Error('Wrong common data');
const roots=32+dat.readUInt32BE(4)+4*dat.readUInt32BE(8);
const commonOffset=32+dat.readUInt32BE(32+dat.readUInt32BE(roots));
const entry=0x81000000,common=entry+0x29000,data=entry+0x30000,stack=entry+0xff000;
original.writeUInt32BE(common,r13-20812-base);

original.writeUInt32BE(0x38600000,0x800c5240-base);
original.writeUInt32BE(0x4e800020,0x800c5244-base);
const stubs=[0x800a2040,0x8016b41c,0x8016b0fc,0x801a45e8,0x800df0d0,0x8008031c,0x8006abec,0x800c37a0,0x800819a8];
for(const pc of stubs){original.writeUInt32BE(0x38600000,pc-base);original.writeUInt32BE(0x4e800020,pc+4-base);}
const sequences=[
 {name:'existing-window-through-freeze',age:10,ticks:[[true,0],[true,0],[true,0],[false,0]]},
 {name:'early-frozen-press-held',age:255,ticks:[[true,64],[true,64],[true,64],[false,64]]},
 {name:'last-frozen-press-held',age:255,ticks:[[true,0],[true,0],[true,64],[false,64]]},
 {name:'release-frame-press-held',age:255,ticks:[[true,0],[true,0],[true,0],[false,64]]},
 {name:'neutral-through-release',age:255,ticks:[[true,0],[true,0],[true,0],[false,0]]}
];
const gobj=entry+0x20000,state=entry+0x21000;
const wrapper=Buffer.alloc(0x40000),words=[];
dat.copy(wrapper,common-entry,commonOffset,commonOffset+0x818);
wrapper.writeUInt32BE(state,gobj-entry+0x2c);wrapper.writeFloatBE(4,0x28ffc);
const emit=w=>words.push(w>>>0),dform=(op,rt,ra,d)=>emit((op<<26)|(rt<<21)|(ra<<16)|(d&65535));
function imm(r,v){dform(15,r,0,v>>>16);emit((24<<26)|(r<<21)|(r<<16)|(v&65535));}
function call(pc){imm(12,pc);emit(0x7d8903a6);emit(0x4e800421);}
imm(1,stack);imm(2,r2);imm(13,r13);imm(30,state);imm(31,state);
let rowIndex=0;
for(const sequence of sequences){
 imm(0,0);for(const offset of [0x65c,0x660,0x664,0x668,0x66c])dform(36,0,30,offset);
 imm(0,sequence.age);dform(38,0,30,0x680);imm(0,255);dform(38,0,30,0x684);
 imm(29,entry+0x28ffc);dform(48,0,29,0);dform(52,0,30,0x195c);imm(0,4);dform(38,0,30,0x2219);
 for(const [frozen,held] of sequence.ticks){
  imm(28,data+rowIndex*24);imm(29,0x804c21cc);imm(0,held);dform(36,0,29,0);imm(3,gobj);call(0x8006a1bc);
  imm(3,gobj);call(0x8006ad10);
  dform(32,0,30,0x668);dform(36,0,28,0);
  dform(34,0,30,0x680);dform(36,0,28,4);dform(34,0,30,0x684);dform(36,0,28,8);
  imm(3,gobj);call(0x800986b0);dform(36,3,28,12);dform(48,0,30,0x195c);dform(52,0,28,16);dform(34,0,30,0x2219);dform(36,0,28,20);
  dform(32,0,30,0x65c);dform(36,0,30,0x660);rowIndex++;
 }
}
dform(14,0,0,4);dform(14,3,0,1);imm(4,data);dform(14,5,0,rowIndex*24);emit(0x44000002);
dform(14,0,0,1);dform(14,3,0,0);emit(0x44000002);
words.forEach((w,i)=>wrapper.writeUInt32BE(w,i*4));
const originalOffset=0x1000,wrapperOffset=originalOffset+original.length;
const elf=Buffer.alloc(wrapperOffset+wrapper.length);elf.set([0x7f,0x45,0x4c,0x46,1,2,1]);
const w16=(o,v)=>elf.writeUInt16BE(v,o),w32=(o,v)=>elf.writeUInt32BE(v>>>0,o);
w16(16,2);w16(18,20);w32(20,1);w32(24,entry);w32(28,52);w16(40,52);w16(42,32);w16(44,2);
function segment(i,o,a,size,memorySize=size){[1,o,a,a,size,memorySize,7,4096].forEach((v,j)=>w32(52+i*32+j*4,v));}
segment(0,originalOffset,base,original.length);segment(1,wrapperOffset,entry,wrapper.length,0x100000);
original.copy(elf,originalOffset);wrapper.copy(elf,wrapperOffset);
const path=root+'/private-original.elf';await Bun.write(path,elf);chmodSync(path,0o700);
const qemu='/nix/store/7fbvcx0hwmaxv2jafvc1g6d6zg5fgm8i-qemu-10.2.4/bin/qemu-ppc';
const process=Bun.spawn([qemu,'-cpu','750',path],{cwd:root,stdout:'pipe',stderr:'pipe'});
const [bytes,stderr,exitCode]=await Promise.all([new Response(process.stdout).arrayBuffer(),new Response(process.stderr).text(),process.exited]);
await Bun.write(root+'/stderr.txt',stderr);
if(exitCode!==0)throw Error('Original execution failed: '+exitCode);
const output=Buffer.from(bytes);if(output.length!==rowIndex*24)throw Error('Wrong output size');
let sample=0;
const results=sequences.map(sequence=>({name:sequence.name,initialAge:sequence.age,initialPreviousPressInterval:255,ticks:sequence.ticks.map(([frozen,held])=>{const offset=sample++*24;return {suppliedScheduleLabelFrozen:frozen,hitlagRemaining:output.readFloatBE(offset+16),frozen:(output.readUInt32BE(offset+20)&4)!==0,held,pressed:output.readUInt32BE(offset),age:output.readUInt32BE(offset+4),previousPressInterval:output.readUInt32BE(offset+8),eligible:output.readUInt32BE(offset+12)!==0};})}));
const facts={id:'retail-ntsc-1.02-tech-hitlag-input',executableSha1:hash(dol),commonDataSha1:hash(dat),referenceRevision:'0296f009f32f710495979d30772d8332af2d411a',execution:{cpu:'QEMU PPC750',hitlagEntry:'0x8006A1BC',initialHitlag:4,inputEntry:'0x8006AD10',gateEntry:'0x800986B0',zeroReturnStubs:stubs.map(pc=>'0x'+pc.toString(16)),exclusionStub:'0x800C5240 -> false',exitCode},limitations:['Original Fighter_procHitlag executes before complete Fighter_procInput, matching registered callback priorities 0 and 3. Hitlag count starts at four; freeze flags are changed by original code, not supplied per frame.','CPU/game-mode queries, unrelated post-input counter callbacks, mushroom checks and shield-state timers return zero. Collision and action entry are not executed; fighter callbacks and linked-fighter pointers are null.','These composed observations are not a complete original gameplay trajectory. Original binaries remain private outside repositories.'],results};
await Bun.write(root+'/facts.json',JSON.stringify(facts,null,2)+'\n');console.log(JSON.stringify({facts:root+'/facts.json',results:results.map(r=>({name:r.name,last:r.ticks.at(-1)})),exitCode}));
