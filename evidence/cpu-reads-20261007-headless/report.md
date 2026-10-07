# Prepared read and surprise response — 7 October 2026

Candidate: `cf7be04b772318ffcf8c775fe8a16b9637d2976a`.

The unchanged `ts/test/native/pads/cpu-reads.pad` passed on [hosted job 112878322590](https://github.com/tompassarelli/smashcraft/actions/runs/37646052720/job/112878322590), using the real controller helper and two headless clients:

- 2/2 original expectations: player a damage is 12.753 at frame 64 and 25.507 at frame 185.
- 28 recorded input edges, zero off their authored frame, zero written late, zero helpers stopped.
- The original script repeats seven close shields, then switches to a grab and surprise jump. Its original inputs and expectations are retained unchanged beside this report, with both client traces, the raw result and the job's verification lines.

Native parity box satisfied by headless, per wisp#19 (Tom, 7 Oct). This is the existing prepared-read/surprise script referenced by #184 and #182.

Command from the measured checkout:

```sh
bun wisp farm pads --only . --ref cf7be04b772318ffcf8c775fe8a16b9637d2976a --wait
```

The existing workflow accepts folders, so this used its top-level batch. The terminal batch result was 43/53 pad scripts passing; `cpu-reads.pad` and `cpu-reactions.pad` both passed. Other scripts' expectation failures are outside this check. Raw `pad-11` artifact: `11493499124`, downloaded without changes.

An earlier local attempt was invalid: one of 28 edges planned for frame 840 was written and landed at 841. Its moderate capacity scope released; an exclusive retry was deferred before starting. The hosted run above replaces that invalid attempt. No native client was started or controlled.

The integrated fighter-balance gate remains failed at five fighters; see [the original full-field report](../cpu-calibration-20261007/cf7be04b-field.md). #184 and #186 remain open.
