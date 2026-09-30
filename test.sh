#!/usr/bin/env bash
set -euo pipefail

project_dir=$(cd -- "$(dirname -- "$0")" && pwd)
compiler_jar="$project_dir/toolchain/wurstscript.jar"
java=/home/tom/.wurst/wurst-runtime/bin/java
stdlib_checkout=/home/tom/code/wurst-stdlib/pins/4dfc8a0474bd
compiler_checkout=/home/tom/code/wurst-compiler/pins/c31f228c4a43dad1bca4d4acc003b1d12a823331
test_timeout=${2:-20}
[[ "$test_timeout" =~ ^[1-9][0-9]*$ ]] || { echo 'Test timeout must be positive seconds.' >&2; exit 2; }
mkdir -p "$project_dir/_build" "$project_dir/build/wurst-tests"
cp "$compiler_checkout/de.peeeq.wurstscript/src/main/resources/common.j" "$project_dir/_build/common.j"
cp "$compiler_checkout/de.peeeq.wurstscript/src/main/resources/blizzard.j" "$project_dir/_build/blizzard.j"

exec "$java" -Xmx512m -XX:ActiveProcessorCount=2 -jar "$compiler_jar" \
    -lua -runtests -testFilter "${1:-Tests}" -testTimeout "$test_timeout" -runcompiletimefunctions -stacktraces \
    -workspaceroot "$project_dir" \
    -lib "$stdlib_checkout" \
    -out "$project_dir/build/wurst-tests/test.lua" \
    "$project_dir/_build/common.j" \
    "$project_dir/_build/blizzard.j" \
    "$project_dir/wurst/Simulation.wurst" \
    "$project_dir/wurst/DirectionalInput.wurst" \
    "$project_dir/wurst/DirectionalInputTests.wurst" \
    "$project_dir/wurst/SimulationTests.wurst" \
    "$project_dir/wurst/SelectionDrag.wurst" \
    "$project_dir/wurst/SelectionDragTests.wurst" \
    "$project_dir/wurst/StageSelection.wurst" \
    "$project_dir/wurst/StageSelectionTests.wurst" \
    "$project_dir/wurst/MatchRules.wurst" \
    "$project_dir/wurst/MatchRulesTests.wurst" \
    "$project_dir/wurst/MatchStep.wurst" \
    "$project_dir/wurst/MatchStepTests.wurst" \
    "$project_dir/wurst/FreezeTrapTests.wurst" \
    "$project_dir/wurst/SpecialMoveTests.wurst" \
    "$project_dir/wurst/CommandBuffer.wurst" \
    "$project_dir/wurst/CommandBufferTests.wurst" \
    "$project_dir/wurst/CombatInput.wurst" \
    "$project_dir/wurst/CombatInputTests.wurst" \
    "$project_dir/wurst/KeyBindings.wurst" \
    "$project_dir/wurst/KeyBindingsTests.wurst" \
    "$project_dir/wurst/PlayerInputState.wurst" \
    "$project_dir/wurst/PlayerInputStateTests.wurst" \
    "$project_dir/wurst/ReplayState.wurst" \
    "$project_dir/wurst/ReplayStateTests.wurst" \
    "$project_dir/wurst/ReplayHistory.wurst" \
    "$project_dir/wurst/ReplayHistoryTests.wurst" \
    "$project_dir/wurst/ReplaySoak.wurst" \
    "$project_dir/wurst/NetworkInput.wurst" \
    "$project_dir/wurst/NetworkInputTests.wurst" \
    "$project_dir/wurst/InputProtocol.wurst" \
    "$project_dir/wurst/InputProtocolTests.wurst" \
    "$project_dir/wurst/InputLedger.wurst" \
    "$project_dir/wurst/InputLedgerTests.wurst" \
    "$project_dir/wurst/FixedInputSchedule.wurst" \
    "$project_dir/wurst/FixedInputScheduleTests.wurst" \
    "$project_dir/wurst/ImpactEvents.wurst" \
    "$project_dir/wurst/ImpactEventsTests.wurst"
