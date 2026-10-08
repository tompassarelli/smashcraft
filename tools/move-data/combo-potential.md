# Combo potential

Historical snapshot from before #339, with the current roster’s rows retained. The measured rules are in [balance](../../docs/design/balance.md#combo-potential); regenerate with `bun wisp combos`.

| Fighter | Max true combo | Typical punish | Kill confirm | Openings per kill | Multi-hit openings | With reads as openings | Damage per opening | Best route |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rifleman | 33% | 25.4% | 95% | 5.2 | 5.2 | 5.8 | 26.2% | down air → grab, up throw → forward smash (33% at 10%) |
| Illidan | 25% | 21% | 140% | 8.5+ | 6.8+ | 8.5+ | 19.6% | down air → grab, forward throw → forward smash (25% at 10%) |
| Blademaster | 24.8% | 20.1% | 110% | 6 | 5.8 | 6.8 | 22.4% | forward throw → dash, dash attack (24.8% at 130%) |
| Mountain King | 33.2% | 23.2% | 75% | 4.8 | 4.8 | 5 | 25% | up throw → up tilt → forward tilt (33.2% at 50%) |
| Warden | 35% | 17% | 115% | 6.7 | 6.7 | 7.5 | 21.3% | down tilt → up tilt → jab → jab → jab → dash, dash attack (35% at 160%) |
| Lich | 27% | 18% | 75% | 5.8 | 1.3 | 5.8 | 19.3% | up air → dash, dash attack (27% at 70%) |
| Forsaken Paladin | 28% | 17.6% | 110% | 7 | 6 | 7.3 | 18.8% | up throw → neutral special → down smash (28% at 90%) |
| Dreadlord | 24.4% | 21.7% | 90% | 5.5 | 5.2 | 5.8 | 21.4% | up throw → dash, dash attack (24.4% at 80%) |
| Shadow Hunter | 24% | 19% | 90% | 6.3 | 3.5 | 6.3 | 19.6% | up throw → dash, dash attack (24% at 90%) |
| Pit Lord | 35% | 25% | 90% | 5.3 | 2.8 | 5.5 | 24.7% | up throw → dash, dash attack (35% at 80%) |
| Beastmaster | 27.7% | 21% | 80% | 6 | 2.5 | 6 | 20.9% | up air → dash, dash attack (27.7% at 80%) |
| Lich King | 31% | 20% | 105% | 6.3 | 3.8 | 6.7 | 20.5% | up throw → dash, dash attack (29% at 100%) |
| Thrall | 36% | 18% | 115% | 6.8 | 2.2 | 7.2 | 19.9% | up throw → down special → forward smash (36% at 90%) |
| Jaina Proudmoore | 29% | 23% | 70% | 5.2 | 2.8 | 5.3 | 20.3% | up throw → forward smash (24% at 60%) |
| Sylvanas Windrunner | 21% | 18% | 115% | 7.8 | 5.5 | 8.2 | 18.5% | up throw → forward smash (21% at 100%) |
| Cairne Bloodhoof | 52% | 23% | 85% | 5.2 | 2.2 | 5.3 | 25.8% | up throw → side special → grab, up throw → down smash (52% at 70%) |
| Chen Stormstout | 32.5% | 27.5% | 70% | 4.5 | 2.7 | 4.5 | 25.8% | up air → dash, dash attack (32.5% at 70%) |
| Peon | 25% | 19% | 100% | 6.8 | 1.7 | 6.8 | 19.9% | up throw → dash, dash attack (25% at 90%) |
| Goblin Tinker | 24% | 20% | 130% | 8.2 | 7.8 | 8.2 | 21.3% | up throw → dash, dash attack (24% at 120%) |
| Kael'thas Sunstrider | 43% | 19% | 90% | 6.2 | 2.5 | 6.3 | 20.1% | up throw → neutral special → dash, dash attack (35% at 100%) |

## Best routes

Each fighter's most damaging true combo and every opener's first kill, with the attacker's inputs frame by frame from the setup (A attack, B special, Z grab, R shield, C the attack stick).

### Rifleman

- Most damage: down air → grab, up throw → forward smash, 33% from 10% (DI out). Inputs: C-down ×1, — ×27, Z ×1, — ×5, up ×1, — ×24, C-right ×1, — ×33.
- forward throw kills Rifleman from 140% at the ledge: forward throw (DI out).
- down throw kills Rifleman from 140% at the ledge: down throw (DI out).

