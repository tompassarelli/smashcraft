# Native packet comparison checkpoint

Competitive verdict remains HOLD. Full online/controller acceptance is incomplete.

Exact 0.0.19 candidate `20261003T221416375056960`, SHA256
`246ce77febd0ac5cece16b43a3b530bc33eb6910917982ec2e5255f6dcbb2e80`,
was extracted privately and inspected. Its script contains original one/two-row
cursor advancement and the exact-local-next-row speculative admission guard.
Existing journal tests passed 3/3; existing corpus generation passed 1/1.
The build script promotes the final artifact only after package extraction and
byte comparison gates; no final interrupted-worker log was recovered.

Both installed maps match that hash. Previous 0.0.18 maps are privately archived
under `~/.local/share/smashcraft-build-inputs/native-map-archive-20261004/install-0019-1791066155886282725/{a,b}/`.
Both signed-in clients were reused without restart, joined
`sc-journal-0019-1004`, and entered Archer versus Rifleman, Sky Deck,
three stocks/seven minutes, unused slots closed. Ready receipts identify
epoch 1 and local slots 0/1.

Before publishing, each client recorded 300 callbacks, F1, confirmed F0,
zero speculative steps/failures and zero trace drops with all rows absent.
See `wc3-melee:evidence/native-journal-packet-comparison-20261004/{a,b}-missing-before.txt`.

Singleton publication completed: 1,200 immutable packets, 600 frames/slot.
Host publication lateness median 1.2812295 ms, p95 1.897285 ms,
maximum 2.830156 ms. These measure file publication, not input response.

First clean service export contains 1,461 service rows/client over
24,341.949 native ms and reaches confirmed F190. Observed confirmation plateaus
include F126 from 10,378.692 to 15,160.857 native ms (4,782.165 ms),
F159 for 4,398.925 ms, and F190 for the final 4,482.240 ms.
Service rows continue during these plateaus. Native time is not host wall time.
No packet-quota or network/engine cause is established.

Later short traces reach F351 and F543 with matching sampled checksums,
zero rejected rows, zero speculative failures, and zero drops in those windows.
Those windows are retained as `singleton-progress` and `singleton-late`.
No claim about all-session rejection counts follows from short windows.

Both clients reached confirmed F600/checksum `132930:406073`; the retained
exhaustion window has zero speculative failures and zero drops. This closes
the native finite-source wait check for this candidate and corpus.

The singleton fight was left through verified Game Menu / End Game / Quit
Mission without restarting either authenticated client. Its 612 test-owned
files/client were moved privately to
`~/.local/share/smashcraft-build-inputs/native-map-archive-20261004/singleton-journal-1791067437269368898/{a,b}/`
while both clients were outside the map.

The pair arm ran on the exact same candidate, selections, stage, stocks, timer,
and underlying authored inputs. Pair publication completed 600 packets total,
two rows/packet, at each pair's last nominal capture time. File publication
lateness median 2.1921285 ms, p95 2.890713 ms, maximum 8.586402 ms. This includes
neither physical capture nor network delivery. The intentional pairing wait is
one nominal frame before publication; lateness is additional to that wait.

Its first clean recording contains 2,179 service rows/client over 36,299.383
native ms and reaches confirmed F352. Plateaus include F288 for 4,148.986 ms
and F320 for 3,865.722 ms. Halving packet count did not eliminate the long
confirmation plateaus; this does not identify a native quota or specific cause.
Both clients later reached F600 with the same checksum and no speculative
failures or drops in the retained exhaustion window.

Host scheduling counters were sampled over 24,970.573 host ms during the pair
trial. Largest cumulative runnable-wait delta among retained threads was
95.244306 ms for A and 107.816455 ms for B. These per-thread Linux counters
argue against multi-second runnable CPU starvation in this sampled interval.
They do not measure callback/render cadence or rule out sleeping, blocking,
native clock catch-up, or every private-desktop effect. Raw counters are in
`wc3-melee:evidence/native-journal-packet-comparison-20261004/pair-host-scheduling.json`.

Live state at 22:56 UTC: both retained clients remain in the pair fight at
finite-corpus exhaustion. Pair epoch-1 files are still immutable and installed.
All retained native exports identify 0.0.19's build. Rehosting resets epoch to
1; archive the exact test-owned files while outside the map first.

Next: discriminate local admission/submission from synchronized receipt on
both clients and repair the first measured owning cause. Continue live capture
and frame mapping, visible/audio recovery, human fights/rematches, 3–4 players,
and cross-platform companion acceptance. Current deadline is 08:38 Taipei;
the 07:08 first usable checkpoint remains pending.
