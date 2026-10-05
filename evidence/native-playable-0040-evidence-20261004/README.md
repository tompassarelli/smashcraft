# Native playable 0.0.40 evidence

Candidate and exact limits: wc3-melee:evidence/smashcraft-delivery-state-20261004.md.
Two retained private-desktop clients joined [TEST]sc-play40, slots 0/1 with
slots 2/3 closed. Input was XTEST on their own displays, keyboard source.

- a-ready.txt / b-ready.txt: build, bindings and participant masks.
- a-idle.txt / b-idle.txt: initial advancing-frame trace.
- a-actions.txt / b-actions.txt: movement and default short synthetic taps;
  not every injected action was registered.
- a-held-actions.txt / b-held-actions.txt: explicit 100 ms action holds,
  recorded attacks, damage/launch, specials, jumps and rollback corrections.

Each trace pair has six matching recorded confirmed frame/checksum pairs;
all report dropped 0. This does not prove every-frame equality or hardware
latency. The subsequent pause/resume, result/readiness and second-match start
were observed through fresh native compositor captures and bounded OCR.
The later evidence extends this checkpoint:

- wc3-melee:evidence/native-playable-0040-evidence-20261004/response/: 12
  recovery-separated shield presses entered predicted shield in their capture
  callback, before confirmation. This measures logical response after capture,
  not hardware-to-pixel latency. The earlier rapid-repeat run is labeled
  confounded by shield recovery and excluded from the latency conclusion.
- wc3-melee:evidence/native-playable-0040-evidence-20261004/controller-mapper/:
  current SDL3 digital mapper, one virtual Linux pad, movement and three attacks
  in actual two-client play; six additional matching confirmed checkpoints.
  A virtual device establishes the software path, not physical pad timing.

The previously responsive digital controller-to-keyboard path is separate
from experimental continuous-analog FileIO. FileIO delays do not establish
a regression in that digital path. No physical-controller trial was performed.
