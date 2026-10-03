# Trigonometry at directional-influence angle boundaries

Directional influence can move an angle beyond positive or negative pi. The
existing independently authored scalar math matches 16 new sine/cosine outputs
from eight original input angles, including both sides beyond pi. No production
formula change was needed. The focused Wurst check passed 1/1 with zero errors
and one existing unused-import warning; evidence is
smashcraft:build/di-trig-focused.log. Emitted Lua and native Warcraft have not
been checked for these new inputs.

smashcraft:tools/physics-probe/observe-retail-di-trig.mjs executes unchanged
original trigonometric initialization, sine and cosine routines under QEMU
PPC750. The eleven-row numerical corpus in
smashcraft:docs/smash-melee-reference/retail-di-trig.json includes three existing
zero/pi cases; only the eight additional angles enter the new focused test.
The corpus retains original executable hash, source revision, entry addresses,
input/output bits and execution limitations. Private original-containing
outputs remain under ~/.local/share/smashcraft-melee-reference/di-trig-runner.
No external gameplay implementation was copied or translated.

These are scalar observations, not verification of directional influence.
The complete original DI routine at 0x8008E5A4 reaches a paired-single load
inside PSVECCrossProduct at 0x80342E58. QEMU's PPC750 and PPC750CL user-mode
execution reject that instruction, so neither attempt produced a complete DI
corpus. The counterexample is preserved privately under
~/.local/share/smashcraft-melee-reference/di-vector-runner. Input selection,
grounded eligibility, vector arithmetic and hitlag dispatch remain separate
requirements; successful scalar checks do not close them.
