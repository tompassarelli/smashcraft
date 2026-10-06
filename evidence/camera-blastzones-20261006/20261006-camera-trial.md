# Camera, magnifier and blast-zone trial — 6 October 2026

Camera candidate `704601ef` completed the required host check, unused-code
check, 851 host/logic tests, 733 Lua32 tests, acceptance tapes, numeric parity,
Melee oracle and CI checks. CI timing was advisory via `CI_TIMING=report`;
compiler correctness gates remained binding.

The default soak completed 200 matches and 183,933 frames with **0 visible-ko
and 0 offscreen-bubble findings**. Its exit status was 1 because other detectors
reported 499 hidden stock hit-particle findings (issue #95) and two
Rifleman-to-Archer lock-loop findings, in matches 92 and 95. Those combat
findings precede the newer #84/#85 repairs integrated below. This trial does
not claim a finding-free full soak.

The oracle reports 236 passes, 0 mismatches, 6 documented departures and
19 inapplicable cases. All 63 wall/ceiling and 9 offscreen rows pass. The
removed Illidan underside exceptions are ordinary passing rows now.
Acceptance tapes cover 10 tapes and 6,850 frames with 0 divergent frames in
stock and toward-zero Lua32. Numeric parity covers 2,000 cases and 22,000
results per Lua32 mode, with 0 mismatches.

Integration candidate `ec9becee` includes published main `6e77276d`, preserving
the combat escape repairs, body placement and Wisp warm-menu route. Its
compiler check and focused camera/freeze/snapshot contracts pass. The
player-view check passes 13 tests and 47,555 assertions, including actual
camera fields across **3 selectable stages × 3 supported aspect ratios ×
360 frames = 3,240 frames**. Every stage/aspect scenario includes at least
180 offscreen observations and one off-camera stock loss; camera findings
are zero. The underside contact and framing checks pass.

Raw results are retained under
`smashcraft:evidence/camera-blastzones-20261006/`: `final-gates.log`,
`final-soak.log`, `final-oracle.log`, `final-tapes.log`, `final-parity.log`,
`publication-player-view.log` and `publication-focused.log`. The earlier
`match-72.json` reproduces the corrected presented-phase detector defect.

Native capture remains the third #80 acceptance box. Use a fresh game with
this candidate, then type `-dev camera` from a startable menu state. It starts
a one-stock quick match, holds the first fighter outside the camera limits
for 180 frames, then its retained horizontal launch crosses the side KO
plane. Capture the portrait/arrow near one second and the off-camera KO
after three seconds. Native clients belong to the native-delivery owner.
