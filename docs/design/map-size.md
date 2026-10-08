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

## Unused imports and slack removed, 8 Oct 2026 (#286)

Build of main at eebd57ca, before and after (`bun wisp map build --name Smashcraft`):

| | Before | After |
| --- | ---: | ---: |
| Whole map | 162.7 MB (162,673,513 B) | 122.7 MB (122,662,148 B) |
| Imports | 153.4 MB in 2551 files | 121.3 MB in 2266 files |
| Free space left by replaced entries | 7.90 MB | 0 |

The same cut on main at 56465340 builds 122.3 MB (122,344,480 B), imports
120.9 MB in 2264 files, 368 B free; that is the committed baseline.

Three cuts, 40.0 MB in all:

- **Container leftovers, 245 files, 30.28 MB.** The container map
  (`container` in smashcraft:build-inputs.json) carried files no build
  declares: superseded Archer, Rifleman and Illidan models and clip pools,
  their old TGA portraits, tiles and names, the old match HUD, two selection
  cards for slots 5 and 7, and older stage and impact models. The build
  copies the container and replaces entries in it, so these rode along, and
  every replaced entry left its old bytes behind as free space.
- **Archive slack, 7.90 MB.** The container is now a compacted archive
  holding only `war3map.imp`; the base map's files and every import are added
  to it fresh, so nothing is replaced and the built map has no free space.
- **Declared but never named, 40 files, 1.82 MB.** The neutral
  (slotless) card, bust and stock-icon portraits of the 13 rendered
  fighters: the map draws those only in a slot's outfit; only the selection
  grid's tile is also drawn without a slot (`MAP_PORTRAITS` in
  smashcraft:ts/scripts/wisp/mapInputs.ts). And the Three Bridges stage
  thumbnail, whose stage is not in the catalog.

