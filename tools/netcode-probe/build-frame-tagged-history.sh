#!/usr/bin/env bash
set -euo pipefail
project_dir=$(cd -- "$(dirname -- "$0")/../.." && pwd)
compiler_checkout=/home/tom/code/wurst-compiler/pins/9913e1bd300c2053637d756a11bae8c3c8ed568f
compiler="$project_dir/toolchain/wurstscript.jar"
stdlib=/home/tom/code/wurst-stdlib/pins/4dfc8a0474bd
packager="$project_dir/build/tools/map-pack"
if [[ $# -lt 1 || $# -gt 2 || ! -f "$1" ]]; then
    echo 'Usage: wc3-melee:tools/netcode-probe/build-frame-tagged-history.sh PRIVATE_BASE_MAP [0.0.N]' >&2
    exit 2
fi
base_map=$(realpath -- "$1")
version=${2:-0.0.9}
[[ "$version" =~ ^0\.0\.[0-9]+$ ]] || { echo 'Expected a 0.0.N pre-release version.' >&2; exit 2; }
expected_compiler_sha256=$(sed -n 's/^compilerArtifactSha256 = "\([0-9a-f]*\)"$/\1/p' "$project_dir/wurst-toolchain.lock")
[[ $(sha256sum "$compiler" | cut -d ' ' -f1) == "$expected_compiler_sha256" ]]
[[ $(git -C "$compiler_checkout" rev-parse HEAD) == 9913e1bd300c2053637d756a11bae8c3c8ed568f ]]
[[ $(git -C "$stdlib" rev-parse HEAD) == 4dfc8a0474bd0b9628ff79d935310c7fc92bce4a ]]
[[ -x "$packager" ]]
probe_root=/home/tom/.local/share/smashcraft-build-inputs/frame-tagged-history-probe-20261004
mkdir -p "$probe_root"
probe_dir=$(mktemp -d "$probe_root/build.XXXXXX")
mkdir -p "$probe_dir/wurst" "$probe_dir/_build/dependencies"
build_id=$(date -u +%Y%m%dT%H%M%S%N)
map_name="Smashcraft $version"
printf 'package ProbeInfo\npublic constant string TAGGED_BUILD = "%s"\n' "$build_id" > "$probe_dir/wurst/ProbeInfo.wurst"
ln -s "$stdlib" "$probe_dir/_build/dependencies/wurststdlib"
cp "$project_dir/tools/netcode-probe/FrameTaggedRecord.wurst" "$project_dir/tools/netcode-probe/FrameTaggedSyncProbe.wurst" "$probe_dir/wurst/"
cp "$project_dir/tools/map-entry.j" "$probe_dir/wurst/war3map.j"
cat > "$probe_dir/wurst.build" <<YAML
projectName: $map_name
wc3Patch: v3.0
buildMapData:
  name: $map_name
  fileName: $map_name
  author: Tompas
  scenarioData:
    description: Preserve externally frame-tagged ASCII records through local polling and Warcraft sync events.
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
    /home/tom/.wurst/wurst-runtime/bin/java -Xmx1024m -XX:ActiveProcessorCount=2 -jar "$compiler" \
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
sha256sum "$probe_dir/$map_name.w3x"
printf 'Build ID %s\nPrivate candidate %s/%s.w3x\n' "$build_id" "$probe_dir" "$map_name"
