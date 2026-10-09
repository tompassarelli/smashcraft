# Move sound check

smashcraft#391 boxes 3 and 4, 10 Oct 2026. Each move ran headlessly through the map's own
impact-event and move-sound path (the frames the presentation reads); a perform counts when its
sound plays on the move's first active frame (a special: by its frame 2), a hit when the struck
fighter plays the striking move's own hit sound. Moves come from `soundedMoves` in
smashcraft:ts/src/game/presentation/moveSounds.ts. A move with no hit whiffed in the scripted
spacing; its hit sound is the table's.

Listening clips: one per fighter per look, recorded from signed-in clone-c's own audio sink
during `bun scripts/nativeCapture.ts run` (three jabs, forward tilt, forward, up and down
smash, neutral air, the four specials), kept outside the repository under
`~/.local/state/wisp/sound-391/clips/{definitive,classic}/`.

| Fighter | Moves | Perform on its frame | Own hit sound | Definitive clip | Classic clip |
| --- | --- | --- | --- | --- | --- |
| Rifleman | 22 | 22/22 | 19/22 | 01-rifleman.ogg | 01-rifleman.ogg |
| Illidan | 23 | 23/23 | 21/23 | 02-illidan.ogg | 02-illidan.ogg |
| Blademaster | 20 | 20/20 | 17/20 | 03-blademaster.ogg | 03-blademaster.ogg |
| Mountain King | 20 | 20/20 | 19/20 | 04-mountain-king.ogg | 04-mountain-king.ogg |
| Warden | 21 | 21/21 | 19/21 | 05-warden.ogg | 05-warden.ogg |
| Lich | 20 | 20/20 | 16/20 | 06-lich.ogg | 06-lich.ogg |
| Forsaken Paladin | 20 | 20/20 | 18/20 | 07-forsaken-paladin.ogg | 07-forsaken-paladin.ogg |
| Dreadlord | 21 | 21/21 | 19/21 | 08-dreadlord.ogg | 08-dreadlord.ogg |
| Shadow Hunter | 21 | 21/21 | 17/21 | 09-shadow-hunter.ogg | 09-shadow-hunter.ogg |
| Pit Lord | 20 | 20/20 | 18/20 | 10-pit-lord.ogg | 10-pit-lord.ogg |
| Beastmaster | 21 | 21/21 | 16/21 | 11-beastmaster.ogg | 11-beastmaster.ogg |
| Lich King | 21 | 21/21 | 20/21 | 12-lich-king.ogg | 12-lich-king.ogg |
| Thrall | 22 | 22/22 | 17/22 | 13-thrall.ogg | 13-thrall.ogg |
| Jaina Proudmoore | 20 | 20/20 | 16/20 | 14-jaina-proudmoore.ogg | 14-jaina-proudmoore.ogg |
| Sylvanas Windrunner | 21 | 21/21 | 17/21 | 15-sylvanas-windrunner.ogg | 15-sylvanas-windrunner.ogg |
| Cairne Bloodhoof | 20 | 20/20 | 16/20 | 16-cairne-bloodhoof.ogg | 16-cairne-bloodhoof.ogg |
| Chen Stormstout | 21 | 21/21 | 17/21 | 17-chen-stormstout.ogg | 17-chen-stormstout.ogg |
| Peon | 20 | 20/20 | 15/20 | 18-peon.ogg | 18-peon.ogg |
| Goblin Tinker | 21 | 21/21 | 17/21 | 19-goblin-tinker.ogg | 19-goblin-tinker.ogg |
| Kael'thas Sunstrider | 22 | 22/22 | 19/22 | 20-kael-thas-sunstrider.ogg | 20-kael-thas-sunstrider.ogg |
| Murloc | 22 | 22/22 | 18/22 | 21-murloc.ogg | 21-murloc.ogg |
| Grom Hellscream | 22 | 22/22 | 19/22 | 22-grom-hellscream.ogg | 22-grom-hellscream.ogg |
| Kobold | 22 | 22/22 | 18/22 | 23-kobold.ogg | 23-kobold.ogg |
| Malfurion Stormrage | 20 | 20/20 | 16/20 | 24-malfurion-stormrage.ogg | 24-malfurion-stormrage.ogg |
| Medivh | 22 | 22/22 | 19/22 | 25-medivh.ogg | 25-medivh.ogg |
| Anub'arak | 22 | 22/22 | 18/22 | 26-anub-arak.ogg | 26-anub-arak.ogg |
| All | 547 | 547/547 | 461/547 | 26/26 | 26/26 |
