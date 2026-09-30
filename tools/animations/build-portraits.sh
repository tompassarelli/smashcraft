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

    # Use a matching head-to-boots frame for both fighters. Fitting the full
    # alpha bounds shrinks Rifleman to make room for his long gun while Archer
    # fills the image. These fixed 3:4 windows normalize the visible bodies
    # without stretching either model; the weapon tips may crop at the edges.
    case "$fighter" in
        Archer)
            portrait_crop=450x600+295+220
            tile_crop=450x450+295+220
            ;;
        Rifleman)
            portrait_crop=398x530+325+315
            tile_crop=398x398+325+315
            ;;
    esac
    magick "$portrait" -crop "$portrait_crop" +repage -resize 768x1024 \
        -background none -gravity center -extent 768x1024 -depth 8 -compress none \
        "$project_dir/build/selection-assets/${fighter}Portrait.tga"
    magick "$portrait" -crop "$tile_crop" +repage -resize 512x512 \
        -gravity center \
        -background '#152034' -extent 512x512 -alpha remove -depth 8 -compress none \
        "$project_dir/build/selection-assets/${fighter}Tile.tga"
done
