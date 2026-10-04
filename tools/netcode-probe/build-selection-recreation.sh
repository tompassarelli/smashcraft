#!/usr/bin/env bash
set -euo pipefail
project_dir=$(cd -- "$(dirname -- "$0")/../.." && pwd)
private_root="$HOME/.local/share/smashcraft-build-inputs/production-netcode-20261004"
version=${1:-57}
[[ "$version" =~ ^[1-9][0-9]*$ ]]
compiler=/home/tom/code/wurst-compiler/worktrees/jass-map-language-20261004/de.peeeq.wurstscript/build/libs/wurstscript.jar
stdlib=/home/tom/code/wurst-stdlib/pins/e3714f629113
packager="$project_dir/build/tools/map-pack"
base_map="$HOME/.local/share/smashcraft-build-inputs/physics-base.w3m"
asset_map="$private_root/build/Smashcraft 0.0.40.w3x"
[[ $(sha256sum "$compiler" | cut -d ' ' -f1) == b1137e155baf0fe0bbc6ebe35c203dbf1425620069adeed0fa0564dc7fbaffe3 ]]
[[ $(git -C "$stdlib" rev-parse HEAD) == e3714f629113ee682353c3244065fee3e7d9ae16 ]]
[[ $(sha256sum "$asset_map" | cut -d ' ' -f1) == 13f0ba7f6a78eff1c7f71e14f2c398ebeb38c6f24b06aad9b2540f4f7eaa1f17 ]]
probe_dir=$(mktemp -d "$private_root/build/selection$version.XXXXXX")
mkdir -p "$probe_dir/wurst" "$probe_dir/_build/dependencies"
printf 'package SelectionProbeInfo\npublic constant string SELECTION_PROBE_ID = "selection-%04d"\n' "$version" > "$probe_dir/wurst/SelectionProbeInfo.wurst"
printf 'package BuildInfo\npublic constant string BUILD_ID = "selection-%04d"\npublic constant boolean RESPONSE_SERVICE_PROBE = true\n' "$version" > "$probe_dir/wurst/BuildInfo.wurst"
cp "$private_root/summon-original-clips/wurst/SummonOriginalClipInfo.wurst" "$probe_dir/wurst/"
cp "$project_dir/build/animation-assets/FighterAssetInfo.wurst" "$probe_dir/wurst/"
cp "$project_dir/build/illidan-animation/DemonHunterAssetInfo.wurst" "$probe_dir/wurst/"
python=/run/user/1000/private-desktop.ua70lDgf/venv/bin/python
"$python" - "$project_dir" "$probe_dir" <<'PY'
import re, shutil, sys
from pathlib import Path
repo, work = map(Path, sys.argv[1:])
pending = [repo / 'tools/netcode-probe/SelectionRecreationProbe.wurst']
seen = set()
while pending:
    path = pending.pop()
    if path in seen:
        continue
    seen.add(path)
    shutil.copyfile(path, work / 'wurst' / path.name)
    for package in re.findall(r'^import (\w+)', path.read_text(), re.M):
        dependency = repo / 'wurst' / (package + '.wurst')
        if not dependency.exists():
            dependency = repo / 'tools/netcode-probe' / (package + '.wurst')
        if dependency.exists():
            pending.append(dependency)
print('Staged', len(seen), 'source packages')
PY
"$packager" extract "$base_map" "$probe_dir/base.lua" war3map.lua
"$python" "$project_dir/tools/lua-bootstrap-to-jass.py" "$probe_dir/base.lua" "$probe_dir/wurst/war3map.j"
ln -s "$stdlib" "$probe_dir/_build/dependencies/wurststdlib"
cp "$project_dir/wurst.build" "$probe_dir/wurst.build"
sed -i "s/^  name: .*/  name: Smashcraft 0.0.$version/; s/^    description: .*/    description: Character-selection diagnostic./" "$probe_dir/wurst.build"
(
    cd "$probe_dir"
    /home/tom/.wurst/wurst-runtime/bin/java -Xmx1024m -XX:ActiveProcessorCount=2 -jar "$compiler" \
        -build -dev -noExtractMapScript -stacktraces \
        -workspaceroot "$probe_dir" -inputmap "$asset_map" \
        -out "$probe_dir/probe.j" -lib "$stdlib"
)
output="$private_root/build/Smashcraft 0.0.$version.w3x"
cp "$probe_dir/_build/Smashcraft.w3x" "$output.next"
"$packager" replace "$output.next" "$probe_dir/probe.j" war3map.j
"$packager" extract "$output.next" "$probe_dir/verified.j" war3map.j
cmp "$probe_dir/probe.j" "$probe_dir/verified.j"
mv "$output.next" "$output"
sha256sum "$output"
printf 'Retained sources and output: %s\n' "$probe_dir"
