# Animation

For fighter animation quality and action coverage, use the source-owned
`smashcraft-animation` skill (`agents path smashcraft-animation`): its
reference library supplies Sakurai's impact/attack principles and the Fox
drill example; its procedure routes the existing motion audit, paired throws,
recovery clips and nine-way pain reactions. The project index of sources,
with URLs, verified timestamps and rights, is
smashcraft:docs/design/animation-reference.md. Reference pixels remain private.

`bun tools/animations/recovery-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT` from
  the repository root appends fighter recovery and transition clips before
  storing their families and refreshing the clip pool (smashcraft:docs/fighter-animation-work.md).
  `bun tools/animations/drill-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT` appends
  Blademaster, Warden and Shadow Hunter down-air drills, preserving earlier
  clips and writing both-facing silhouette sheets for the native review.
  `bun tools/animations/down-air-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT` appends
  downward contact poses for the seven stock heroes whose casts/swings pointed forward.
  `bun tools/animations/attack-gesture-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT [--character ID]`
  appends distinct roster attack gestures without changing combat data or old clips;
  `--character` regenerates one fighter while retaining other generated bindings;
  `--pose POSE` appends only that missing gesture, preserving existing clips.
  `bun tools/animations/dreadlord-pounce-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT` authors Dreadlord’s horizontal corkscrew, bite and recovery; `bun tools/animations/dreadlord-pounce-captures.ts PRIVATE_ASSETS PRIVATE_OUTPUT` captures their production phase selection in both facings.
  `bun tools/animations/jump-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT` appends
  movement-only jump gestures, including Blademaster's front flip
  (smashcraft:docs/fighter-animation-work.md).
  `bun tools/animations/blademaster-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT`
  appends a distinct gesture for each Blademaster normal and his back throw,
  preserving the shipped plunge and double-jump flip.
  `bun tools/animations/peon-clips.ts STOCK_PEON.mdx PRIVATE_OUTPUT` appends
  Peon's tool strikes, movement, recovery, paired grabs and nine pain poses,
  preserves the 22 stock sequences and writes both-facing silhouette sheets.
  `bun tools/animations/peon-pool.ts AUTHORED_PEON.mdx PRIVATE_OUTPUT` prepares
  Peon's checked pooled clips and a retained record for the final roster export.
  `bun tools/animations/warden-fan-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT` authors
  Warden's ground and air Fan of Knives casts, preserving other clips
  (smashcraft:docs/design/warden-fan-of-knives.md).
  `bun tools/animations/down-air-captures.ts PRIVATE_ASSETS PRIVATE_OUTPUT` writes
  both-facing down-air sheets from production pose selection and the roster's
  strike-height inventory (smashcraft:docs/down-airs.md).
  `bun tools/animations/pain-captures.ts PRIVATE_OUTPUT [FIRST_FIGHTER_SLUG]` plays accepted hits through
  the Wisp map, checks held hitstun and recovery, validates the bound pain models,
  and renders interruption, entry, held and recovery frames for the remaining roster.
  `bun tools/animations/stand-captures.ts PRIVATE_OUTPUT` checks each selectable
  fighter's shipped timeline against its source geosets at every Stand/move frame
  and renders both-facing Stand frames in Classic and Definitive.
  `bun tools/animations/grab-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT [--character ID]` appends
  coordinated expansion-hero reach, hold, pummel and four-direction holder/victim
  gestures or reauthors their existing indices. `--character` limits reauthoring
  to one expansion fighter (smashcraft:docs/fighter-animation-work.md).
  `bun tools/animations/pit-lord-specials.ts PRIVATE_ASSETS PRIVATE_OUTPUT`
  authors Pit Lord's four special gestures while preserving all earlier clips.
  `bun tools/animations/kaelthas-clips.ts STOCK_BLOOD_MAGE.mdx PRIVATE_OUTPUT`
  appends Kael’thas’s normal, special, paired throw, recovery and nine pain
  gestures, preserves all eleven stock sequences, and writes both-facing sheets.
  `bun tools/animations/murloc-clips.ts STOCK_MURLOC.mdx PRIVATE_OUTPUT` appends the
  Murloc's normal, special, paired throw, recovery and nine pain gestures to the
  stock Tiderunner, preserves its nine sequences and writes both-facing sheets;
  run it twice for a fresh clip table, since its reach search reads the table.
  Add `--kobold` with the stock Kobold input to author Kobold's pick, candle,
  recovery, throw and nine pain gestures and refresh only his clip/stride rows.
  `bun tools/animations/anubarak-clips.ts STOCK_CRYPT_LORD.mdx PRIVATE_OUTPUT` authors
  Anub'arak's insect gestures, floor burrow, paired throws and nine pain poses,
  preserving all seventeen stock clips and writing both-facing pose sheets.
  `bun tools/animations/grab-pads.ts` generates the #180 mirror and unlike-height capture batch:
  every selectable fighter, four throws, both facings, with ordinary catch/pummel
  inputs and contact-frame captures in smashcraft:ts/test/native/pads/180/.
  `-dev quick pair FIRST / SECOND` selects different named fighters in the two human slots.

