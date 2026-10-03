// Independently authored loader. The original executable and execution output
// stay in private storage; this records five complete retail callbacks.
import { mkdirSync, chmodSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = '/home/tom/.local/share/smashcraft-melee-reference/powershield-clock-runner';
const source = '/home/tom/.local/share/smashcraft-melee-reference/ntsc-1.02/main.dol';
const qemu = '/nix/store/7fbvcx0hwmaxv2jafvc1g6d6zg5fgm8i-qemu-10.2.4/bin/qemu-ppc';
mkdirSync(root, { recursive: true, mode: 0o700 });
const dol = Buffer.from(await Bun.file(source).arrayBuffer());
const executableSha1 = createHash('sha1').update(dol).digest('hex');
if (executableSha1 !== '08e0bf20134dfcb260699671004527b2d6bb1a45') throw Error('Wrong executable');
const u32 = o => dol.readUInt32BE(o);
const sections = Array.from({ length: 18 }, (_, i) => ({ offset: u32(i * 4), address: u32(0x48 + i * 4), size: u32(0x90 + i * 4) })).filter(s => s.size);
const base = 0x80003000, align = n => Math.ceil(n / 4096) * 4096;
const end = Math.max(...sections.map(s => s.address + s.size), u32(0xd8) + u32(0xdc));
const original = Buffer.alloc(align(end - base));
for (const s of sections) dol.copy(original, s.address - base, s.offset, s.offset + s.size);
const instruction = address => original.readUInt32BE(address - base);
function register(address, reg) {
    const hi = instruction(address), lo = instruction(address + 4);
    if ((hi >>> 16) !== (0x3c00 | (reg << 5)) || (lo >>> 16) !== (0x6000 | (reg << 5) | reg)) throw Error('Startup register');
    return (((hi & 65535) * 65536) + (lo & 65535)) >>> 0;
}
const r2 = register(0x80005348, 2), r13 = register(0x80005350, 13);
const datPath = '/home/tom/.local/share/smashcraft-melee-reference/ntsc-1.02/PlCo.dat';
const dat = Buffer.from(await Bun.file(datPath).arrayBuffer());
const commonDataSha1 = createHash('sha1').update(dat).digest('hex');
if (commonDataSha1 !== 'c904de0c4c5eb3ef65211a75d8bd70ca5b0f9f41') throw Error('Wrong common data');
const roots = 32 + dat.readUInt32BE(4) + 4 * dat.readUInt32BE(8);
const commonOffset = 32 + dat.readUInt32BE(32 + dat.readUInt32BE(roots));
const commonInputWindow = dat.readInt32BE(commonOffset + 0x2a0);
const commonReflectFrames = dat.readFloatBE(commonOffset + 0x2a4);
const commonSecondaryFrames = dat.readFloatBE(commonOffset + 0x2b4);
const commonReflectRadius = dat.readFloatBE(commonOffset + 0x2a8);
const commonReflectDamageMultiplier = dat.readFloatBE(commonOffset + 0x2ac);
const commonReflectSpeedMultiplier = dat.readFloatBE(commonOffset + 0x2b0);
const entry = 0x81000000, state = entry + 0x20000, gobj = entry + 0x28000, stack = entry + 0x3f000;
const wrapper = Buffer.alloc(0x40000), code = [], outputStride = 20, callbackCount = 5;
const ftData = entry + 0x2a000, attributes = entry + 0x2a100, bones = entry + 0x2a200, joint = entry + 0x2a300;
wrapper.writeUInt32BE(state, gobj - entry + 0x2c);
wrapper.writeUInt32BE(ftData, state - entry + 0x10c);
wrapper.writeUInt32BE(attributes, ftData - entry + 8);
wrapper.writeUInt32BE(bones, state - entry + 0x5e8);
wrapper.writeUInt32BE(joint, bones - entry);
wrapper.writeUInt8(0x10, state - entry + 0x2218);
wrapper.writeUInt8(0x70, state - entry + 0x221c);
wrapper.writeFloatBE(commonReflectFrames, state - entry + 0x2354);
wrapper.writeFloatBE(commonSecondaryFrames, state - entry + 0x2358);
const emit = word => code.push(word >>> 0);
function dform(op, rt, ra, d) { emit((op << 26) | (rt << 21) | (ra << 16) | (d & 65535)); }
function imm(reg, value) { dform(15, reg, 0, value >>> 16); emit((24 << 26) | (reg << 21) | (reg << 16) | (value & 65535)); }
function call(address) { imm(12, address); emit(0x7d8903a6); emit(0x4e800421); }
function syscallWrite(address, bytes) { dform(14, 0, 0, 4); dform(14, 3, 0, 1); imm(4, address); dform(14, 5, 0, bytes); emit(0x44000002); }
const data = entry + 0x30000;
imm(1, stack); imm(2, r2); imm(13, r13); imm(31, state); imm(30, data);
for (let sample = 0; sample < callbackCount; sample++) {
    imm(3, gobj); call(0x80093bc0);
    // Emit reflect bit, animation flags, and both counters after each callback.
    imm(28, state + 0x2218);
    dform(34, 0, 28, 0); dform(34, 5, 28, 4);
    dform(48, 2, 28, 0x13c); dform(48, 3, 28, 0x140);
    dform(36, 0, 30, sample * outputStride);
    dform(36, 5, 30, sample * outputStride + 4);
    dform(52, 2, 30, sample * outputStride + 8);
    dform(52, 3, 30, sample * outputStride + 12);
    dform(34, 0, 28, 2); dform(36, 0, 30, sample * outputStride + 16);
}
syscallWrite(data, callbackCount * outputStride);
dform(14, 0, 0, 1); dform(14, 3, 0, 0); emit(0x44000002);
code.forEach((word, i) => wrapper.writeUInt32BE(word, i * 4));
const originalOffset = 0x1000, wrapperOffset = originalOffset + original.length;
const elf = Buffer.alloc(wrapperOffset + wrapper.length); elf.set([0x7f, 0x45, 0x4c, 0x46, 1, 2, 1]);
const w16 = (o, v) => elf.writeUInt16BE(v, o), w32 = (o, v) => elf.writeUInt32BE(v >>> 0, o);
w16(16, 2); w16(18, 20); w32(20, 1); w32(24, entry); w32(28, 52); w16(40, 52); w16(42, 32); w16(44, 2);
function segment(i, offset, address, filesz, memsz) { [1, offset, address, address, filesz, memsz, 7, 4096].forEach((v, j) => w32(52 + i * 32 + j * 4, v)); }
segment(0, originalOffset, base, original.length, original.length);
segment(1, wrapperOffset, entry, wrapper.length, 0x100000);
original.copy(elf, originalOffset); wrapper.copy(elf, wrapperOffset);
const elfPath = root + '/private-original.elf';
await Bun.write(elfPath, elf); chmodSync(elfPath, 0o700);
const proc = Bun.spawn([qemu, '-cpu', '750', elfPath], { cwd: root, stdout: 'pipe', stderr: 'pipe' });
const [binary, stderr, exitCode] = await Promise.all([new Response(proc.stdout).arrayBuffer(), new Response(proc.stderr).text(), proc.exited]);
await Bun.write(root + '/execution-stderr.txt', stderr);
if (exitCode !== 0) throw Error(`Original execution failed (${exitCode}): ${stderr}`);
const bytes = Buffer.from(binary);
if (bytes.length !== callbackCount * outputStride) throw Error(`Unexpected output: ${bytes.length}`);
await Bun.write(root + '/numerical-output.bin', bytes);
const samples = Array.from({ length: callbackCount }, (_, i) => ({
    callback: i + 1,
    reflectorFlagByte: '0x' + bytes.readUInt32BE(i * outputStride).toString(16).padStart(8, '0'),
    guardCallbackFlagByte: '0x' + bytes.readUInt32BE(i * outputStride + 4).toString(16).padStart(8, '0'),
    reflectorFramesRemaining: bytes.readFloatBE(i * outputStride + 8),
    secondaryFramesRemaining: bytes.readFloatBE(i * outputStride + 12),
    shieldCallbackFlagByte: '0x' + bytes.readUInt32BE(i * outputStride + 16).toString(16).padStart(8, '0')
}));
const facts = {
    id: 'retail-ntsc-1.02-powershield-reflector-clock', executableSha1, commonDataSha1,
    referenceRevision: '0296f009f32f710495979d30772d8332af2d411a',
    execution: { cpu: 'QEMU PPC750', callback: '0x80093BC0', callbackCount,
        returnPatches: [], exitCode, byteCount: bytes.length },
    commonValues: { inputWindow: commonInputWindow, reflectorFrames: commonReflectFrames, secondaryFrames: commonSecondaryFrames,
        reflectorRadius: commonReflectRadius, reflectorDamageMultiplier: commonReflectDamageMultiplier,
        reflectorSpeedMultiplier: commonReflectSpeedMultiplier }, samples,
    conclusion: 'The reflector bit remains active after callback 1 and clears during callback 2, which installs the ordinary shield descriptor. The secondary flag 0x20 remains through callback 3 and clears during callback 4. These are callback observations, not a full match contact-order trace.',
    limitations: ['Synthetic Fighter, GObj, attributes and bone memory; complete callback and ordinary shield creation only; no collision or original-character geometry.', 'Complete GuardReflect entry, animation and collision scheduling are not executed.', 'QEMU PPC750, not GameCube or Warcraft native execution.', 'No original executable bytes or decompiled implementation are published.']
};
await Bun.write(root + '/facts.json', JSON.stringify(facts, null, 2) + '\n');
console.log(JSON.stringify({ facts: root + '/facts.json', samples, exitCode }));
