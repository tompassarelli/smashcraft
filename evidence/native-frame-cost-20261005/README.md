# Native paired frame cost — 5 October 2026

One paired workload ran in Warcraft: 4096 production simulation frames per
executor. Source commit:
`ba88e6dfb80403a4678113643918c6af33120118`. Private diagnostic map SHA256:
`563eafb6a252a90b7d19c509146e6b7ac7e402e947ea638f70ad25c84e4521f3`.

smashcraft:evidence/native-frame-cost-20261005/result.json retains the exact
native readback result. Wurst took 1.450195296 seconds; TypeScript took
1.225585936 seconds, a TypeScript/Wurst ratio of 0.8451178536990649.
Both final checksums were `391715:668934`.

smashcraft:ts/scripts/frameCost.ts validated each record's final checksum
against its complete canonical state and compared the initial checksums,
final checksums and complete final state strings for exact equality. The
paired workload passed that comparison and the ratio ≤1.0 gate. The timer is
Warcraft's `os.clock`, shared by both executors.

This is one paired native workload, not a distribution of frame costs or an
input-timing result. The diagnostic map and game assets remain private.
