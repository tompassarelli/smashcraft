// Independently authored loader; original executable bytes remain private.
import { mkdirSync, chmodSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = '/home/tom/.local/share/smashcraft-melee-reference/powershield-contact-runner';
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
const returnPatches=[0x80076e3c,0x80076e5c,0x800930d0];
for(const address of returnPatches)original.writeUInt32BE(0x4e800020,address-base);
const rows=[];
for(const perfect of [false,true])for(const strength of [0.4,1])for(const damage of [3,10,30])rows.push({perfect,strength,damage,shieldDamageSeed:7,extraShieldDamage:2});
const entry=0x81000000,data=entry+0x30000,stack=entry+0xff000,attacker=entry+0x24000,stride=32;
const wrapper=Buffer.alloc(0x40000),words=[];
dat.copy(wrapper,common-entry,commonFileOffset,commonFileOffset+0x818);
wrapper.writeFloatBE(-1,state-entry+0x19ac);
const emit=w=>words.push(w>>>0);
const dform=(op,rt,ra,d)=>emit((op<<26)|(rt<<21)|(ra<<16)|(d&65535));
function imm(reg,value){dform(15,reg,0,value>>>16);emit((24<<26)|(reg<<21)|(reg<<16)|(value&65535));}
function call(address){imm(12,address);emit(0x7d8903a6);emit(0x4e800421);}
imm(1,stack);imm(2,r2);imm(13,r13);imm(31,state);imm(29,attacker);imm(30,hit);
for(const [i,row]of rows.entries()){
    const offset=i*stride;
    wrapper.writeFloatBE(row.strength,data-entry+offset);
    imm(28,data+offset);
    imm(0,row.perfect?0x20:0);dform(38,0,31,0x221c);
    imm(0,row.shieldDamageSeed);dform(36,0,31,0x19a0);
    imm(0,row.extraShieldDamage);dform(36,0,30,0x34);
    imm(3,row.damage);call(0x80076dfc);
    dform(32,0,31,0x19a0);dform(36,0,28,4);
    dform(48,1,28,0);imm(3,row.damage);call(0x80092ed8);
    dform(52,1,28,8);emit(0xffe00890);
    call(0x80093080);dform(48,0,31,0xec);dform(52,0,28,12);
    imm(3,state);call(0x80094138);
    dform(32,0,31,0x235c);dform(36,0,28,16);
    dform(48,0,31,0x2350);dform(52,0,28,20);
}
dform(14,0,0,4);dform(14,3,0,1);imm(4,data);dform(14,5,0,rows.length*stride);emit(0x44000002);
dform(14,0,0,1);dform(14,3,0,0);emit(0x44000002);
words.forEach((w,i)=>wrapper.writeUInt32BE(w,i*4));
const originalOffset=0x1000,wrapperOffset=originalOffset+original.length;
const elf=Buffer.alloc(wrapperOffset+wrapper.length);elf.set([0x7f,0x45,0x4c,0x46,1,2,1]);
const w16=(o,v)=>elf.writeUInt16BE(v,o),w32=(o,v)=>elf.writeUInt32BE(v>>>0,o);
w16(16,2);w16(18,20);w32(20,1);w32(24,entry);w32(28,52);w16(40,52);w16(42,32);w16(44,2);
function segment(i,offset,address,filesz,memsz){[1,offset,address,address,filesz,memsz,7,4096].forEach((v,j)=>w32(52+i*32+j*4,v));}
segment(0,originalOffset,base,original.length,original.length);segment(1,wrapperOffset,entry,wrapper.length,0x100000);
original.copy(elf,originalOffset);wrapper.copy(elf,wrapperOffset);
const elfPath=root+'/private-original.elf';await Bun.write(elfPath,elf);chmodSync(elfPath,0o700);
const proc=Bun.spawn([qemu,'-cpu','750',elfPath],{cwd:root,stdout:'pipe',stderr:'pipe'});
const [binary,stderr,exitCode]=await Promise.all([new Response(proc.stdout).arrayBuffer(),new Response(proc.stderr).text(),proc.exited]);
await Bun.write(root+'/execution-stderr.txt',stderr);if(exitCode!==0)throw Error(`Original execution failed (${exitCode}): ${stderr}`);
const output=Buffer.from(binary);if(output.length!==rows.length*stride)throw Error('Wrong output length');
await Bun.write(root+'/numerical-output.bin',output);
const field=o=>({bits:'0x'+output.readUInt32BE(o).toString(16).padStart(8,'0'),value:output.readFloatBE(o)});
const results=rows.map((row,i)=>({...row,shieldDamageAccumulated:output.readInt32BE(i*stride+4),stunDuration:field(i*stride+8),pushback:field(i*stride+12),postContactCounter:output.readInt32BE(i*stride+16),postContactTimer:field(i*stride+20)}));
const facts={id:'retail-ntsc-1.02-powershield-contact',executableSha1:sha1,commonDataSha1:datSha1,referenceRevision:'0296f009f32f710495979d30772d8332af2d411a',execution:{cpu:'QEMU PPC750',contactBranch:'0x80076DFC',stun:'0x80092ED8',pushback:'0x80093080',postContactSetup:'0x80094138',returnPatches:returnPatches.map(x=>'0x'+x.toString(16)),exitCode,byteCount:output.length},limitations:['Synthetic fields and isolated contact registration/pushback fragments, stopping before effect and full state-entry consumers.','No collision geometry, successful powershield selection, contact ordering, actionability or native execution.','The post-contact setup is called separately for observation; it is not counted as complete contact execution.','No original executable bytes or decompiled implementation published.'],results};
await Bun.write(root+'/facts.json',JSON.stringify(facts,null,2)+'\n');console.log(JSON.stringify({facts:root+'/facts.json',results,exitCode}));
