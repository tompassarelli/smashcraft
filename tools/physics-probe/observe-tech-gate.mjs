// Independently authored foreign-executable loader; original bytes stay private.
import { mkdirSync, chmodSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = '/home/tom/.local/share/smashcraft-melee-reference/tech-gate-runner';
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
// The CPU/item gate is supplied as false; the original timer gate is unchanged.
original.writeUInt32BE(0x38600000,0x800c5240-base);
original.writeUInt32BE(0x4e800020,0x800c5244-base);
const rows=[[0,255],[19,40],[20,40],[19,39],[0,39],[0,40],[255,255]];
const gobj=entry+0x20000,state=entry+0x21000;
const wrapper=Buffer.alloc(0x40000),words=[];
dat.copy(wrapper,common-entry,commonOffset,commonOffset+0x818);
wrapper.writeUInt32BE(state,gobj-entry+0x2c);
const emit=w=>words.push(w>>>0),dform=(op,rt,ra,d)=>emit((op<<26)|(rt<<21)|(ra<<16)|(d&65535));
function imm(r,v){dform(15,r,0,v>>>16);emit((24<<26)|(r<<21)|(r<<16)|(v&65535));}
function call(pc){imm(12,pc);emit(0x7d8903a6);emit(0x4e800421);}
imm(1,stack);imm(2,r2);imm(13,r13);imm(30,state);
for(const [i,[age,interval]]of rows.entries()){
 wrapper.writeUInt32BE(age,data-entry+i*12);wrapper.writeUInt32BE(interval,data-entry+i*12+4);
 imm(28,data+i*12);imm(0,age);dform(38,0,30,0x680);imm(0,interval);dform(38,0,30,0x684);
 imm(3,gobj);call(0x800986b0);dform(36,3,28,8);
}
dform(14,0,0,4);dform(14,3,0,1);imm(4,data);dform(14,5,0,rows.length*12);emit(0x44000002);
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
const output=Buffer.from(bytes);if(output.length!==rows.length*12)throw Error('Wrong output size');
const facts={id:'retail-ntsc-1.02-tech-timer-gate',executableSha1:hash(dol),commonDataSha1:hash(dat),referenceRevision:'0296f009f32f710495979d30772d8332af2d411a',commonValues:[{offset:'0x250',name:'inputAgeExclusiveLimit',value:dat.readFloatBE(commonOffset+0x250)},{offset:'0x01C',name:'previousPressIntervalInclusiveMinimum',value:dat.readInt32BE(commonOffset+0x1c)}],execution:{entry:'0x800986B0',cpu:'QEMU PPC750',exitCode,stub:{address:'0x800C5240',result:false,meaning:'CPU/item exclusion supplied false'}},limitations:['Original timer comparisons and return execute unchanged with synthetic fighter/input counters.','Input capture, counter advancement through hitlag, collision and action entry are not executed.','QEMU PPC750 is not GameCube hardware; original binaries remain outside repositories.'],results:rows.map((row,i)=>({age:output.readUInt32BE(i*12),previousPressInterval:output.readUInt32BE(i*12+4),eligible:output.readUInt32BE(i*12+8)!==0}))};
await Bun.write(root+'/facts.json',JSON.stringify(facts,null,2)+'\n');
console.log(JSON.stringify({facts:root+'/facts.json',results:facts.results,exitCode}));
