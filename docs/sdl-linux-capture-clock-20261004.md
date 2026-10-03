# Linux SDL capture-clock boundary

This is source evidence, not a measured physical latency result. The companion
uses sdl3 0.20.0 and sdl3-src 3.4.16, locked archive checksum
5bfd475a15a4679b94f6579aed7d52c69f3e04d80e6707712373f12903a2ef91.
SDL's bundled source is under the zlib license (Sam Lantinga, 1997–2026).
Only behavioral facts are recorded here; no SDL code is copied or adapted.

## What the selected Linux path does

The observed attached Xbox One S is exposed through /dev/input/event1. In
SDL3:src/joystick/linux/SDL_sysjoystick.c, HandleInputEvents reads queued kernel
events and supplies SDL_EVDEV_GetEventTimestamp(event) for button, axis and hat
events. It does not replace each queued event timestamp with dequeue time.

SDL3:src/core/linux/SDL_evdev.c, SDL_EVDEV_GetEventTimestamp, converts the kernel
seconds/microseconds to nanoseconds. On its first invocation it sets an offset
from that first kernel event to the current SDL_GetTicksNS value. Later it maps
event timestamps with that offset. If a mapped timestamp lies in the future,
it reduces the offset and clamps the mapped time to now.

Therefore the timestamp is expressed in SDL's clock domain but its initial
alignment is based on a received event. It is not independently established as
the exact occurrence time relative to SDL initialization. A first-read backlog
could enter that calibration; the effect on this helper is still unmeasured.
Relative kernel intervals may survive while absolute frame assignment remains
wrong. A warmed retention test alone does not close that question.

The same source handles SYN_DROPPED by ignoring events until SYN_REPORT and
resampling current state. That cannot reconstruct edges already dropped by the
kernel. No overflow is established in our tested operating envelope; a helper
that preserves received events cannot promise recovery from unreceived ones.

The classic /dev/input/js path is different: HandleClassicEvents stamps queued
events with one current SDL_GetTicksNS value. Do not extend an evdev result to
that path, HIDAPI, Windows or macOS. Source inspection does not establish which
other adapters choose which path at runtime.

SDL's Unix performance clock chooses CLOCK_MONOTONIC_RAW when available;
otherwise CLOCK_MONOTONIC. Python producer monotonic timestamps, Rust Instant,
kernel input timestamps and SDL event times must retain their clock labels.
Do not subtract their absolute values without an explicit alignment and error
bound. A nanosecond field does not imply nanosecond accuracy: evdev's delivered
timeval has microsecond resolution.

## Decisive experiment and intervention boundary

Use a dedicated virtual joystick, observation-only helper, independent stimulus
log and exact selected SDL identity. Compare baseline 4–5 ms taps/axis excursions
with a verified 250 ms helper stop. Run warmed and fresh-helper first-stimulus
cases separately. Verify edge counts/order and timestamp intervals, and report
any alignment uncertainty rather than inferring an absolute latency.

Symptom to investigate: intact event IDs/edges but timestamps aligned to a late
first read. Cause confidence: the calibration rule is established by source;
its material effect on the current helper is inferred until measured. Category:
library clock conversion behavior, not a Warcraft or Battle.net constraint.
If reproduced, repair or calibrate the owning capture-clock boundary using an
independent clock observation; do not retarget events to dequeue time. Any
chosen intervention must be checked on the actual intended backend and remain
separate from map common-frame alignment and native presentation acceptance.
