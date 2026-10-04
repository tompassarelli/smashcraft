# Native controller/chat check — 5 October 2026

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
