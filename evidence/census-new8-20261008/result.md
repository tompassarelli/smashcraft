# Newly selectable fighter spike census

PASS: 8 fighters, 312 original entries, 0 entries above the unchanged 2 ms limit.

Measured source: e7d96cf43769c3f8f04299de819d1a936cd4294f, including numeric pin 7ea39f32. [Hosted run 37678697036](https://github.com/tompassarelli/smashcraft/actions/runs/37678697036) completed all 8 jobs successfully in 2.9 minutes from dispatch; complete wrapper 197.529 s.

The original 39 move/special/follow-up cases per fighter ran in the playable map with calibrated Lua32 instruction/native/allocation costs. The original median of the 30 standing baseline frames and worst-frame comparison are unchanged. Every move still watches 150 frames, including its original presentation effects. Accepted 13-fighter and stage-hazard evidence was left unchanged; no old cases were rerun.

| Fighter | Entries | Largest-rise entry | Rise above baseline (ms) |
| --- | ---: | --- | ---: |
| cairne-bloodhoof | 39 | side special, again | 0.819997 |
| chen-stormstout | 39 | side special, again | 0.840126 |
| goblin-tinker | 39 | side special, again | 0.917936 |
| jaina-proudmoore | 39 | side special, then attack | 1.131844 |
| kael'thas-sunstrider | 39 | side special, again | 1.043221 |
| peon | 39 | side special, then attack | 0.808350 |
| sylvanas-windrunner | 39 | dash attack | 0.860316 |
| thrall | 39 | side special, again | 0.822158 |

Largest rise: Jaina side special, then attack, 1.131844230 ms; baseline 4.508771396 ms, worst 5.640615626 ms at frame +21. No source repair was needed.

Exact command from ts/:

```bash
bun wisp farm perf "census --fighter thrall --functions" "census --fighter jaina-proudmoore --functions" "census --fighter sylvanas-windrunner --functions" "census --fighter cairne-bloodhoof --functions" "census --fighter chen-stormstout --functions" "census --fighter peon --functions" "census --fighter goblin-tinker --functions" "census --fighter kael'thas-sunstrider --functions" --ref e7d96cf43769c3f8f04299de819d1a936cd4294f --out build/census-new8-e7d96cf4
```

Per-job summaries and original gzipped frame samples are retained beside result.json and all 312 parsed entries. Read the raw samples with the existing censusEntries parser after decompression; the performance assertions remain in ts/scripts/wisp/perfCensus.ts.
