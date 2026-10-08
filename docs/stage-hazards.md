# Deterministic stage hazards

The hidden test stages are wind (10), carried loop (11), barrel cannon (12),
and timed lift (13). They are exercised by controller rows, replay tapes and
the headless soak. Their schedules use the match frame, reset each match and
replay with the fighters; none uses randomness or changes its path in response
to a fighter. The loop and lift use smashcraft:ts/src/game/sim/stage.ts's moving
platform paths, with the carry and landing rules in smashcraft:docs/physics.md.

Wind follows Dream Land 64's Whispy data in Melee's GrOp.dat and
melee:src/melee/gr/groldpupupu.c: 600 calm frames, a 45-frame warning, then 274
frames pushing 0.2 Melee units per frame, alternating right and left. Its box
has Melee's inner offsets from center, outer offsets from the ledges and
height −10 to 40 Melee units above the floor. Ground dodges skip it, as in
`Fighter_procUpdate` in melee:src/melee/ft/fighter.c. The notice names the
direction before and during the gust.

The carried platform waits 60 frames at each corner, then follows a rectangle
at 3 world units per frame: x −420 to 420, z 120 to 300, a 920-frame lap.
The timed lift follows the published 420-frame lift path: wait 90, rise 120,
wait 90, sink 120. Both turn amber and show a notice for the last 30 frames
of each authored wait. These are learnable authored schedules inspired by
Randall and rising platforms; their exact retail movement is not asserted.

The cannon's catch radius, hold, shot and immunity follow Kongo Jungle 64's
GrOk.dat and melee:src/melee/gr/groldkongo.c / ft/kinds/ftCommon/ftCo_Barrel.c:
within 15 Melee units, the first eligible fighter in slot order is caught;
Attack or Special, or a 480-frame timeout, starts an 11-frame shot; the launch
deals no damage and uses base knockback 180, followed by 16 frames of catch
immunity (PlCo +0x5E0). Its swing and lean are authored: x ±760 at z −390,
5 world units per frame, leaning up to 15 degrees toward center. GrOk.dat's
main deck is floor-only, so Melee's barrel fires up through it; Blackrock's
has walls and an underside like every stage (#338), and a shot passes through
them only while it carries the fighter up: from the shot until the fighter's
feet are above the deck's top or it lands, its walls, underside and the
body push-out ignore that fighter. The flag is fighter state, saved with
rollback and the canonical state. The classic Warcraft TNT barrel shows the cannon;
it turns red with a countdown during the shot, and a held player sees the
fire controls and timeout warning. It can assist recovery but changes the
route and timing; predictable hazards alone do not establish competitive
legality (smashcraft:docs/design/stages.md).

The stage menu's **Hazards: On/Off** button is synchronized match state.
Off holds all moving platforms at their frame-zero rest poses and removes
wind, the cannon, Blackrock's lava and the Tomb of Sargeras hydra; the
Tomb's tide stays, as Ultimate keeps Jungle Japes' river. The setting is copied and hashed with
replays. Gryphon Aerie (11) and Ahn'Qiraj (13) expose the carried loop and
lift above; neither deals damage. One complete neutral ride (920 and 420
frames) retains all three stocks at 0% and replays to its full checksum.

Blackrock's lava is one patch, 140 wide, centred 180 to one side of the
stage's centre (x 110…250, or −250…−110), so it is 350 from the near ledge:
more than two of any fighter's initial dashes, so it shapes neutral rather
than edge-guards. It follows the stage clock (smashcraft:ts/src/game/sim/lava.ts):
a 2,400-frame cycle of a right turn then a left turn, each 300 calm frames,
300 warning frames and 600 erupting frames. The right patch warns on frames
301–600 and erupts on 601–1,200; the left warns on 1,501–1,800 and erupts on
1,801–2,400. During the warning the patch's own spot glows dark red, bubbling
and brightening, and the notice reads "Lava erupts on the right (left) in N
frames."; while it erupts the notice reads "Lava on the right (left)." Hazards
off keep it calm. Contact while it erupts deals 12% fire damage and base
knockback 100 with zero growth, straight up, through ordinary body-hit
resolution: 40 frames of hitstun, ordinary hitlag, action interruption,
damage reactions and DI. Percent and weight do not increase the launch;
ordinary defensive context still applies. Shields do not protect feet in
lava; invincibility and dodge intangibility do. Its animated surface strip is
exactly the contact width. The centre, both ledges and the raised platform
are safe. No extra cooldown state is needed: hitlag prevents a second hit
while frozen and the upward launch leaves it.

## The Tomb of Sargeras sea (#277)

smashcraft:docs/design/water-stage.md has the references and the design;
smashcraft:ts/src/game/sim/stageHazards.ts (tide) and
smashcraft:ts/src/game/sim/water.ts (floating, swimming, the water jump and
the hydra) implement it, pinned by smashcraft:ts/src/game/sim/water.tests.ts.

- **The sea** fills the stage from blast line to blast line (±1,562.6) below
  its surface at z −360, 60 below the deck's deepest underside. A position
  at or below the surface is in the water.
- **The tide** runs on a 1,200-frame cycle of the match's own frame, not the
  stage clock, so it runs with hazards off: 4.8 world units a frame
  (0.8 Melee units) right on frames 1–540, slack 541–600, left 601–1,140,
  slack 1,141–1,200. During each slack the notice reads "Tide turns left
  (right) in N frames." The push is a position offset after the fighter's
  own motion, the same `moveMeleeX` offset the wind uses, applied in the
  match step's water pass after the fighters move, so hitlag and hitstun
  don't stop it. From the ledge a floating fighter passes the side blast
  line in 201 frames, from under the deck's centre in 326.
- **Floating.** Out of hitstun, a fighter in the water gains 0.6 a frame
  upward in place of gravity (at most 18) and floats at the surface; a
  helpless fighter recovers its actions there, as at a ledge. In hitstun it
  falls as in the air, so spikes and the hydra still carry it through the
  bottom blast line.
- **Swimming.** Left and right swim at up to 3.6 a frame, gaining 0.3;
  against the tide that still loses 1.2 a frame.
- **The water jump.** Jump in the water is the full ground jump with no
  squat, scaled by 0.91 for each re-entry since the fighter last landed (at
  most four times, 0.686), and keeps the double jump and air dodge. Every
  selectable fighter's water jump and double jump from the surface reach
  above the deck.
- **Water state** is per fighter and saved in rollback snapshots and the
  canonical state: in the water, frames there since landing (paused out of
  it, reset on landing), entries since landing, and the hydra's tell frame
  and mark. A lost stock clears it.
- **The hydra.** On a fighter's 150th frame in the water its 45-frame tell
  starts at the fighter's x; the mark then drifts with the tide at the
  current's speed and never steers. On the tell's frame 46 (the 195th in the
  water if the fighter stayed) every fighter within 90 of the mark, from
  the surface to 150 above it, takes 15% and a straight-down launch of base
  knockback 120 with no growth, through the body-hit batch the lava uses:
  shields don't help, invincibility and dodge intangibility do. Then the
  hydra submerges and that fighter's count restarts. Jumping out or
  swimming against the tide through the tell escapes it.
- **Cost.** Off the Tomb the water pass and the hydra are two early returns
  per frame and the motion step one stage check per fighter. On the Tomb,
  Bun measured 0.8 µs a frame for two fighters in the sea (water pass and
  hydra check together, 1,000,000 frames).
