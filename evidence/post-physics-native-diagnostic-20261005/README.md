# Replacement native physics diagnostic — 5 October 2026

The TypeScript replacement diagnostic reports **9/16 groups passing, 7 failing**,
**26 messages**, and verdict **`NATIVE_PHYSICS_FAIL`**. This is a failed native
physics check for #9; it does not satisfy that issue's native acceptance box.

Source: `5a60a9cfd8198a6f7319b8169c9ba3796200cf72`.
Native receipt bundle: `137580-4480135`.
Private diagnostic map SHA256:
`79029df2709e12e8b6e349ee43456cd309d41e6711b74da2aa3c55a184270cab`.

smashcraft:evidence/post-physics-native-diagnostic-20261005/result.json retains
every decoded diagnostic line, the passing and failing groups, exact reported
case failures and mismatch counts. Failing groups are shield-contact sum,
air decrement, air cutoff, ground motion, analog shield, directional influence,
and capsule/shield classification. Launch-magnitude mismatches: **0**;
directional-influence mismatches: **1**; discrete directional-influence
mismatches: **1**.

Some failed cases display the same decimal text for expected and actual
values. That display does not establish binary equality: retain the native
failure verdict. Expectations and diagnostic output were not changed or
weakened for this evidence. No arithmetic repair or new native run was performed
while preparing the record.

Only authored diagnostic messages and numerical records are published.
The proprietary map/assets, raw client file and account paths remain private.
