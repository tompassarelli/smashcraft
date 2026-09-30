Build Smashcraft into a playable, responsive Melee-inspired Warcraft III platform fighter, authored in Wurst, preserving all agreed gameplay, controls, animation, and UI requirements.

First establish the multiplayer foundations: verify native local input, transport timing, engine pacing, and safe animation restoration. Make the existing simulation deterministic, snapshot-capable, and replayable without changing combat tuning. Compare fixed delay (D=3, R=0) against bounded rollback (D=3, R=6), selecting the approach from measured two-client responsiveness, consistency, fairness, and readable interactions.

Keep headless Wurst tests as the primary development loop, including input-tape replay and network fault injection. Use Warcraft for engine behavior, presentation, feel, and actual multiplayer validation. Preserve a playable baseline throughout.

Complete character select → stage select → matches, including movement, aerials, wavedashing, shields, hitlag/hitstun, knockback, stocks, specials, animation-aligned hitboxes/hurtboxes, and the agreed visual polish. Use the local Melee reference for factual mechanics and independently authored implementation.

Keep working code, commands, evidence, decisions, and remaining work durably documented in the public repository. Distinguish implemented from measured and untested. Escalate demonstrated native limitations explicitly; don’t conceal them with smoothing or assume an unproven external bridge.