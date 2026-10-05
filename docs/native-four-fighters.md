# Four-fighter match and rematch

`bun waygate four-fighters capture` exercises issue #17's automated journey
through the same virtual-pad, persistent-helper and native-file services used
by the input-integrity capture. Its result command checks the four-fighter
roster, completed match and rematch, rematch slot change, and both clients'
final result checksums. Issue #26's input timing verdict is separate.

Use two signed-in private clients at fighter selection, with connected players
in slots A/B and slots C/D empty. The desktop driver's client records must name
the retained windows. Start no other controller helper on those clients during
capture. The map must use normal combat, journal/editbox input, and the response
probe, as declared by `INTEGRITY_BUILD` in
smashcraft:ts/src/game/shell/currentBuild.ts. The checked-in development build
uses keyboard input and cannot produce these receipts. Match `--build` to the
actual map's build ID, not its display name.

From smashcraft:ts/, with the matching helper binary and private-compositor
app IDs:

```sh
bun waygate four-fighters capture \
  --helper /absolute/path/to/wc3-journal \
  --build typescript-integrity \
  --out /absolute/path/to/new-four-fighter-capture \
  --app-id a=GAME_APP_ID_A --app-id b=GAME_APP_ID_B \
  --first-epoch 1
bun waygate four-fighters result /absolute/path/to/new-four-fighter-capture
```

Use the clients' actual names for the app-ID arguments. `--clients` can select
a separate client-state file. A fresh map begins at epoch 1; a chained capture
must supply its next odd epoch. The output directory must not already exist.

The journey selects two CPUs through the slot tags, selects the fighters and
stage, sets the normal match timer to one minute, and sends four attack taps per
player. The CPUs continue normal combat until stocks or the timer end the
match. Between matches, slot C cycles CPU → empty → player → CPU. Both matches
retain two players and two CPUs. After the rematch result, the journey returns
to fighter selection and empties C/D. Results are archived before leaving each
match; a longer match also gets a stationary result trace.

The result command writes `four-fighters.json` beside the native capture.
Exit 0 requires all four final result checksums at matching frames, with no
journey failures. Retain the candidate map hash and helper hash with the raw
capture when reporting native acceptance. This automated journey does not
replace the human controller playtest.
