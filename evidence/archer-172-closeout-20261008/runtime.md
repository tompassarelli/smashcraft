# Archer #172 runtime closeout

The repeat-spam rework remains in current main `31c78c07`: release frame 16,
action end 24, repeat interval 30, damage 5%, speed 28, lifetime 45 and flight
height 45. No Archer source edit is needed for the runtime criterion.

The four Swift Arrow contracts and `ts/test/native/pads/archer-neutral.pad`
are byte-identical to tested source `6ebbd055`. They cover the six shot starts
at frames 2/32/62/92/122/152, a held shield taking no body damage or shieldstun,
a jump clearing the arrow, and a close-range shield grab punishing recovery.
The later shared-special facing rule and contact-height presentation do not
change the neutral-input timeline or these authored values.

Existing accepted evidence is reused:

- [Runtime trial](../archer-defile-runtime-20261007/trial.json): 39/39 contracts
  in stock and toward-zero Lua32; 20 replay tapes, 16,330 frames, zero differences
  against Bun. Evidence commit `f50661b9`, measured source `6ebbd055`.
- Same original Archer neutral input timeline: 11 headless expectations,
  32 input edges, zero off-frame or late writes, recorded in issue #172.
- [Before/after match measurements](../archer-neutral-172-20261007/README.md):
  repeat interval 8 to 30 frames, idle damage 203 to 40, held-shield body damage
  182 to zero. At 60 units the defender can shield-grab during Archer recovery.

Tom authorized the same-input headless behavior check to replace the native
LAN requirement during the client hold. The native test worker confirmed this
exact timeline is the accepted substitute; no native execution is claimed here.

Balance is a separate issue criterion. The accepted original 13-fighter field
at `82995f01` passes all fighters (Archer 43.7292%, Lich King 53.3333%), but that
frozen result does not cover the subsequently changed roster and kits. The
full current-roster 400-per-pair, 40–60% gate remains unchanged.
