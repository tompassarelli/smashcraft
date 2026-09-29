#!/usr/bin/env bash
set -euo pipefail

project_dir=$(cd -- "$(dirname -- "$0")" && pwd)
compiler_jar="$project_dir/toolchain/wurstscript.jar"
java=/home/tom/.wurst/wurst-runtime/bin/java
stdlib_checkout=/home/tom/code/resources/WurstStdlib2

exec "$java" -jar "$compiler_jar" \
    -lua -runtests -testFilter SimulationTests -runcompiletimefunctions -stacktraces \
    -workspaceroot "$project_dir" \
    -lib "$stdlib_checkout" \
    -out "$project_dir/build/wurst-tests/test.lua" \
    "$project_dir/_build/common.j" \
    "$project_dir/_build/blizzard.j" \
    "$project_dir/wurst/Simulation.wurst" \
    "$project_dir/wurst/SimulationTests.wurst"
