#!/usr/bin/env bash
set -euo pipefail
project_dir=$(cd -- "$(dirname -- "$0")/../.." && pwd)
source_dir="$project_dir/tools/selection/art"
output_dir="$project_dir/build/selection-assets"
mkdir -p "$output_dir"
for name in SelectionBackdrop SelectionTileFrame SelectionAction SelectionStage; do
    magick -background none "$source_dir/$name.svg" -depth 8 "TGA:$output_dir/$name.tga"
done
sed -e 's/CARD_COLOR/#7d1c2d/g' -e 's/PLAYER_MARK/P1/' "$source_dir/SelectionCard.svg" > "$output_dir/SelectionCardRed.svg"
sed -e 's/CARD_COLOR/#194d9b/g' -e 's/PLAYER_MARK/P2/' "$source_dir/SelectionCard.svg" > "$output_dir/SelectionCardBlue.svg"
magick -background none "$output_dir/SelectionCardRed.svg" -depth 8 "TGA:$output_dir/SelectionCardRed.tga"
magick -background none "$output_dir/SelectionCardBlue.svg" -depth 8 "TGA:$output_dir/SelectionCardBlue.tga"
rm "$output_dir/SelectionCardRed.svg" "$output_dir/SelectionCardBlue.svg"
magick identify "$output_dir"/*.tga
