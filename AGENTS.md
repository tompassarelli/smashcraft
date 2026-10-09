# Smashcraft

profile: prototype

- Keep Wisp changes in Wisp; consume its published pin via the updater. Never edit installed dependencies or add a framework copy.
- The roster holds at 26 until every fighter feels good; each has a specific personality; prefer Warcraft models.
- Definitive is the first-class look and Classic the fallback, per fighter; both looks share gameplay, timing, hitboxes and hurtboxes, and each visible body fits its boxes.
- Every frame must sustain 60 fps; the map’s own work stays below 10 ms, including the worst frame (Warcraft draws inside 16.7 ms). A miss remains unfinished work.
- Keep every mutable gameplay field in deterministic snapshots/replay; local presentation stays separate and shared handles are created consistently.
- Publish a release only when Tom decides; private playable builds are Smashcraft 0.0.N (increment N only). Diagnostics keep distinct run IDs and names; keep one current candidate under Maps/00-Smashcraft.
- Never touch Tom’s install or account a; the offline pool is Classic-only, and Definitive checks run on signed-in clones b, c and d.

Commands: from ts/, run bun wisp help.
Docs and source layout: [docs/README.md](docs/README.md), topic → file.
Issues: [roadmap #16](https://github.com/tompassarelli/smashcraft/issues/16); a box defines scope.

Read the relevant router before working, even when your cwd is the root:
- Map/TypeScript: warcraft-modding and [ts/AGENTS.md](ts/AGENTS.md); [TypeScript](docs/commands/typescript.md) and [testing](docs/commands/testing.md).
- Host commands: effect-development; [host tools](docs/typescript.md#host-tools); enforce via ts/test/effect-host-tools.test.ts.
- Fighter art: smashcraft-animation and [tools/animations/AGENTS.md](tools/animations/AGENTS.md); [animation help](docs/commands/animation.md).
- Stage art: smashcraft-stage-design; [stage help](docs/commands/stage.md).
- Native tools/clients: warcraft-modding and private-desktop-development; [native rules](ts/scripts/wisp/AGENTS.md) and [native help](docs/commands/native.md).
- Builds/pins/private inputs, issue closure and pushes: [workflow](docs/commands/workflow.md).

Before adding a diagnostic, consult the pinned Wisp feature index: ts/node_modules/wisp/docs/index.md.
