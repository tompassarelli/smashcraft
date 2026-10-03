# Integrated playable candidate 0.0.13

Source integration 4c172b2 with build-output path change. Private artifact:
~/.local/share/smashcraft-build-inputs/production-netcode-20261004/build/Smashcraft 0.0.13.w3x
SHA256: 7daec0735a9ed7a895e3e77c71c35febf8841f3bcfd7af444729fc5d6d108cce

Configuration: shadow-d0-r24, pool-predicted, response service probe enabled,
normal scenario, automatic deployment disabled. Compiler completed successfully;
Lua syntax, archive script comparison and packaged asset comparisons passed.
Retained simulation result remains 604/605, with the unresolved tech-roll entry
assertion. This is an evaluation candidate, not physics or competitive acceptance.

Build with WC3_PRIVATE_ASSETS pointing to
~/.local/share/smashcraft-build-inputs/production-netcode-20261004,
WC3_INPUT_PROFILE=shadow-d0-r24, WC3_PRESENTATION=pool-predicted,
WC3_RESPONSE_SERVICE_PROBE=1, WC3_DEPLOY_MAP=0, using
wc3-melee:build.sh and the private physics-base.w3m fixture.
Map staging, output and deployment archive now use the private asset directory's
build subtree outside the checkout. Existing historical outputs are unchanged.

Neither client was restarted, logged in, or moved this turn. Both remain in the
completed 0.0.11 journal probe. Next: archive that installed map privately, install
this exact candidate in both Maps/00-Smashcraft folders, warm leave/rejoin,
then verify controls, combat, stock loss, results and rematch. No human match,
physical-controller response, visible correction or live frame integrity is
claimed from compilation.