- Original strike authoring (from the repository root):
  `bun tools/animations/grom-clips.ts STOCK_GROM.mdx PRIVATE_OUTPUT` authors
  Grom's axe attacks, war cry, rush, leap, throws, recovery and nine pain
  poses on his stock campaign rig and writes both-facing sheets.
  `blender --background --python tools/animations/strikes.py -- rifleman|illidan`.
  `SMASHCRAFT_ANIMATION_ASSETS=PRIVATE_DIR` selects the editable inputs;
  `SMASHCRAFT_STRIKE_CLIP='Attack Jab'` reauthors only the jab.

- Thrall stock-rig animation authoring (from the repository root):
  `bun tools/animations/thrall-clips.ts STOCK_THRALL.mdx PRIVATE_OUTPUT [POSE...]` appends
  mounted hammer, casting, recovery, grab and nine contact-reaction clips,
  writes both-facing side-view sheets, and refreshes Thrall clip and stride
  metadata. Store the generated model in `hero-models` and refresh the
  original clip pool before building. With pose names, reauthor only those clips
  from the existing `PRIVATE_OUTPUT/thrall.mdx`, preserving every other clip.
  Exact `Thrall Damage HEIGHT STRENGTH` names (each number 0–2) replace only
  the selected held pain poses; the generator requires nine distinct first poses.

- Illidan locomotion authoring (from the repository root): run Blender with
  `--python tools/animations/illidan-locomotion.py -- PRIVATE_FIGHTER.blend PRIVATE_AUTHORED`,
  then `bun tools/animations/illidan-locomotion.ts PRIVATE_ASSETS PRIVATE_AUTHORED PRIVATE_OUTPUT`.
  Package with `bun tools/animations/package-illidan.ts PRIVATE_OUTPUT --metadata-only`,
  store `illidan-animation`, and refresh the original clip pool.

- Malfurion stock-rig authoring: `bun tools/animations/malfurion-clips.ts STOCK_FURION.mdx PRIVATE_OUTPUT` appends staff, nature-spell, recovery, paired-throw and nine pain gestures while preserving the eight campaign sequences.

- Medivh animation authoring (from the repository root):
  `bun tools/animations/medivh-clips.ts STOCK_MEDIVH.mdx PRIVATE_OUTPUT`
  appends staff, blink, raven, grab, recovery and nine pain clips, preserving the
  22 stock sequences. Store `hero-models`, export only Medivh, then timeline it.

- Jaina animation authoring (from the repository root):
  `bun tools/animations/jaina-clips.ts STOCK_JAINA.mdx PRIVATE_OUTPUT`
  appends her staff strikes, spell gestures, movement and nine contact reactions;
  store the generated model in `hero-models` and refresh the original clip pool.

- Tinker animation authoring (from the repository root):
  `bun tools/animations/tinker-clips.ts PRIVATE_CLASSIC_HEROTINKER.mdx PRIVATE_OUTPUT [--no-pool]`
  preserves the 23 classic sequences and authors the claw-pack, Robo-Goblin,
  recovery, paired throws and nine pain reactions. It writes the private
  model, both-facing silhouette sheets, clip metadata and measured stride;
  `--no-pool` leaves pooled export to the combined roster pass
  (smashcraft:docs/fighter-animation-work.md, "Goblin Tinker").

