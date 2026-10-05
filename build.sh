#!/usr/bin/env bash
# Canonical TypeScript-only map build. `wisp build`
# (wisp:scripts/wisp/mapBuild.ts) does the work; this script
# supplies its private asset inputs and map packager.
set -euo pipefail

project_dir=$(cd -- "$(dirname -- "$0")" && pwd)
if [[ $# -ne 2 || ! -f "$1" || ! -f "$2" ]]; then
    printf 'Usage: %s BASE_MAP.w3m|BASE_MAP.w3x ASSET_CONTAINER.w3x\n' "$0" >&2
    exit 2
fi
private_assets=${WC3_PRIVATE_ASSETS:?Set WC3_PRIVATE_ASSETS to the private prepared clip directory.}
candidate=${WC3_TS_CANDIDATE_ID:-$(date +%s)}
[[ "$candidate" =~ ^[A-Za-z0-9._-]+$ ]] || { echo 'WC3_TS_CANDIDATE_ID may contain only letters, digits, dots, underscores, and hyphens.' >&2; exit 2; }
map_name="Smashcraft diagnostic ts-$candidate"
private_build_root=$(realpath -m -- "$private_assets/build")
case "$private_build_root" in "$project_dir"|"$project_dir"/*) echo 'Private build inputs must be outside the checkout.' >&2; exit 2;; esac
output=$(realpath -m -- "${WC3_BUILD_OUTPUT:-$private_build_root/$map_name.w3x}")
[[ "$output" == "$private_build_root/"*.w3x ]] || { echo 'WC3_BUILD_OUTPUT must be a .w3x path under the private build directory.' >&2; exit 2; }
bun=${WC3_BUN:-/nix/store/g7skjk9lrdnshaxd7px62bchq6yg0bbh-bun-1.3.13/bin/bun}

packager="$project_dir/build/tools/map-pack"
if [[ ! -x "$packager" ]]; then
    mkdir -p "$(dirname -- "$packager")"
    stormlib=$(nix build --no-link --print-out-paths nixpkgs#stormlib)
    nix shell nixpkgs#gcc --command gcc -I"$stormlib/include" "$project_dir/ts/node_modules/wisp/native/map-pack.c" \
        -L"$stormlib/lib" -Wl,-rpath,"$stormlib/lib" -lstorm -o "$packager"
fi
mkdir -p "$(dirname -- "$output")"

exec "$bun" "$project_dir/ts/scripts/wisp.ts" build \
    --base "$(realpath -- "$1")" --container "$(realpath -- "$2")" \
    --assets "$project_dir/build" --summon "$private_assets/summon-original-clips" \
    --name "$map_name" --out "$output" --packager "$packager"
