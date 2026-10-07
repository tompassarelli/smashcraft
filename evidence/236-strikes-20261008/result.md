# Authored attack clips and measured strike moments (#236)

The strike command reads every packaged hero model from `--assets`, including
appended clips. The original normal alignment test failed at its unchanged
`aligned >= 60` assertion before regeneration. The regenerated table has 106
aligned normals, 19 aligned specials and zero stale normal clip indices.

The focused Blademaster moves/specials, jump, authored clip, hero strike,
attack-family and fighter clip tests passed: 56/56 in Bun and 56/56 in 32-bit
Lua. The existing normal/special thresholds remain 60/10.

Production pose selection drew 16 new Blademaster clips at their real contact
clocks: 34 captures, 17 per facing, including jab chain stage two, the rear
down-smash contact and the holder's back throw. The shipped plunge #54 and
flip #55 remain; only up special uses the stock spin #13. Captures and their
frame/index/clock inventory are private:
`~/.local/share/smashcraft-animation-reference/236-final-20261008/production-hitframes/`.

The playable map built and verified 1,641 entries at
`~/.local/share/smashcraft-animation-reference/236-final-20261008/Smashcraft-236.w3x`.

The aggregate preserves Archer's punch, Illidan's 122-clip locomotion source,
Warden's Fan of Knives #53/#54 and the accepted Lich down-air #49. Removing
Lich's added attack suffix reconstructs the exact accepted 51-clip model,
SHA-256 `bd6ff19ba5184cbbabda2e6e2d4481c93c5ace7336731c85da7fa3f71840e81b`.
Blademaster's 56-clip source also reconstructs exactly before its 16 additions.

Rising Whirlwind keeps #189's charged-angle recovery: eight aim frames,
2.8H across 14 travel frames, six active hit frames, end frame 24; the free
form travels 1.9H. The new clip contract checks that current behavior.
