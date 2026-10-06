# Melee's gameplay camera and ours

How Melee's standard match camera moves, the constants it reads, and how
smashcraft:ts/src/game/sim/matchCamera.ts follows it. Stage camera limits,
blast zones and the off-screen magnifier are in smashcraft:docs/physics.md,
"Camera limits, off-screen damage and blast zones".

Sources: melee:src/melee/cm/camera.c and melee:src/melee/ft/ftcamera.c
(doldecomp/melee); the constant values come from the owner's GALE01 revision 2
`main.dol` and stage files through the private reader
~/.local/share/smashcraft-melee-reference/camera-facts.ts. Only the numbers
are kept here.

## Per frame (`Camera_8002B3D4`)

1. **Subject boxes.** Each fighter's camera callback
   (`ftCamera_UpdateCameraBox`, run by `Fighter_procCamera`) sets the subject
   position to the fighter's `cur_pos` plus ftData +0x3C's y offset (10) and
   its target extents: 22 forward times the stage's fixed zoom (+0x24 = 1.5),
   9 back, 16 up, 9 down (Fox, Falco and Captain Falcon alike). Turning
   around swaps the forward and back extents.
2. **Extent easing** (`Camera_800293E0`): each extent moves toward its target
   by at most 0.5 Melee units a frame. A turnaround therefore slides the box
   over about 48 frames instead of jumping.
3. **Bounds** (`Camera_8002958C`): each extent is scaled by the stage's track
   ratio (grGroundParam +0x20 = 1.5) times cm_803BCB9C's subject weight
   (1.5, 1.32, 1.16, 1.0 for one to four subjects); the position and the four
   extent points are clamped into the stage's camera range (bottom at least
   ground + 1). The union's bottom then drops by 10 + 390 × clamp((|eye z| −
   80) / 4920, 0, 1).
4. **Field of view** eases from 30° toward cm_803BCCA0 +0x40 = 38° by +0x44 =
   0.1 a frame.
5. **Fit** (`Camera_80029CF8`): the union is fitted vertically between the
   tilted top and bottom rays and horizontally at the view aspect 1.2173333
   (cm_803BCB64); the eye distance is the larger of the two, clamped to the
   stage's zoom range (grGroundParam +0xC = 83, +0x10 = 1000 on Final
   Destination). The vertical tilt is −10° (pan, +0x14) + clamp(−(base − 30) ×
   0.05°, −7°, 5°), base being the union's centre height lowered by up to
   0.0682 of it (cm_803BCCA0 +0x1C/+0x20, between spreads +0x24 = 60 and +0x28
   = 120); the horizontal angle is clamp(−centre x × 0.05°, ±17.5°).
6. **Corner limits** (`Camera_8002A768`): the *target* eye and interest shift
   so the view's four corners stay inside the camera range, by half of both
   overlaps when opposite sides overflow. The limit is applied before easing.
7. **Easing** (`Camera_80029AAC`, `Camera_80029C88`): the interest moves
   toward its target by clamp(speed × track smooth, 0.0001, 1) a frame, where
   speed is cm_803BCCA0 +0x2C = 0.05 below a spread of +0x34 = 120, +0x30 =
   0.1 above +0x38 = 900 and linear between, spread is the larger side of the
   bounds, and track smooth is grGroundParam +0x28 = 1.8: 9% to 18% a frame.
   The eye (pan and zoom alike) moves by +0x3C = 0.15 × 1.8 = 27% a frame.
   Zooming in and out use the same rate; there is no dead zone or hysteresis.
8. **Quakes** (`Camera_UpdateQuakes`, `Camera_ApplyQuake`) offset the view on
   requested shakes, scaled 1.0 near and 0.6 far (+0x54..+0x60).

**Hitlag** does not move the camera: the hitlag and grab-mash shake
(`ftCommon_8008021C`) is a drawing offset, and the subject reads `cur_pos`.
**Knockback** is followed like any movement: the damage-flight states keep
`ftCamera_UpdateCameraBox`, and the clamp in step 3 stops the box at the
camera range, so a launched fighter outruns the view and shows in the
magnifier. A star KO's callback (`ftCamera_80076320`) pins its subject to the
top blast line, scaled toward the centre.

## Smashcraft's camera

matchCamera.ts runs steps 1–7 once per match frame in deterministic state,
with Melee heights at six world units a Melee unit: box 198 forward, 54 back,
96 up, 54 down around a point 60 above the feet; extents ease by 3 × the
subject ratio a frame (0.5 Melee units before scaling); interest 9–18% and
eye 27% a frame, the follow speed reading the larger side of the subject box;
eye distance 498–6000. Corner and underside limits shape the goal before
easing (step 6), so reaching a limit eases in. Deliberate differences:

- **Side view.** Warcraft keeps yaw 90° and pitch 10°, so the fit has no tilt
  or pan angles; it centres the box. The half-angle tangent eases from 30° to
  38° like step 4.
- **16:9 and the HUD.** The fit uses the 16:9 match view, and its vertical
  fit keeps the box above the HUD (1.44 half-heights instead of 2). A
  fighter within 100 of the main deck's underside keeps it and the fighter
  above the HUD. Our view is therefore height-bound in neutral where Melee's
  4:3 view is usually width-bound, so a jump zooms out a little more than in
  Melee.
- **Final clamp.** After easing, the view is clamped into the camera range
  once more, so no eased frame ever shows past it (#80's blast-zone rule).
- **No quakes.** Hits keep the camera steady (smashcraft:docs/gameplay-design.md).

## Measuring camera movement

`bun scripts/cameraFeel.ts` (from ts/) plays six fixed computer matches and
reports, for our camera and for a reference port of steps 1–7 driven by the
same fighter paths, the pan and zoom per frame as fractions of the view,
the change of that velocity per frame, frames that jump more than 3% (pan) or
6% (zoom), travel a second and direction reversals a second. On these
matches before #110 our camera matched Melee's in typical movement (pan p95
1.5% vs 1.4% of the view a frame, zoom p95 3.2% vs 2.5%) but snapped when a
limit or the deck underside was reached (up to 24% of the view in one frame
vs Melee's 7%), because those limits clamped the eased view instead of its
goal.
