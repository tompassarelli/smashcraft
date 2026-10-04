#!/usr/bin/env bash
set -euo pipefail

project_dir=$(cd -- "$(dirname -- "$0")/../.." && pwd)
base_map=${1:-/home/tom/.local/share/smashcraft-build-inputs/physics-base.w3m}
base_map=$(realpath -- "$base_map")
version=0.0.17
map_name="Smashcraft $version"
build_id=$(date -u +%Y%m%dT%H%M%S%N)
build_dir="/home/tom/.local/share/smashcraft-build-inputs/native-clock-progress-20261004/build-$build_id"
compiler_checkout=/home/tom/code/wurst-compiler/pins/9913e1bd300c2053637d756a11bae8c3c8ed568f
compiler="$project_dir/toolchain/wurstscript.jar"
stdlib=/home/tom/code/wurst-stdlib/pins/bb1e0458db5a
packager="$project_dir/build/tools/map-pack"
java=/home/tom/.wurst/wurst-runtime/bin/java

[[ -s "$base_map" && -s "$compiler" && -x "$packager" && -x "$java" ]]
[[ $(sha256sum "$compiler" | cut -d ' ' -f1) == 2ed2ee8cf563aedaef7e384b2e0c68f50a306144e99fa506b90935c62b64a18a ]]
[[ $(git -C "$compiler_checkout" rev-parse HEAD) == 9913e1bd300c2053637d756a11bae8c3c8ed568f ]]
[[ $(git -C "$stdlib" rev-parse HEAD) == bb1e0458db5a372ba2a6928112452785e435d01a ]]

mkdir -p "$build_dir/wurst" "$build_dir/_build/dependencies"
ln -s "$stdlib" "$build_dir/_build/dependencies/wurststdlib"
cp "$project_dir/tools/netcode-probe/NativeClockProgressProbe.wurst" "$build_dir/wurst/"
cp "$project_dir/tools/map-entry.j" "$build_dir/wurst/war3map.j"
printf 'package ProbeInfo\npublic constant string CLOCK_BUILD = "%s"\n' "$build_id" > "$build_dir/wurst/ProbeInfo.wurst"
cat > "$build_dir/wurst.build" <<YAML
projectName: $map_name
wc3Patch: v3.0
buildMapData:
  name: $map_name
  fileName: $map_name
  author: Tompas
  scenarioData:
    description: Measure per-client Warcraft timer and recurring service callback progress across a controlled process stop.
    suggestedPlayers: 1-2
  players:
    - id: 0
      name: Player 1
      controller: USER
      race: HUMAN
    - id: 1
      name: Player 2
      controller: USER
      race: HUMAN
YAML

(
    cd "$build_dir"
    "$java" -Xmx512m -XX:ActiveProcessorCount=2 -jar "$compiler" \
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
printf 'Build ID %s\nPrivate candidate %s/%s.w3x\nReady filenames smashcraft-native-clock-progress-%s-p0-ready.txt and smashcraft-native-clock-progress-%s-p1-ready.txt\nMarker filename pattern smashcraft-native-clock-progress-%s-p{slot}-{sequence6}.txt\n' \
    "$build_id" "$build_dir" "$map_name" "$build_id" "$build_id" "$build_id"
