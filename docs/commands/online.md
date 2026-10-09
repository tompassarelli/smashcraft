# Online

- Direct play: `bun wisp online host [--client NAME] [--password VALUE]` hosts the newest
  Smashcraft map as a private Battle.net game and prints its join code;
  `bun wisp online join CODE [--client NAME] [--password VALUE]` joins it;
  with an explicit host password, the guest supplies that same password. All
  hosted games are private and passworded; without the flag the code carries
  the generated password. Both return at fighter selection. The host presses Start now once the guest has joined; no Battle.net chat is sent.
  `online setup` installs the menu page and Allow Local Files after
  the owner agrees. The client's Online page runs them
  (smashcraft:docs/design/client.md, "Direct play").
