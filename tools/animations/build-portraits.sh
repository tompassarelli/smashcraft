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
    magick "$portrait" -trim +repage -resize 900x960 -gravity center \
        -background none -extent 1024x1024 -depth 8 -compress none \
        "$project_dir/build/selection-assets/${fighter}Portrait.tga"
    magick "$portrait" -trim +repage -resize 640x960 -gravity north \
        -crop 640x640+0+0 +repage -resize 512x512 -gravity center \
        -background '#152034' -extent 512x512 -alpha remove -depth 8 -compress none \
        "$project_dir/build/selection-assets/${fighter}Tile.tga"
done
