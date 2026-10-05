# Native controller/chat check — 5 October 2026

## Accepted result

**PASS: shared pause, native chat, controller suppression, neutral rearm and
fresh original-frame input on both clients across a match and rematch.** The
same persistent helpers handled both games. Chat opened for player 1 in the
first match and player 2 in the second; an unsent marker remained intact while
controller actions were suppressed, and Escape restored the receiver. The
opponent could not resume while chat was open.

| Observation | Match 1 / player 1 chats | Match 2 / player 2 chats |
| --- | --- | --- |
| Shared pause/resume frontier | 261 | 277 |
| Shield neutralized before pause | 258 | 274 |
| Confirmed shield-on / shield-off samples | 44 / 57 | 36 / 59 |
| Fresh tap original and applied frame | 306 | 326 |
| Final confirmed frame, both clients | 832 | 867 |
| Final checksum, both clients | 504708:620050 | 607490:597200 |

All six eligible attacks applied exactly once on each client: 12 applications,
zero missing/extra/moved actions, no native input failure or trace drops. Both
clients reached stationary matching results. Presses during chat and the button
held through Escape/resume stayed suppressed until neutral; the subsequent
fresh tap retained its independently calculated frame. The unchanged
wc3-melee:tools/journal-chat-result.py assertions passed.

Candidate source is `e068b9a`. Exact map/helper hashes are in
wc3-melee:evidence/controller-chat-native-20261005/candidate.json; the reconciled
result and authored producer/kernel/helper/native records are under
wc3-melee:evidence/controller-chat-native-20261005/passed. Original compositor
captures remain in wc3-melee:build/native-controller-chat-trace-r1-20261005;
the retained metadata points to those images. No chat message was submitted.
Reproduce from initial character selection with the matching candidate/helper,
wc3-melee:tools/journal-match-capture.py `--controller-menus --controller-chat`,
then wc3-melee:tools/journal-chat-result.py on the output directory.

This accepts the bounded virtual-Linux-pad chat behavior, not physical timing,
cross-machine clocks or Windows/macOS; playable 0.0.41 remains the preserved
human-session checkpoint. Both helpers were reaped and authenticated clients
were retained at the second results screen. No repeat is needed for this claim.

## Native visibility repair

The native visibility repair preceded the accepted journey above. In
`chat-visibility2-20261005`,
2,674 cached controls were observed before/open/closed on both clients. Only
the chatting client's native subtree at `GAME_UI` child 290 changed visibility.
Its unnamed two-child container has a label and a four-child editbox; the latter's
first child has five leaves. This signature was unique in the captured tree.
The receiver caches that structure rather than relying on child index 290.

The corrected `chat-recovery-20261005` map has SHA256
`bfefc52d286bcb2cea8f71ceb5c67ef983a3c5d84d970d52aadd986061bc1d0c`.
The existing native journey established shared pause at frame 309, drained
157 records, observed chat and received `chatState=3`. Escape restored
`chatState=0` and the receiver. The fixture stopped before chat-period controls
because full-screen OCR split its marker; a single-line crop of the retained
image reads the complete `UNSENTCHATPROBE`. That observation step is corrected
without changing the map or weakening the exact marker check.

Observed subtree, diagnostic source and gameplay receipts are retained under
wc3-melee:evidence/controller-chat-native-20261005/visibility. Full captures remain
under wc3-melee:build/native-chat-visibility-r2-20261005 and
wc3-melee:build/native-controller-chat-recovery-r1-20261005. The visibility
diagnostic map hash is `e48bd86dc10d20a4cef7523e32a2381efce85aef35bb25825a306a4a5d967d55`.
An earlier diagnostic traversed an ancestor with no exposed children; its
two-frame output did not inspect `GAME_UI` and supplies no negative conclusion.

## Observer repairs during acceptance

The `chat-recovery` R2 journey completed two matches, but its pre-chat capture
and OCR held shield from frame 61 until focus release at 299/318. Full-strength
shield has 60 energy and drains 0.28 per active tick; it exhausted around frame
276, before the intended release. That trial could not establish release of a
live shield. The fixture now captures the initial screen before pressing shield.
Both marker and stimulus images use the same single-line native-entry crop;
R2's original OCR metadata remains preserved alongside retained-image reanalysis.

R3 then observed the live shield and its release: 42/36 held samples and 45/48
released samples on the two chatting clients. Its fixed 1,200-callback action
trace, however, ended during the chat pause at confirmed frames 262/281. Fresh
taps assigned to 310/329 occurred outside that recording. The missing action
rows are therefore an observation gap, not proof of lost input. The trace now
retains its original callback counter and wall clock while excluding shared
pause duration from its finishing budget. Both native trace drivers accept the
resulting longer callback count, still requiring a complete trace of at least
1,200 callbacks. No attack assertion or gameplay rule was relaxed.

