# Jaina projectile identity

Frostbolt and its casting cue use
`Abilities\Weapons\SorceressMissile\SorceressMissile.mdx`.
The classic HumanUnitFunc `hsor` record names this missile; its extracted
model is 50,776 bytes. It is unused in the checked 17-fighter inventory and
the four pending kits.

- Bun projectile-art contracts: 2 passed, 111 ms.
- Bun spell-cue contracts: 6 passed, 131 ms.
- The same eight presentation contracts passed in emitted Lua32.

Only the projectile and cue model paths changed; gameplay numbers and the
authored Jaina model are unchanged.
