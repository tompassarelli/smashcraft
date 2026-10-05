#!/usr/bin/env bash
# Minimal private paired benchmark; the simulation packages are production sources.
set -euo pipefail
project_dir=$(cd -- "$(dirname -- "$0")/../.." && pwd)
base_map=$(realpath -- "${1:?Usage: build.sh PRIVATE_BASE_MAP RUN_ID}")
run_id=${2:?Supply a distinct diagnostic run ID.}
[[ "$run_id" =~ ^[a-z0-9][a-z0-9-]*$ ]]
private_assets=${WC3_PRIVATE_ASSETS:?Set WC3_PRIVATE_ASSETS to the private prepared clips.}
private_root=$(realpath -m -- "$private_assets/build")
case "$private_root" in "$project_dir"|"$project_dir"/*) echo 'Private builds must be outside the checkout.' >&2; exit 2;; esac
build_dir="$private_root/frame-cost-$run_id"
[[ ! -e "$build_dir" ]]
compiler="$project_dir/toolchain/wurstscript.jar"
stdlib=/home/tom/code/wurst-stdlib/pins/e3714f629113
packager="$project_dir/build/tools/map-pack"
bun=${WC3_BUN:-/nix/store/g7skjk9lrdnshaxd7px62bchq6yg0bbh-bun-1.3.13/bin/bun}
[[ $(sha256sum "$compiler" | cut -d ' ' -f1) == 9495b1f3ad1f1baf53335934e9152874773e6c735b0e5db819b3e7f06c82ed15 ]]
[[ $(git -C "$stdlib" rev-parse HEAD) == e3714f629113ee682353c3244065fee3e7d9ae16 ]]
[[ -s "$base_map" && -x "$packager" ]]
mkdir -p "$build_dir/wurst" "$build_dir/_build/dependencies"
ln -s "$stdlib" "$build_dir/_build/dependencies/wurststdlib"
cp "$project_dir/tools/map-entry.j" "$build_dir/wurst/war3map.j"
for package in Simulation TechInput MeleeContactGeometry MeleeScalarMath RollTravel IllidanMotion FighterPose DamagePose SummonPose SummonState SpecialEffectState ImpactEvents ImpactState MatchRules MatchStep CommandBuffer CombatInput NetworkInput InputAdapter ParticipantInputs KeyBindings BotRecovery ReplayState FrameCostBenchmark; do
    cp "$project_dir/wurst/$package.wurst" "$build_dir/wurst/"
done
cp "$project_dir/build/animation-assets/FighterAssetInfo.wurst" "$project_dir/build/illidan-animation/DemonHunterAssetInfo.wurst" "$private_assets/summon-original-clips/wurst/SummonOriginalClipInfo.wurst" "$build_dir/wurst/"
map_name="Smashcraft diagnostic $run_id"
cat > "$build_dir/wurst.build" <<YAML
projectName: Smashcraft
wc3Patch: v3.0
buildMapData:
  name: $map_name
  fileName: $map_name
  author: Tompas
  scenarioData:
    description: Paired 4096-frame execution benchmark. Diagnostic map only.
    suggestedPlayers: 1
  players:
    - id: 0
      name: Player 1
      controller: USER
      race: HUMAN
YAML
(
    cd "$build_dir"
    /home/tom/.wurst/wurst-runtime/bin/java -Xmx2048m -XX:ActiveProcessorCount=2 -jar "$compiler" \
        -build -dev -lua -noExtractMapScript -stacktraces -workspaceroot "$build_dir" \
        -inputmap "$base_map" -out "$build_dir/wurst.lua" -lib "$stdlib"
)
"$packager" extract "$base_map" "$build_dir/base.lua"
[[ $(rg -c '^function main\(' "$build_dir/base.lua") == 1 ]]
[[ $(rg -c '^function config\(' "$build_dir/base.lua") == 1 ]]
[[ $(rg -c '^RunInitializationTriggers\(\)' "$build_dir/base.lua") == 1 ]]
sed -i 's/^function main()/function baseMain()/; s/^function config()/function baseConfig()/; s/^RunInitializationTriggers()/-- Terrain only./' "$build_dir/base.lua"
sed 's/^function main()/function wurstMain()/; s/^function config()/function wurstConfig()/' "$build_dir/wurst.lua" >> "$build_dir/base.lua"
"$bun" "$project_dir/ts/scripts/frameCost.ts" compose "$build_dir" "$run_id"
nix shell nixpkgs#lua5_3 --command luac -p "$build_dir/war3map.lua"
candidate="$build_dir/$map_name.w3x"
cp "$build_dir/_build/$map_name.w3x" "$candidate"
"$packager" replace "$candidate" "$build_dir/war3map.lua"
"$packager" extract "$candidate" "$build_dir/verified.lua"
cmp "$build_dir/war3map.lua" "$build_dir/verified.lua"
sha256sum "$candidate"
printf 'Private diagnostic %s\nRead: %s %s/ts/scripts/frameCost.ts read CUSTOM_MAP_DATA %s\n' "$candidate" "$bun" "$project_dir" "$run_id"
