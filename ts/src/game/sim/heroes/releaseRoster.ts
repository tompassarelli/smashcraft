// Fighters hidden from selection in this build because they failed the balance
// gate (smashcraft:docs/design/roster.md, "Balance gate"). Written by
// `bun scripts/releaseRoster.ts FIELD.json`; compiled into the map, so every client agrees.
export const HIDDEN_FIGHTERS: readonly string[] = [];
