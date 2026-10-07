# Native camera and pose divergence, 7 October 2026

Run: lane 1's native Rifleman pad script, ~/.local/state/smashcraft/pads/20261007-0734/rifleman
(native, A+B) and rifleman-headless (headless), built from Smashcraft with Wisp e74e784.
`bun wisp pad --compare` (a170b91d) showed that the native match ran the intended rows. All 40 fighter
lines are equal through frame 1046. Checksums differ from frame 148 on, and at frame 360 the native
state differs only in match.camera x/z/distance and runtime.poses[0] clipTime/rate.

Method: the native moment ending at frame 531 (start 0) was replayed in Bun. The checksums equal
native at frames 82, 120 and 285, and differ at 34, 148, 222, 240 and 348. Fighters at 360 are
field-for-field equal. For each differing native checksum, the native camera was recovered by
searching x/z/distance ulp offsets of Bun's camera until the state checksum matched:

| frame | native vs Bun (ulps) |
|---|---|
| 34 | distance +1 |
| 148 | distance +2 |
| 222, 240 | z -2, distance +2 |
| 348 | z -2 |
| 405 | x -3, z -1 |

Over frames 121-240 the camera goal is constant and only the eases run. Natively the distance ease
settles 2 ulps above Bun's, which needs a goal distance about 2 ulps higher. A search over
single-op perturbations of the standalone camera found only `vertical = (top - lower) / (1.44 *
tangent)`, perturbed upward, to reproduce frame 34. At frames 140-240 that raw quotient is
379.64484f / 0.49583164f. Its exact value is 0.39 ulp above the nearest binary32, 765.6728516.
Rounding that division away from zero at this site alone reproduces the native camera at 148,
222 and 240.

Pose: Rifleman recovery plays clip 37 (1.417 s) over 34 frames:
rate = 1.417f / f32(34 * FRAME_SECONDS), where FRAME_SECONDS = f32(0.016666667).
The native rate 2.5005886554718018 is reproduced exactly with FRAME_SECONDS = 0x1.11111p-6
(0.01666666567325592), the binary32 below the nearest 0x1.111112p-6. So Warcraft read the numeral
toward zero. Poses are not in the checksum.

The camera reads only fighters' x, z, facing and out status, plus stage constants. It reads no
resolution, aspect or real time. The local view (arenaCamera.localCamera) uses the client's aspect
only on a copy.

Fix: Wisp 6c466bb compiles f32(a / b) to the exact divideFloat32 and prints non-integer literals
as exact hexadecimal floats. Its toward-zero Lua32 also rounds `/` and decimal numerals toward zero.
`bun wisp tapes` with that Lua shows 19 tapes and 15510 frames:

- with Wisp e74e784: 15510 divergent frames, first at frame 1, kit digests from literals;
- with Wisp 6c466bb: 0 divergent frames in both Lua32s.
