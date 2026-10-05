# Linux SDL controller event retention — 2026-10-04

The companion retained every commanded button edge across a verified helper
stop, but its SDL capture timestamps failed for the fresh helper's first input
batch. A warm helper preserved the same tap intervals through a 250 ms stop.
This confirms the queue-collapse repair for this Linux virtual-device path and
exposes a timestamp-initialization defect that blocks using those cold capture
times as simulation-frame evidence.

The test ran source commit `f052364e0bafd1b7da36cdf35c2b1f3c0f621e77`, built
with the repository's pinned Rust 1.96.1 and SDL 3.4.16. The helper was started
in observation-only mode with `--gamepad 2`; `--emit` was not used. SDL named
the virtual uinput device “Xbox 360 Controller” (VID 045e/PID 028e), while the
physical Xbox One S remained a separate SDL device and was not manipulated.
The test wrote only through `/dev/uinput`, read its corresponding evdev node,
and did not open a keyboard output device or Warcraft III.
The runtime was Linux x86_64, kernel 6.18.51; the helper executable SHA-256 was
`07e9833874e73a7495172db023ef9050fa6270119392efb09714ab2ea4a457b8`.

The producer logged each input before and after its uinput write using
`CLOCK_MONOTONIC`. A second read-only evdev client explicitly selected
`CLOCK_MONOTONIC` with `EVIOCSCLOCKID`; it saw all 54 producer events in order,
with no extras. The producer-write to kernel event timestamp interval was
0.021–0.225 ms (median 0.067 ms). This checks the synthetic Linux input path;
it is not a physical controller measurement.

| Trial | Stimulus and helper result | Producer duration | SDL `capture_ns` duration |
| --- | --- | ---: | ---: |
| Fresh helper, first input batch while stopped | 5 taps; all 10 button edges and all 10 Attack transitions retained in order. Helper was confirmed in `/proc` state `T` for 250.247 ms. | 4.587–4.691 ms (median 4.620 ms) | 0–0.010 ms (median 0.002 ms) |
| Warm helper baseline | 12 taps; 24 input edges and 24 Attack transitions retained in exact order. | 4.643–4.788 ms (median 4.671 ms) | 4.184–4.661 ms (median 4.633 ms) |
| Warm helper axis baseline | 5 right-and-center excursions; all 10 commanded events and 10 Right transitions appeared in order. One additional neutral `LeftX=0` SDL event appeared before the first excursion; it was absent from the evdev log and caused no transition. | 16.108–16.311 ms (median 16.187 ms) | 16.129–16.187 ms (median 16.181 ms) |
| Warm helper, input while stopped | 5 taps; all 10 button edges and Attack transitions retained in exact order. Helper was confirmed in `/proc` state `T` for 250.314 ms. | 4.567–4.650 ms (median 4.628 ms) | 4.594–4.659 ms (median 4.628 ms) |

Both helpers received `SIGCONT`, exited normally with status 0 after `SIGINT`,
and were reaped. The temporary `/dev/input/event2` virtual device disappeared
when the producer destroyed it. No live test process or virtual controller
remains.

The cold result is the decisive caveat: five taps separated by about 4.6 ms
survived as logical edges, but their first-read SDL timestamps clustered within
15 microseconds. Warm capture intervals followed the producer intervals closely
in both the active and stopped batches. This pattern is consistent with SDL's
Linux evdev first-event timestamp offset calibration and future-time clamp
documented by the parent investigation; this experiment does not establish
which internal branch caused the compression. The separate neutral axis event
also remains unexplained. Keep cold `capture_ns` out of frame assignment until
the timestamp path is fixed or otherwise shown to preserve event intervals.

SDL capture timestamps and helper dequeue times have different origins.
Comparisons above use intervals within each clock only. The direct producer and
evdev observer both use `CLOCK_MONOTONIC`; their relative timing is bounded by
the producer's before/after-write measurements and kernel timestamp
microsecond precision. No cross-origin latency was calculated.

This does not exercise a physical Xbox controller, the keyboard output path,
Warcraft III map input polling, intended simulation-frame assignment, networking,
or visual/audio rollback. The scope is Linux uinput → kernel evdev → SDL event
queue → companion logical mapper.

Reproduce on Linux with Python 3 and standard library only, a writable
`/dev/uinput`, and read access to the created `/dev/input/event*` node:

```sh
/home/tom/.local/share/uv/python/cpython-3.14.2-linux-x86_64-gnu/bin/python3.14 \
  tools/controller_event_retention.py \
  --helper "$PWD/companion/target/debug/wc3-controller" \
  --output-dir "$PWD/evidence/controller-event-history-20261004/virtual-test"
```

The captured `summary.json`, exact producer `producer.jsonl`, kernel observer
`kernel-events.jsonl`, helper TSV files, stderr, and SDL enumeration are in
[`evidence/controller-event-history-20261004/virtual-test`](controller-event-history-20261004/virtual-test).
