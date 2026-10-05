#!/usr/bin/env bash
set -euo pipefail
project_dir=$(cd -- "$(dirname -- "$0")/../.." && pwd)
mode=${1:-export}
[[ "$mode" == export || "$mode" == --check ]] || { echo 'Usage: tools/move-data/compare.sh [--check]' >&2; exit 2; }
cd "$project_dir/ts"
if [[ "$mode" == --check ]]; then
    "${MOVE_DATA_BUN:-bun}" test ./scripts/moveComparisons.tests.ts
fi
"${MOVE_DATA_BUN:-bun}" scripts/moveData.ts compare "$mode"
