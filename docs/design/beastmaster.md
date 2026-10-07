# Beastmaster: fight with the pack

Beastmaster builds a small formation, then fights beside it. Bear threatens the
ground, Quilbeast creates a firing position, and Hawk threatens the air. The
opponent can rush Beastmaster during a call, jump over the ground animals,
shield their attacks, or hit the animals to remove that part of the formation.
All three may exist together and each has its own position and durability.

The existing axe normals, movement, weight and down-throw chase remain his
close-range kit. This distinguishes him from Archer's mobile mount, Shadow
Hunter's stationary ward, and the roster's projectile or rushdown fighters:
he chooses which independent position to attack from. Losing the formation
costs time and mana. Animals never block hits intended for Beastmaster.

## Controls and decisions

Values below are original provisional Smashcraft values, in simulation frames;
the call frame is one-based. H is the existing hero reference height.

| Input | Action and reward | Commitment and response |
| --- | --- | --- |
| Neutral: Wild Axes | Two axes leave on frames 16 and 20 at different heights. Each travels about 3H, then returns to Beastmaster; the returning hit pulls inward for an axe-normal or Bear chase. Free, 5 damage outward and 4 returning. Moving changes their return route. | Ends frame 35; 20 landing frames in air. Two axes maximum. Shield, jump between their heights, or approach beneath them. Each axe disappears on contact, so an outward hit cannot also hit on return. |
| Side: Summon Bear | Without Bear, call it on frame 24 for 20 mana. Bear follows 0.8H behind on its own deck and survives 600 frames or 30 damage. | Ends frame 44, ground only. Punish the call or attack the Bear. |
| Side with Bear: Stampede | Order Bear's 10-frame warning, 4-frame 1.2H lunge and 30-frame recovery; its 12-damage bite launches outward. Two small thunder lizards run ahead from Beastmaster on frames 12 and 20, each 4 damage. Ground pressure and an edgeguard against low recoveries. | Costs 12 mana, ends frame 32, cannot repeat while Bear lunges or is stunned. Jump over the line, shield, strike Bear during warning, or hit Beastmaster to cancel the command. |
| Down: Summon Quilbeast | Call a Quilbeast on frame 18 for 12 mana; it holds its ground position and fires one 3-damage quill after settling, then at 90-frame intervals. It survives 600 frames or 18 damage. Quills poke at horizontal approaches while Beastmaster advances. | Ends frame 32, ground only. The low animal can be struck; its straight shots can be jumped, shielded or reflected. No automatic targeting. |
| Down with Quilbeast: Quill Volley | Turn Quilbeast toward the input facing and fire three quills after a 10-frame warning, 8 frames apart. Quilbeast shoots from its own position, setting up a crossfire with the returning axes or covering a Bear chase. | Costs 6 mana, ends frame 24; the animal cannot volley again until its 48-frame command completes. Automatic shots pause during commands and stun. Hitting the animal stuns it; hitting Beastmaster cancels the remaining volley. |
| Up on ground: Summon Hawk / Hawk Dive | Call Hawk on frame 12 for 10 mana, ending frame 26. It follows 0.6H ahead and 1.2H above Beastmaster. Press again to send it diagonally down and forward after 8 warning frames; one 6-damage upward launch starts an aerial chase or catches a ledge departure. | Dive costs 6 mana, ends frame 24; 8 active frames and 28 recovery frames. Hawk has 12 durability and 600 life. Its descent is fixed on command, so sidestep or strike it; it does not home. |
| Up in air: Hawk Lift | Hawk appears beside him if absent and carries him through the existing 2H rise and 0.5H drift for 15 mana; below that cost the free form rises 1.4H and drifts 0.35H. Hawk remains a separately moving companion afterward. | Frames 10–32 lift, once per airtime, consumes aerial jump and ends helpless. No attack while carrying; vulnerable from the side and above. |

Quilbeast stays where called, Bear follows on its original deck, and Hawk can
cross a ledge in flight. Animals stop attacking during Beastmaster's hitstun or
grab. Their health, positions, attack phases, hit records and lifetime restore
with replay and clear on a lost stock or rematch. No invulnerability, armor or
body blocking comes from owning an animal. Commands do not repair animals.

## What to combine

In neutral, Wild Axes makes the opponent choose a route while Beastmaster
establishes Quilbeast. Bear punishes a grounded approach; Hawk discourages a
predictable jump. Down tilt and the existing low down throw start a chase;
Bear or the returning axe can cover a tech direction. Hawk's upward dive hit
offers an up-air follow-up, with DI deciding the chase. These are attempted
follow-ups, not a guaranteed string or a grab loop. At the edge, Quilbeast
covers the horizontal route and Hawk dives below the lip; Stampede covers a
grounded return. Offstage, Beastmaster gives up attacking to use Hawk Lift.

The stock Warcraft animations supply each animal's stand, movement and attack;
the fighter's forward cast signals a command, and his axe swing signals Wild
Axes. Animal attack animation follows its warning/action/recovery state from
its actual position. Hawk Lift draws the same Hawk, never an extra cosmetic
copy. Stock Warcraft models remain private inputs.

## Sources and borrowing

- [Warcraft III Beastmaster](https://classic.battle.net/war3/neutral/beastmaster.shtml):
  the named Bear, Quilbeast and Hawk can coexist; Stampede supplies the thunder
  lizards. This kit keeps the Bear's melee role, Quilbeast's ranged role and
  Hawk's flying role. The timings and platform-fighter behavior above are new.
- [DotA Beastmaster](https://www.dota2.com/hero/beastmaster) and Valve's
  [7.07 hero rework](https://www.dota2.com/duelingfates): Wild Axes and Call of
  the Wild provide the hero identity. No DotA damage amplification is added.
- [Toon Link](https://www.smashbros.com/wiiu-3ds/us/characters/toon_link.html):
  Wild Axes borrows the boomerang idea of controlling a second route on return.
- [Rosalina & Luma](https://www.smashbros.com/wiiu-3ds/us/characters/rosetta.html):
  Bear borrows pressure from a separate position and the cost of losing a partner.
- [Duck Hunt](https://www.smashbros.com/en_US/fighter/59.html): Quilbeast borrows
  a delayed ranged threat that lets the fighter approach behind it.
- [Olimar](https://www.smashbros.com/wiiu-3ds/us/characters/pikmin.html): the
  pack borrows visibly different companion jobs and replaceable small bodies.
- [Ice Climbers](https://www.smashbros.com/en_US/fighter/15.html): the formation
  borrows coordinating two locations; Beastmaster's hitstun cancels animal
  attacks so the pack does not create an automatic escape from being punished.

References checked 8 October 2026. These are gameplay ideas, not copied code,
models, animation, exact frame data or hitboxes.
