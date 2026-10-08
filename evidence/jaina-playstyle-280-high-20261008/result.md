# Jaina Frostbolt focused trials (#280)

Two high-tier trials failed the original neutral-special use target. Neither
gameplay change is accepted or landed.

Both computers were Wren Expert, three stocks, four minutes, spawn variant 0,
10 requested seeds and 40 requested matches per pair. The same eight pairs
produced 48 matches each: 384 Jaina matches per trial. Opponents were Archer,
Rifleman, Illidan, Warden, Lich, Thrall, Chen and Goblin Tinker, in both orders
on every soak stage. The saved baseline is from the preceding worker; later
main changes include Archer's independent gameplan adjustment.

| Trial | Source | Run | Frostbolt starts / all starts | Frostbolt damage / all damage | Wins |
| --- | --- | --- | --- | --- | --- |
| Baseline | `febfa549646b662e676e49bb1b293f0b63c5dd1d` | [37760191766](https://github.com/tompassarelli/smashcraft/actions/runs/37760191766) | 13,742 / 32,439 = 42.3626% | 62,813.0001 / 136,161.4725 = 46.1313% | 251 / 384 = 65.3646% |
| Frostbolt mana 6 to 12 | `9358f14daa669678bf2e91b87c7fb4b7cb391c9b` | [37762406786](https://github.com/tompassarelli/smashcraft/actions/runs/37762406786) | 10,421 / 30,043 = 34.6869% | 47,901.0001 / 125,594.7225 = 38.1393% | 179 / 384 = 46.6146% |
| Original 6 mana; quarter computer preference | `5b6e359cc6036ae0fba76ed4158a2c98089832ee` | [37763169756](https://github.com/tompassarelli/smashcraft/actions/runs/37763169756) | 11,144 / 30,963 = 35.9913% | 53,355.0001 / 130,771.8059 = 40.8001% | 232 / 384 = 60.4167% |

The fixed targets are use 5–25%, damage at most 40%, and shared-field wins
40–60%. The mana trial passed only the damage target. The preference trial
missed both focused targets. Displayed balance scores were baseline 40.4,
mana 26.7 and quarter preference 27.5.

The original spacing, damage, travel and timing stayed fixed in both trials.
The second trial added optional per-move weights to the existing gameplan
chooser and set only Jaina's Frostbolt weight to 0.25. Lower weight does not
remove a spell when it is the only available ranged option. Raising mana
cost to 12 still leaves Frostbolt affordable below Blizzard's 18 and the
elemental's 24. Both trials barely changed its share of starts.

Type checking and source checks passed before both farm dispatches. No
rejected-trial gameplay contracts or emitted Lua check were run locally;
there is no accepted change requiring the shared Lua or final roster field.
The initial quarter-preference publication had an assertion signature error,
fixed before its farm dispatch. Scratch farm refs were deleted by the waiter.

Stopped after two failed fixes. Recommended next trial: use the existing
`AuthoredSpecial.cooldownFrames` with 120 frames on the original six-mana
Frostbolt, giving Blizzard and Water Elemental openings between bolts without
reducing Frostbolt damage. Estimated focused measurement and contracts:
10 minutes. No cooldown change was made in these trials.
