#!/usr/bin/env bash





set -euo pipefail
project_dir=$(cd -- "$(dirname -- "$0")/../.." && pwd)
inputs=${1:-$HOME/.local/share/smashcraft-build-inputs/lich-king-20261007}
build="$inputs/build"
mkdir -p "$build"
bun "$project_dir/tools/animations/convert.ts" "$inputs/src/LichKing2.mdx" "$build/LichKing2.mdl"

env -u LD_LIBRARY_PATH blender --background --threads 2 --python-exit-code 1 \
    --python "$project_dir/tools/animations/lichking.py" -- "$build/LichKing2.mdl" "$build" > "$build/author.log" 2>&1
append_args=()
if [[ -n ${2:-} ]]; then append_args=(--append-to "$2"); fi
bun "$project_dir/tools/animations/package-lichking.ts" "$inputs/src/LichKing2.mdx" "$build" "$inputs/LichKingFighter.mdx" "${append_args[@]}" "${@:3}"
