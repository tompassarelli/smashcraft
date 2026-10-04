#!/usr/bin/env bash
set -euo pipefail
project_dir=$(cd -- "$(dirname -- "$0")/../.." && pwd)
output_dir="$project_dir/build/physics-probe"
compiler_root=/home/tom/code/wurst-compiler/pins/6b129956f6e7cf9582510f26b99d305526bf3ded
runtime_root=/home/tom/code/wurst-compiler/pins/0fe2efc959049b4ede2b86c66ae61c130eb04b55
stdlib_root=/home/tom/code/wurst-stdlib/pins/e3714f629113
mkdir -p "$output_dir"
"${BUN:-/nix/store/g7skjk9lrdnshaxd7px62bchq6yg0bbh-bun-1.3.13/bin/bun}" "$project_dir/tools/physics-probe/generate-capsule-probe.mjs"
"${BUN:-/nix/store/g7skjk9lrdnshaxd7px62bchq6yg0bbh-bun-1.3.13/bin/bun}" "$project_dir/tools/physics-probe/generate-air-cutoff-probe.mjs"
"${BUN:-/nix/store/g7skjk9lrdnshaxd7px62bchq6yg0bbh-bun-1.3.13/bin/bun}" "$project_dir/tools/physics-probe/generate-signed-zero-probe.mjs"
"${BUN:-/nix/store/g7skjk9lrdnshaxd7px62bchq6yg0bbh-bun-1.3.13/bin/bun}" "$project_dir/tools/physics-probe/generate-recorded-fall-probe.mjs"
"${BUN:-/nix/store/g7skjk9lrdnshaxd7px62bchq6yg0bbh-bun-1.3.13/bin/bun}" "$project_dir/tools/physics-probe/generate-air-decrement-probe.mjs"
"${BUN:-/nix/store/g7skjk9lrdnshaxd7px62bchq6yg0bbh-bun-1.3.13/bin/bun}" "$project_dir/tools/physics-probe/generate-ground-motion-probe.mjs"
"${BUN:-/nix/store/g7skjk9lrdnshaxd7px62bchq6yg0bbh-bun-1.3.13/bin/bun}" "$project_dir/tools/physics-probe/generate-hitstun-probe.mjs"
"${BUN:-/nix/store/g7skjk9lrdnshaxd7px62bchq6yg0bbh-bun-1.3.13/bin/bun}" "$project_dir/tools/physics-probe/generate-launch-magnitude-probe.mjs"
"${BUN:-/nix/store/g7skjk9lrdnshaxd7px62bchq6yg0bbh-bun-1.3.13/bin/bun}" "$project_dir/tools/physics-probe/generate-hitlag-probe.mjs"
"${BUN:-/nix/store/g7skjk9lrdnshaxd7px62bchq6yg0bbh-bun-1.3.13/bin/bun}" "$project_dir/tools/physics-probe/generate-analog-shield-probe.mjs"
"${BUN:-/nix/store/g7skjk9lrdnshaxd7px62bchq6yg0bbh-bun-1.3.13/bin/bun}" "$project_dir/tools/physics-probe/generate-di-probe.mjs"
/home/tom/.wurst/wurst-runtime/bin/java -Xmx2048m -XX:ActiveProcessorCount=2 \
    -jar "$project_dir/toolchain/wurstscript.jar" -lua -runcompiletimefunctions -stacktraces \
    -workspaceroot "$project_dir" -lib "$stdlib_root" -out "$output_dir/precision.lua" \
    "$compiler_root/de.peeeq.wurstscript/src/main/resources/common.j" \
    "$compiler_root/de.peeeq.wurstscript/src/main/resources/blizzard.j" \
    "$project_dir/wurst/Simulation.wurst" "$project_dir/wurst/MeleeContactGeometry.wurst" \
    "$project_dir/wurst/RollTravel.wurst" \
    "$project_dir/wurst/MeleeScalarMath.wurst" \
    "$project_dir/wurst/ParticipantInputs.wurst" "$project_dir/wurst/CommandBuffer.wurst" \
    "$project_dir/wurst/NetworkInput.wurst" "$project_dir/wurst/KeyBindings.wurst" \
    "$project_dir/wurst/TechInput.wurst" \
    "$project_dir/tools/physics-probe/NumericalPrecisionProbe.wurst" \
    "$output_dir/DirectionalInfluencePrecisionProbe.wurst" \
    "$output_dir/CapsuleShieldPrecisionProbe.wurst" \
    "$output_dir/AnalogShieldPrecisionProbe.wurst" \
    "$output_dir/HitlagPrecisionProbe.wurst" \
    "$output_dir/HitstunPrecisionProbe.wurst" \
    "$output_dir/GroundMotionPrecisionProbe.wurst" \
    "$output_dir/LaunchMagnitudePrecisionProbe.wurst" \
    "$output_dir/RecordedFallPrecisionProbe.wurst" "$output_dir/AirDecrementPrecisionProbe.wurst" \
    "$output_dir/SignedZeroPrecisionProbe.wurst" "$output_dir/AirCutoffPrecisionProbe.wurst"
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
init_ParticipantInputs()
init_MeleeScalarMath()
init_MeleeContactGeometry()
init_Simulation()
local results = {}
local failed = false
BJDebugMsg = function(message)
    if string.find(message, '_FAIL$', 1) then failed = true end
    results[message] = true
    print(message)
end
init_NumericalPrecisionProbe()
init_RecordedFallPrecisionProbe()
init_AirDecrementPrecisionProbe()
init_SignedZeroPrecisionProbe()
init_AirCutoffPrecisionProbe()
init_GroundMotionPrecisionProbe()
init_HitstunPrecisionProbe()
init_HitlagPrecisionProbe()
init_AnalogShieldPrecisionProbe()
init_LaunchMagnitudePrecisionProbe()
init_DirectionalInfluencePrecisionProbe()
init_CapsuleShieldPrecisionProbe()
assert(results.GROUNDED_BINARY32_EXACT_PASS and results.SHIELD_REGEN_BINARY32_EXACT_PASS
    and results.SHIELD_DAMAGE_BINARY32_EXACT_PASS and results.SHIELD_CONTACT_SUM_BINARY32_EXACT_PASS
    and results.SHIELD_STUN_BINARY32_EXACT_PASS and results.RECORDED_FALL_TEN_FRAMES_BINARY32_EXACT_PASS
    and results.AIR_DECREMENT_BINARY32_EXACT_PASS and results.SIGNED_ZERO_SCALARS_EXACT_PASS
    and results.HITSTUN_BOUNDARIES_EXACT_PASS and results.AIR_CUTOFF_BINARY32_EXACT_PASS and results.GROUND_MOTION_BINARY32_EXACT_PASS
    and results.LAUNCH_MAGNITUDE_BINARY32_EXACT_PASS and results.HITLAG_SCALARS_EXACT_PASS and results.ANALOG_SHIELD_BINARY32_EXACT_PASS
    and results.DIRECTIONAL_INFLUENCE_BINARY32_EXACT_PASS and results.CAPSULE_SHIELD_CLASSIFICATION_PASS
    and not failed,
    'Missing numerical precision result')
LUA
if [[ -n ${PHYSICS_LUA:-} ]]; then
    "$PHYSICS_LUA" "$output_dir/run-precision.lua" "$project_dir" \
        "$runtime_root/de.peeeq.wurstscript/src/test/resources/luaruntime"
else
    nix shell nixpkgs#lua5_3 --command lua "$output_dir/run-precision.lua" "$project_dir" \
        "$runtime_root/de.peeeq.wurstscript/src/test/resources/luaruntime"
fi
