# Alternative host on the retained clients, #19 — 6 October 2026

**Blocked: the signed-in Warcraft 3.0.0.24268 clients cannot find a game
from a local host, by any route that leaves sign-in alone.** The Multiplayer
menu goes straight to Battle.net Versus/Custom Games, with no LAN entry.
The game's only local discovery component is `ClientSdkMDNSHost.exe` in
`_retail_/x86_64`, a bundled Apple Bonjour mDNSResponder. `ClientSdk.dll`
browses `_blizzard._udp,_%s` through it. It was not running for either
client. While a client sat on Custom Games, the client sent no traffic on
UDP 5353 or 6112, or from its only UDP sockets (unconnected, ephemeral ports
55816 and 58074), in a 30 s packet capture.

A game advertised by the existing host was not listed in Custom Games. The
host was `w3gshost` (SHA-256 `62a1aa45…`) on 192.168.110.55:6113, named
`SCLAN19`, version 10032, for 90 s (host.log). A 40 s capture during that
window saw no Warcraft query and no announcement from the host. The other
mDNS traffic came from unrelated devices on the shared network.

`Warcraft III.exe` names no LAN or direct-connect command-line option; the
only option string found is `--repair`. The remaining routes all touch what
this work must preserve:

- launching the client with other arguments (forbidden as a direct launch);
- starting the bundled responder inside a live prefix through a second Wine
  runtime (risks the signed-in sessions);
- installing a third-party launcher into the prefixes (not authorized).

Native time used: about 15 minutes. No sign-in, prefix, launcher or client
process was changed, and both clients stayed at Custom Games.

## Facts gathered

- Both games share the host network namespace (`net:[4026531833]`).
- The host binary advertises over mDNS and answers queries
  (`lan.NewMDNSAdvertiser` in its `cmd/w3gshost/main.go`). It has no other
  discovery route.
- The map it served was the current private integrity diagnostic copy:
  38,551,776 bytes, SHA-1 `93df44b2…`.

## What would unblock it

A client whose own discovery runs and can be observed, then measuring its
query to learn the subtype and version. The clients must keep their sign-in
throughout. One example: a separately installed client in its own prefix,
started through its own launcher, that is allowed to sign in. That is an
owner decision about a third installation and a third account session, not
a change to the retained clients.
