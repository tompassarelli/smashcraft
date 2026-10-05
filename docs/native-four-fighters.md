# Four-fighter match and rematch

`bun wisp four-fighters capture` exercises issue #17's automated journey
through the same virtual-pad, persistent-helper and native-file services used
by the input-integrity capture. Its result command checks the four-fighter
roster, completed match and rematch, rematch slot change, and both clients'
final result checksums. Issue #26's input timing verdict is separate.

Use two signed-in private clients at fighter selection, with connected players
in slots A/B and slots C/D empty. The desktop driver's client records must name
the retained windows. Start no other controller helper on those clients during
capture. The map must use normal combat, journal/editbox input, and the response
probe. Build with `bun wisp build --profile integrity` and the normal private
map inputs, or rebuild an already packaged private candidate with:

```sh
bun wisp rebuild /absolute/path/to/candidate.w3x --profile integrity
```

This selects `INTEGRITY_BUILD` in smashcraft:ts/src/game/shell/currentBuild.ts,
with build ID `typescript-integrity`. The default development profile uses
keyboard input and cannot produce these receipts. Match `--build` to the actual
map's build ID, not its display name.

From smashcraft:ts/, with the matching helper binary and private-compositor
app IDs:

```sh
bun wisp four-fighters capture \
  --helper /absolute/path/to/wc3-journal \
  --build typescript-integrity \
  --out /absolute/path/to/new-four-fighter-capture \
  --app-id a=GAME_APP_ID_A --app-id b=GAME_APP_ID_B \
  --first-epoch 1
bun wisp four-fighters result /absolute/path/to/new-four-fighter-capture
```

Use the clients' actual names for the app-ID arguments. `--clients` can select
a separate client-state file. A fresh map begins at epoch 1; a chained capture
must supply its next odd epoch. The output directory must not already exist.

The journey selects two CPUs through the slot tags, selects the fighters and
stage, sets one stock for both matches and the normal match timer to one minute,
and sends four attack taps per player. The CPUs continue normal combat until stocks or the timer end the
match. The named #26 integrity workload separately retains its required longer
settings for the all-binding edge sample. Between matches, slot C cycles
CPU → empty → player → CPU. Both matches
retain two players and two CPUs. After the rematch result, the journey returns
to fighter selection and empties C/D. Results are archived before leaving each
match; a longer match also gets a stationary result trace.

At each match start, about a second in, the journey also checks what each
player sees, and the scene report again at each result
(smashcraft:docs/player-view.md); frames stay in
`OUT/player-view-EPOCH/CLIENT.ppm`. A map built before the scene recorder
writes no report, so rebuild candidates before capturing.

The result command writes `four-fighters.json` beside the native capture.
Exit 0 requires all four final result checksums at matching frames, with no
journey failures. Retain the candidate map hash and helper hash with the raw
capture when reporting native acceptance. This automated journey does not
replace the human controller playtest.
