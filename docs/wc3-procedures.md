# Fast state-labeled Warcraft procedures

Use `tools/wc3-procedure` to run a short, named input chain against an existing
private Warcraft session. It groups inputs that do not need an inspection
between them into one XTEST client call; focus and the private run identity are
checked at the boundary. That can remove repeated tool round trips in a
multi-action iteration. It does not make captures, game-state decisions, or
long wait loops faster, and no 5–10x end-to-end speedup has been measured.

Example, from a shell with `xdotool` available:

```sh
nix shell nixpkgs#xdotool --command \
  tools/wc3-procedure /run/user/1000/private-desktop.RUN match-running export-ui-service
```

Use the exact run directory printed by the canonical private-desktop launcher.
The state label must match the recipe. It is the caller's assertion, not a
detected Warcraft screen state. The runner requires the active private window
title to be exactly `Warcraft III` before and after sending the chain. It stops
on another title, bounds a chain to 40 directives and eight seconds, and
releases declared keys on interruption. After it reports “Chain sent,” inspect
the game or its fresh trace/export before choosing another procedure. It does
not retry, infer success, use normal-desktop input, or control the primary
display.

`export-ui-service.chain` captures an existing collection pattern: from a
running match, Escape clears map UI focus, then Ctrl+H asks the map to export
its UI-service trace. The collector still needs to wait for and validate the
fresh complete export. This sequence is **prior-art-derived, not yet verified
in the current private session**; do not present a sent key sequence as proof
that the export happened.

Validate a recipe without opening a display or sending input:

```sh
tools/wc3-procedure --validate match-running export-ui-service
```

Recipe files in `tools/wc3-procedures/*.chain` support `tap KEY MS`,
`hold KEY MS`, `chord KEY+KEY MS`, and `wait MS`. Each file starts with exactly
one `# caller-state LABEL` matching the state label passed on the command line.
No recipe presses Return, KP_Enter, ISO_Enter or Linefeed: the caller's label
proves no match, and outside one Return sends chat to Battle.net's channel or a
lobby.
Add a recipe only when its starting state and sequence have a concrete source
or a native trial. Mark untried recipes as candidates in their comments and
keep result verification as a separate explicit step. Do not chain across an
unobserved menu transition or infer that a state label proves the current UI.

The batching advantage depends on the procedure. For N preplanned input actions
with one inspection afterwards, the runner needs one batched XTEST input call
instead of N separate input calls; focus adds two small boundary queries. The
export example contains three directives, so the present recipe is about
round-trip reduction, not a demonstrated fivefold speedup. Measure complete
edit-to-observation time on a repeated task before claiming a numeric multiplier.
