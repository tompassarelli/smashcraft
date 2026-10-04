#!/usr/bin/env bash
set -euo pipefail
project_dir=$(cd -- "$(dirname -- "$0")/../.." && pwd)
base_map=$(realpath -- "${1:?Usage: build-native-precision.sh PRIVATE_BASE_MAP.w3m COORDINATED_VERSION}")
map_version=${2:?Supply the version agreed with concurrent map developers.}
[[ "$map_version" =~ ^0\.0\.[1-9][0-9]*$ ]] || { echo 'Version must be 0.0.N with positive N.' >&2; exit 2; }
compiler="$project_dir/toolchain/wurstscript.jar"
stdlib=/home/tom/code/wurst-stdlib/pins/e3714f629113
packager="$project_dir/build/tools/map-pack"
[[ $(sha256sum "$compiler" | cut -d ' ' -f1) == 9495b1f3ad1f1baf53335934e9152874773e6c735b0e5db819b3e7f06c82ed15 ]]
[[ $(git -C "$stdlib" rev-parse HEAD) == e3714f629113ee682353c3244065fee3e7d9ae16 ]]
[[ -x "$packager" && -s "$base_map" ]]
mkdir -p "$project_dir/build/physics-probe"
private_build_root="$HOME/.local/share/smashcraft-build-inputs/$(basename -- "$project_dir")"
mkdir -p "$private_build_root"
build_dir=$(mktemp -d "$private_build_root/native.XXXXXX")
mkdir -p "$build_dir/wurst" "$build_dir/_build/dependencies"
bun=${BUN:-/nix/store/g7skjk9lrdnshaxd7px62bchq6yg0bbh-bun-1.3.13/bin/bun}
for generator in generate-air-cutoff-probe generate-signed-zero-probe generate-recorded-fall-probe generate-air-decrement-probe generate-ground-motion-probe generate-hitstun-probe generate-launch-magnitude-probe generate-hitlag-probe generate-analog-shield-probe generate-di-probe generate-capsule-probe; do
	"$bun" "$project_dir/tools/physics-probe/$generator.mjs"
done
simulation_packages=(Simulation MeleeContactGeometry RollTravel MeleeScalarMath ParticipantInputs CommandBuffer NetworkInput KeyBindings TechInput)
for package in "${simulation_packages[@]}"; do
	cp "$project_dir/wurst/$package.wurst" "$build_dir/wurst/"
done
cp "$project_dir/tools/physics-probe/NativePhysicsReport.wurst" "$build_dir/wurst/"
for probe in "$project_dir/tools/physics-probe/NumericalPrecisionProbe.wurst" \
	"$project_dir/build/physics-probe/RecordedFallPrecisionProbe.wurst" \
	"$project_dir/build/physics-probe/AirDecrementPrecisionProbe.wurst" \
	"$project_dir/build/physics-probe/SignedZeroPrecisionProbe.wurst" \
	"$project_dir/build/physics-probe/AirCutoffPrecisionProbe.wurst" \
	"$project_dir/build/physics-probe/GroundMotionPrecisionProbe.wurst" \
	"$project_dir/build/physics-probe/DirectionalInfluencePrecisionProbe.wurst" \
	"$project_dir/build/physics-probe/CapsuleShieldPrecisionProbe.wurst" \
	"$project_dir/build/physics-probe/AnalogShieldPrecisionProbe.wurst" \
	"$project_dir/build/physics-probe/HitlagPrecisionProbe.wurst" \
	"$project_dir/build/physics-probe/HitstunPrecisionProbe.wurst" \
	"$project_dir/build/physics-probe/LaunchMagnitudePrecisionProbe.wurst"; do
	# Authored test sources use one report boundary in the native map.
	awk '/^package / { print; print "import NativePhysicsReport"; next } { gsub(/BJDebugMsg\(/, "reportPhysicsProbe("); print }' "$probe" > "$build_dir/wurst/$(basename -- "$probe")"
done
source_commit=$(git -C "$project_dir" rev-parse HEAD)
for package in "${simulation_packages[@]}"; do
	git -C "$project_dir" diff --quiet HEAD -- "wurst/$package.wurst"
done
printf 'package NativePhysicsSource\npublic constant string PHYSICS_SOURCE = "%s"\n' "$source_commit" > "$build_dir/wurst/NativePhysicsSource.wurst"
cp "$project_dir/tools/map-entry.j" "$build_dir/wurst/war3map.j"
ln -s "$stdlib" "$build_dir/_build/dependencies/wurststdlib"
map_name="Smashcraft $map_version"
cat > "$build_dir/wurst.build" <<YAML
projectName: $map_name
wc3Patch: v3.0
buildMapData:
  name: $map_name
  fileName: $map_name
  author: Tompas
  scenarioData:
    description: Compare movement and combat calculations. Diagnostic map only.
    suggestedPlayers: 1
  players:
    - id: 0
      name: Player 1
      controller: USER
      race: HUMAN
YAML
(
	cd "$build_dir"
	/home/tom/.wurst/wurst-runtime/bin/java -Xmx1024m -XX:ActiveProcessorCount=2 -jar "$compiler" \
		-build -dev -lua -noExtractMapScript -stacktraces \
		-workspaceroot "$build_dir" -inputmap "$base_map" \
		-out "$build_dir/probe.lua" -lib "$stdlib"
)
"$packager" extract "$base_map" "$build_dir/war3map.lua"
[[ $(rg -c '^function main\(' "$build_dir/war3map.lua") == 1 ]]
[[ $(rg -c '^function config\(' "$build_dir/war3map.lua") == 1 ]]
[[ $(rg -c '^RunInitializationTriggers\(\)' "$build_dir/war3map.lua") == 1 ]]
sed -i 's/^function main()/function baseMain()/; s/^function config()/function baseConfig()/; s/^RunInitializationTriggers()/-- Terrain only./' "$build_dir/war3map.lua"
sed 's/^function main()/function wurstMain()/; s/^function config()/function wurstConfig()/' "$build_dir/probe.lua" >> "$build_dir/war3map.lua"
cat >> "$build_dir/war3map.lua" <<'LUA'

function main()
    baseMain()
    wurstMain()
end
function config()
    wurstConfig()
end
LUA
nix shell nixpkgs#lua5_3 --command luac -p "$build_dir/war3map.lua"
cp "$build_dir/_build/$map_name.w3x" "$build_dir/$map_name.w3x"
"$packager" replace "$build_dir/$map_name.w3x" "$build_dir/war3map.lua"
"$packager" extract "$build_dir/$map_name.w3x" "$build_dir/verified.lua"
cmp "$build_dir/war3map.lua" "$build_dir/verified.lua"
sha256sum "$build_dir/$map_name.w3x"
printf 'Source %s\nCandidate %s/%s.w3x\n' "$source_commit" "$build_dir" "$map_name"
