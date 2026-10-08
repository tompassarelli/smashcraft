# Map size

Players download the map in the lobby, and a smaller map downloads faster, so
more of them stay (#264). Prefer Warcraft's built-in assets: reshape, recolour,
rescale or recombine stock models, doodads, effects and animations before
importing a file. Custom assets are fine where stock can't do the job well.
The size is a number to watch, not a ban.

## How it is measured

`bun wisp map build` prints the built map's size and its imported bytes, e.g.
`map 177.8 MB, imports 168.6 MB (95%) in 2455 files`. An import's bytes are what
it occupies inside the archive (compressed), read from the map's MPQ block
table (smashcraft:ts/scripts/mapSize.ts). Imports are the files the build
declares plus every other file in a folder of the archive; the map's own root
files (`war3map.lua`, `war3map.w3i`, ...) are not.

The default build (no `--profile`) compares the map with
smashcraft:ts/map-size-baseline.tsv and fails when it is more than 10% larger,
naming the five largest new or grown imports. After a justified import or a
cut, rebuild with `MAP_SIZE_UPDATE=1` and commit the rewritten baseline.

## Measurement, 8 Oct 2026

Build of main at 88e494da (`bun wisp map build --name Smashcraft`):

| Part | Files | Size |
| --- | ---: | ---: |
| Whole map | | 177.8 MB |
| Imports, total | 2455 | 168.6 MB (95%) |
| - declared by the build | 2211 | 138.3 MB (78%) |
| - carried from the container, not declared | 244 | 30.3 MB (17%) |
| Map's own files (`war3map.lua` 1.16 MB) | 20 | 1.2 MB |
| Free space left by replaced entries, tables | | 7.9 MB |

By kind (all imports, by file name): fighter clip-pool models 89.6 MB in 1963
files, textures and portraits 37.1 MB in 342, white-flash body copies 19.3 MB
in 71, other models 13.0 MB in 72.

The 10 largest imports:

| Import | Size | Note |
| --- | ---: | --- |
| `IllidanWhite-7299c290….mdx` | 4.16 MB | white flash copy |
| `DemonHunterFighter-d586986c….mdx` | 4.04 MB | |
| `DemonHunterFighter-eabc4b5a….mdx` | 3.56 MB | older version, not declared |
| `RiflemanWhite-d95ad99e….mdx` | 3.28 MB | white flash copy |
| `RiflemanFighter-9f110074….mdx` | 3.25 MB | |
| `ArcherWhite-6783f3c3….mdx` | 3.20 MB | white flash copy |
| `ArcherFighter-94cea621….mdx` | 3.17 MB | |
| `ArcherFighter-33738800….mdx` | 3.05 MB | older version, not declared |
| `RiflemanFighter-f9912ada….mdx` | 2.93 MB | older version, not declared |
| `ForsakenPaladin.mdx` | 1.57 MB | |

All are under `war3mapImported\`. The largest cheap cut is the 30.3 MB the
container still carries that the build no longer declares (older fighter
versions and portraits), plus the 7.9 MB of free space a fresh archive would
not have.