### Illidan

- Most damage: down air → grab, forward throw → forward smash, 25% from 10% (DI out). Inputs: C-down ×1, — ×26, Z ×1, — ×5, right ×1, — ×30, C-right ×1, — ×22.
- forward throw kills Rifleman from 140% at the ledge: forward throw (DI out).
- down throw kills Rifleman from 140% at the ledge: down throw (DI out).

### Blademaster

- Most damage: forward throw → dash, dash attack, 24.8% from 130% (DI up). Inputs: Z ×1, — ×6, right ×1, — ×30, right ×4, right+A ×1, — ×45.
- forward throw kills Rifleman from 130% at the ledge: forward throw → dash, dash attack (DI up).
- up throw kills Rifleman from 70% at the ledge: up throw → forward smash (DI out).
- down throw kills Rifleman from 170% at the ledge: down throw (DI out).

### Mountain King

- Most damage: up throw → up tilt → forward tilt, 33.2% from 50% (DI up). Inputs: Z ×1, — ×8, up ×1, — ×29, up+A+walk ×1, — ×38, right+A+walk ×1, — ×194.
- forward throw kills Rifleman from 90% at the ledge: forward throw (DI out).
- up throw kills Cairne Bloodhoof from 50% at the ledge: up throw → up tilt → forward tilt (DI up).
- down throw kills Rifleman from 90% at the ledge: down throw (DI out).

### Warden

- Most damage: down tilt → up tilt → jab → jab → jab → dash, dash attack, 35% from 160% (DI in). Inputs: down+A+walk ×1, — ×16, up+A+walk ×1, — ×27, A ×1, — ×1, A ×1, — ×5, A ×1, — ×29, right ×1, right+A ×1, — ×49.
- down tilt kills Cairne Bloodhoof from 160% at the ledge: down tilt → up tilt → jab → jab → jab → dash, dash attack (DI in).
- forward throw kills Rifleman from 120% at the ledge: forward throw → dash, dash attack (DI up).
- up throw kills Rifleman from 70% at the ledge: up throw → forward smash (DI out).
- down throw kills Rifleman from 180% at the ledge: down throw (DI out).

### Lich

- Most damage: up air → dash, dash attack, 27% from 70% (DI out). Inputs: C-up ×1, — ×27, right ×1, right+A ×1, — ×70.
- forward throw kills Rifleman from 120% at the ledge: forward throw (DI out).
- down throw kills Rifleman from 120% at the ledge: down throw (DI out).
- up air kills Rifleman from 70% at the centre: up air → dash, dash attack (DI out).

### Forsaken Paladin

- Most damage: up throw → neutral special → down smash, 28% from 90% (DI up). Inputs: Z ×1, — ×8, up ×1, — ×25, B ×1, — ×47, C-down ×1, — ×199.
- forward throw kills Rifleman from 180% at the ledge: forward throw (DI out).
- up throw kills Rifleman from 90% at the ledge: up throw → forward smash (DI out).
- down throw kills Rifleman from 180% at the ledge: down throw (DI out).
- up air kills Rifleman from 110% at the centre: up air → dash, dash attack (DI out).

### Dreadlord

- Most damage: up throw → dash, dash attack, 24.4% from 80% (DI out). Inputs: Z ×1, — ×6, up ×1, — ×26, right ×1, right+A ×1, — ×70.
- forward throw kills Rifleman from 110% at the ledge: forward throw (DI out).
- down throw kills Rifleman from 120% at the ledge: down throw (DI out).
- side special kills Rifleman from 80% at the ledge: side special (DI out).

### Shadow Hunter

- Most damage: up throw → dash, dash attack, 24% from 90% (DI out). Inputs: Z ×1, — ×8, up ×1, — ×22, right ×1, right+A ×1, — ×62.
- forward throw kills Rifleman from 120% at the ledge: forward throw (DI out).
- up throw kills Rifleman from 50% at the ledge: up throw → forward smash (DI out).
- down throw kills Rifleman from 140% at the ledge: down throw (DI out).
- down air kills Cairne Bloodhoof from 90% at the ledge: down air (DI out).

### Pit Lord

- Most damage: up throw → dash, dash attack, 35% from 80% (DI out). Inputs: Z ×1, — ×10, up ×1, — ×30, right ×1, right+A ×1, — ×54.
- forward throw kills Rifleman from 100% at the ledge: forward throw (DI out).
- down throw kills Rifleman from 100% at the ledge: down throw (DI out).