How each was confirmed unreferenced: every file's name without its
extension (so a `.blp` reference to a `.tga` counts), case-insensitive, was
searched in the built map script (`war3map.lua`, every string the script
holds, sound labels included), the generated object data (`war3map.w3u`,
`war3map.w3a`), the post-processing file, every base-map file, and the bytes
of all 2306 declared imports (every model's texture, attachment and event
path), then in smashcraft:ts/src, smashcraft:ts/scripts, smashcraft:tools and
smashcraft:build-inputs.json. None of the 245 container files matched
anywhere. Names the script builds at run time (portraits, selection cards
and chips, HUD plates) were checked at their call sites instead: selection
cards take slots 1 to 4 only (red, blue, teal, purple), and
`fighterPortrait` is called with a slot for every card, bust and stock icon.
A headless render of all 11 stages and all 22 fighters (one frame each, both
clients), reading imports from the built map's own files, asked for 93
imports and found every one. Stratholme's frame stops in the renderer on its
stock tower model (a Reforged `.tif` texture and a geoset it can't build),
the same on the uncut map.

| Removed file | Bytes in the map | Source |
| --- | ---: | --- |
| `war3mapImported\DemonHunterFighter-eabc4b5affd15559d54db07508b4572e17b20632b8502e0c7c173cf3df8adcff.mdx` | 3,556,996 | container |
| `war3mapImported\ArcherFighter-33738800a56ce43a79ea18c1a2f369bf95ac60d7694c2be2e98d0c00843d85ed.mdx` | 3,049,905 | container |
| `war3mapImported\RiflemanFighter-f9912ada2ddd7a81cad9a98936f5facc5b42a31627b0f064eacafa3b6588c932.mdx` | 2,927,841 | container |
| `war3mapImported\RiflemanPortrait.tga` | 1,439,084 | container |
| `war3mapImported\ArcherPortrait.tga` | 1,269,953 | container |
| `war3mapImported\DemonHunterPortrait.tga` | 1,074,868 | container |
| `war3mapImported\ArcherOriginalClip23-c379b096f245da174e817901dc89b9f7b23e99c843b5ca7f79a44ac9914651df.mdx` | 465,263 | container |
| `war3mapImported\ArcherOriginalClip22-f282b5db0137dd90f48d5f6add4004806b1037881662d7dce02675ec5b1c047f.mdx` | 350,018 | container |
| `war3mapImported\IllidanOriginalClip84-210c61ba0f5eadb13f9c8c6ad65d33c2c76bfed373edcf739566e416881cdb7b.mdx` | 344,218 | container |
| `war3mapImported\RiflemanTile.tga` | 335,665 | container |
| `war3mapImported\RiflemanOriginalClip22-ab45aece4545790471eae65ca38808e59226dcb3adb16cbbe442c9aaeecd4123.mdx` | 323,220 | container |
| `war3mapImported\IllidanOriginalClip83-99dfe90d16d3fc17ab51a83c441235c91c1dbefd4f8ff2dd1a348986f069f66b.mdx` | 321,908 | container |
| `war3mapImported\ArcherTile.tga` | 277,678 | container |
| `war3mapImported\IllidanOriginalClip18-3ec8c0bf9e8961614caa261d3477b144c167013c81b30612f7ee26cc09e3009c.mdx` | 245,241 | container |
| `war3mapImported\DemonHunterTile.tga` | 232,929 | container |
| `war3mapImported\ArcherOriginalClip46-9d05a91155d92962de4ff768937798f066f3b8fe8a1b726a2d395cda3252dd69.mdx` | 230,765 | container |
| `war3mapImported\RiflemanOriginalClip21-5e56937c271a56ede3c8778f1352525fdea9fddaa2128b7089965d63429a4cfd.mdx` | 224,924 | container |
| `war3mapImported\IllidanOriginalClip59-f7713cc360fcbd32bb19d15f9c9a7c89ae351f5d05c9144b899552184e83a034.mdx` | 207,457 | container |
| `war3mapImported\ArcherOriginalClip16-8efe852e2c3ff51cba3aac8ccfc88906b2085c8ae2f7a585c2a569e4043f6773.mdx` | 184,681 | container |
| `war3mapImported\IllidanOriginalClip8-d8f05f183772a0f5a493aa10cab4dcdc492f1bf3e11b101a75fcff6b196fbe2c.mdx` | 173,722 | container |
| `war3mapImported\IllidanOriginalClip82-79205ef7f788c98826fbeea310aa5bb055a161ba1b4f4a85169dda4aed4c4cb2.mdx` | 165,991 | container |
| `war3mapImported\IllidanOriginalClip7-900000108c5f4d3e6786b30097f5e81b6e140650214847de0d779dc0669a09ee.mdx` | 162,793 | container |
| `war3mapImported\IllidanOriginalClip108-76c6fad158661706607d70f9c941ea183e9aa5e096bfff97f0e0b1215ad93c2c.mdx` | 160,398 | container |
| `war3mapImported\ArcherOriginalClip28-9ceedb14bef4a2cd4051bf3a075b898bd9dd511fec04af8768c6d8244a1ad6c2.mdx` | 156,997 | container |
| `war3mapImported\IllidanOriginalClip78-3fd6277078c28cfc140a16c344b335b80f208bb97893b0de0435c2763df64012.mdx` | 153,936 | container |
| `war3mapImported\IllidanOriginalClip58-e420b625724e8950bbcae1b00d0aa972d6bef7a89741e7e6872c0db769c2de9f.mdx` | 148,108 | container |
| `war3mapImported\IllidanOriginalClip107-e1978574c67e1c4bce3c28ad62e8aa106a2fd72c640518594d6b05f651813f58.mdx` | 147,538 | container |
| `war3mapImported\IllidanOriginalClip19-631683e9d15761ac4cb4ca540fa0130202f9115de22cbc05bcb0f9acceb84c6d.mdx` | 139,857 | container |
| `war3mapImported\IllidanOriginalClip6-f1842ce5ceb460ca02fdd0ee47ceb361a1ed56b7c5b5cd0fbc8fe5897f6d226a.mdx` | 137,479 | container |
| `war3mapImported\IllidanOriginalClip88-c7e0fc4f2bc1801afdedd43c87ea558c68221fd5c85511794f68f29848b9e67d.mdx` | 127,177 | container |
| `war3mapImported\IllidanOriginalClip79-b825a9b2e4e52be5fa3731c73ec371bbdf6c2bbc51916d2c0000fd1059cfb1d5.mdx` | 126,269 | container |
| `war3mapImported\IllidanOriginalClip85-ca9f39d4cea5cb590f00f7f1a38b7b65d3108825f536fa21d1753b49c457107d.mdx` | 123,711 | container |
| `war3mapImported\ArcherOriginalClip57-93e382ed34499dada872e879839ed1724b11ec9dc8bd61e63e5c20268bfcf254.mdx` | 117,883 | container |
| `war3mapImported\RiflemanOriginalClip27-a8ae4f3cf2408412bc4645dc10bc72fdc4577330647a16aa7d8e1ccb2fb6173f.mdx` | 115,157 | container |
| `war3mapImported\RiflemanOriginalClip11-8961da71171d647d9aabd1b910e96c6195ceaa43204b7f5e124e297db5b781c4.mdx` | 111,826 | container |
| `war3mapImported\RiflemanOriginalClip15-71a6ff41a2a9f96af62e1145cf31757894e80b647219b88e1088f825cb18a536.mdx` | 110,967 | container |
| `war3mapImported\RiflemanOriginalClip54-5c5e3dffea93feda9a676b2322dd681218872f2bb65a6c6e1507848120de7f9b.mdx` | 110,110 | container |
| `war3mapImported\ArcherOriginalClip43-e2f80b73bb689d65d7cb43dc319b0216ae01fc0535a08ccf508c5a6646c407fa.mdx` | 108,977 | container |
| `war3mapImported\ArcherOriginalClip12-fa304f97e481b7731a539d3667ef7b7066e13d104ca09ac5022d3d3c10ecbd87.mdx` | 106,754 | container |
| `war3mapImported\IllidanOriginalClip77-48b608a968a59c846bd0a5619c9fac74fba36d5092a7da7f4b037a50ace82d64.mdx` | 99,170 | container |
| `war3mapImported\RiflemanOriginalClip47-40410785db4fd7766f2e61f72223db66bc55489b2427c09a7e6c80304a6d00eb.mdx` | 94,369 | container |
| `war3mapImported\RiflemanOriginalClip44-9c46ee5cfeae587b88400ca25cc044214f4ae892e9c04c06b2aa61a9655797a6.mdx` | 93,093 | container |
| `war3mapImported\ArcherOriginalClip6-6b7f8ab312d37ac0d802c817bee700b11ec413e1d493d4a42f19ec31a326d3ae.mdx` | 92,836 | container |
| `war3mapImported\RiflemanOriginalClip45-1395b2fc857f48caf2f9c5147100ae167273ab15f52ef9dd13d75c5fdad39c8d.mdx` | 91,989 | container |
| `war3mapImported\RiflemanOriginalClip16-947371d8985b1f3e20022c79a2190a58be1c21ced681c65c9b27415b360f6539.mdx` | 88,914 | container |
| `war3mapImported\ArcherOriginalClip5-89c7c6d380951e22eb9cb0a769d9584fcd6b8707d9f11c45cf6d35f4a790ea78.mdx` | 88,117 | container |
| `war3mapImported\RiflemanOriginalClip42-7a937349d4bcdccf9603598864336b5e1428f6e3d244db6037f974ca6c519852.mdx` | 86,757 | container |
| `war3mapImported\RiflemanOriginalClip46-272e8733d656b0bc4f7e0dd59957188f5a520f65a97d90896f6e3f6486fd10cc.mdx` | 86,470 | container |
| `war3mapImported\RiflemanOriginalClip5-d9f80843ef60161f2c91a17eee43287459372edc2a05be626a065e29f289130b.mdx` | 85,951 | container |
| `war3mapImported\IllidanOriginalClip81-d25531f099ef17985ec3ea801d97f09bc7383c5c6e09b1e59ad022c3ab44930b.mdx` | 82,090 | container |
| `war3mapImported\RiflemanOriginalClip20-14da69c102328f6cd92b1cada1d5b85aac1be9090fb5f74d555e3de9b624807c.mdx` | 81,790 | container |
| `war3mapImported\ArcherOriginalClip47-e47d2c9497ec4b59c5f5173f2771deacdb5c31791a85b83fb1426df6399924cb.mdx` | 81,253 | container |
| `war3mapImported\RiflemanOriginalClip19-761404900c070afc71394bb9f96903e3643b2896ba73264da23c430b078e712b.mdx` | 80,194 | container |
| `war3mapImported\RiflemanOriginalClip18-42f975c4c12dec0e4cdb666769cbd6362573e42960c95eaded6b62e9cf54419b.mdx` | 78,536 | container |
| `war3mapImported\ArcherOriginalClip42-eec449421488dc6bc67b1c62cc4a65472a65354a928cedee366efd3e490a2b09.mdx` | 78,357 | container |
| `war3mapImported\ArcherOriginalClip51-7c348fe5c626c0ef6675848eab341463ce36b8d5c2b8d0ca6cab962ba06556a0.mdx` | 77,145 | container |
| `war3mapImported\IllidanOriginalClip21-172d482de3343ad61522521a9cbc5f8ba4fb224fbbaa50c7c0039c43e64c477e.mdx` | 76,644 | container |
| `war3mapImported\RiflemanOriginalClip37-b84bebef89585a542549067c5c4d16adcf41f81375db9470ac9e47352072ed15.mdx` | 76,494 | container |
| `war3mapImported\RiflemanOriginalClip2-ec1e468f69c8f09666064cfa28cc5fb2c031c9e9294ac185a7082be64f7e70a3.mdx` | 75,337 | container |
| `war3mapImported\ArcherOriginalClip48-3fb6274be5b8c0c99fe095fae1063ddf25a3f76563e0f79fb9634516a71c6baf.mdx` | 73,264 | container |
| `war3mapImported\RiflemanOriginalClip6-5119aad93bfdf214bd928411701797df6a6c9804153616f44ad07a9d5d4af944.mdx` | 72,277 | container |
| `war3mapImported\ArcherOriginalClip50-6d6214acc46dedfd8c224143468ccb66ff4e180b2c4be65347cf8b85382b8d46.mdx` | 72,058 | container |
| `war3mapImported\RiflemanOriginalClip38-b3c50a53e6065526b75848377695da52faf3b733dd9669ff516bec11012bb83d.mdx` | 72,014 | container |
| `war3mapImported\SelectionCardGreen.tga` | 70,940 | container |
| `war3mapImported\ArcherOriginalClip17-a56703d966cdcb67f125c7cc60c70c71c80912e7d62975344a24b8d71a0c440b.mdx` | 70,903 | container |
| `war3mapImported\RiflemanOriginalClip23-9d410e6a56b0c7f42c90e4b0c3d596243f49e7eaf1f73e5d58aa4c61860cbe90.mdx` | 70,719 | container |
| `war3mapImported\SelectionCardYellow.tga` | 69,896 | container |
| `war3mapImported\RiflemanOriginalClip3-b8269718f989c8c2438e9ffc36bb2c848e9f7d39a5136da8230bcab292c9a213.mdx` | 68,781 | container |
| `war3mapImported\IllidanOriginalClip39-0eba08b3ea992bad0abe1113c593f4959cc360c3575177c8677c82d51fe2c26b.mdx` | 68,126 | container |
| `war3mapImported\RiflemanOriginalClip4-1e1cb6783a85d5384ff0b61f91046a77fdb774d7d9293f3ec2f04fb6d6e244a6.mdx` | 67,985 | container |
| `war3mapImported\RiflemanOriginalClip1-420238a22dcdddedaa179213695d30611d5825d622dbac0479b3d4a4f75f893c.mdx` | 67,555 | container |
| `war3mapImported\ArcherOriginalClip49-8505f22b5c46b674426b0710a50e6010ef2dea07d765e9517f91df9b6c3d68d0.mdx` | 66,395 | container |
| `war3mapImported\IllidanOriginalClip4-eb28dc095a7f585d9dc34ef88785a0238779ab12e7132d8b00b2ef201d04825a.mdx` | 64,782 | container |
| `war3mapImported\IllidanOriginalClip98-fe30c238cd523511b2cc0a61504fd481399df0e30e326f17172eecbec237dc0c.mdx` | 64,379 | container |
| `war3mapImported\RiflemanOriginalClip48-2f510c73148fc5904f564f92212cbaafebdf863e04684132556f39aaff68ca8b.mdx` | 64,368 | container |
| `war3mapImported\RiflemanOriginalClip0-0b892fffb6700ae639d5bfcbbe94e9bbe28ff6dbb4bd62fd6dcc6309747cd49a.mdx` | 63,991 | container |
| `war3mapImported\IllidanOriginalClip1-2e553671dc463712e045883dcb794c7bc7dfe6c60d9d1245541726e8a128049b.mdx` | 63,507 | container |
| `war3mapImported\RiflemanOriginalClip13-6e19ab88a75f0c8b46a5d99e024dd856ece611996395bd77f5c80b4f2d487a3f.mdx` | 62,971 | container |
| `war3mapImported\IllidanOriginalClip87-324f0e1279613852e1b575f4c18cf0e21f06bb58d7228c8c91d221a8f7cef44b.mdx` | 62,503 | container |
| `war3mapImported\ArcherOriginalClip20-02c78d1fd25883091e5602db34024132a9b4c266c0ef63d498d1fe0d5bbbdd51.mdx` | 62,262 | container |
| `war3mapImported\ArcherOriginalClip21-02c2811ad096ebbb4d5da650392e0bc66a2f19bb3b28e11b8d828b1954c2b37d.mdx` | 62,150 | container |
| `war3mapImported\IllidanOriginalClip2-41a02c673ed8fdace43ec7ffa22663167eb8dc043b0de0bfa39b5231c74fda44.mdx` | 62,023 | container |
| `war3mapImported\RiflemanOriginalClip14-c039d734a220808bbc47b203c35b4d3856ccdc0f97e3e535b08ee8689af420dc.mdx` | 61,524 | container |
| `war3mapImported\IllidanOriginalClip63-3bc22d7612f5369c4c2330b82a0779db863bed0a0c98c9c2a547ead5debccfa9.mdx` | 61,276 | container |
| `war3mapImported\IllidanOriginalClip41-6cbd96cd5bf1324434b7e4001e68fe0ddb734c8ef5de5069bab7577bdc9b3500.mdx` | 61,264 | container |
| `war3mapImported\IllidanOriginalClip57-84051a5b56800117443df43746eeb2b92171b11480c91bee63c6ac6318ef035a.mdx` | 61,249 | container |
| `war3mapImported\IllidanOriginalClip24-927a74c0e58faa77c59ab3f6a730be6698b89fd324a91b8bceca82fb302e5710.mdx` | 61,238 | container |
| `war3mapImported\RiflemanOriginalClip31-7257495628ad5f113f83d1b86b4e85c3a2eb871418e803cec1ce539e08e75980.mdx` | 60,898 | container |
| `war3mapImported\IllidanOriginalClip52-e4031b97cce110da80acffdfe8d7902f003a2fc87c571ef6e26351645c9953b5.mdx` | 60,894 | container |
| `war3mapImported\RiflemanOriginalClip32-9d969fd731cf961fefe6c196606934090d74a2dfb82f7c3551dc7bf536951522.mdx` | 60,861 | container |
| `war3mapImported\IllidanOriginalClip96-95eb678ef85f4b8232fd777dec3328220256e88ce9f2649d3307f052a0610564.mdx` | 60,473 | container |
| `war3mapImported\IllidanOriginalClip91-65806f1b3c9e232bb19e3a3362ec1dc04e9311dcfef610281447910c9d500f0d.mdx` | 60,264 | container |
| `war3mapImported\IllidanOriginalClip3-ecb8680bbc340ea2954f397cf9180143434280776b150f1c6d8c5a81b52597d6.mdx` | 60,204 | container |
| `war3mapImported\IllidanOriginalClip101-f2116ff5fbb49b77de76bf504898ffdd2b6673c13553b8b93689f8490b6478fe.mdx` | 59,798 | container |
| `war3mapImported\IllidanOriginalClip40-1eb9df0d85fbc9d37cc98d154fe2862e7c39795199191a2ff687b4cfaff91294.mdx` | 59,590 | container |
| `war3mapImported\IllidanOriginalClip54-b7facaf9885db613a860a55610f1e0daeb6c195413e1badb43e2c1199f560e80.mdx` | 59,585 | container |
| `war3mapImported\IllidanOriginalClip62-de7b9a1400d886fb5e7e9f2b827bf5ec632c617e97c7491b2460e93a221e8583.mdx` | 59,575 | container |
| `war3mapImported\IllidanOriginalClip93-db1860d52b9df2a5651b624b72b5c450cd48e72d722bc0b3ed335675adda6475.mdx` | 59,534 | container |
| `war3mapImported\IllidanOriginalClip94-9d715449c2599a6465e34695063b758024024c902884c2a5c363792f58bc3b15.mdx` | 59,532 | container |
| `war3mapImported\IllidanOriginalClip76-0bf9866134f5dc610cde02e0961e98fab7915c0860717eb8908d29a3bac204f5.mdx` | 59,339 | container |
| `war3mapImported\IllidanOriginalClip75-675986b487a3cd08a78443360207e28192d965edeac258160309e9ea5041ac96.mdx` | 59,315 | container |
| `war3mapImported\IllidanOriginalClip32-13523dbc7a714c77e82919f62da8100cd62ce412751766bbf48cbd057c3ab91f.mdx` | 59,310 | container |
| `war3mapImported\RiflemanOriginalClip33-c36f85441141ff9128d187b45cdfcdfe01e264fb4b154dff6e869b182cb0ab12.mdx` | 59,258 | container |
| `war3mapImported\IllidanOriginalClip20-504435bdd79aabc0ec10ec73e5f3434cc909461c9815e260830ad4ace046ea61.mdx` | 59,248 | container |
| `war3mapImported\IllidanOriginalClip0-e845635f72ea747ba47f0ac7eef8540c68f7a978fa066f43a192aa3d44dab691.mdx` | 59,202 | container |
| `war3mapImported\ArcherOriginalClip19-8d89e52d5dfd942ed3c70e2519f3568fc8fa94bd25007bceb229cf9b4acb78e0.mdx` | 59,140 | container |
| `war3mapImported\IllidanOriginalClip38-d0f4df06fdb53f505ac70ffd143c130bc9eeb2937785a7341c48b84173074335.mdx` | 58,940 | container |
| `war3mapImported\IllidanOriginalClip90-8194f578670b839f96a36e53505844f82a003a5f0d49549c5e2960a2314b2c1e.mdx` | 58,919 | container |
| `war3mapImported\IllidanOriginalClip16-605a10e6fa9e5871bd4ae4e7186c9aa2043753738c2a1d1adf7a6ff4ec8a7916.mdx` | 58,891 | container |
| `war3mapImported\IllidanOriginalClip15-94c42a8e22b3aece465f18864940a01ab5af17eab9b9dcc11ddc48f6c83fcfe1.mdx` | 58,803 | container |
| `war3mapImported\IllidanOriginalClip9-1ffe0124f328ac691ddb7accc47f5edf2c7108ca7643033d205b63757fdc2931.mdx` | 58,753 | container |
| `war3mapImported\IllidanOriginalClip92-c0705a59cc9836d6c8b67c41e70d3eb6a26a9c4c6fc06aef054cca9d7795c88f.mdx` | 58,683 | container |
| `war3mapImported\ArcherOriginalClip41-9994cd5951c588ada20f5c6ea7857cf88d5799ba9f1a61103125c38549806a13.mdx` | 58,381 | container |
| `war3mapImported\IllidanOriginalClip72-5e132c14f2d4a9045cfb5def9256c66bee8de24fdf2813c3c5c2a30e9a20306b.mdx` | 58,230 | container |
| `war3mapImported\IllidanOriginalClip71-56a3c25f7ab901b5b588e03f7b487e62ebe6e4c5caebb673c8a1f84bc75658a8.mdx` | 58,211 | container |
| `war3mapImported\IllidanOriginalClip22-825936fdce914b8f920d4b51dfda93d5ba74bab1e1bdd02b5165b24d5221d046.mdx` | 58,147 | container |
| `war3mapImported\IllidanOriginalClip10-8af3a262160e14346dbcf23eb3c0f3113c9fdf3fd06c188f1f3980c23fad3b55.mdx` | 57,954 | container |
| `war3mapImported\IllidanOriginalClip69-ffdf1bfd4c87c64df42d628f72ad5db69734cfd5dfe91e4cfb632ed498a23e3c.mdx` | 57,860 | container |
| `war3mapImported\IllidanOriginalClip27-2aca1d4c073553fd46b0cb03c2d32c2a2b9004bf39319ecf39f935c7f9d6f54a.mdx` | 57,675 | container |
| `war3mapImported\IllidanOriginalClip49-68789ebc02b4dbd746e5eaca335fcfbee91a1b4a0a526963a6d140b802dd7545.mdx` | 56,973 | container |
| `war3mapImported\IllidanOriginalClip5-cfe3ad2f823ce01940072f3501f27a040c5e98ea9caa7880df68042e41b86018.mdx` | 56,952 | container |
| `war3mapImported\IllidanOriginalClip37-07419c5393536ebfa56e8ba862c8b42feea9878ae8a1eddad51c2ea567dc2730.mdx` | 56,924 | container |
| `war3mapImported\IllidanOriginalClip100-1480492b7e824f6ae3c84d9a529b995b0386eb556582135e513da6fca35c92ec.mdx` | 56,807 | container |
| `war3mapImported\IllidanOriginalClip70-cbbf0e1842ab858c17d2156caf2c8ec3899248c3e5265ebc4fb21b36f72cecc3.mdx` | 56,761 | container |
| `war3mapImported\IllidanOriginalClip42-d88cb14c965975357ff62da5912ba1cc11e0370fc5ffe4f13aa95d8fc72e5b00.mdx` | 56,606 | container |
| `war3mapImported\IllidanOriginalClip35-bd8a57a2bd836965031c1802ea211dd18cbb96e0152168f1b75117140fa13816.mdx` | 56,496 | container |
| `war3mapImported\IllidanOriginalClip73-5a3c71da0c619e2d81e88b543f2ed83eaf15f3182485ee9fab67c5980ac9631f.mdx` | 56,092 | container |
| `war3mapImported\IllidanOriginalClip74-6cf83bff55d2bffada865bff06e5c5c3ebf9640d1869cf17b85c40ea5f88c10f.mdx` | 56,085 | container |
| `war3mapImported\IllidanOriginalClip60-1b41606671fe25ca22f59173e4b79ac4afb707dc4a3981b9a4a45bb2e0a3371a.mdx` | 55,928 | container |
| `war3mapImported\IllidanOriginalClip36-94c9106b9a263e2c35648b3c9f0817899472031f091ac7be4ff71f821c1237b5.mdx` | 55,913 | container |
| `war3mapImported\IllidanOriginalClip26-cd23061244cb3ef7770fe2e59a2e6d5a3e22b6ea06364145930c6891ed68e0cb.mdx` | 55,819 | container |
| `war3mapImported\IllidanOriginalClip65-69832fe4efbaee0e1a0d24db096ec684d79365c05fee0e9f38cdbc7d1d2ff2fa.mdx` | 55,684 | container |
| `war3mapImported\IllidanOriginalClip48-1a75889c8a7d73280272f5ddf6e56f2993c75d56c13d4c86411e108076919165.mdx` | 55,469 | container |
| `war3mapImported\IllidanOriginalClip80-ff41b7960fa745d7401ada163ae06ac9ca6dcba006325d55f0af018f53c253ea.mdx` | 54,921 | container |
| `war3mapImported\IllidanOriginalClip86-b23b744975cac334992877731f0aa3c6447f2719323e9df521b63675171d66fb.mdx` | 54,631 | container |
| `war3mapImported\IllidanOriginalClip95-219ab6b24a3c93cae36eae36037a4f5f75d08aaef58f801eba4e2bde35c68617.mdx` | 54,425 | container |
| `war3mapImported\RiflemanOriginalClip28-4ef4b9fd201eb9914e04f8498ad295c74b03d2f75467682bb9f55721ad5357e5.mdx` | 54,386 | container |
| `war3mapImported\RiflemanOriginalClip30-ac8af0892c2a71b72ee4acbbaaf7b61ed91cf6928807eadfb098beb8262295ae.mdx` | 54,242 | container |
| `war3mapImported\IllidanOriginalClip102-687e2642ad7b4d5265eca4e302c5c0136095355553ce2845f7a648fdc56e373c.mdx` | 53,959 | container |
| `war3mapImported\IllidanOriginalClip56-3303134b62bf4fe526e0f6656913a4bed5a7058c7fd365f0120a35eed0367c68.mdx` | 53,677 | container |
| `war3mapImported\RiflemanOriginalClip50-13fc553ae5fcbff031b82bbabc20ef7d01ca14acd8dcd92f9c8bd2b9b9230a5a.mdx` | 53,656 | container |
| `war3mapImported\IllidanOriginalClip64-306162d12b8d1f6fe04e8fa12b7707110b1f283824a6cae491126cd2ae581439.mdx` | 53,547 | container |
| `war3mapImported\IllidanOriginalClip106-6564fbbe98a87e7ed9e61d8a00c257727c00274f98d9aeba4a988e738469c39d.mdx` | 53,507 | container |
| `war3mapImported\IllidanOriginalClip109-b078fc41e111a96597ae5dd0052756910af39d05ebff824ffc0bb73ce91ee801.mdx` | 53,394 | container |
| `war3mapImported\IllidanOriginalClip46-7925a8068eb7abcd0512da7dc18ddf97df0386890179c92c8f1705a5da3121b2.mdx` | 53,313 | container |
| `war3mapImported\ArcherOriginalClip24-6ec31c441337fba9a728d940bad82fa1a3db3f83c0997ff606ebc884a8e68fe4.mdx` | 53,101 | container |
| `war3mapImported\RiflemanOriginalClip51-1ead0168882b426da0d96371fa77b81b5d1699ea277d7242847d1ab51f41a679.mdx` | 53,097 | container |
| `war3mapImported\IllidanOriginalClip34-e6b68c6ea39ebf0b284a5943549b6f1884500bb3901a9d60126e3a92f79106de.mdx` | 52,766 | container |
| `war3mapImported\IllidanOriginalClip104-6aa6934a5635f27101a625de6d5c14b88967b4d5d2be034239be70c6ad2226b3.mdx` | 52,334 | container |
| `war3mapImported\IllidanOriginalClip105-1a6f8f45abc466518a977565e633d432f0cd4eaad9eb49971d48990f89d6c586.mdx` | 52,285 | container |
| `war3mapImported\IllidanOriginalClip103-27813c29637c7ab66b88c6bc93db21360c8489cf066c326dacabe0ff455508cd.mdx` | 52,215 | container |
| `war3mapImported\IllidanOriginalClip11-2363b7817bda2fda436faac8b070c7c7e796004c0c32d7a5ba6275c698d8d31b.mdx` | 52,190 | container |
| `war3mapImported\IllidanOriginalClip61-1213298a4816cc2fb31e8e229ed8acc3aafbe86a2d745f881ea672bf39f8823b.mdx` | 51,809 | container |
| `war3mapImported\IllidanOriginalClip43-082984530dbb4bb092e90875067b29d90171ed4427d8ba9e7f785fc62b4fc181.mdx` | 51,780 | container |
| `war3mapImported\IllidanOriginalClip17-886e6cb900959eccc820bfc0abad50a103d8aa3a017da74ada64e205494923c6.mdx` | 51,698 | container |
| `war3mapImported\IllidanOriginalClip13-631b9e9cc048cf6b5b5de5e5b1216cdc79101f5ba3eb70f04ecc2eb830fd7e7c.mdx` | 51,032 | container |
| `war3mapImported\IllidanOriginalClip53-cb3f3768444b18cbabe8a8254ad64c8cf3b67281a008518030b7d80a9f3105a9.mdx` | 50,922 | container |
| `war3mapImported\IllidanOriginalClip12-ef4741299b06f916f1ec4b9762525ca973b12dc5a4a164fbae8aedf9e3659083.mdx` | 50,917 | container |
| `war3mapImported\ArcherOriginalClip7-fecc69f10cd075e32f5e4e6b4a2e81c6c29fa2589be5a61474e3c4e2270e222b.mdx` | 50,625 | container |
| `war3mapImported\IllidanOriginalClip25-083ef49ed2f026e214ad4d4cad5b01220427a5aa2b68e653961903ca4621f05a.mdx` | 50,239 | container |
| `war3mapImported\IllidanOriginalClip51-612f81757046a2913132a4ba0bea9ac4871f0dd30ec126ae128ec3f66ac877eb.mdx` | 50,159 | container |
| `war3mapImported\IllidanOriginalClip14-b7c76539966092f9b4c2a5d0a4df6d6146f2d673415557d98734b10928f29f23.mdx` | 50,136 | container |
| `war3mapImported\IllidanOriginalClip45-0d51ff5922649dfbcfa1cb9e08efbd4e737e7dcacd0deb187a467268b293fb2b.mdx` | 50,126 | container |
| `war3mapImported\IllidanOriginalClip28-c45bd379488f3d0d1b587a8f3ea8c74e427f03b70926942683009d9c85d48b31.mdx` | 50,108 | container |
| `war3mapImported\IllidanOriginalClip55-cb23d3010c6eeee2209065f300ec8b6eb2931545f97a36397000854cb4a2574b.mdx` | 50,104 | container |
| `war3mapImported\IllidanOriginalClip30-e1958454f49f861cec1c1d3d5578d4e6ea97eff09b38fe511b5cbce695cde777.mdx` | 50,075 | container |
| `war3mapImported\IllidanOriginalClip29-47d2db96cc312d0d73f28a56df8198f4cb5602418c8ae40d8ddbc0c4d50b15d6.mdx` | 50,068 | container |
| `war3mapImported\IllidanOriginalClip31-4d60e676663abbcdaf2b966aceb1719569d3512b9715356132988a5e3d59749a.mdx` | 50,064 | container |
| `war3mapImported\IllidanOriginalClip66-1d952db0791704a6fc803a1071a6479c261eb2e8b4fc3ab9c6ded7fdcd8483bf.mdx` | 50,051 | container |
| `war3mapImported\IllidanOriginalClip33-4699b03c51e4fd7b0522b5dd7b1a52fa09547d1324b450d61e0b0259fb0abb9d.mdx` | 49,994 | container |
| `war3mapImported\RiflemanOriginalClip41-fc159ca5722a76c01c1ce96f79c89c60b4b748fab012d37805a4092f51706723.mdx` | 49,975 | container |
| `war3mapImported\IllidanOriginalClip99-fa5c693397105b58e19b243a99c4b3717eaa7ffb233c1ec334763ba64926d5f3.mdx` | 49,961 | container |
| `war3mapImported\IllidanOriginalClip44-6746a5384f512d8c4afb8e0c1ff3d8640bcbab0c56185f3c767ed3cc01ead602.mdx` | 49,926 | container |
| `war3mapImported\IllidanOriginalClip68-9682b163d046ed12a611beb05b7c8e41c7a243a40008cf338cbf054318cf56e4.mdx` | 49,784 | container |
| `war3mapImported\IllidanOriginalClip23-9294b550b6624552fddbd4379c08014ca4671e15d945a975923dae3a8fcb436b.mdx` | 49,630 | container |
| `war3mapImported\IllidanOriginalClip50-4cbaaaaa5ef226b49c6b0fb52abf1d8938923be9aa9ad6f1adc79c91ce04d392.mdx` | 49,586 | container |
| `war3mapImported\IllidanOriginalClip67-32a056d4a0bba3bfd63f49124cc92e6eb3192e1ae3bc9e8b594651a1397cead1.mdx` | 49,557 | container |
| `war3mapImported\IllidanOriginalClip97-71051b70219bb0ab7ae833e636c65489c4a572256968dd5eff71aeaaaeeede91.mdx` | 49,472 | container |
| `war3mapImported\RiflemanOriginalClip36-85761548b7879bc48b21c234def84048e01866b35e2dec901caed6c039027260.mdx` | 48,776 | container |
| `war3mapImported\IllidanOriginalClip89-d59006cf7aa62d528c4aa149ce51574853b9b8d8b8efbf7d162c5ed8fee67502.mdx` | 48,411 | container |
| `war3mapImported\IllidanOriginalClip47-738d29e33a0ccb3fe700d5b3b6015151bdbdf75a347be24bbc6a1f9b86dc640e.mdx` | 48,225 | container |
| `war3mapImported\ArcherOriginalClip31-efc4c742668e9285289abf941c740d6774d67c40e80470b48443e537121a69c0.mdx` | 47,862 | container |
| `war3mapImported\RiflemanOriginalClip34-95daf3e945c7352a211ac37b897ccd847ab11f423be8ac6bfc5cf15270c41911.mdx` | 47,438 | container |
| `war3mapImported\ArcherOriginalClip34-14f8b06fd1ad4f6830924fbc2e4ad94f3ec42f69dbf59d21b7b29d44894cea7b.mdx` | 46,843 | container |
| `war3mapImported\ArcherOriginalClip29-1bf01b353c8239c54cd4b8699b4c8e0765b85ff9be73a7ad3ae9eccd9dd79155.mdx` | 45,689 | container |
| `war3mapImported\RiflemanOriginalClip52-c43028a833722be1f3bb5713f1ecf736846f0ee27fdd758d07ecf199b969bf3d.mdx` | 45,593 | container |
| `war3mapImported\RiflemanOriginalClip53-76ce206eb5083401603a6e7bc861bbc6f7bc0b5b8d2fc0e2ae9216265fc3317a.mdx` | 44,334 | container |
| `war3mapImported\RiflemanOriginalClip35-a27e2d904c9c689220510935108486c7f11fce5a9b65130f574eaf15dd8fa259.mdx` | 43,070 | container |
| `war3mapImported\RiflemanOriginalClip39-779fd9eb1e237ea2f2bc4d99c8d0bf2214afb91e46bdc1f1fa242512fadf6cc3.mdx` | 42,932 | container |
| `war3mapImported\RiflemanOriginalClip26-256f82372f8055e96622ef81479ae240b259b1b93f6b769ccd0fe1f4847545d0.mdx` | 41,974 | container |
| `war3mapImported\ArcherOriginalClip38-32844f0367091d8165088253e27eac02840f1d1fe62a9ee7e47d776d6536511a.mdx` | 41,337 | container |
| `war3mapImported\ArcherOriginalClip53-723cecd26206d9577ed23a7128dc465b431e8e3b514248b5c8fbfd7161c209fc.mdx` | 41,328 | container |
| `war3mapImported\ArcherOriginalClip54-03d0a1f150092e385414de621aae54a7af6349fc70d6f8b48ac2556434981aa3.mdx` | 40,340 | container |
| `war3mapImported\ArcherOriginalClip3-84d7e99473df3223cf6c0b2f846d34e91245f6f4a3bc5816678748484afeb18a.mdx` | 38,920 | container |
| `war3mapImported\ArcherOriginalClip37-f0af5de43e411df9b3588ca89248d474d12abd24ae06f218e316738c78b9adb6.mdx` | 38,326 | container |
| `war3mapImported\RiflemanOriginalClip49-0dd16ceb2e4e57c577b43c901732f8cee7eb59de1cdb0763b8d71bcd687d07ed.mdx` | 37,947 | container |
| `war3mapImported\ArcherOriginalClip15-835ce49a51e6e538f726ba580c4b3d8fbf0d4079cbf6ffef69809c81b0fc3476.mdx` | 37,036 | container |
| `war3mapImported\ArcherOriginalClip27-3547842f745d76dd6b5be8c660a59aeb005ca5dc1176013dfa2158d9d298df08.mdx` | 35,846 | container |
| `war3mapImported\ArcherOriginalClip32-69670f2111fc38a61020680f558f3476246bc0fc9451b25cac41986fa8ef33b2.mdx` | 35,580 | container |
| `war3mapImported\ArcherOriginalClip33-fc1bf34a9f05d2d6540358dbe7c53e9b0ea79c5221eae16f89293a368b2c3d4e.mdx` | 35,534 | container |
| `war3mapImported\ArcherOriginalClip40-0e8b8e1515ed65539eab19d370faa5113a410b67dbdd368254731d6300c74dbd.mdx` | 35,063 | container |
| `war3mapImported\RiflemanOriginalClip10-3e8653bfd9a38da6016c5f2a5a39806848fb48bd540015005af022b9687240d8.mdx` | 33,901 | container |
| `war3mapImported\ArcherOriginalClip39-9d4fe612a0d8c6c51487ca421a421a250a0f9fb826e4162b9097bea5085b3a95.mdx` | 33,496 | container |
| `war3mapImported\ArcherOriginalClip2-9139ebe69ba86c6237fb363dd62dc642c9cf99065b433538fede93388d96f782.mdx` | 33,275 | container |
| `war3mapImported\RiflemanOriginalClip7-8095824274ed40a4c2fb90424db4c0ab07f66b8f87bf14b6e7c32784d545a71b.mdx` | 33,237 | container |
| `war3mapImported\ArcherOriginalClip55-81de20e6444468f5f32f45bee3f1efdcce6491ada076cc19ad9c32f85c598b82.mdx` | 33,135 | container |
| `war3mapImported\ArcherOriginalClip56-3f09012e433338345782099f6ee8acb51bbc20ad98b6ff7fbb6464826b879b30.mdx` | 32,973 | container |
| `war3mapImported\ArcherOriginalClip1-190f7a8266f804dcad9ab0d2956d7f8183703c6afac6fc1c72fdbb8bba0118cd.mdx` | 32,359 | container |
| `war3mapImported\ArcherOriginalClip4-1645a96166f83fc9463629e2b3f2228951ddb73b3cbae745c6154f1479d9607a.mdx` | 32,082 | container |
| `war3mapImported\RiflemanOriginalClip8-ff156b321e9668976ff0a9de038d005d8400aeaf97aefe6e12949db2f44fed18.mdx` | 31,928 | container |
| `war3mapImported\ArcherOriginalClip52-d57b544af350880d7f967d320a431c98dc81bb0e23d4fa164e9aab9d24716182.mdx` | 31,437 | container |
| `war3mapImported\RiflemanOriginalClip9-b2f68a03ca276812a9ae916d319dec889b8f3889a1bde4180063ce3ca6dfce7a.mdx` | 31,339 | container |
| `war3mapImported\ArcherOriginalClip0-c812e09461d44ff14b272d787b12d92a3e1d1687d60b26413e5a76272f8d014e.mdx` | 30,140 | container |
| `war3mapImported\RiflemanOriginalClip43-df33708f0daf085c7076b5e63fe867b15b1d6e8058ce773ebad216ac16633c90.mdx` | 29,929 | container |
| `war3mapImported\RiflemanOriginalClip40-c74cadd2aed8f5a6b64b94cf870ac5ecb0534c2ed369cb58a2c7b684ce829e08.mdx` | 29,054 | container |
| `war3mapImported\ArcherOriginalClip45-80efa47c21d299a8f83cde93b53b74fcc5ca76880112f8c5daa39638dd4599fc.mdx` | 28,538 | container |
| `war3mapImported\ArcherOriginalClip11-c71ca93066a9815c4f9fb7c347b5d27e14d5a23911b46cb8cde46c566e1a5ab9.mdx` | 27,727 | container |
| `war3mapImported\ArcherOriginalClip8-a421a6ba33a8fc5bb2aeb1dbfef9cb7ea3ffa7a16495c2948e1999004019ab2e.mdx` | 27,650 | container |
| `war3mapImported\ArcherOriginalClip10-5cbe05f66a6fb9af74d84da6f21d6ecc2457d70e14726fbfd2e9ec67c09d5e2d.mdx` | 27,422 | container |
| `war3mapImported\ArcherOriginalClip9-a19e0c682ec841bb94c6efafddd03198ec421426d183f85e3aafa834f407dcfd.mdx` | 27,300 | container |
| `war3mapImported\RiflemanOriginalClip17-eca85ce079b6a9119f3f4ded61d4398aa5826c6061510410e3228baedd6437ff.mdx` | 26,509 | container |
| `war3mapImported\RiflemanOriginalClip24-4c31c8e98983d9611a86c42ffb073c1f189da9405dd2abe8546fb74b97e8dec4.mdx` | 26,487 | container |
| `war3mapImported\RiflemanOriginalClip25-bf5f7a1445cc61d561f63a62e406be8cc85adec6c083795ff8feef5c7f32e75d.mdx` | 26,482 | container |
| `war3mapImported\RiflemanOriginalClip29-46eee5ac869761f92b2b60e31a5cf34eaae0ac78fe9478d993772fb86dd16ecc.mdx` | 26,444 | container |
| `war3mapImported\ArcherOriginalClip26-9027d14339bc8672e37b4d6148de4fbc046a4b1a990950068f40a4f742f77ac8.mdx` | 24,724 | container |
| `war3mapImported\ArcherOriginalClip25-bfdb8ea71bed16f418c0211bf20f64bc9b11f96a692fcf23e661d06062485e34.mdx` | 24,692 | container |
| `war3mapImported\ArcherOriginalClip30-f4c60546ee765733881959ffc086b42ad31a01731d740ff2343cbce88919dbe2.mdx` | 24,566 | container |
| `war3mapImported\ArcherOriginalClip36-9c688be9ed741ec4849733c1cb8d54f78ac2de97f72e833ea2e18b5ebf693343.mdx` | 20,759 | container |
| `war3mapImported\ArcherOriginalClip35-80a10de7ae6c4036f87f8d34c437f00b2365c5f61becbc70a391f095a3065bbe.mdx` | 20,753 | container |
| `war3mapImported\ArcherOriginalClip14-1c58a82502d0140dbb0ae0e1d3bd188a85f08d11c50c278871d0be235beced9b.mdx` | 19,449 | container |
| `war3mapImported\RiflemanName.tga` | 17,043 | container |
| `war3mapImported\RiflemanOriginalClip12-c7d4796b1c2eaf4ef69af0a4431b94adacaba404ca15806f794983806e011da2.mdx` | 17,043 | container |
| `war3mapImported\ArcherOriginalClip18-7ff17e4c8bd6a006cbe64b3ce6f5e250c3ca9387a7a3bb503eaf82c19efd590a.mdx` | 16,358 | container |
| `war3mapImported\ArcherOriginalClip44-62ee44f40bd612f41b3d7b095ebd40a795755a3faf44b4592c39e7cf2ebf89bb.mdx` | 15,893 | container |
| `war3mapImported\ArcherName.tga` | 15,494 | container |
| `war3mapImported\ArcherOriginalClip13-9b32cd36a7d07c3342807a610e4973f5868437f3618ef18af717ba6febc354ff.mdx` | 15,300 | container |
| `war3mapImported\DemonHunterName.tga` | 14,311 | container |
| `war3mapImported\MatchHUD2.tga` | 11,021 | container |
| `war3mapImported\MatchHUD1.tga` | 11,016 | container |
| `war3mapImported\MatchHUD0.tga` | 10,997 | container |
| `war3mapImported\MatchHUD3.tga` | 10,994 | container |
| `war3mapImported\ImpactHit-14ab984c85a771b2c9feb68275c44577ceb14d0f5c5f2e3801cbc00c2decd594.mdx` | 2,016 | container |
| `war3mapImported\ImpactTech-5945ef252a0e75aa6ccd0f82a1db34f12ab718fb8c7c592864a3b8f330099a20.mdx` | 1,250 | container |
| `war3mapImported\StageDeck-48ca8b3ca98aa77d741926a42ad589a5f8b1df78e68f565c285ccadd6bc2c27c.mdx` | 855 | container |
| `war3mapImported\StagePalette-4d487e03f105a34fbe9f67e1c14022e44032671a0392de68c287a1afefe16850.tga` | 42 | container |
| `war3mapImported\FighterCardPitLord.blp` | 99,160 | declared |
| `war3mapImported\FighterCardShadowHunter.blp` | 87,235 | declared |
| `war3mapImported\FighterCardDreadlord.blp` | 84,867 | declared |
| `war3mapImported\FighterCardWarden.blp` | 83,619 | declared |
| `war3mapImported\FighterCardMountainKing.blp` | 83,422 | declared |
| `war3mapImported\FighterCardBeastmaster.blp` | 80,245 | declared |
| `war3mapImported\FighterCardArcher.blp` | 78,052 | declared |
| `war3mapImported\FighterCardRifleman.blp` | 76,279 | declared |
| `war3mapImported\FighterCardLich.blp` | 74,018 | declared |
| `war3mapImported\FighterCardLichKing.blp` | 71,974 | declared |
| `war3mapImported\FighterCardIllidan.blp` | 67,961 | declared |
| `war3mapImported\FighterBustShadowHunter.blp` | 67,095 | declared |
| `war3mapImported\FighterBustLichKing.blp` | 64,750 | declared |
| `war3mapImported\FighterCardForsakenPaladin.blp` | 61,919 | declared |
| `war3mapImported\FighterBustPitLord.blp` | 60,821 | declared |
| `war3mapImported\FighterCardBlademaster.blp` | 57,774 | declared |
| `war3mapImported\FighterBustArcher.blp` | 57,070 | declared |
| `war3mapImported\FighterBustDreadlord.blp` | 56,809 | declared |
| `war3mapImported\FighterBustWarden.blp` | 56,062 | declared |
| `war3mapImported\FighterBustIllidan.blp` | 55,079 | declared |
| `war3mapImported\FighterBustMountainKing.blp` | 52,066 | declared |
| `war3mapImported\FighterBustBeastmaster.blp` | 51,449 | declared |
| `war3mapImported\FighterBustBlademaster.blp` | 48,448 | declared |
| `war3mapImported\FighterBustLich.blp` | 45,585 | declared |
| `war3mapImported\FighterBustRifleman.blp` | 44,631 | declared |
| `war3mapImported\FighterBustForsakenPaladin.blp` | 41,015 | declared |
| `war3mapImported\SelectionThreeBridges.tga` | 28,993 | declared |
| `war3mapImported\FighterStockArcher.blp` | 7,576 | declared |
| `war3mapImported\FighterStockLich.blp` | 7,567 | declared |
| `war3mapImported\FighterStockPitLord.blp` | 7,372 | declared |
| `war3mapImported\FighterStockIllidan.blp` | 7,087 | declared |
| `war3mapImported\FighterStockLichKing.blp` | 6,758 | declared |
| `war3mapImported\FighterStockBlademaster.blp` | 6,643 | declared |
| `war3mapImported\FighterStockForsakenPaladin.blp` | 6,531 | declared |
| `war3mapImported\FighterStockWarden.blp` | 6,373 | declared |
| `war3mapImported\FighterStockShadowHunter.blp` | 5,666 | declared |
| `war3mapImported\FighterStockBeastmaster.blp` | 5,551 | declared |
| `war3mapImported\FighterStockMountainKing.blp` | 5,527 | declared |
| `war3mapImported\FighterStockDreadlord.blp` | 5,139 | declared |
| `war3mapImported\FighterStockRifleman.blp` | 4,909 | declared |

## Live imports, 8 Oct 2026 (#291)

The live imports are the 2211 files the build declares (`importedAssets` in
smashcraft:ts/scripts/wisp/mapInputs.ts, read from the inputs in
smashcraft:build-inputs.json at a75b307b), 138.3 MB. Sizes are the bytes
each one occupies in the built map (smashcraft:ts/map-size-baseline.tsv, the
88e494da build); four stage light and impact models newer than that build are
counted at 40% of their file size, under 0.1 MB together. The 245 undeclared
files #286 removed are not counted; #286 also dropped 40 declared files
(1.82 MB) the map never names, listed above.

### By category

| Category | Files | Size | What it is |
| --- | ---: | ---: | --- |
| Animations (clip pool) | 1741 | 73.75 MB | One model per sequence for each of 21 fighters, each carrying the whole body mesh |
| Portraits | 260 | 28.63 MB | Card, bust, tile and stock icon TGAs, neutral plus four slot colours, for 13 fighters (11.86 MB as BLP since #307) |
| White-flash bodies | 71 | 19.31 MB | Every fighter's mesh and keys on one timeline with white materials, plus 50 white textures |
| Fighter models | 6 | 12.61 MB | Full Archer, Rifleman, Illidan, Forsaken Paladin and Lich King models (KO bodies, winner pose, unit) |
| Textures (UI, model) | 29 | 2.83 MB | Selection backdrop and cards, HUD plates, shield bubbles, Lich King textures |
| Stage art | 83 | 0.92 MB | Decks, skies, lights, palettes, water, lava, snow and stage thumbnails |
| Effects | 17 | 0.23 MB | Impact sparks, shields' models, bear clips |
| Sounds | 0 | 0 | Every sound is a stock label (model sounds, music) |
| UI frames | 4 | 0.00 MB | FDF and TOC files |

Fighters are 134.3 MB, 97% of the live imports. Stage art is under 1 MB
because stages are built from stock terrain and doodads.

### By fighter

Size (files). Stock heroes import no full model: their KO bodies and unit use
the stock model.

| Fighter | Full model | Clip pool | White flash | Portraits | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Illidan | 4.04 (1) | 9.29 (124) | 4.16 (1) | 1.74 (20) | 19.23 MB (146) |
| Forsaken Paladin | 1.57 (1) | 12.61 (109) | 1.57 (1) | 1.86 (20) | 17.62 MB (131) |
| Rifleman | 3.25 (1) | 4.50 (73) | 3.28 (1) | 2.28 (20) | 13.30 MB (95) |
| Archer | 3.17 (1) | 4.35 (77) | 3.20 (1) | 2.34 (20) | 13.05 MB (99) |
| Goblin Tinker | - | 8.49 (98) | 0.62 (1) | - | 9.11 MB (99) |
| Lich King | 0.58 (2) | 4.13 (97) | 0.56 (1) | 2.21 (20) | 7.48 MB (120) |
| Dreadlord | - | 3.09 (66) | 0.43 (1) | 2.64 (20) | 6.16 MB (87) |
| Pit Lord | - | 2.29 (65) | 0.56 (1) | 2.54 (20) | 5.38 MB (86) |
| Warden | - | 2.02 (65) | 0.39 (1) | 2.41 (20) | 4.81 MB (86) |
| Mountain King | - | 1.90 (76) | 0.33 (1) | 2.47 (20) | 4.71 MB (97) |
| Beastmaster | - | 1.70 (62) | 0.30 (1) | 2.60 (20) | 4.60 MB (83) |
| Shadow Hunter | - | 1.64 (65) | 0.33 (1) | 2.46 (20) | 4.43 MB (86) |
| Lich | - | 1.99 (64) | 0.33 (1) | 1.54 (20) | 3.86 MB (85) |
| Blademaster | - | 1.75 (72) | 0.17 (1) | 1.54 (20) | 3.46 MB (93) |
| Kael'thas | - | 2.44 (92) | 0.40 (1) | - | 2.85 MB (93) |
| Chen Stormstout | - | 2.36 (97) | 0.29 (1) | - | 2.66 MB (98) |
| Cairne | - | 2.04 (93) | 0.42 (1) | - | 2.46 MB (94) |
| Sylvanas | - | 1.88 (78) | 0.50 (1) | - | 2.38 MB (79) |
| Thrall | - | 1.89 (88) | 0.20 (1) | - | 2.10 MB (89) |
| Jaina | - | 1.81 (90) | 0.18 (1) | - | 1.99 MB (91) |
| Peon | - | 1.53 (88) | 0.39 (1) | - | 1.92 MB (89) |
| White textures, shared | | | 0.69 (50) | | 0.69 MB (50) |

A clip costs about one copy of its fighter's mesh: Blademaster's clips are
all 49 to 65 KB raw, the Forsaken Paladin's 178 to 301 KB. The pool's cost is
clips times mesh, so high-poly fighters with many sequences cost most.

### By stage

| Stage | Files | Size |
| --- | ---: | ---: |
| Hellfire Citadel | 5 | 97 KB |
| Naxxramas | 5 | 94 KB |
| Blackrock | 5 | 59 KB |
| Ahn'Qiraj | 5 | 58 KB |
| Gryphon Aerie | 5 | 57 KB |
| Durotar Skies | 5 | 56 KB |
| Tomb of Sargeras | 5 | 45 KB |
| Stratholme | 5 | 44 KB |
| Frozen Throne | 5 | 43 KB |
| Nordrassil | 4 | 41 KB |
| Sky Deck (test) | 5 | 40 KB |
| Shared (backdrop, water, lava, snow, chip, palettes) | 28 | 253 KB |
| Three Bridges thumbnail, no stage in the catalog | 1 | 29 KB |

Each stage is a deck slab, a main deck, a light, a sky and a thumbnail
(Nordrassil keeps the stock aurora sky).

## Portraits as BLP, 8 Oct 2026 (#307)

The build encodes each fighter portrait from its TGA in the `fighter-renders`
input to a one-level BLP1 JPEG at quality 90 (smashcraft:ts/scripts/blp.ts),
cached by source hash under `~/.cache/smashcraft/blp-portraits/`; the map
script names the `.blp` files. Build of 4af9c1d3 plus #307: the 260 portraits
take 11.86 MB in the map instead of 28.63 MB, and the map measured 162.7 MB.
smashcraft:ts/test/portrait-blp.test.ts holds every portrait import to BLP and
their total to 12.5 MB in the committed baseline.

| Quality | Portraits | Worst portrait PSNR | Largest channel error |
| ---: | ---: | ---: | ---: |
| 90 | 12.03 MB | 38.4 dB | 22 |
| 85 | 10.54 MB | 35.4 dB | 34 |
| 80 | 9.00 MB | 33.3 dB | 42 |
| 75 | 8.13 MB | 31.9 dB | 54 |
| 70 | 7.54 MB | 30.7 dB | 59 |

Sizes are the encoded files; error is decoded with war3-model's BLP reader
against the source, over opaque pixels' colour and every pixel's alpha.

## Items over 1 MB

Eight files are over 1 MB, and so are 21 clip pools, four portrait sets and
the white-flash set taken as groups. No stock asset replaces a fighter's
pose-by-pose body: the custom fighters' meshes and the appended recovery,
grab and drill clips exist only in the imports. The levers are packing the
same frames into fewer bytes.

| Item | Size | Option | Saves | Visual cost |
| --- | ---: | --- | ---: | --- |
| 21 clip pools | 73.75 MB | Draw the body from one model per fighter with every sequence on one seekable timeline, as the white-flash bodies already do (smashcraft:tools/animations/white-flash-models.ts), with original materials. The mesh is stored once instead of once per clip. | about 55 MB (the 19 timeline bodies weigh about what the white set does, 18.6 MB) | None expected: the white flash already follows the pool frame for frame on that timeline. Static lights and model-sound cues keyed to pooled clips move to timeline times. Unknown: why the pool was chosen over a timeline; check one fighter natively first. |
| Clip pools, same | | Drop sequences no fighter plays: cinematic, portrait and test sequences | 1.8 MB (1.7 MB of it the Forsaken Paladin's 13 cinematics) | None |
| Forsaken Paladin clip pool | 12.61 MB | Halve the community model's polygons | about 6 MB now, about 0.8 MB after the timeline | Medium: the hammer and armour lose detail up close |
| `IllidanWhite.mdx` | 4.16 MB | Keep keys only inside clips that can flash (hitlag poses and smash charge, smashcraft:ts/src/game/presentation/whiteGlow.ts); drop the rest of the timeline's keys | about 1.7 MB (assumes 40% of keys stay) | None: other poses never flash |
| `RiflemanWhite.mdx` | 3.28 MB | Same | about 1.3 MB | None |
| `ArcherWhite.mdx` | 3.20 MB | Same | about 1.3 MB | None |
| `ForsakenPaladinWhite.mdx` | 1.57 MB | Same | about 0.3 MB (mesh-heavy, few keys) | None |
| White-flash set, all 71 | 19.31 MB | Same, plus removing keys that linear interpolation reproduces | about 8 MB | None at a small tolerance |
| `DemonHunterFighter.mdx` | 4.04 MB | KO bodies, winner pose and the fighter unit draw from the pool or the timeline body instead of a full model (smashcraft:ts/src/game/render/combatEffects.ts `fighterModel`) | 4.04 MB | None |
| `RiflemanFighter.mdx` | 3.25 MB | Same | 3.25 MB | None |
| `ArcherFighter.mdx` | 3.17 MB | Same | 3.17 MB | None |
| `ForsakenPaladin.mdx` | 1.57 MB | Same; the timeline body is derived from it, so the source stays in private inputs only | 1.57 MB | None |
| Archer, Rifleman, Illidan keys (full, white, pool) | about 30 MB | Remove keys that linear interpolation reproduces within a small tolerance; these baked models carry about 405,000 keys each (Archer) | about 10 MB (unmeasured; assumes half the keys go) | None at a small tolerance; motion may soften at a coarse one |
| Portraits, 260 TGAs | 28.63 MB | Done (#307): JPEG BLP at quality 90, encoded at build time, one mip level | 16.77 MB (now 11.86 MB) | Worst portrait 38.4 dB PSNR against its source, largest channel error 22 of 255. The 5.7 MB estimate does not hold for BLP: Warcraft decodes BLP JPEG as four B, G, R, A planes with no colour transform, so colour can't be subsampled. 7 MB needs about quality 65 (30 dB) |
| Portraits, same | | Drop the four slot-colour variants and keep the neutral portrait | 80% of what is left (about 4.6 MB after BLP) | The card and plate lose the slot's outfit colour |
| `FighterCard*` set | 11.06 MB (65) | Covered by the BLP row | about 8.8 MB | As above |
| `FighterBust*` set | 8.90 MB (65) | Covered by the BLP row | about 7 MB | As above |
| `FighterTile*` set | 7.85 MB (65) | Covered by the BLP row | about 6.3 MB | As above |

Smaller textures (resolution) are not worth it here: the portraits are
already at the size their frames draw (smashcraft:docs/design/fighter-portraits.md),
and the selection backdrops compress to 0.9 MB.

## Budget for the finished game

### Platform limit

- Patch 1.27b (December 2016) raised the map file size limit from 8 MB to
  128 MB ([PCGamingWiki, patch archive](https://community.pcgamingwiki.com/files/file/1180-warcraft-3-standalone-patches-all-languages-windows/);
  [Hive Workshop, "Custom map size limit {solved}"](https://www.hiveworkshop.com/threads/custom-map-size-limit-solved.291599)).
- Reforged players reported the limit doubled to 256 MB in 2021. A 2024 Hive
  thread says the game opens files up to 512 MB but Battle.net's map cloud
  storage, which hosting needs, stops at 256 MB
  ([Hive Workshop, "Is it possible to host map above the 256mb limit?"](https://www.hiveworkshop.com/threads/is-it-possible-to-host-map-above-the-256mb-limit.355073)).
  Blizzard has published no figure since 1.27b.
- Big maps download slowly in lobbies: a 2021 report says a 202 MB map hosts
  only if early players seed it.

Treat 256 MB as the hard ceiling.

### What other maps weigh

Featured Reforged maps on maps.w3reforged.com and Hive Workshop (8 Oct 2026):
the median of 15 is 20.7 MB. Ambitious maps are larger: Warcraft Legacies
96 MB, Pokemon Legends 150 MB, Pumpkin TD 163 MB. The largest confirmed is
Heroic Origins Galaxy TD at 276 MB.

### Proposed budget: 120 MB

A whole game with a classic mode and an adventure has more content than
Warcraft Legacies and sits below the maps players call heavy. 120 MB is
under half the ceiling, so a lobby download stays bearable.

| Share | Budget | Today (live) | After the top savings |
| --- | ---: | ---: | ---: |
| Fighters (21 now) | 50 MB | 134.3 MB | about 35 MB (1.7 MB each), room for about 8 more |
| Stages | 15 MB | 0.9 MB | 0.9 MB; about 1 MB a stage for custom decks, skies, backdrops and home-stage scenery (#195, #268) |
| Classic mode (#284) | 10 MB | 0 | Boss models, ending art (21 endings at about 50 KB as BLP is 1 MB) |
| Adventure (#269) | 20 MB | 0 | Stock units cost nothing; custom leaders, scenes and cutscene art |
| UI, effects, textures | 5 MB | 3.1 MB | 3.1 MB |
| Map script and own files | 5 MB | 1.2 MB | 1.2 MB |
| Reserve | 15 MB | | |
| Total | 120 MB | 139.5 MB + #286's 38 MB | about 40 MB |

The baseline gate (10% growth per build) stays the per-change check; this
budget is the line it should never reach.

### Savings, by bytes per hour

| Rank | Saving | Bytes | Work | MB per hour |
| ---: | --- | ---: | ---: | ---: |
| 1 | Portraits as JPEG BLP | 22.9 MB | 3 h (BLP writer, renderer output, frame paths, one look in game) | 7.6 |
| 2 | Full models replaced by pool or timeline for KO bodies, winner pose and unit (only if 3 waits) | 12.0 MB | 2 h | 6.0 |
| 3 | Timeline bodies replace the clip pools and full models | about 67 MB (55 pool + 12 full) | 12 h (generator exists for whites; presentation, lights, sound cues, a native check per fighter) | 5.6 |
| 4 | White flash keeps keys only in flashable clips | about 8 MB | 3 h | 2.7 |
| 5 | Key reduction on Archer, Rifleman and Illidan | about 10 MB (unmeasured) | 4 h | 2.5 |
| 6 | Halve the Forsaken Paladin's polygons | about 6 MB, 0.8 after 3 | 3 h | 2.0, 0.3 after 3 |
| 7 | Drop cinematic, portrait and test sequences | 1.8 MB | 1 h | 1.8 |

Doing 1, 3 and 4 brings the fighters from 134 MB to about 35 MB and the map
to about 40 MB, a third of the budget.

## Stage-select pictures (#304)

Seven stages show Warcraft's own campaign loading art, which costs no import
bytes; their layout silhouettes and name banners are drawn by frames. The four
stages with no fitting zone art import one 512x512 BLP each
(smashcraft:docs/design/stage-select.md), 122,043 bytes together, measured
by `bun scripts/stageThumbnails.ts` on 8 Oct 2026 (ts/stage-thumbnails.json
keeps each card's current bytes):

| Picture | Bytes |
| --- | ---: |
| `StageCardGryphon.blp` | 34,468 |
| `StageCardBlackrock.blp` | 27,158 |
| `StageCardAhnQiraj.blp` | 42,372 |
| `StageCardSkyDeck.blp` | 18,045 |

They replace the eleven drawn `Selection<Stage>.tga` tiles (about 0.5 MB).
