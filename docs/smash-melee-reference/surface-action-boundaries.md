# Surface recovery action boundaries

Reference revision: `0296f009f32f710495979d30772d8332af2d411a`.
These are independently described control-flow observations, not copied game
implementation. Numerical animation lengths are recorded separately in
smashcraft:docs/smash-melee-reference/retail-action-lengths.json.

Ceiling recovery, observed in melee:src/melee/ft/kinds/ftCommon/ftCo_PassiveCeil.c,
consumes its horizontal impulse event once, then transitions to ordinary fall
when animation tracks finish. Its input-interrupt callback is empty. For the
three recorded test profiles the animation length is 26 frames. Entry clocks,
track completion and collision transitions must determine the actual simulation
boundary; the length alone is not a substitute for those rules.

Wall recovery, observed in melee:src/melee/ft/kinds/ftCommon/ftCo_PassiveWall.c,
pauses animation during the startup timer. Timer expiry resumes animation and
applies the selected wall or wall-jump impulse. Wall and wall-jump animation
lengths are 26 and 40 frames respectively for the recorded profiles. After
startup, aerial actions can interrupt; ceiling recovery does not share that
interrupt policy. Wall physics applies aerial friction without ordinary steering
acceleration while this action remains active.

Wall entry sets facing opposite the passed collision direction. The passed
direction is -1 on right-wall contact and +1 on left-wall contact. Horizontal
impulse uses that facing multiplied by the signed actor attribute. Verify the
attribute sign together with the stage normal convention before changing the
impulse; outward displacement alone does not establish facing parity.

## Open production discrepancies

At primary revision `80df62d`, smashcraft:wurst/Simulation.wurst saturates the
ceiling clock at the impulse event and the wall clock at startup expiry. Neither
clock reaches the animation completion boundary. Ceiling recovery also does
not yet enforce its full input lock. Wall facing uses the outward stage normal;
its facing and signed impulse require reconciliation with the observations above.
The existing startup, impulse and protection tests do not prove these missing
action boundaries. Native recovery observation remains open.

The subsequent ceiling-boundary implementation advances the clock beyond the
impulse, enters ordinary fall at the actor's configured animation end (26 in
the recorded profiles), and blocks attacks, specials, jumps and air dodges until
that transition. Air drift remains enabled: the ceiling physics callback uses
ordinary airborne drift and gravity. Three focused CeilingTech cases passed,
including production collision entry and the 25/26 action boundary. This closes
the modeled ceiling completion/input-lock discrepancy; independent frame traces,
ECB attachment/repositioning and native execution remain unverified. Wall action
completion and interrupts still require implementation.
