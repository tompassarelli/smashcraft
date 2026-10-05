# TypeScript native input integrity — 5 October 2026

One same-host, two-client run exercised start, result and rematch with persistent
Linux virtual-pad helpers, every input binding, and deliberate helper/game
stalls. Build identity: `typescript-integrity`; two match epochs; rollback
limit: 24 frames. Controller navigation was used, with a keyboard diagnostic
trace toggle. This is a diagnostic run, not a new playable release.

The helper executable SHA256 was
`d78e70838306ae55adfc59928277f6019ae64648f06461b9f59bfc54cb7ecce3`.
The private diagnostic map SHA256 was
`816293dee60eec35bd696374808b579b699cc3e58720dc9c0718432143f85eff`.
The retained capture does not establish the map source commit; the map hash
and capture build identity identify the artifact actually exercised.

Its source includes `5ba10d4` (bounded pause preparation) and `1fdfceb`
(ignore controls published before the current match), published here as
`0b66383` and `71155bc`. These repairs already passed their focused Rust
checks and this native run; neither was repeated for publication.

smashcraft:evidence/native-ts-integrity-20261005-r3/summary.json preserves
the reconciled numerical result and distributions; the adjacent integrity
table gives the aggregate answer. Each player injected 648 edges: 0 lost,
duplicated, reordered or stuck; 1296/1296 applied on their original frames.
Final checksums agree between clients in both epochs (`370825:612971` and
`525067:124509`). Evidence failures: none.

Capture exited **0**. Reconciliation exited **1** solely because local-response
acceptance remains false: p50/p95/max **0/49/83 frames**, n=200; zero legal
actions missing their first prediction. Opponent lateness was **6/18/23**
(n=1391), rollback depth **8/18/24** (n=348). There were 49 prediction stalls,
longest 57 service callbacks. The local-response repair remains owner-gated;
this record does not claim that gate passed.

Only independently recorded numerical results are published. Private map,
assets, client paths, raw captures and account details remain outside the
repository. Physical-controller latency, cross-machine alignment, four-fighter
acceptance and input-to-screen time were not measured by this run.
