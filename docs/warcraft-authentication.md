# WC3 authentication incident: bounded diagnosis

Observed 2026-10-03 15:22–15:24 UTC. Read-only; no GUI inputs, restarts, login attempts, network changes or credential disclosure performed.

## Decisive finding

The latest login form followed Battle.net launching Warcraft after its W3 SSO generation explicitly failed with `ERROR_RPC_REQUEST_TIMED_OUT (3006)`. The launcher was visually retained but its authentication transport was stale. Both launcher processes retained TCP connections bound to a VPN source address which NetworkManager had removed. This is a concrete transport failure; it is not evidence that the user's password or saved login expired.

## Evidence chain (UTC)

- A launcher reports successful Battle.net login at 14:30:27.804006; B at 14:30:56.861810. Private comparison of logged-in Battle.net identities: **different**. No account values reproduced.
- A successfully prepares a launch at 14:36:53.290383 and launches the executable at 14:36:53.896599. No SSO error occurs in that launch interval.
- NetworkManager at 15:09:50.7069 deactivates `proton0` with reason `connection-removed`. It records the ProtonVPN connection-delete operation at 15:09:50.7082 and deletion of source address `10.2.0.2/32` at 15:09:50.7859. Audit actor is PID1123350 UID1000; process is no longer live, so human versus automation origin is not established.
- A starts repeated presence RPC timeouts at 15:11:55.384769.
- A Play request at 15:12:54.494985 enters pending launch.
- At 15:13:09.494882 the launcher reports `Pending game launch expired before Agent reported it running`; Execute operation expires too.
- At 15:13:39.599197 W3 GenerateAuth fails with RPC timeout. At 15:13:39.599987 launcher reports SSO token generation error. It nevertheless launches Warcraft at 15:13:39.737389. The approximately45s delay is the observed auth request timeout path, not verified game-loading time.
- Both retained launcher TCP connections to port1119 remained ESTAB at inspection, bound to removed source `10.2.0.2`, with 3354/2213 bytes unsent, retransmission backoff13, and no received data for roughly15–17min. A fresh route query selects Wi-Fi source `192.168.110.55`; current interfaces have no `10.2.0.2`. New Warcraft sockets use the Wi-Fi source.
- B also reports recurring presence RPC timeouts from 15:21:12.620783.
- `ACCOUNT_TS` exists on both successful and failed launches and is numeric. It is a timestamp, not proof of SSO success. Do not emit its value or any ACCOUNT value.

## Cause and scope

High confidence for the latest failed re-entry: transport continuity was lost across VPN interface removal; retained launcher TCP sessions were not usefully reconnected; W3 SSO generation timed out; launch continued and game presented login. It is incorrect to call this a saved-credential failure based on the form alone.

The earlier game disconnect was observed before the15:09 VPN removal according to retained task context. Its precise native reason remains unknown; this event cannot explain that earlier symptom or every login today. The current `War3Log.txt` is empty. Same-account eviction is not supported for current A/B because identities differ. Direct executable launches and prefix/runtime misuse remain separate historical paths, not established causes for this specific launch.

## Prevention and immediate recovery recommendation

1. Hold the network route/interface stable through an authenticated development session. Do not change VPN mode while game or launcher auth sockets are active. This preserves TCP session continuity; it cannot promise that servers never expire credentials.
2. Detect network-interface/address changes using netlink/NetworkManager events. On a change, invalidate automation's *connection-health assumption* immediately; never mistake retained UI or ESTAB TCP alone for functioning auth.
3. Before Play, inspect the current launcher auth socket source against live local addresses and inspect fresh auth errors. A removed source or current repeated RPC failure is a transport blocker. Reconnect the launcher's transport with its supported reconnect path, then observe successful login/auth response before Play. If no supported reconnect is available, a controlled launcher restart using the same preserved prefix is the minimal candidate, but cached auto-login must be tested; never promise it in advance.
4. Treat explicit W3 GenerateAuth/SSO error after Play as failed launch. Do not ask the user to type credentials into the resulting game login form. Repair launcher connectivity first. ACCOUNT_TS presence is insufficient.
5. Email only on a verified interactive challenge/credential requirement after transport is healthy, with prefix/client/display and exact action. A network RPC timeout is machine-recoverable diagnosis, not yet a user sign-in request.
6. Acceptance: stable source route, functioning launcher auth response, W3 launch with no SSO generation failure, real game main menu, leave/rejoin/rematch without restart. Repeated native trials are still required before claiming the devloop fixed.

## Reproduction sources (private)

A: `~/.local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/users/steamuser/AppData/Local/Battle.net/Logs/battle.net-20261003T143015.186541.log`

B: `~/.local/share/wc3-melee/client-b/pfx/drive_c/users/steamuser/AppData/Local/Battle.net/Logs/battle.net-20261003T143044.835889.log`

Network journal: `journalctl -u NetworkManager --since '2026-10-03 23:09:45' --until '2026-10-03 23:09:55' -o short-iso` (host timezone Taipei, +08:00).

Transport: `ss -tinpH dst 34.125.242.191`; `ip -brief address`; `ip route get 34.125.242.191`.

Do not publish raw launcher logs; they contain account/auth material. Extract timestamp, event name and error code only.

## Historical avoidable triggers

Prior evidence records same-account concurrent sign-in coinciding with host eviction, direct executable relaunch losing a completed login, and duplicate runtime/wineserver use against one mutable prefix. Current A/B identities are different. Do not reuse old explicit one-hour desktop commands or direct game-entry commands for retained sessions. None of those historical faults proves the cause of every earlier disconnect.

## Notification availability

No exposed email connector, sendmail/msmtp executable, running Proton Bridge, or local SMTP listener is available. Existing encrypted mail state was untouched. Automatic email is not configured and no email was sent. This remains an explicit deliverable, not a completed claim.

## Verified reconnect result

A already had AutoLogin and RememberAccountName enabled. On scoped recovery of its unusable TCP connection at 15:26 UTC, cached login data was found, then Battle.net explicitly rejected the saved token. The launcher deleted it, reported ERROR_TOKEN_NOT_FOUND (49), and entered LoginCredential. The reason for server rejection is not logged; it cannot be attributed to VPN change conclusively. Interactive authentication is now a real blocker, not a request to repeat login as a speculative fix. No further restart or sign-in attempt was made.

## Executable transport check

Run `wc3-melee:tools/wc3-auth-transport LAUNCHER_PID` before Play/recovery. It inspects only the selected Battle.net browser process. It refused the still-stale B socket because its source address is absent. Syntax check passed. A source-present result is expressly not authenticated readiness; inspect current launcher auth events and a verified real main menu separately. This tool reads actual socket/address state; it does not estimate authentication from elapsed time, launch timestamps or an account label.
