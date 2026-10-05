#!/usr/bin/env bash
set -euo pipefail
project_dir=$(cd -- "$(dirname -- "$0")/../.." && pwd)
base_map=${1:?Usage: build-native-contact-rollback.sh PRIVATE_BASE_MAP.w3m}
base_map=$(realpath -- "$base_map")
version=0.0.10
map_name="Smashcraft $version"
private_root=/home/tom/.local/share/smashcraft-build-inputs/native-contact-rollback-20261004
mkdir -p "$private_root"
build_dir=$(mktemp -d "$private_root/build.XXXXXX")
compiler=/home/tom/code/smashcraft/worktrees/production-netcode-integration-20261004/toolchain/wurstscript.jar
packager=/home/tom/code/smashcraft/worktrees/production-netcode-integration-20261004/build/tools/map-pack
stdlib=/home/tom/code/wurst-stdlib/pins/4dfc8a0474bd
java=/home/tom/.wurst/wurst-runtime/bin/java
[[ $(sha256sum "$compiler" | cut -d ' ' -f1) == 2ed2ee8cf563aedaef7e384b2e0c68f50a306144e99fa506b90935c62b64a18a ]]
[[ $(git -C /home/tom/code/wurst-compiler/pins/9913e1bd300c2053637d756a11bae8c3c8ed568f rev-parse HEAD) == 9913e1bd300c2053637d756a11bae8c3c8ed568f ]]
[[ $(git -C "$stdlib" rev-parse HEAD) == 4dfc8a0474bd0b9628ff79d935310c7fc92bce4a ]]
[[ -x "$packager" && -s "$base_map" ]]
mkdir -p "$build_dir/wurst" "$build_dir/_build/dependencies"
# Reproduce the measured simulation, independently of newer production physics.
simulation_commit=62b1a88ae077935b73cdbb457a7f12d86b4421db
git -C "$project_dir" cat-file -e "$simulation_commit^{commit}"
for source in BotRecovery CombatInput CommandBuffer DamagePose FighterPose FixedInputSchedule IllidanMotion ImpactEvents ImpactState InputAdapter InputLedger InputProtocol KeyBindings MatchRules MatchStep NetworkInput ParticipantInputs ReplayHistory ReplayState RollTravel ShadowInputPlayback ShadowInputSchedule Simulation SpecialEffectState SummonPose SummonState WorldTestSupport; do
	git -C "$project_dir" show "$simulation_commit:wurst/$source.wurst" > "$build_dir/wurst/$source.wurst"
done
cp "$project_dir/tools/netcode-probe/NativeContactRollbackProbe.wurst" "$build_dir/wurst/"
cp "$project_dir/tools/netcode-probe/FrameTaggedRecord.wurst" "$build_dir/wurst/"
cp "$project_dir/tools/map-entry.j" "$build_dir/wurst/war3map.j"
cp /home/tom/code/smashcraft/worktrees/production-netcode-integration-20261004/build/animation-assets/FighterAssetInfo.wurst "$build_dir/wurst/"
cp /home/tom/code/smashcraft/worktrees/production-netcode-integration-20261004/build/illidan-animation/DemonHunterAssetInfo.wurst "$build_dir/wurst/"
cp /home/tom/.local/share/smashcraft-build-inputs/production-netcode-20261004/summon-original-clips/wurst/SummonOriginalClipInfo.wurst "$build_dir/wurst/"
ln -s "$stdlib" "$build_dir/_build/dependencies/wurststdlib"
build_id="contact-rollback-20261004"
printf 'package ProbeInfo\npublic constant string BUILD_ID = "%s"\n' "$build_id" > "$build_dir/wurst/ProbeInfo.wurst"
cat > "$build_dir/wurst.build" <<YAML
projectName: $map_name
wc3Patch: v3.0
buildMapData:
  name: $map_name
  fileName: $map_name
  author: Tompas
  scenarioData:
    description: Native synchronized tagged shield delivery and production rollback contact correction probe.
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
	"$java" -Xmx1024m -XX:ActiveProcessorCount=2 -jar "$compiler" \
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
printf 'Build ID %s\nCandidate %s/%s.w3x\n' "$build_id" "$build_dir" "$map_name"
