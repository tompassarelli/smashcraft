# Build inputs

The map build reads private inputs that never enter Git: the base map, the
asset container, the summon clips and the folders of `--assets` (fighter
models, clip pools, stage and impact models, imported community models,
selection art, fighter renders, stage-select pictures, hero models, model sounds). Each is a
*family*, stored once under the hash of its contents and never changed.
smashcraft:build-inputs.json names the hash of every family a revision builds
with, so a commit fixes its art exactly as it fixes its code.

## How it works

- **Store.** ~/.local/share/smashcraft-build-inputs/store/FAMILY/HASH/ holds
  one family. HASH is the SHA-256 of the folder's sorted file list, each
  line a relative path and that file's SHA-256 (base and container are folders
  holding `base.w3m` and `container.w3x`). `bun wisp inputs add` copies the
  source into a private staging folder, hashes the copy, makes it read-only
  and publishes it by one rename; a second writer of the same contents finds
  it there. Nothing writes into a published folder.
- **Manifest.** smashcraft:build-inputs.json maps each family named in
  smashcraft:ts/scripts/wisp/buildInputs.ts (`FAMILIES`) to its hash. There is
  no global pointer: a lane's manifest is its own, and main's is main's.
- **Resolve and verify.** `bun wisp map build` without `--base`, `--container`,
  `--assets` or `--summon` reads the checkout's manifest, rehashes every family
  (about 0.6 s for 290 MB) and fails before compiling when one is missing or
  differs, naming the command that produces it. `--assets` resolves to
  store/views/HASH/, a folder of links to the asset families, itself keyed by
  the hashes it names. An input given on the command line overrides the
  manifest's for experiments.
- **Play.** `bun wisp play` builds main from main's manifest. Builders of a
  revision share the lock ~/.local/share/smashcraft-build-inputs/locks/play-REVISION.lock
  (flock(2), released by the kernel when its holder exits): the first builds
  in the revision's lane worktrees/play-build-REV12 into a staging folder
  beside play-current/REVISION and renames it into place; the others wait,
  then reuse that map. A new revision's number is reserved under
  locks/play-version.lock as play-current/REVISION.version, so two revisions
  built at once never share a number. The lane is removed after the build.
- **Optional helper.** The controller helper is optional (#166). A new play
  build tries it after the map; a failure prints one line and play goes on on
  the keyboard. `bun wisp controller` builds it on demand.
- **Staged writes.** Wisp stages a map as `OUT.PID.next` and renames it over
  `--out`, and extracts from the base and container read-only, so concurrent
  builds of one path never share a partial file and stored inputs stay sealed.
  Game files, installed maps and play's host files are written the same way.

## Change art

New or changed art is a new family hash and a manifest commit, landed like
code:

1. Produce the family into a folder of your lane (generators write
   build/FAMILY; `bun wisp inputs path assets` prints the current `--assets`
   for tools that read it). For a clip pool, start from a writable copy of the
   current one: `cp -rL "$(bun wisp inputs path assets)/original-clips-static-lights" NEW && chmod -R u+w NEW`,
   then `bun tools/animations/export-original-clips.ts --assets "$(bun wisp inputs path assets)" --out NEW --keep-unchanged`.
2. `bun wisp inputs add FAMILY DIR` (from smashcraft:ts/) stores it and writes
   its hash into your checkout's build-inputs.json.
3. `bun wisp map build --profile playable --name NAME --out OUT.w3x` from the lane
   checks the change; commit build-inputs.json with the code that needs it and
   land it. Lanes that changed different families merge like any JSON edit; two
   lanes that changed the same family conflict in Git, never on disk.

`bun wisp inputs check` verifies every family of the checkout's manifest.
Never edit a stored folder; a build reports an edit in place with the command
that regenerates the family.

## Other shared paths

- The LAN pool's ~/.local/state/wisp/lan/ and each client's CustomMapData
  belong to the agent running those clients; Wisp writes game files through
  per-process temporaries.
- The controller launcher link and the owner's Maps/00-Smashcraft are replaced
  through per-process temporaries (`NAME.PID.next`), renamed in.
- The LAN pool's pool.json and clients.json have one writer, the running
  `wisp lan pool`.
- ts/build/ and build/ are per checkout: run one build at a time in a lane.
- Dated folders under ~/.local/share/smashcraft-build-inputs/ are lanes'
  scratch and evidence inputs. A build reads only the store.