- Lich King animation authoring (from the repository root):
  `tools/animations/build-lichking.sh [PRIVATE_INPUTS] [IMMUTABLE_EXISTING_MODEL] [--replace NAME]`
  authors clips through Blender; the optional existing model preserves shipped
  sequences and appends only new clips; `--replace NAME` reauthors one existing clip at its same index and length (smashcraft:docs/fighter-animation-work.md).

- Definitive fighter body: `bun tools/animations/hd-models.ts AUTHORED.mdx STOCK_DEFINITIVE.mdx PRIVATE_OUTPUT.mdx [--character ID --rig PAIRS.ts]`
  transfers production poses to the stock Definitive rig and checks both retargeted
  clips and the final timeline within 0.5 units / 0.5 degrees.

- Normal timeline body pilot (from the repository root):
  `bun tools/animations/timeline-models.ts PRIVATE_ASSETS PRIVATE_POOL MountainKing`
  combines Mountain King's normal mesh and keys into one seekable model in a writable copy
  of `original-clips-static-lights` and refreshes its clip and model tables.
  Store the family with `bun wisp inputs add original-clips-static-lights PRIVATE_POOL`.

- White body flashes (from the repository root):
  `bun tools/animations/white-flash-models.ts PRIVATE_ASSETS PRIVATE_OUTPUT [--character ID]`
  authors white body-only copies with the original meshes and keys for selectable gameplay poses, removing unused sequences, repeated constant keys, glow cards and team-glow ground planes for charge and heavy-hit flashes (the pre-push stored-model check fails a white copy that keeps a ground plane, #346); store PRIVATE_OUTPUT as `impact-assets`.
  `--character` refreshes one fighter in an existing PRIVATE_OUTPUT family and its model tables.

- Sylvanas animation authoring (from the repository root):
  `bun tools/animations/sylvanas-clips.ts STOCK_SYLVANAS.mdx PRIVATE_OUTPUT`
  appends bow attacks, casts, recovery, paired grabs and nine damage reactions
  to the classic undead Sylvanas rig, preserving its stock sequences.

- Cairne animation authoring (from the repository root):
  `bun tools/animations/cairne-clips.ts STOCK_TAUREN.mdx PRIVATE_OUTPUT`
  appends the complete totem kit, recovery, paired grabs and nine pain clips
  to the private classic Tauren Chieftain model, preserving its stock clips.

- Forsaken Paladin animation authoring (from the repository root):
  `bun tools/animations/forsaken-paladin-clips.ts STOCK_FORSAKEN_PALADIN.mdx PRIVATE_OUTPUT`
  keeps the stock Forsaken body, sword and rig, and
  authors his strikes, recovery, paired throws and nine pain poses.
  `bun tools/animations/stock-forsaken-model.ts STOCK_CLASSIC_FORSAKEN.mdx AUTHORED_FORSAKEN.mdx PRIVATE_OUTPUT.mdx`
  restores the stock Classic mesh and version-1800 skin while retaining the shipped motion.

- Chen animation authoring (from the repository root):
  `bun tools/animations/chen-clips.ts STOCK_CHEN.mdx PRIVATE_OUTPUT` authors
  Chen's staff, footwork, special, recovery, paired throw and nine pain clips
  from his private stock model and regenerates his clip table
  (smashcraft:docs/design/chen.md).

- Damage reactions (from the repository root):
  `bun tools/animations/damage-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT`
  appends all fighters' nine articulated contact reactions, checks their
  drawn first poses, and preserves old sequences. Store changed model families
  and refresh the clip pool (smashcraft:docs/fighter-animation-work.md).

Portrait outfits: `bun tools/selection/render-fighters.ts --extract EXTRACTOR --assets PRIVATE_ASSETS --slots --reuse`
renders and checks the four slot outfits; omit `--slots` for the neutral grid.
The renderer extracts only the standing sequence with the existing clip tool
(Rifleman: 427,224 animation keys to 881), avoiding full-pool Blender imports.
See smashcraft:docs/design/fighter-portraits.md.
