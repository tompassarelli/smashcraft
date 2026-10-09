# Controller

- Controller layout: `bun wisp controller layout melee|z-jump|tom` changes the running service live, or saves the choice for its next start. Layout, tap jump and left/right full or light shield are kept in `~/.config/wc3-controller/settings.json` (or `$XDG_CONFIG_HOME/wc3-controller/settings.json`) and editable on the client Controller page.

- Controller: `bun wisp controller` builds main's controller (the pinned
  wc3-controller service and Smashcraft's plug-in `wc3-journal`, from
  smashcraft:controller), points the always-on service (the login unit
  wc3-controller.service) at it and restarts it, or runs the service in the foreground when
  the unit isn't installed. The service finds Warcraft III on :0, the pad and
  any Smashcraft session by itself, so a map opened from Custom Games plays
  on the controller: a keyboard build (the playable one) gets the pad as the
  map's standard keys, a journal build (integrity) a journal helper
  (smashcraft:controller/README.md). The
  controller is optional: the keyboard is the baseline.
