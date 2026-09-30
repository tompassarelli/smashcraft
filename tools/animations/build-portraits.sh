#!/usr/bin/env bash
set -euo pipefail
project_dir=$(cd -- "$(dirname -- "$0")/../.." && pwd)
mkdir -p "$project_dir/build/selection-assets"
for fighter in Archer Rifleman; do
    blender --background --threads 2 --python-exit-code 1 \
        --python "$project_dir/tools/animations/portraits.py" -- "$fighter" \
        > "$project_dir/build/selection-assets/$fighter-render.log" 2>&1
    portrait="$project_dir/build/selection-assets/${fighter}Portrait.png"
    [[ $(magick "$portrait" -format '%[fx:mean.a>0.01]' info:) == 1 ]]

    # Normalize full silhouette height; the portrait camera must fit weapons
    # within the square canvas at that scale. Never crop a weapon to fit.
    silhouette_width=$(magick "$portrait" -trim +repage -resize x960 -format '%w' info:)
    [[ "$silhouette_width" -le 1024 ]] || { echo "$fighter portrait camera leaves the weapon outside its frame" >&2; exit 1; }
    magick "$portrait" -trim +repage -resize x960 \
        -background none -gravity center -extent 1024x1024 -depth 8 -compress none \
        "$project_dir/build/selection-assets/${fighter}Portrait.tga"
    magick "$project_dir/build/selection-assets/${fighter}Portrait.tga" -resize 512x512 \
        -gravity center \
        -background '#152034' -extent 512x512 -alpha remove -depth 8 -compress none \
        "$project_dir/build/selection-assets/${fighter}Tile.tga"
done
