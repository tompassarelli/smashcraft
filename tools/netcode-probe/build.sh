#!/usr/bin/env bash
set -euo pipefail
project_dir=$(cd -- "$(dirname -- "$0")/../.." && pwd)
compiler="$project_dir/toolchain/wurstscript.jar"
stdlib=/home/tom/code/wurst-stdlib/pins/4dfc8a0474bd
packager="$project_dir/build/tools/map-pack"
if [[ $# -lt 1 || $# -gt 2 || ! -f "$1" ]]; then
    echo 'Usage: wc3-melee:tools/netcode-probe/build.sh BASE_MAP [1|2]' >&2
    exit 2
fi
base_map=$(realpath -- "$1")
batch=${2:-1}
case "$batch" in 1|2) ;; *) echo 'Batch must be 1 or 2.' >&2; exit 2;; esac
[[ $(sha256sum "$compiler" | cut -d ' ' -f1) == 9169418755f722bbbfd36f4e4f2e34241e72a0e006510040b3569eb76e4cb6ad ]]
[[ $(git -C "$stdlib" rev-parse HEAD) == 4dfc8a0474bd0b9628ff79d935310c7fc92bce4a ]]
[[ -x "$packager" ]]
probe_root="$project_dir/build/netcode-probe"
mkdir -p "$probe_root"
probe_dir=$(mktemp -d "$probe_root/batch-$batch.XXXXXX")
map_name="Smashcraft_Input_Probe_$batch"
mkdir -p "$probe_dir/wurst" "$probe_dir/_build/dependencies"
ln -s "$stdlib" "$probe_dir/_build/dependencies/wurststdlib"
cp "$project_dir/tools/netcode-probe/InputProbe.wurst" "$probe_dir/wurst/"
cp "$project_dir/tools/map-entry.j" "$probe_dir/wurst/war3map.j"
printf 'package ProbeInfo\npublic constant int PROBE_BATCH = %s\n' "$batch" > "$probe_dir/wurst/ProbeInfo.wurst"
cat > "$probe_dir/wurst.build" <<YAML
projectName: Smashcraft Input Probe $batch
wc3Patch: v3.0
buildMapData:
  name: Smashcraft Input Probe $batch
  fileName: $map_name
  author: Tompas
  scenarioData:
    description: Local polling versus synchronized events and 180-byte native sync traffic. Diagnostic map only.
    suggestedPlayers: 1-2
  players:
    - id: 0
      name: Probe 1
      controller: USER
      race: HUMAN
    - id: 1
      name: Probe 2
      controller: USER
      race: HUMAN
YAML
(
    cd "$probe_dir"
    /home/tom/.wurst/wurst-runtime/bin/java -Xmx512m -XX:ActiveProcessorCount=2 -jar "$compiler" \
        -build -dev -lua -noExtractMapScript -stacktraces \
        -workspaceroot "$probe_dir" -inputmap "$base_map" \
        -out "$probe_dir/probe.lua" -lib "$stdlib"
)
"$packager" extract "$base_map" "$probe_dir/war3map.lua"
[[ $(rg -c '^function main\(' "$probe_dir/war3map.lua") == 1 ]]
[[ $(rg -c '^function config\(' "$probe_dir/war3map.lua") == 1 ]]
[[ $(rg -c '^RunInitializationTriggers\(\)' "$probe_dir/war3map.lua") == 1 ]]
sed -i 's/^function main()/function baseMain()/; s/^function config()/function baseConfig()/; s/^RunInitializationTriggers()/-- Terrain only./' "$probe_dir/war3map.lua"
sed 's/^function main()/function wurstMain()/; s/^function config()/function wurstConfig()/' "$probe_dir/probe.lua" >> "$probe_dir/war3map.lua"
cat >> "$probe_dir/war3map.lua" <<'LUA'

function main()
    baseMain()
    wurstMain()
end
function config()
    wurstConfig()
end
LUA
nix shell nixpkgs#lua5_3 --command luac -p "$probe_dir/war3map.lua"
cp "$probe_dir/_build/$map_name.w3x" "$probe_dir/$map_name.w3x"
"$packager" replace "$probe_dir/$map_name.w3x" "$probe_dir/war3map.lua"
"$packager" extract "$probe_dir/$map_name.w3x" "$probe_dir/verified.lua"
cmp "$probe_dir/war3map.lua" "$probe_dir/verified.lua"
cp "$probe_dir/$map_name.w3x" "$probe_root/$map_name.w3x.next"
mv "$probe_root/$map_name.w3x.next" "$probe_root/$map_name.w3x"
printf 'Built %s/%s.w3x\n' "$probe_root" "$map_name"
