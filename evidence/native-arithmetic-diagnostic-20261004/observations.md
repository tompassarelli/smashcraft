# Native arithmetic diagnostic, 2026-10-04

Diagnostic repair commit `ac26f22aa81f75ebc350a85324f38152f41f230c`
built Smashcraft 0.0.35 at
~/.local/share/smashcraft-build-inputs/native-arithmetic-diagnostic-20261004/native.wnAHam/Smashcraft 0.0.35.w3x.
SHA-256: `0bc8b9280c1aa9377e5f638e8ff0ed5b8bc982ca2a3309da9c9cffafa7fdc1e2`.
Compilation, Lua syntax, and packaged-script comparison passed. Native execution
and export retention remain to be observed by the parent task.

The preceding native 0.0.33 export contained SOURCE, MESSAGES 689, and
NATIVE_PHYSICS_FAIL, but none of the individual comparisons. Emitted Lua
initializes the report package before its probes: package ordering does not
establish the loss's cause. The observed distinction is that initialization-time
Preload records were absent while timer-time records survived. The repair
buffers messages, then starts capture, writes every record, and closes the file
in one timer callback. Four formerly unconditional group PASS messages now
depend on their individual checks. Completion also requires sixteen passing
groups and nineteen records. Detailed shield/fall values appear only on failure.

The scalar checker was stale after the four-participant integration: it omitted
five imported packages and the ParticipantInputs initializer. Once corrected,
all nineteen comparisons passed in ordinary Lua 5.3. The retained output is
wc3-melee:evidence/native-arithmetic-diagnostic-20261004/lua64-results.txt.

Lua 5.3.6 built from https://www.lua.org/ftp/lua-5.3.6.tar.gz with
`MYCFLAGS=-DLUA_32BITS` reports a signed 32-bit integer maximum and
`16777216.0 + 1.0 == 16777216.0`. The source archive SHA-256 is
`fc5fd69bb8736323f026672b1b7235da613d7177e72558893a0bdcd320466d60`.
Its executable is
~/code/wc3-melee/worktrees/native-arithmetic-diagnostic-20261004/build/physics-probe/lua-5.3.6/src/lua.
This tests float32 Lua arithmetic, not Warcraft's complete native environment.

The emitted production calculations fail the recorded fall at frame -53,
cutoff cases 4/13/14, ground cases 8/12/19, and fourteen shield pushback cases.
The original detailed output, captured before adding R2SW failure detail, is
wc3-melee:evidence/native-arithmetic-diagnostic-20261004/lua32-original-details.txt.
Launch magnitude, DI, signed-zero, contact-sum, and capsule groups pass locally.
This differs materially from native 0.0.33; its additional failures remain open.

The first isolated production seam is world-unit storage in
wc3-melee:wurst/Simulation.wurst, specifically addMeleeWorldValues. Multiplying
an original float32 value by six and dividing it by six is not reversible on
float32 Lua. After five gravity decrements, velocity bits `bf59999a` become
`bf59999b` when recovered from world coordinates. The next update's stored
velocity differs from the original update's scaled result. The executable
counterexample is wc3-melee:evidence/native-arithmetic-diagnostic-20261004/scaling-counterexample.lua;
run it with the float32 Lua executable above. The recorded-fall Wurst generator
is the existing executable production counterexample. No production arithmetic
or expected result was changed.

The checker accepts `PHYSICS_LUA` for an explicitly selected executable and
retains failures through its final assertion.

## Recovery run: complete Lua32 output with measured R2SW fixture

Upstream runtime/shim commit `0fe2efc959049b4ede2b86c66ae61c130eb04b55`
implements measured `R2SW` formatting in the standalone Lua fixture and adds an
executed regression for width, sign, carry, large integer wrap, and binary32
fraction formatting. The filtered compiler test ran with the local `LUA_32BITS`
binary: 1 test, 0 skipped, 0 failures. The immutable runtime source pin is
`~/code/wurst-compiler/pins/0fe2efc959049b4ede2b86c66ae61c130eb04b55`.

The complete probe run now finishes its assertions. This is a float32 Lua
comparison, not Warcraft's runtime arithmetic. It passes grounded, shield
regeneration/damage/stun/contact sum, air decrement, signed-zero, hitstun,
hitlag, launch magnitude, DI (56 vectors), and capsule classification (508
vectors). It fails recorded fall, air cutoff (cases 4/13/14), ground motion
(cases 8/12/19), and analog shield pushback (14 individual outputs). The
compiler succeeds with zero errors and zero warnings; the final test runner
assertion fails as expected because those recorded numerical comparisons fail.

The recorded-fall float32 trace first diverges at gravity step 5: direct
binary32 velocity is `bf59999a` (-0.8500000238418579), while the production
world-coordinate divide/add/multiply path yields `bf59999b` (-0.8500000834465027).
The minimal reproducer is `scaling-counterexample.lua`. This proves that the
`value / 6 -> add -> * 6` production path loses a representable low bit under
the float32 model. It does not account for the native 0.0.35 report's much
broader DI, launch-context, and capsule mismatches; native arithmetic differs
from both ordinary Lua and this Lua32 build.

The native 0.0.35 export at
`wc3-melee:evidence/native-physics-precision-20261004/native0035.txt` contains 703
Preload records, `MESSAGES 700`, and `NATIVE_PHYSICS_FAIL`. It records DI
mismatch count 21 (15 discrete), launch magnitude mismatch count 119, 339
capsule mismatches, and individual fall, cutoff, ground-motion, shield, and
signed-zero failures. No production formula or expected value has been changed.

The first demonstrated consumer defect is `Simulation.wurst:addMeleeWorldValues`
at lines 15–21, where world values are divided by six, summed, and multiplied
back. The wider root blocker is the runtime arithmetic contract: the checked-in
`Binary32.roundToFloat32` API rounds an already-computed value, so it cannot
recover precision discarded by a native arithmetic operator. Correcting that
generically needs exact add/multiply/divide semantics upstream or a measured
consumer formula based on native results; current Lua32 results do not identify
which native mismatches share that cause. A narrow native discriminator should
compare, in the same run and with identical source operands, (1) current
`addMeleeWorldValues`, (2) direct world-unit addition, and (3) normalized-unit
addition, while recording operands/results for the first fall frame where they
diverge. This is the smallest proof that separates the scale round-trip defect
from the engine's arithmetic contract before considering the remaining groups.
