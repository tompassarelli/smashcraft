# EX affordability HUD

The two-client mana-bar test reproduced a zero-width EX text frame on both
overhead and plate bars. Giving the label its bar's width and a text height
fixes the missing space.

`bun test test/mana-bar.test.ts`: 5 pass, 0 fail, 112 assertions. Both
clients show no cue at 27 mana, `EX N` at 28, and `EX N + S` at 37 for Archer;
the shown labels have positive width and height. Existing fill, refusal,
gain, drain and grab-escape positioning checks pass.

This changes only UI layout; the shared frozen 84,000-match field's EX
gameplay source is unchanged.
