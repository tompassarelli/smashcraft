#!/usr/bin/env bash
set -euo pipefail
project_dir=$(cd -- "$(dirname -- "$0")/../.." && pwd)
source_dir="$project_dir/tools/selection/art"
output_dir="$project_dir/build/selection-assets"
mkdir -p "$output_dir"
for chip in P1 P2 CPU; do
    case "$chip" in
        P1) color='#c52c38';;
        P2) color='#2876cd';;
        CPU) color='#626977';;
    esac
    sed -e "s/CHIP_COLOR/$color/g" -e "s/CHIP_LABEL/$chip/g" "$source_dir/SelectionChip.svg" > "$output_dir/SelectionChip$chip.svg"
    magick -background none "$output_dir/SelectionChip$chip.svg" -depth 8 "TGA:$output_dir/SelectionChip$chip.tga"
done
for name in SelectionBackdrop SelectionTileFrame SelectionAction SelectionSkyDeck SelectionThreeBridges; do
    magick -background none "$source_dir/$name.svg" -depth 8 "TGA:$output_dir/$name.tga"
done
sed -e 's/CARD_COLOR/#7d1c2d/g' -e 's/PLAYER_MARK/P1/' "$source_dir/SelectionCard.svg" > "$output_dir/SelectionCardRed.svg"
sed -e 's/CARD_COLOR/#194d9b/g' -e 's/PLAYER_MARK/P2/' "$source_dir/SelectionCard.svg" > "$output_dir/SelectionCardBlue.svg"
magick -background none "$output_dir/SelectionCardRed.svg" -depth 8 "TGA:$output_dir/SelectionCardRed.tga"
magick -background none "$output_dir/SelectionCardBlue.svg" -depth 8 "TGA:$output_dir/SelectionCardBlue.tga"
rm "$output_dir/SelectionCardRed.svg" "$output_dir/SelectionCardBlue.svg"
magick identify "$output_dir"/*.tga
