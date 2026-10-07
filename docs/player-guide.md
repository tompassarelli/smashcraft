# Player guide

Requires Warcraft III 3.0 and a keyboard; nothing else to install. Put the
map in the Warcraft III Maps folder and open it from Custom Games. A
controller is optional: the Smashcraft controller helper turns its buttons
and sticks into the same keys (A attacks, X specials, B or Y jumps, RB grabs,
either trigger shields, LB walks, Start pauses). The current prototype includes character and stage
selection, three fighters, a bot opponent, floating platforms, blast zones,
stocks, rematches, and configurable controls.

For solo practice, place only your own fighter chip and press Y, then choose
a stage and press Y again. Leave the CPU chip unplaced. Practice has no timer
or opponent, and falling off the stage respawns you without ending the session.
Press Y to pause, then Escape to return to fighter selection. Place the CPU
chip before starting when you want a bot match instead. A CPU card shows its
level, 1 to 9, with buttons to lower and raise it: level 1 barely fights back,
level 9 plays its fighter the way a solid player would. The first player, or
the player whose slot it is, sets it; it starts at 9.

At fighter selection, any player can change Stocks, Time, Endless and
Automatic rematch. No time limit removes the clock. Endless also removes
the stock limit; pause and press Escape to leave. Automatic rematch keeps
the same fighters, stage and rules, with a visible five-second countdown
after the result. A player can stop it with a menu control, then choose the
next match. It starts off.

Training (top of the rules) turns the match into practice against computer
partners: no clock and no lost stocks. Choose what the partner does (Stand,
Shield, Crouch, Jump, Attack or Fight), which way it drifts when hit, how it
techs, its damage, whether hit areas show (bodies green, attacks red) and the
speed (Full, Half or Quarter).
The top-left readout gives your last attack's frames, how many frames ahead
(+) or behind (-) you were after it hit or was shielded, and the combo. Hold
both shields and press Attack to put everyone back at the start.

An orange halo means your fighter is locked and no current input can help.
A green halo means moving the stick can change the hit or throw, while buttons
cannot. The halo disappears as soon as a button can matter, including an attack
you can queue before recovery or a tech you can press before landing. The
fighter keeps the usual hit and ice colours inside the halo.

## Menus and controls

Mouse buttons and W/R + N select a fighter or stage; U goes back. Drag a
character chip from the active player card onto the roster. New Match retains
selections. Y confirms character/stage selection, chooses the next match after
a result, and pauses or resumes an active match. Pausing freezes combat and
match time while keeping input handling live. Enter is reserved for Warcraft
chat.

F1 opens Controls before a match. Choose QWERTY or Custom, click either key
slot to rebind it, then Save. Saved controls load automatically on the next map
start. Y is reserved for Start/Pause and K for saving a moment; F6 and F7
remain reserved for Warcraft shortcuts. Ctrl+T starts a developer input trace.

Saw something wrong? Press K, or hold View on a controller for a second: the
last ten seconds of the match are saved for a bug report on your computer, in
Warcraft III's CustomMapData folder as smashcraft-repro-*.txt, and "Moment
saved" appears. The match goes on undisturbed.

The Custom preset uses W/R to move, I/9 to jump, Space to aim up, E to
fast-fall or climb down through platforms, Q/8 to shield or air-dodge, O to grab, N
to attack, and U for a special. Shield + N or O grabs. While holding an
opponent, tap N to pummel once or a movement/C-stick direction to throw forward,
backward, up, or down; after the pummel, throw or the opponent goes free. Mash
action buttons and alternate movement directions to escape a grab; holding one
button does not count as mashing. The bar above a held fighter drains as the
hold runs out and faster with mashing; the mark on it shows when a pummel would
land. Mash and wiggle the same way to break out of Rifleman's frost trap
sooner; its bar shows how long the ice has left.

Attacks buffer for six frames, including through jump squat. Hold P to walk;
P with E crouches on a platform instead of climbing down. Jumping into a
platform from below climbs onto it: hold E to stop on top, or shield to land
shielding.
N with a direction performs a smash, or a tilt while walking. B (or /) is
C-stick left; H is down; J is up; M is right. C-stick down-air preserves
normal aerial momentum. QWERTY uses 7 for right trigger and 8 for the
alternate jump key.

Specials use U with a direction; every fighter's specials, passive and
ultimate are listed by name in the [move list](move-list.md). Archer steers her
hippogryph ride with the stick (down for a low line) and can jump off it to
act again. Her first down special sends the hippogryph swooping to a perch;
the next makes it dive at her, through anyone in the way. Archer's neutral arrow
can be jump-cancelled. The current summon presentation uses Warcraft bear and
hippogryph models.

Use Warcraft's ordinary Quit Mission to leave and recreate a custom game.
The map's Ctrl+R restart path is unreliable, and F5 has previously hung the
client when returning to the menu.
