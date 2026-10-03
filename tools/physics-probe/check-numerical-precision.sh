#!/usr/bin/env bash
set -euo pipefail
project_dir=$(cd -- "$(dirname -- "$0")/../.." && pwd)
output_dir="$project_dir/build/physics-probe"
compiler_root=/home/tom/code/wurst-compiler/pins/9913e1bd300c2053637d756a11bae8c3c8ed568f
stdlib_root=/home/tom/code/wurst-stdlib/pins/bb1e0458db5a
mkdir -p "$output_dir"
/home/tom/.wurst/wurst-runtime/bin/java -Xmx2048m -XX:ActiveProcessorCount=2 \
    -jar "$project_dir/toolchain/wurstscript.jar" -lua -runcompiletimefunctions -stacktraces \
    -workspaceroot "$project_dir" -lib "$stdlib_root" -out "$output_dir/precision.lua" \
    "$compiler_root/de.peeeq.wurstscript/src/main/resources/common.j" \
    "$compiler_root/de.peeeq.wurstscript/src/main/resources/blizzard.j" \
    "$project_dir/wurst/Simulation.wurst" "$project_dir/wurst/RollTravel.wurst" \
    "$project_dir/tools/physics-probe/NumericalPrecisionProbe.wurst"
cat > "$output_dir/run-precision.lua" <<'LUA'
local project, runtime = arg[1], arg[2]
dofile(runtime .. '/wc3shim.lua')
dofile(runtime .. '/common.j.lua')
dofile(runtime .. '/blizzard.j.lua')
dofile(project .. '/build/physics-probe/precision.lua')
-- Scalar simulation fixture; map UI and handle initialization are outside this claim.
__wurst_init_bootstrap()
initGlobals()
initCompiletimeState()
init_Real()
init_Integer()
init_Simulation()
local results = {}
BJDebugMsg = function(message)
    if string.find(message, '_FAIL$', 1) then error(message) end
    results[message] = true
    print(message)
end
init_NumericalPrecisionProbe()
assert(results.GROUNDED_BINARY32_EXACT_PASS and results.SHIELD_REGEN_BINARY32_EXACT_PASS
    and results.SHIELD_DAMAGE_BINARY32_EXACT_PASS and results.SHIELD_CONTACT_SUM_BINARY32_EXACT_PASS
    and results.SHIELD_STUN_BINARY32_EXACT_PASS,
    'Missing numerical precision result')
LUA
nix shell nixpkgs#lua5_3 --command lua "$output_dir/run-precision.lua" "$project_dir" \
    "$compiler_root/de.peeeq.wurstscript/src/test/resources/luaruntime"
