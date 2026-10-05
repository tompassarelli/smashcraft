#!/usr/bin/env bash
set -euo pipefail
project_dir=$(cd -- "$(dirname -- "$0")/../.." && pwd)
probe_dir="$project_dir/build/restart-probe"
stdlib=/home/tom/code/wurst-stdlib/pins/4dfc8a0474bd
compiler="$project_dir/toolchain/wurstscript.jar"
packager="$project_dir/build/tools/map-pack"
if [[ $# -lt 1 || $# -gt 2 || ! -f "$1" ]]; then
    echo 'Usage: smashcraft:tools/restart-probe/build.sh BASE_MAP [plain|bindings|keys]' >&2
    exit 2
fi
base_map=$(realpath -- "$1")
variant=${2:-plain}
case "$variant" in plain|bindings|keys) ;; *) exit 2;; esac
[[ $(sha256sum "$compiler" | cut -d ' ' -f1) == 9169418755f722bbbfd36f4e4f2e34241e72a0e006510040b3569eb76e4cb6ad ]]
[[ $(git -C "$stdlib" rev-parse HEAD) == 4dfc8a0474bd0b9628ff79d935310c7fc92bce4a ]]
mkdir -p "$probe_dir/wurst" "$probe_dir/_build/dependencies"
if [[ ! -e "$probe_dir/_build/dependencies/wurststdlib" ]]; then
    ln -s "$stdlib" "$probe_dir/_build/dependencies/wurststdlib"
fi
cp "$project_dir/tools/restart-probe/RestartProbe.wurst" "$probe_dir/wurst/RestartProbe.wurst"
printf 'package ProbeInfo\npublic constant string PROBE_VARIANT = "%s"\n' "$variant" > "$probe_dir/wurst/ProbeInfo.wurst"
if [[ "$variant" != plain ]]; then
    cp "$project_dir/tools/restart-probe/LoadProbe.wurst" "$probe_dir/wurst/LoadProbe.wurst"
else
    rm -f "$probe_dir/wurst/LoadProbe.wurst"
fi
if [[ "$variant" == keys ]]; then
    cp "$project_dir/tools/restart-probe/KeysProbe.wurst" "$probe_dir/wurst/KeysProbe.wurst"
else
    rm -f "$probe_dir/wurst/KeysProbe.wurst"
fi
cp "$project_dir/tools/map-entry.j" "$probe_dir/wurst/war3map.j"
sed 's/Smashcraft/A_Restart_Probe/g; s/Archer versus Rifleman platform fight./Minimal timer and synchronized-key restart reproduction./' "$project_dir/wurst.build" > "$probe_dir/wurst.build"
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
cp "$probe_dir/_build/A_Restart_Probe.w3x" "$probe_dir/A_Restart_Probe.w3x"
"$packager" replace "$probe_dir/A_Restart_Probe.w3x" "$probe_dir/war3map.lua"
"$packager" extract "$probe_dir/A_Restart_Probe.w3x" "$probe_dir/verified.lua"
cmp "$probe_dir/war3map.lua" "$probe_dir/verified.lua"
printf 'Built %s/A_Restart_Probe.w3x\n' "$probe_dir"
