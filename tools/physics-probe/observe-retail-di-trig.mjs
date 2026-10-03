// Authored foreign executable loader. Original game instructions remain private.
import { mkdirSync, chmodSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = '/home/tom/.local/share/smashcraft-melee-reference/di-trig-runner';
const source = '/home/tom/.local/share/smashcraft-melee-reference/ntsc-1.02/main.dol';
const qemu = process.env.QEMU_PPC ?? '/nix/store/7fbvcx0hwmaxv2jafvc1g6d6zg5fgm8i-qemu-10.2.4/bin/qemu-ppc';
mkdirSync(root, { recursive: true, mode: 0o700 });
const dol = Buffer.from(await Bun.file(source).arrayBuffer());
const sha1 = createHash('sha1').update(dol).digest('hex');
if (sha1 !== '08e0bf20134dfcb260699671004527b2d6bb1a45') throw new Error('Unexpected original DOL');
const u32 = o => dol.readUInt32BE(o);
const sections = Array.from({length:18}, (_,i) => ({offset:u32(i*4), address:u32(0x48+i*4), size:u32(0x90+i*4)})).filter(s=>s.size);
const base = 0x80003000;
const align = n => Math.ceil(n/4096)*4096;
const end = Math.max(...sections.map(s=>s.address+s.size),u32(0xd8)+u32(0xdc));
const original = Buffer.alloc(align(end-base));
for (const s of sections) dol.copy(original,s.address-base,s.offset,s.offset+s.size);
const instruction = a => original.readUInt32BE(a-base);
function startupRegister(address, register) {
  const hi=instruction(address), lo=instruction(address+4);
  if ((hi>>>16)!==(0x3c00|(register<<5)) || (lo>>>16)!==(0x6000|(register<<5)|register)) throw new Error('Startup register encoding changed');
  return (((hi&65535)*65536)+(lo&65535))>>>0;
}
const r2=startupRegister(0x80005348,2), r13=startupRegister(0x80005350,13);
const addresses={atan2f:0x80022c30, cosf:0x80326240, sinf:0x803263d4, initialize:0x80326578};
const vectors=[];
const angles=[0,...[Math.PI,Math.PI+0.3141592653589793,Math.PI+0.2,Math.PI/2+0.3141592653589793,0.3141592653589793].flatMap(a=>[Math.fround(a),Math.fround(-a)])];
const rows=[...vectors.map(([y,x])=>({kind:'atan2',y,x})),...angles.map(angle=>({kind:'angle',angle}))];
const entry=0x81000000, data=entry+0x10000, stack=entry+0xff000;
const wrapper=Buffer.alloc(0x11000), words=[];
const emit = n=>words.push(n>>>0);
const dform=(opcode,reg,base,offset)=>emit((opcode<<26)|(reg<<21)|(base<<16)|(offset&65535));
function imm(register,value) { dform(15,register,0,value>>>16); emit((24<<26)|(register<<21)|(register<<16)|(value&65535)); }
function call(address) {imm(12,address);emit(0x7d8903a6);emit(0x4e800421);}
imm(1,stack);imm(2,r2);imm(13,r13);imm(30,data);
call(addresses.initialize);
for(let i=0;i<rows.length;i++) {
  const row=rows[i], offset=i*20;
  wrapper.writeFloatBE(row.y??0,0x10000+offset);
  wrapper.writeFloatBE(row.x??0,0x10000+offset+4);
  wrapper.writeFloatBE(row.angle??0,0x10000+offset+8);
  if(row.kind==='atan2') {
    dform(48,1,30,offset);dform(48,2,30,offset+4);call(addresses.atan2f);dform(52,1,30,offset+8);
  }
  dform(48,1,30,offset+8);call(addresses.cosf);dform(52,1,30,offset+12);
  dform(48,1,30,offset+8);call(addresses.sinf);dform(52,1,30,offset+16);
}
// Linux PPC32 sys_write(1, data, bytes), followed by sys_exit(0).
dform(14,0,0,4);dform(14,3,0,1);imm(4,data);dform(14,5,0,rows.length*20);emit(0x44000002);
dform(14,0,0,1);dform(14,3,0,0);emit(0x44000002);
words.forEach((word,i)=>wrapper.writeUInt32BE(word,i*4));
if(words.length*4>=0x10000)throw new Error('Wrapper overlaps input area');

const originalOffset=0x1000, wrapperOffset=originalOffset+original.length;
const elf=Buffer.alloc(wrapperOffset+wrapper.length);
elf.set([0x7f,0x45,0x4c,0x46,1,2,1]);
const w16=(o,v)=>elf.writeUInt16BE(v,o), w32=(o,v)=>elf.writeUInt32BE(v>>>0,o);
w16(16,2);w16(18,20);w32(20,1);w32(24,entry);w32(28,52);w16(40,52);w16(42,32);w16(44,2);
function segment(i,offset,address,filesz,memsz) {
  const p=52+i*32;
  [1,offset,address,address,filesz,memsz,7,4096].forEach((v,j)=>w32(p+j*4,v));
}
segment(0,originalOffset,base,original.length,original.length);
segment(1,wrapperOffset,entry,wrapper.length,0x100000);
original.copy(elf,originalOffset);wrapper.copy(elf,wrapperOffset);
const elfPath=root+'/private-original.elf';
await Bun.write(elfPath,elf);chmodSync(elfPath,0o700);
const proc=Bun.spawn([qemu,'-cpu','750',elfPath],{cwd:root,stdout:'pipe',stderr:'pipe'});
const [binary,stderr,exitCode]=await Promise.all([new Response(proc.stdout).arrayBuffer(),new Response(proc.stderr).text(),proc.exited]);
await Bun.write(root+'/execution-stderr.txt',stderr);
if(exitCode!==0)throw new Error(`Original execution failed (${exitCode}): ${stderr}`);
const output=Buffer.from(binary);
if(output.length!==rows.length*20)throw new Error(`Expected ${rows.length*20} bytes; received ${output.length}`);
await Bun.write(root+'/numerical-output.bin',output);
const field=offset=>({bits:'0x'+output.readUInt32BE(offset).toString(16).padStart(8,'0'),value:output.readFloatBE(offset)});
const results=rows.map((row,i)=>({kind:row.kind,...(row.kind==='atan2'?{y:field(i*20),x:field(i*20+4)}:{}),angle:field(i*20+8),cos:field(i*20+12),sin:field(i*20+16)}));
const zero=results.find(row=>row.kind==='angle'&&row.angle.bits==='0x00000000');
if(zero.cos.bits!=='0x3f800000'||zero.sin.bits!=='0x00000000')throw new Error('Basic zero/one check failed');
const version=await new Response(Bun.spawn([qemu,'--version'],{stdout:'pipe'}).stdout).text();
const facts={source:{path:source,sha1,referenceRevision:'0296f009f32f710495979d30772d8332af2d411a'},execution:{qemu,version:version.trim(),cpu:'750',bun:Bun.version,r2:'0x'+r2.toString(16),r13:'0x'+r13.toString(16),addresses:Object.fromEntries(Object.entries(addresses).map(([k,v])=>[k,'0x'+v.toString(16)])),exitCode,byteCount:output.length},checks:{zeroAngleCosOneSinZero:true},limitations:['Original scalar routines executed under QEMU PPC750; not hardware measurements.','No Gekko reciprocal-square-root estimate or full-game behavior equivalence claim.','Linux default floating-point state; this loader does not run GameCube OS startup.'],results};
await Bun.write(root+'/facts.json',JSON.stringify(facts,null,2)+'\n');
console.log(JSON.stringify({facts:root+'/facts.json',cases:results.length,checks:facts.checks}));
