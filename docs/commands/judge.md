# Judge

- Capture judge: `bun wisp judge DIR --rubric FILE` writes `DIR/judge.json` with each case and measurement line, checks drawn frame stamps, and lists only crops near a rubric threshold for model inspection. Rubric format and #82 reference: `docs/capture-judge.md`, `ts/test/native/rubrics/82-f9d0fbf3.json`.
