# Stage lighting on 3.0 under Wine: measured, 8 October 2026

Two measurements for smashcraft#170 box 1. No native client was started for
this record; it reads captures that already existed and stock files.

## 1. Authored stage light against stock light, on native captures

Source captures: the #170 lighting batch that ran on offline LAN pair 2 on
7 Oct 2026, 16:11–16:22 +0800 (`bun wisp accept --pair 2 --only "170-*"`,
map `composition-integrated.w3x` built 14:28 the same day, which contains the
stage lights of ceab6971). The pixels stay private in
~/.local/share/smashcraft-stage-design-178/native-pair2/lighting-170/.
The run's report was 27 checks: 0 pass, 9 fail (chat refused while a client
reported no menu page), 18 needs-look. Four stages have a complete
stock / mask / stage triple on both clients: 2, 3, 4 and 13. The stage light
values of those four are unchanged on main since the capture (only stages 6
and 7 were added, in ccb5857b).

Each check paused the same quick match (three human fighters, `-dev view
off`), captured with stock lighting (`-dev lighting stock`: DNCLordaeron
terrain and unit models at the frozen noon), then a fighter mask with
`-dev backdrop off` after 13 s, then the same pose with `-dev lighting stage`.
Sky, fog, camera and pose are identical across the pair. Frames are
1320×760 PPM. The graphics mode was not recorded in the run directory; pair
2's War3Preferences read `hd=1` (Reforged), `lightingquality=2`,
`texquality=1`, 1280×720 when inspected later, at its 23:44 write.

Measured on 8 Oct with
`bun tools/stage/contrast.ts MASK STOCK STAGE` (the tool as of 743ea2bf).
Every mask's empty background read rgb(4,4,4); fighters 11,078–12,807 px in
2–3 blobs.

| Stage | Client | fighter L* stock → stage | ring L* stock → stage | abs ΔL stock → stage | ΔE00 stock → stage |
| --- | --- | --- | --- | --- | --- |
| 2 Frozen Throne | a | 23.9 → 36.1 | 54.4 → 58.6 | 30.6 → 22.6 | 35.2 → 33.0 |
| 2 Frozen Throne | b | 25.8 → 38.5 | 51.8 → 56.5 | 26.0 → 18.1 | 30.9 → 30.1 |
| 3 Durotar | a | 27.5 → 39.4 | 53.4 → 53.7 | 25.9 → 14.3 | 31.9 → 28.6 |
| 3 Durotar | b | 26.9 → 38.5 | 55.0 → 55.0 | 28.1 → 16.6 | 33.3 → 29.8 |
| 4 Naxxramas | a | 34.3 → 43.5 | 31.2 → 31.4 | 3.1 → 12.1 | 19.7 → 22.0 |
| 4 Naxxramas | b | 34.9 → 43.2 | 32.8 → 32.9 | 2.1 → 10.2 | 18.7 → 20.6 |
| 13 Ahn'Qiraj | a | 28.6 → 39.9 | 62.2 → 62.8 | 33.5 → 22.9 | 39.3 → 34.8 |
| 13 Ahn'Qiraj | b | 33.9 → 44.7 | 48.5 → 48.5 | 14.6 → 3.8 | 25.2 → 25.6 |

Whole-frame L* moved by at most 0.5 between stock and stage on any pair.

## 2. The stock lighting model each graphics mode loads

Extracted on 8 Oct from a pool client's storage, build 3.0.1.24342
(`.build.info` of ~/.local/share/wisp/lan/isolated24342-20261008/clients/lan0a),
with the CascLib extractor built from smashcraft:tools/animations/casc-extract.cpp.
`Environment\DNC\DNCLordaeron\DNCLordaeronUnit\DNCLordaeronUnit.mdx`:

| CASC path prefix | Bytes | MDX version |
| --- | --- | --- |
| `war3.w3mod:` (Classic) | 1,496 | 1800 |
| `war3.w3mod:_hd.w3mod:` (Reforged) | 1,056 | 1800 |
| `war3.w3mod:_de.w3mod:` (Definitive) | 1,188 | 1800 |

war3-model 4.0.1 rejects all three light records, the known version-1800
light layout. The animated tracks were read by scanning the light chunk for
their tags (colours converted from the stored blue-first order to RGB):

- Classic: key colour `KLAC` white (0.996) from frame 15,333 to 43,700 of
  333–60,333; ambient `KLBC` (0.840, 0.840, 0.980) over the same span; night
  key and fill (0.313, 0.533, 0.799). Intensities are static, not decoded.
- Reforged: key colour `KLAC` (0.839, 0.839, 0.980) from 18,367 to 46,700 of
  3,367–63,367, key intensity `KLAI` 0.920 over that span; no ambient track
  (static, not decoded).
- Definitive: key colour `KLAC` (1.000, 1.000, 1.000) at 31,115, intensity
  `KLAI` 1.000 at 33,918; no ambient track.

So the three modes load three different stock lighting models from the one
path. An imported model (`war3mapImported\StageLight-….mdx`) has no `_hd` or
`_de` copy and loads the same file in every mode.
