# Fresh

- Fresh match: `bun wisp fresh MAP.w3x [--rebuild]` starts a new game, sends
  `-dev quick`, and waits until every signed-in client writes its receipt.
  `--rebuild` replaces the map script first. Other quick starts for `--chat`
  and pad scripts: `-dev quick hero NAME [stocks N]` (one stock unless N is 1 to 9), `-dev quick recovery hero NAME`
  (starts tumbling above the floor for recovery captures), and `-dev quick cpu OPPONENT DIFFICULTY [hero NAME]`,
  a quick match against a named computer at the selected difficulty over three stocks.
  `-dev quick promo stage N pair FIRST / SECOND` starts two Wren Expert computers over three stocks with match HUD, hints and developer receipts hidden (for example `-dev quick promo stage 0 pair rifleman / illidan`). `-dev reset` restores the normal UI.
  `-dev quick stage N [lighting stock|stage] [backdrop on|off] [view near|far|off] [fog on|off]`
  applies the stage look before the first match draw, avoiding midmatch chat.
  Classic and Definitive use the same setup; omitted options keep current defaults.
  `-dev classic NAME` starts that fighter's Classic run and `-dev classic boss NAME` its boss battle (smashcraft:docs/design/classic-mode.md).
  `-dev lore N` starts Lore Battle N (1-20, smashcraft:ts/src/game/classic/loreBattles.ts) for the first player.
  `-dev lore win` during a Lore Battle knocks out every opponent (a boss's health to zero), so the battle ends and is saved as cleared through the normal result.
  `-dev quick offstage hero NAME` starts the #189 recovery check at x=700, z=300 on Frozen Throne with jumps spent.
  The named variant uses the normal CPU selection rule.
  `-dev pain HEIGHT STRENGTH FIGHTER` starts the #181 mirror capture fixture:
  low/middle/high and small/medium/large, with ordinary projectile contacts at
  frame 150 after both players' scripted jab. `bun tools/animations/pain-pads.ts`
  from the repository root generates its 117 native parity scripts.

- Item setup at fighter selection: `-dev items on|off` controls whether pickups appear;
  `-dev item speed|jump|heavy on|off` controls each kind. The normal selection
  buttons show Items, Speed, Extra jump and Heavy, all on by default.

- Meter drop setup at fighter or stage selection: `-dev drops on|off` controls
  whether meter drops appear; the stage menu's Drops button does the same
  (smashcraft:docs/gameplay-design.md, "Meter drops").
