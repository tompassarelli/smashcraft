# First visible resume frame (#206): FAIL

On 8 October 2026, clone-a and clone-d ran the unchanged
`ts/test/native/pads/206/pause-dash.pad` in the same `pause-probe` map as
`../pause-resume-206-20261008/`. All 10 input edges were on time. The native
operator retained a lossless RGB recording of clone-a's private desktop.

The first screen frame carrying the resume marker has already moved both
fighters. The original first-visible-position criterion remains open.

The existing `cameraDraw.ts` reader identified the last paused image as video
frame **3045**, response row **377**, and the first image carrying the resume
marker as video frame **3046**, response row **378**. They are 17 ms apart.
Both callback rows report simulation frame 167 and fighter positions
(-149.040, 0.000) and (240.000, 0.000), but their rendered pixels differ.

The fighters' blue overhead bars provide fixed image anchors. Every one of
their ten blue segments moved by the same amount within each bar:

| Fighter | Last paused bar left X | First resumed bar left X | Screen displacement |
| --- | --- | --- | --- |
| 0 | 176 px | 229 px | +53 px |
| 1 | 627 px | 600 px | -27 px |

Both bars occupy image Y 204–208 in the 800×600 game viewport. The first
fighter also changes from a dash pose to an upright pose. Thus matching probe
coordinates alone do not establish the first position visible after resume.
The probe stops advancing its marker when it exports; subsequent gameplay can
reach the renderer before the first image carrying that marker is drawn.

Recommendation: keep the frozen fighter and camera presentation through the
first actual draw after resume, while the simulation resumes independently.
This capture ends the current attempt; no further gameplay fix was made.

## Reproduce the observation

The full private recording is
`~/.local/state/smashcraft/pause-capture206-20261008/video/clone-a.mkv`:
1920×1080, 81.488 s, SHA-256
`166b97f0293b010099679edc0f13ab15cd644c6a3447288120dac4865943fac3`.
The game viewport, measured from its window edges, is **7,46,800,600**.

From `smashcraft:ts/`, the existing reader was run with:

```sh
bun scripts/cameraDraw.ts --video PRIVATE/clone-a.mkv \
  --pages PRIVATE/pixels-probe --out PRIVATE/pixels-drawn \
  --slot 0 --run 1 --viewport 7,46,800,600
```

It joined 2,285 recorded frames to response rows, with a 16 ms median and
17 ms p95 interval. `boundary-frames.json` retains the frames around resume;
the full timeline remains in the private `pixels-drawn` directory. Original
response pages and the input result are retained beside this report.

The two exact viewport images were extracted without changing their pixels:

```sh
ffmpeg -i PRIVATE/clone-a.mkv \
  -vf 'select=eq(n\,3045)+eq(n\,3046),crop=800:600:7:46' \
  -frames:v 2 -fps_mode passthrough PRIVATE/boundary-%d.png
```

Their SHA-256 values are:

- `boundary-1.png`: `d32c927a8dbce2683016a9998d567e6393ad26812ec6b2da7e9804a682499bcc`
- `boundary-2.png`: `b42bb4a9e0162f27cdaadd783140054298f6531f06f6547f18a6a7dedec9f2ed`

The bar positions were measured in each image's `800x60+0+180` crop with the
RGB predicate `b>0.45 && b>r*1.5 && b>g*1.1 && g>0.1`, then ImageMagick's
eight-connected components. The 20 five-pixel-tall blue segments retain their
widths and relative spacing; their X shifts are exactly +53 and -27 pixels.
