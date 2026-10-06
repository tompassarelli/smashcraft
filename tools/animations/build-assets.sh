#!/usr/bin/env bash
set -euo pipefail
project_dir=$(cd -- "$(dirname -- "$0")/../.." && pwd)
assets="$project_dir/build/animation-assets"
bash "$project_dir/tools/animations/extract.sh"
blender --background --threads 2 --python-exit-code 1 \
    --python "$project_dir/tools/animations/import.py" -- archer > "$assets/import-archer.log" 2>&1
blender --background --threads 2 --python-exit-code 1 \
    --python "$project_dir/tools/animations/jab.py" > "$assets/author-jab.log" 2>&1
blender --background --threads 2 --python-exit-code 1 \
    --python "$project_dir/tools/animations/dodges.py" > "$assets/author-dodges.log" 2>&1
blender --background --threads 2 --python-exit-code 1 \
    --python "$project_dir/tools/animations/archer-specials.py" > "$assets/author-archer-specials.log" 2>&1
blender --background --threads 2 --python-exit-code 1 \
    --python "$project_dir/tools/animations/strikes.py" -- archer > "$assets/author-archer-strikes.log" 2>&1
blender --background --threads 2 --python-exit-code 1 \
    --python "$project_dir/tools/animations/import.py" -- rifleman > "$assets/import-rifleman.log" 2>&1
blender --background --threads 2 --python-exit-code 1 \
    --python "$project_dir/tools/animations/rifleman.py" > "$assets/author-rifleman.log" 2>&1
blender --background --threads 2 --python-exit-code 1 \
    --python "$project_dir/tools/animations/strikes.py" -- rifleman > "$assets/author-rifleman-strikes.log" 2>&1
bun "$project_dir/tools/animations/package.ts"