The retained failed corpora are
wc3-melee:build/native-controller-chat-recovery-r2-20261005 and
wc3-melee:build/native-controller-chat-recovery-r3-20261005. The repaired trace
candidate is `chat-trace-20261005`; its build passed with zero errors and the
same 27 warnings. The helper and gameplay code are unchanged.

## Prior handoff failure

The unreleased `chat-handoff-20261005` candidate (`50c6d9a`) established pause
frame 314 and drained all 160 records. The helper stopped output and pressed
Return. Masked OCR independently read `To Allies:`. The map's selected unnamed
frame nevertheless remained invisible, leaving receipt `chatState=2` instead
of 3. The fixture failed before typing or chat-period controls, then pressed
Escape and reaped both helpers. No chat message was submitted. No closing,
neutral rearm, resume or rematch acceptance is claimed for this repair.

The earlier `chat-pause-20261005` candidate also opened paused chat, but its
unmasked OCR missed the gold label and `ChatEditBar` lookup returned null.
Reprocessing the retained capture established opening. A native frame-tree
inspection then found unnamed controls; selecting one by its two-child shape
returned a handle but did not identify the actual chat entry. Do not repeat
that structural guess or treat a non-null handle as proof. The next owning
step is a before/open/closed visibility comparison of cached native controls,
using observed chat UI as the independent reference.

The failed journey, receipt, helper logs, OCR and exact hashes are retained in
wc3-melee:evidence/controller-chat-native-20261005/handoff-failure. Original captures
remain at wc3-melee:build/native-controller-chat-handoff-r1-20261005. At that checkpoint both games
remained signed in at the paused diagnostic match, with no helper running.
Playable 0.0.41 and its accepted reconnect helper are unchanged and preserved.

## Original 0.0.41 failure

**FAIL at chat opening; chat-period input behavior was not reached.** The
unchanged playable 0.0.41 and reconnect helper completed controller selection
and started the two-client match. With controller gameplay active, Enter did
not produce the native `All:`/`Allies:` entry in any of three retained captures.
The fixture stopped before typing its marker or applying chat-period controls;
it did not send a chat message. No chat suppression, recovery or rematch pass
is claimed. This is an open #18/#26 defect, not a reversal of the accepted
combat/rematch and reconnect results.

Before the fixture, the same signed-in client at character selection showed
`To Allies: UNSENTCHATPROBE` after Enter and typing. Escape removed the unsent
marker. After the failed fixture, a 100 ms Return press during the still-active
match again showed no chat entry. These manual observations are context;
the retained automated failure is the reproducible evidence below.

## Candidate and reproduction

Map source `d12a2bf`, build `playable-0041`, SHA256
`25493bacd040fc08b380df0589f31631055f9032fd84671c0c5d9f639200a533`.
Reconnect helper source `007b5b8`, SHA256
`b5ff04432803aaba596dae08b1ffa108dbae8541cfdba68fab1c4b947786c20a`.
Fixture source `afd7b0e`. Startup/files: wc3-melee:docs/playable-0041.md.

From a fresh character-selection screen, use the existing two-client session
arguments with the reconnect helper, private XTEST, native Python and Tesseract:

```sh
python ~/code/wc3-melee/worktrees/playable-integration-20261005/tools/journal-match-capture.py \
  --session /absolute/session.json --build playable-0041 \
  --out /absolute/new-trial --controller-menus --controller-chat
```

The fixture
uses one persistent helper per virtual Linux pad, observes the actual native
chat UI before any chat stimulus, and cancels with Escape on failure.
Its proposed suppression/rearm reconciler is not an accepted product guarantee.
A repaired candidate must first pass opening and then the chosen chat policy;
a passing parser or absent OCR marker alone is insufficient.

## Retained evidence and next repair

`events.json` contains START publications, the Enter/Escape times and each
capture/OCR observation. The adjacent OCR, producer/kernel records and helper
logs preserve the first failed boundary. Original compositor images remain at
wc3-melee:build/native-controller-chat-baseline-20261005; no image pass is claimed.
Both helpers were stopped/reaped by the failed driver; both signed-in games
remain available. The driver exited 1.

The current receiver acquires an EDITBOX's focus for the full match, while the
helper's eligibility checks only the game window. Those are the owning source
seams to investigate; this run does not prove the exact native event ordering
or that simply releasing the editbox would safely route controller packets.
Do not reopen transport comparisons or rerun the accepted reconnect corpus.
Do not call chat fixed by merely changing the test to skip it.
