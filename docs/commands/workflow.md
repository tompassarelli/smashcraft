# Workflow

Smashcraft is a platform fighter for Warcraft III, written in TypeScript and
compiled to Lua with TypeScriptToLua. Wisp and Bun are the supported build,
test and development tools. `smashcraft:typescript-toolchain.lock` pins Bun,
TypeScript, TypeScriptToLua and Effect; the map build checks it. Wisp is
maintained in its own repository. smashcraft:ts/wisp.lock records the exact
source revision; Bun installs its generated archive from smashcraft:ts/vendor/.
Change framework code in an owned Wisp lane, publish it, and update the
consumer pin with `bun run update:wisp` from smashcraft:ts/ (fetches the
current published `main` and records its resolved commit).

Roadmap [#16](https://github.com/tompassarelli/smashcraft/issues/16) lists the
open work in order. Each issue's **Done when** and **Not required** lists are its
complete scope, and its "Rules for whoever picks this up" govern the work.

- A problem that doesn't block a box goes in a new `priority:later` issue, not
  into the current one.
- After about a day without progress, stop
  and tell Tom what fails, one recommended fix and its cost.
- Keep each issue's Status section to 5 lines, edited in place, with at most
  one line of residual risk. Comment only to close or to ask Tom for a decision.

Answer "what can we claim about input timing?" from #26's integrity table, or
its Status until the table exists. A status question never starts a new
investigation.

- smashcraft:ts/src/ owns gameplay, deterministic state/replay, selection and UI.
- smashcraft:controller/ owns Smashcraft's controller plug-in and journal helper (`wc3-journal`); the service itself is github.com/tompassarelli/wc3-controller, pinned by tag in controller/Cargo.toml.
- The player's desktop app is github.com/tompassarelli/smashcraft-client; it reads Smashcraft only through smashcraft:docs/client-interface.md, which this repository owns.
- smashcraft:tools/ owns build, native probes and automation.
- smashcraft:docs/ holds durable knowledge only: how systems work, design
  decisions, reference data and procedures. Status, progress, plans, claim
  tables and trial results live in the owning issue: the table, the run link
  and the commit. When a trial teaches something durable, add that fact to the
  relevant doc, with its build.
- Use the declared project development shell rather than repeated ad hoc setup.

Every push runs the pre-push gate (smashcraft:.githooks/pre-push, enabled for
the repository with `git config core.hooksPath .githooks`; safe-push runs it):
the clean-room check (smashcraft:ts/scripts/cleanRoom.ts: no game files or
copied game scripts outside smashcraft:clean-room-allowlist.tsv; wisp:docs/clean-room.md),
`bun run check` and the type-escape audit (smashcraft:ts/test/source-shapes.test.ts)
when the pushed commits change ts/, the model facts check
(smashcraft:ts/test/model-facts.test.ts; it refuses with the `bun wisp view models`
refresh command) when they change clips or model build inputs, in a few seconds (smashcraft:ts/scripts/prePush.ts).
It checks the working tree, so push from a clean checkout of the commit.
A push to main then needs a green farm suite (`bun wisp farm test`) on the exact commit it pushes: the gate reuses a farm run already green on that commit, else runs one and waits (about 4 minutes), and refuses on any failure, main's known ones included (#394). The repository's .safe-push sets `landing.exact`, so `safe-push --to main` re-runs the gate whenever main moved during it; the commit that lands is the one the farm tested. Run `bun wisp farm test --wait` before `safe-push` to see failures earlier; the gate then reuses that run if main hasn't moved.

Main stays green. Each CI run on main opens, updates or closes the one
"main is red" issue (smashcraft:.github/workflows/main-red.yml), which lists the
failing tests and the first failing commit; the pre-push gate prints that list
on every push. A red main is not "already failing": before landing, check
whether your change touches a listed test, and if your commit broke main, fix
it first.
A push to a `claude/**` branch (a cloud worker's) lands on main by itself
when its full suite adds no failure to main's, and otherwise comments on the
referenced issue (smashcraft:docs/ci.md, "Autoland").

Keep proprietary game assets and base maps privately outside repository trees.
Always identify the current playable artifact separately from an experimental
candidate; a diagnostic pass does not replace that release.
