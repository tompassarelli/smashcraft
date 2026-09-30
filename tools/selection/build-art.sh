#!/usr/bin/env bash
set -euo pipefail
project_dir=$(cd -- "$(dirname -- "$0")/../.." && pwd)
source_dir="$project_dir/tools/selection/art"
output_dir="$project_dir/build/selection-assets"
mkdir -p "$output_dir"
for chip in P1 P2 CPU; do
    case "$chip" in
        P1) color='#c52c38'; label=P1;;
        P2) color='#2876cd'; label=P2;;
        CPU) color='#626977'; label=P2;;
    esac
    sed -e "s/CHIP_COLOR/$color/g" -e "s/CHIP_LABEL/$label/g" "$source_dir/SelectionChip.svg" > "$output_dir/SelectionChip$chip.svg"
    magick -background none "$output_dir/SelectionChip$chip.svg" -depth 8 "TGA:$output_dir/SelectionChip$chip.tga"
done
for name in SelectionBackdrop SelectionTileFrame SelectionAction SelectionSkyDeck SelectionThreeBridges; do
    magick -background none "$source_dir/$name.svg" -depth 8 "TGA:$output_dir/$name.tga"
done
for card in Red Blue Gray; do
    case "$card" in
        Red) color='#9c2539'; edge='#f05c69'; metal='#bbc6cf';;
        Blue) color='#205fba'; edge='#66a5ff'; metal='#bbc6cf';;
        Gray) color='#30353b'; edge='#555d65'; metal='#687078';;
    esac
    sed -e "s/CARD_COLOR/$color/g" -e "s/CARD_EDGE/$edge/g" -e "s/CARD_METAL/$metal/g" \
        "$source_dir/SelectionCard.svg" > "$output_dir/SelectionCard$card.svg"
    magick -background none "$output_dir/SelectionCard$card.svg" -depth 8 "TGA:$output_dir/SelectionCard$card.tga"
    rm "$output_dir/SelectionCard$card.svg"
done
magick identify "$output_dir"/*.tga