### Beastmaster

- Most damage: up air → dash, dash attack, 27.7% from 80% (DI out). Inputs: C-up ×1, — ×26, right ×1, right+A ×1, — ×65.
- forward throw kills Rifleman from 110% at the ledge: forward throw (DI out).
- up throw kills Rifleman from 50% at the ledge: up throw → down smash (DI out).
- down throw kills Rifleman from 140% at the ledge: down throw (DI out).
- up air kills Rifleman from 70% at the ledge: up air → dash, dash attack (DI out).

### Lich King

- Most damage: up throw → dash, dash attack, 29% from 100% (DI out). Inputs: Z ×1, — ×8, up ×1, — ×30, right ×1, right+A ×1, — ×49.
- forward throw kills Rifleman from 110% at the ledge: forward throw (DI out).
- down throw kills Rifleman from 120% at the ledge: down throw (DI out).

### Thrall

- Most damage: up throw → down special → forward smash, 36% from 90% (DI in). Inputs: Z ×1, — ×8, up ×1, — ×28, down+B ×1, — ×55, C-left ×1, — ×102.
- forward throw kills Rifleman from 130% at the ledge: forward throw (DI out).
- down throw kills Rifleman from 120% at the ledge: down throw (DI out).

### Jaina Proudmoore

- Most damage: up throw → forward smash, 24% from 60% (DI out). Inputs: Z ×1, — ×8, up ×1, — ×25, C-right ×1, — ×72.
- forward throw kills Rifleman from 100% at the ledge: forward throw (DI out).
- down throw kills Rifleman from 110% at the ledge: down throw (DI out).

### Sylvanas Windrunner

- Most damage: up throw → forward smash, 21% from 100% (DI out). Inputs: Z ×1, — ×6, up ×1, — ×24, C-right ×1, — ×69.
- forward throw kills Rifleman from 160% at the ledge: forward throw (DI out).
- down throw kills Rifleman from 120% at the ledge: down throw (DI out).
- down special kills Rifleman from 150% at the ledge: down special (DI out).

### Cairne Bloodhoof

- Most damage: up throw → side special → grab, up throw → down smash, 52% from 70% (DI in). Inputs: Z ×1, — ×10, up ×1, — ×35, left+B ×1, — ×63, Z ×1, — ×9, up ×1, — ×32, C-down ×1, — ×93.
- forward throw kills Rifleman from 100% at the ledge: forward throw (DI out).
- up throw kills Rifleman from 70% at the centre: up throw → side special → grab, up throw → down smash (DI in).
- down throw kills Rifleman from 90% at the ledge: down throw (DI out).

### Chen Stormstout

- Most damage: up air → dash, dash attack, 32.5% from 70% (DI out). Inputs: C-up ×1, — ×27, right ×3, right+A ×1, — ×51.
- forward throw kills Rifleman from 100% at the ledge: forward throw (DI out).
- down throw kills Rifleman from 110% at the ledge: down throw (DI out).
- up air kills Rifleman from 70% at the ledge: up air → dash, dash attack (DI out).

### Peon

- Most damage: up throw → dash, dash attack, 25% from 90% (DI out). Inputs: Z ×1, — ×8, up ×1, — ×22, right ×1, right+A ×1, — ×50.
- forward throw kills Rifleman from 130% at the ledge: forward throw (DI out).
- down throw kills Rifleman from 140% at the ledge: down throw (DI out).

### Goblin Tinker

- Most damage: up throw → dash, dash attack, 24% from 120% (DI out). Inputs: Z ×1, — ×8, up ×1, — ×24, right ×1, right+A ×1, — ×74.
- up throw kills Rifleman from 110% at the ledge: up throw → dash, dash attack (DI out).
- down throw kills Rifleman from 120% at the ledge: down throw (DI out).

### Kael'thas Sunstrider

- Most damage: up throw → neutral special → dash, dash attack, 35% from 100% (DI down). Inputs: Z ×1, — ×8, up ×1, — ×31, B ×1, — ×43, right ×15, left+A ×1, — ×101.
- forward throw kills Rifleman from 180% at the ledge: forward throw (DI out).
- down throw kills Rifleman from 120% at the ledge: down throw (DI out).

