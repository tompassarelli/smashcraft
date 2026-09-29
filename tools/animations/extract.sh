#!/usr/bin/env bash
set -euo pipefail
project_dir=$(cd -- "$(dirname -- "$0")/../.." && pwd)
casc_dir=${CASC_SOURCE:-/home/tom/code/casclib/worktrees/assets}
storage=${WC3_STORAGE:-/home/tom/.local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/Program Files (x86)/Warcraft III}
output_dir="$project_dir/build/animation-assets"
mkdir -p "$output_dir"
g++ -O2 -I "$casc_dir/src" "$project_dir/tools/animations/casc-extract.cpp" \
    "$casc_dir/build/libcasc.a" -pthread -o "$output_dir/casc-extract"
cd "$project_dir/tools/animations"
bun install --frozen-lockfile
for model in units/nightelf/archer/archer units/human/rifleman/rifleman; do
    name=${model##*/}
    "$output_dir/casc-extract" "$storage" "war3.w3mod:$model.mdx" "$output_dir/$name.mdx"
    bun "$project_dir/tools/animations/convert.ts" "$output_dir/$name.mdx" "$output_dir/$name.mdl"
done
# This installed build stores DDS textures even when model paths end in BLP.
for texture in Textures/Ranger Textures/star2_32 Textures/gutz Units/Human/Rifleman/Rifleman Textures/Dust3x Textures/Flame4 ReplaceableTextures/TeamColor/TeamColor00; do
    target="$output_dir/textures/$texture"
    mkdir -p "$(dirname -- "$target")"
    "$output_dir/casc-extract" "$storage" "war3.w3mod:$texture.dds" "$target.dds"
    magick "$target.dds[0]" "$target.png"
done
printf 'Models and textures: %s\n' "$output_dir"
