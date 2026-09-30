#!/usr/bin/env bash
set -euo pipefail
project_dir=$(cd -- "$(dirname -- "$0")/../.." && pwd)
casc_dir=${CASC_SOURCE:-/home/tom/code/casclib/worktrees/assets}
storage=${WC3_STORAGE:-/home/tom/.local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/Program Files (x86)/Warcraft III}
output_dir="$project_dir/build/illidan-assets"
mkdir -p "$output_dir"
casc_extractor=${CASC_EXTRACTOR:-"$output_dir/casc-extract"}
if [[ ! -x "$casc_extractor" ]]; then
    cxx=${CXX:-g++}
    command -v "$cxx" >/dev/null || { echo "C++ compiler $cxx is required to build the CASC extractor" >&2; exit 1; }
    "$cxx" -O2 -I "$casc_dir/src" "$project_dir/tools/animations/casc-extract.cpp" \
        "$casc_dir/build/libcasc.a" -pthread -o "$casc_extractor"
fi
"$casc_extractor" "$storage" \
    'war3.w3mod:units/nightelf/herodemonhunter/herodemonhunter.mdx' \
    "$output_dir/demonhunter.mdx"
for texture in HeroDemonHunter Black32 Shadow Dust5ABlack Zap1 Clouds8x8Mod Clouds8x8FadeWhite; do
    target="$output_dir/textures/Textures/$texture"
    mkdir -p "$(dirname -- "$target")"
    "$casc_extractor" "$storage" "war3.w3mod:Textures/$texture.dds" "$target.dds"
    magick "$target.dds[0]" "$target.png"
done
for texture in TeamColor/TeamColor00 TeamGlow/TeamGlow00; do
    target="$output_dir/textures/ReplaceableTextures/$texture"
    mkdir -p "$(dirname -- "$target")"
    "$casc_extractor" "$storage" "war3.w3mod:ReplaceableTextures/$texture.dds" "$target.dds"
    magick "$target.dds[0]" "$target.png"
done
printf 'Demon Hunter model and source textures: %s\n' "$output_dir"
