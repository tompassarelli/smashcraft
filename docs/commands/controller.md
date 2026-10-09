# Controller

- Controller layout: `bun wisp controller layout standard|zjump` changes the running service live, or saves the choice for its next start. Layout, tap jump and left/right full or light shield are kept in `~/.config/smashcraft/controller.json` (or `$XDG_CONFIG_HOME/smashcraft/controller.json`) and editable on the client Controller page.

- Controller: `bun wisp controller` points the always-on controller service
  (`wc3-journal --service`, the login unit smashcraft-controller.service) at
  main's helper and restarts it, or runs the service in the foreground when
  the unit isn't installed. The service finds Warcraft III on :0, the pad and
  any Smashcraft session by itself, so a map opened from Custom Games plays
  on the controller: a keyboard build (the playable one) gets the pad as the
  map's standard keys, a journal build (integrity) a journal helper
  (smashcraft:companion/README.md, "Always-on controller service"). The
  controller is optional: the keyboard is the baseline.
