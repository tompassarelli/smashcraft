# Primary warm-menu trial, 6 October 2026

Candidate: Smashcraft 4dfffcb5, Wisp 248db12; unchanged playable-0047 diagnostic map. Primary output eDP-1 was 2880×1920, scale 2. Battle.net was already signed in when `bun wisp play --menus` started. A had one runtime on :0; B remained on :2.

The command stopped at step 3 after 26.162 seconds. It did not find Warcraft III with its installation state in Battle.net’s Games tab. Warcraft did not start, no helper started, and no match or stage capture was obtained. This trial does not pass the under-30-second warm-match gate. Existing accepted cold result remains 72.5 seconds.

A’s supported Wisp menu page was installed on port 47124; `Allow Local Files` was enabled while its runtime was stopped. The private registry backup and launcher captures remain at `~/.local/share/smashcraft-build-inputs/primary-menu-20261006/`, outside Git. B’s configuration and account stores were preserved.

The owning parent stopped further primary retries and selected restoration to the verified private desktop path.
