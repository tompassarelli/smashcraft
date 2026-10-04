#!/usr/bin/env bash
set -euo pipefail

project_dir=$(cd -- "$(dirname -- "$0")/../.." && pwd)
base_map=$(realpath -- "${1:?Usage: build-native-discriminator.sh PRIVATE_BASE_MAP.w3m}")
compiler="$project_dir/toolchain/wurstscript.jar"
stdlib=/home/tom/code/wurst-stdlib/pins/bb1e0458db5a
packager="$project_dir/build/tools/map-pack"
[[ $(sha256sum "$compiler" | cut -d ' ' -f1) == 9495b1f3ad1f1baf53335934e9152874773e6c735b0e5db819b3e7f06c82ed15 ]]
[[ $(git -C "$stdlib" rev-parse HEAD) == bb1e0458db5a372ba2a6928112452785e435d01a ]]
[[ -x "$packager" && -s "$base_map" ]]

private_build_root="$HOME/.local/share/smashcraft-build-inputs/$(basename -- "$project_dir")"
mkdir -p "$private_build_root"
build_dir=$(mktemp -d "$private_build_root/native.XXXXXX")
mkdir -p "$build_dir/wurst" "$build_dir/_build/dependencies"

simulation_packages=(Simulation MeleeContactGeometry RollTravel MeleeScalarMath ParticipantInputs CommandBuffer NetworkInput KeyBindings TechInput)
for package in "${simulation_packages[@]}"; do
	cp "$project_dir/wurst/$package.wurst" "$build_dir/wurst/"
done
cp "$project_dir/tools/physics-probe/NativeArithmeticDiscriminator.wurst" "$build_dir/wurst/"
source_commit=$(git -C "$project_dir" rev-parse HEAD)
printf 'package NativePhysicsSource\npublic constant string PHYSICS_SOURCE = "%s"\n' "$source_commit" > "$build_dir/wurst/NativePhysicsSource.wurst"
cp "$project_dir/tools/map-entry.j" "$build_dir/wurst/war3map.j"
ln -s "$stdlib" "$build_dir/_build/dependencies/wurststdlib"

map_name='Smashcraft 0.0.37'
cat > "$build_dir/wurst.build" <<YAML
projectName: $map_name
wc3Patch: v3.0
buildMapData:
  name: $map_name
  fileName: $map_name
  author: Tompas
  scenarioData:
    description: Isolate world-scale and native arithmetic during a Falco fall.
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
printf 'Source %s\nCandidate %s/%s.w3x\nExport smashcraft-physics-discriminator-0037.txt\n' \
	"$source_commit" "$build_dir" "$map_name"
