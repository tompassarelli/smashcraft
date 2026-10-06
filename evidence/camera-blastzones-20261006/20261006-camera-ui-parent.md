# Native bubble parent repair — 6 October 2026

The saved native source `e6fb992e` placed the bubble's BACKDROP and TEXT
frames under GameUI. Warcraft restricts those custom frame types to the
central 4:3 area: backdrops extending past it become narrower and text is
cut off. The documented fullscreen parent is ConsoleUIBackdrop, already
used by Smashcraft's selection and stage backgrounds.

Reference: [frame positioning, 4:3 limitation](https://www.hiveworkshop.com/threads/the-big-ui-frame-tutorial.335296/#PosFrames_Limitation43).

The two-client camera fixture at simulation frame 47, stage 0 and 16:9,
requests portrait center `(0.8211667, 0.3751698)`, size `0.046 × 0.046`,
and arrow center `(0.8531667, 0.3751698)`, size `0.027 × 0.027`.
On the saved 2560×1440 display, these convert to portrait center about
`(2291, 540)` and arrow center `(2368, 540)`. GameUI's right boundary is
2240 pixels. The portrait's requested left edge is about 2236 pixels,
leaving only four pixels inside the permitted area; the arrow lies wholly
outside it. This explains why the prior OCR and portrait matching could
not positively identify them.

The saved A capture has non-sky portrait pixels at x2237–2238, y520–523:
at y520 those are RGB `(9,9,52)` and `(136,119,95)`; the adjacent sky
at x2233–2236 and x2239–2243 is `(152,169,205)`. B also has a narrow
non-sky strip at x2235–2237 in that interval. These disk measurements
used the existing captures; no native client input or new capture occurred.

The repair parents both frames to ConsoleUIBackdrop. The camera detector
now checks this native rendering constraint alongside visibility and screen
bounds, because the headless frame recorder preserves requested coordinates
without modeling GameUI's 4:3 restriction. The selectable-stage aggregate
now enumerates the live stage catalog instead of the removed stage 1.

On the repaired source based on published `93041ecf`, the compiler check
passes. The focused player-view run passes 2 tests, 136,206 assertions:
all 9 catalog stages × 3 supported aspects × 360 frames (9,720 frames),
with no camera findings, at least 180 offscreen observations and at least
one off-camera stock loss per scenario. Raw output is
`smashcraft:evidence/camera-blastzones-20261006/ui-parent-focused.log`.
Earlier simulation, Lua32, oracle, tape and soak results remain at their
original observed scope.

Remaining native observation: **load a fresh map** containing this change
(hot reload retains the previous frame parents), then run `-dev camera`
from a startable state. At about one second, identify the Archer portrait
near `(2291, 540)` and the `>` arrow near `(2368, 540)` on a 2560×1440
client, or half those coordinates in a 1280×720 recording. After the
three-second hold, observe the fighter lose its stock while off camera,
and the portrait/arrow disappear when the result begins. Retain those
identifiable frames with the candidate revision; this completes #80's
remaining native box.
