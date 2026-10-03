# Powershield and projectile reflection

The shared shield input records the trigger's nonzero-to-press timing in
deterministic fighter state. NTSC 1.02 PlCo.dat has a two-frame powershield
input window at common offset `+0x2A0`. A full digital trigger press inside that
window starts the GuardReflect timer. The input age and reflector timer are
copied and compared by replay; the input row retains its press edge and trigger
activity.

The retail reflector counter at common `+0x2A4` starts at 1. A bounded
execution of the original callback `0x80093BC0` left the reflector flag set
after callback one (counter 0) and cleared it during callback two (counter
-1). Smashcraft keeps two active contact samples from the shield press: the
entry tick and the tick after the first callback. This observed timer result is
recorded in
`smashcraft:docs/smash-melee-reference/retail-powershield-clock.json`.

Smashcraft fighters use an explicitly authored shield circle centered at local
offset `(0, 45)` with base radius `60` world units. These are original
Smashcraft tuning values, not copied Melee character geometry. Its current
reflector radius is `base radius × shieldSizeMultiplier × 0.75`; `0.75` is the
common reflector-size factor at `+0x2A8`. Projectile travel is tested against
the swept circle in the simulation's x/z plane. Reflection transfers ownership
to the defender and applies the observed common damage multiplier `0.5` and
speed multiplier `0.699999988079071`. It keeps the source projectile's authored
visual family when ownership changes and carries that identity through replay.
An accepted reflection increments a separate deterministic presentation serial;
the existing impact journal uses it to emit one shield-success flash, separate
from an ordinary blocked-hit flash.

The original entry routine's complete input call path and native timing have
not been executed here. The two-frame input age follows the observed common
integer and the reference ABI description. Projectile behavior is covered by
focused deterministic simulation tests, not by a native Melee or Warcraft
collision trace. Native tuning of the authored shield center/radius remains
open. Powershield effects on ordinary melee shield contacts, ordinary shield
pokes/tilt, and the secondary counter at `+0x2B4` remain unimplemented or
unverified; ordinary melee contacts keep the existing shield path.

The numerical probe
`smashcraft:tools/physics-probe/observe-powershield-clock.mjs` loads the retail
files from private storage and keeps its original-containing ELF and outputs
under `~/.local/share/smashcraft-melee-reference/powershield-clock-runner`.
The tool uses symbol/ABI addresses only and does not publish executable bytes
or decompiled implementation.
