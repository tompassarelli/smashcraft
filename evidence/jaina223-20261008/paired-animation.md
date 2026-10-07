# Jaina paired animation

The holder and victim clips now declare their authored contact times. This
aligns a short victim reaction with the actual holder's pummel or throw.

- Production `advanceFighterPose` checked 20 action pairs: pummel and four
  throws, Jaina mirror and Mountain King, both facings; 0 timing mismatches.
- The four hold panels also passed. All 24 paired contact panels were
  visually inspected at shared grip offsets: both bodies and weapons remain
  distinct, pummel is localized, and four release gestures read separately.
- Nine pain silhouettes were inspected: low/middle/high contact with
  small/medium/large intensity. Each height retains its distinct response.
- `bun run check` passed.

The generator adds ten contact bindings. Model bytes remain unchanged at
SHA256 `1f90a347d408843d17b80675b4a5168fdb7d410b8208360a54202bc8cf572ad8`.
The private reviewed image is
`~/.local/share/smashcraft-build-inputs/jaina223/art-fix/paired-damage-review-small.jpg`.
