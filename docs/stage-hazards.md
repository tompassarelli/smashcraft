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
5 world units per frame, leaning up to 15 degrees toward center. The main
deck has no wall or ceiling, matching GrOk.dat's floor-only collision, and is
drawn as a shallow slab. The classic Warcraft TNT barrel shows the cannon;
it turns red with a countdown during the shot, and a held player sees the
fire controls and timeout warning. It can assist recovery but changes the
route and timing; predictable hazards alone do not establish competitive
legality (smashcraft:docs/design/stages.md).

The stage menu's **Hazards: On/Off** button is synchronized match state.
Off holds all moving platforms at their frame-zero rest poses and removes
wind, the cannon, and Blackrock's lava. The setting is copied and hashed with
replays. Gryphon Aerie (11) and Ahn'Qiraj (13) expose the carried loop and
lift above; neither deals damage. One complete neutral ride (920 and 420
frames) retains all three stocks at 0% and replays to its full checksum.

Blackrock's two molten ends cover x −600…−410 and 410…600 on its main
floor. Contact deals 12% fire damage and base knockback 100 with zero growth,
straight up, through ordinary body-hit resolution: 40 frames of hitstun,
ordinary hitlag, action interruption, damage reactions and DI. Percent and
weight do not increase the launch; ordinary defensive context still applies.
Shields do not protect feet in lava; invincibility and dodge intangibility do.
Its two animated surface strips are exactly the contact width. The stage's
centre and raised platform are safe. No extra cooldown state is needed:
hitlag prevents a second hit while frozen and the upward launch leaves it.
