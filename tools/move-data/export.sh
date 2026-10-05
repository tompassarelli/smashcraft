#!/usr/bin/env bash
set -euo pipefail
project_dir=$(cd -- "$(dirname -- "$0")/../.." && pwd)
output_dir="$project_dir/build/move-export"
mode=${1:-export}
[[ "$mode" == export || "$mode" == --check ]] || { echo 'Usage: tools/move-data/export.sh [--check]' >&2; exit 2; }
# These paths resolve the source-owned lock; no alternate compiler is selected.
lock_value() { sed -n "s/^$1 = \"\(.*\)\"$/\1/p" "$project_dir/wurst-toolchain.lock"; }
compiler_commit=$(lock_value compilerCommit)
stdlib_commit=$(lock_value stdlibCommit)
runtime_commit=$(lock_value luaTestRuntimeCommit)
compiler_root="/home/tom/code/wurst-compiler/pins/$compiler_commit"
stdlib_root="/home/tom/code/wurst-stdlib/pins/${stdlib_commit:0:12}"
runtime_root="/home/tom/code/wurst-compiler/pins/$runtime_commit/de.peeeq.wurstscript/src/test/resources/luaruntime"
compiler_jar="$project_dir/toolchain/wurstscript.jar"
expected_hash=$(lock_value compilerArtifactSha256)
actual_hash=$(sha256sum "$compiler_jar")
[[ "${actual_hash%% *}" == "$expected_hash" ]] || { echo 'Compiler artifact does not match wurst-toolchain.lock' >&2; exit 1; }
mkdir -p "$output_dir/workspace"
cp "$project_dir/wurst.build" "$project_dir/wurst_run.args" "$output_dir/workspace/"
test_args=()
if [[ "$mode" == --check ]]; then
    test_args=(-runtests -testFilter MoveDataTests -testTimeout 90)
fi
cd "$output_dir/workspace"
/home/tom/.wurst/wurst-runtime/bin/java -Xmx2048m -XX:ActiveProcessorCount=2 \
    -jar "$compiler_jar" -lua -runcompiletimefunctions -stacktraces "${test_args[@]}" \
    -workspaceroot "$output_dir/workspace" -lib "$stdlib_root" -out "$output_dir/moves.lua" \
    "$compiler_root/de.peeeq.wurstscript/src/main/resources/common.j" \
    "$compiler_root/de.peeeq.wurstscript/src/main/resources/blizzard.j" \
    "$project_dir/wurst/Simulation.wurst" "$project_dir/wurst/MeleeContactGeometry.wurst" \
    "$project_dir/wurst/RollTravel.wurst" "$project_dir/wurst/MeleeScalarMath.wurst" \
    "$project_dir/wurst/ParticipantInputs.wurst" "$project_dir/wurst/CommandBuffer.wurst" \
    "$project_dir/wurst/NetworkInput.wurst" "$project_dir/wurst/KeyBindings.wurst" \
    "$project_dir/wurst/TechInput.wurst" "$project_dir/wurst/MoveData.wurst" \
    "$project_dir/tools/move-data/MoveDataExport.wurst" \
    "$project_dir/tools/move-data/MoveDataTests.wurst" > "$output_dir/compiler.log" 2>&1 || {
        cat "$output_dir/compiler.log" >&2; exit 1;
    }
if [[ -n ${MOVE_DATA_LUA:-} ]]; then
    "$MOVE_DATA_LUA" "$project_dir/tools/move-data/run.lua" "$output_dir" "$runtime_root"
else
    nix shell nixpkgs#lua5_3 --command lua "$project_dir/tools/move-data/run.lua" "$output_dir" "$runtime_root"
fi
if [[ "$mode" == --check ]]; then
    cmp "$project_dir/tools/move-data/moves.jsonl" "$output_dir/moves.jsonl" || {
        echo 'Production move data changed: inspect the fresh export before replacing the snapshot.' >&2
        exit 1
    }
    echo 'Production move export matches the checked-in snapshot.'
fi
