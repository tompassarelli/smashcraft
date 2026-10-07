# Air cap and floor integration

Measured 7 October 2026 UTC from main `5fc28926`, which includes Kael's
intentional 1.25 air-speed cap and Banish defensive use.

The Thrall owner explicitly authorized carrying only his tested 0.735→0.75
air floor and matching first body paragraph from `e50223f6`. No neutral,
recovery, art or other Thrall changes from that commit were included.

- `bun test ./scripts/airDrift.tests.ts`: the original 3 cases passed, 0
  failed, 170 assertions. All 21 fighters meet the unchanged air-speed and
  acceleration bands, preserve shared dash/run jump momentum and cross over
  a shield with a dash/jump/aerial.
- Current-21 Kael CPU coverage: 8 matches, specials 50/10/9/9, 124 ordinary
  attacks, 0 missing actions. The complete counts and selectable roster are
  in `cpu-air-cap-and-floor.json`.
- Kael's 9 Bun and 9 number-plugin Lua32 contract passes after his cap are
  retained from `air-cap-checks.md`; his source did not change in this piece.

The checks ran together in one `heavy` capacity scope, which released.
Publication uses the parent's explicitly permitted `moderate` scope for the
short frozen install and push checks under the shared main lock. No field or
native clients ran here.
