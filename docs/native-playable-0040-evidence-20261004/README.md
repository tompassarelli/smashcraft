# Native playable 0.0.40 evidence

Candidate and exact limits: wc3-melee:docs/smashcraft-delivery-state-20261004.md.
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
No new response benchmark or physical-controller trial was performed.
