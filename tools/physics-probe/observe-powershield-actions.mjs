// Independently authored loader; original executable bytes remain private.
import { mkdirSync, chmodSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = '/home/tom/.local/share/smashcraft-melee-reference/powershield-actions-runner';
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
// Stop before action consumers. The original counter branches and stores run
// unchanged; executed PC traces identify which original input check was next.
const returnPatches=[0x800927d4,0x80092af4,0x80093fb0,0x80092d24,0x80092de4];
for(const address of returnPatches)original.writeUInt32BE(0x4e800020,address-base);
const counters=[0,1,2,3,4],entry=0x81000000,data=entry+0x30000,stack=entry+0xff000,gobj=entry+0x28000,stride=16;
const wrapper=Buffer.alloc(0x40000),words=[];
wrapper.writeUInt32BE(state,gobj-entry+0x2c);
const emit=w=>words.push(w>>>0),dform=(op,rt,ra,d)=>emit((op<<26)|(rt<<21)|(ra<<16)|(d&65535));
function imm(reg,value){dform(15,reg,0,value>>>16);emit((24<<26)|(reg<<21)|(reg<<16)|(value&65535));}
function call(address){imm(12,address);emit(0x7d8903a6);emit(0x4e800421);}
imm(1,stack);imm(2,r2);imm(13,r13);
for(const [i,counter]of counters.entries()){
    imm(28,data+i*stride);imm(30,state);
    for(const [j,routine]of [0x800927bc,0x80092adc,0x80093f98].entries()){
        imm(0,counter);dform(36,0,30,0x235c);imm(31,state);imm(4,state);call(routine);
        dform(32,0,30,0x235c);dform(36,0,28,j*4);
    }
    imm(0,counter);dform(36,0,30,0x235c);imm(31,gobj);imm(3,gobj);call(0x80092d10);
    dform(32,0,30,0x235c);dform(36,0,28,12);
}
dform(14,0,0,4);dform(14,3,0,1);imm(4,data);dform(14,5,0,counters.length*stride);emit(0x44000002);
dform(14,0,0,1);dform(14,3,0,0);emit(0x44000002);
words.forEach((w,i)=>wrapper.writeUInt32BE(w,i*4));
const originalOffset=0x1000,wrapperOffset=originalOffset+original.length;
const elf=Buffer.alloc(wrapperOffset+wrapper.length);elf.set([0x7f,0x45,0x4c,0x46,1,2,1]);
const w16=(o,v)=>elf.writeUInt16BE(v,o),w32=(o,v)=>elf.writeUInt32BE(v>>>0,o);
w16(16,2);w16(18,20);w32(20,1);w32(24,entry);w32(28,52);w16(40,52);w16(42,32);w16(44,2);
function segment(i,offset,address,filesz,memsz){[1,offset,address,address,filesz,memsz,7,4096].forEach((v,j)=>w32(52+i*32+j*4,v));}
segment(0,originalOffset,base,original.length,original.length);segment(1,wrapperOffset,entry,wrapper.length,0x100000);
original.copy(elf,originalOffset);wrapper.copy(elf,wrapperOffset);
const elfPath=root+'/private-original.elf',tracePath=root+'/execution-trace.txt';await Bun.write(elfPath,elf);chmodSync(elfPath,0o700);
const proc=Bun.spawn([qemu,'-cpu','750','-one-insn-per-tb','-d','exec,nochain','-D',tracePath,elfPath],{cwd:root,stdout:'pipe',stderr:'pipe'});
const [binary,stderr,exitCode]=await Promise.all([new Response(proc.stdout).arrayBuffer(),new Response(proc.stderr).text(),proc.exited]);
await Bun.write(root+'/execution-stderr.txt',stderr);if(exitCode!==0)throw Error(`Original execution failed (${exitCode}): ${stderr}`);
const output=Buffer.from(binary);if(output.length!==counters.length*stride)throw Error('Wrong output length');
await Bun.write(root+'/numerical-output.bin',output);
const trace=await Bun.file(tracePath).text();
const selectedStops=[...trace.matchAll(/\[[0-9a-f]+\/0*(80092d24|80092de4)\//gi)].map(m=>'0x'+m[1].toUpperCase());
if(selectedStops.length!==counters.length)throw Error(`Unexpected terminal trace count ${selectedStops.length}`);
const results=counters.map((counter,i)=>({counter,guardOnAfterHeldTick:output.readInt32BE(i*stride),guardAfterHeldTick:output.readInt32BE(i*stride+4),guardReflectAfterHeldTick:output.readInt32BE(i*stride+8),guardOffCounter:output.readInt32BE(i*stride+12),guardOffNextInputCheckCall: selectedStops[i]==='0x80092D24'?'0x80096540':'0x8009980C'}));
if(results.some(r=>r.guardOnAfterHeldTick!==Math.max(0,r.counter-1)||r.guardAfterHeldTick!==r.guardOnAfterHeldTick||r.guardReflectAfterHeldTick!==r.guardOnAfterHeldTick||r.guardOffCounter!==r.counter))throw Error('Unexpected counter observations');
const facts={id:'retail-ntsc-1.02-powershield-action-gate',executableSha1:sha1,commonDataSha1:datSha1,referenceRevision:'0296f009f32f710495979d30772d8332af2d411a',execution:{cpu:'QEMU PPC750',entries:['0x800927BC','0x80092ADC','0x80093F98','0x80092D10'],returnPatches:returnPatches.map(a=>'0x'+a.toString(16)),exitCode,byteCount:output.length},limitations:['Synthetic fighter/GObj fields and isolated counter/gate fragments, not complete input callbacks.','GuardOff observations stop before the selected action helper. They prove which check is next, not that any requested attack succeeds.','Animation clock, minimum guard timer and hitlag/shieldstun callback ordering remain outside this probe.','No original executable bytes or decompiled implementation published.'],results};
await Bun.write(root+'/facts.json',JSON.stringify(facts,null,2)+'\n');console.log(JSON.stringify({facts:root+'/facts.json',results,exitCode}));
