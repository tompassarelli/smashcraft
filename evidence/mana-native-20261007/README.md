# Mana bars on real clients, 7 Oct 2026 (#153 box 5)

Native lane 1 ran `bun wisp accept --only 153-mana-full --only 153-mana-spent --only 153-mana-escape --only 153-mana-refused` on clients A and B: one Uther mirror, development map rebuilt from main f90f46d4. Run folder: ~/.local/state/smashcraft/accept/20261006-211656/ (frames stay outside Git).
No-import-failure and no-error rules held on both clients for every check. The look lines were judged from pixel measurements of the 2560x1440 frames (blue #0042FF fill, red flash, yellow #FFFB00 escape fill):

| Check | Measured | Verdict |
| --- | --- | --- |
| 153-mana-full | Overhead bars 168 px, ten segments, full over both fighters (x527-695 and x1863-2031, y487-499); plate bars full, 301 of 301 px | pass |
| 153-mana-spent | Player 1's plate bar 123 of 301 px (41%) after three Crusader Rushes; player 2's 301 of 301 | pass |
| 153-mana-escape | Held fighter: escape meter fill y484-502, its mana bar y457-469 above it, same centre, 14 px apart, no overlap; the holder's bar alone at y487-499 | pass |
| 153-mana-refused | Player 1's plate bar red (301 px) in frames 0-2, then blue at 27 of 301 px (9 mana, under the rush's 20) in frames 3-7 | pass |

The 6 Oct first run (20261006-190832) passed full, spent and refused; its escape check never grabbed, so the check was reordered (f90f46d4).
