#!/usr/bin/env bash
set -euo pipefail

project_dir=$(cd -- "$(dirname -- "$0")" && pwd)
compiler_checkout=/home/tom/code/wurst-compiler/pins/c31f228c4a43dad1bca4d4acc003b1d12a823331
stdlib_checkout=/home/tom/code/wurst-stdlib/pins/4dfc8a0474bd
compiler_jar="$project_dir/toolchain/wurstscript.jar"
java=/home/tom/.wurst/wurst-runtime/bin/java
maps_dir='/home/tom/.local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/users/steamuser/Documents/Warcraft III/Maps'
build_output="$project_dir/build/wurst-map/Melee_Prototype.w3x"
fighter_assets="$project_dir/build/animation-assets"

if [[ $# -ne 1 || ! -f "$1" ]]; then
    printf 'Usage: %s BASE_MAP.w3m|BASE_MAP.w3x\n' "$0" >&2
    exit 2
fi
base_map=$(realpath -- "$1")
if [[ ! -s "$fighter_assets/ArcherFighter.mdx" || ! -s "$fighter_assets/RiflemanFighter.mdx" || ! -s "$fighter_assets/FighterAssetInfo.wurst" ]]; then
    printf 'Authored fighter assets are missing. Follow wc3-melee:ANIMATIONS.md to build them.\n' >&2
    exit 1
fi
build_id=${WC3_BUILD_ID:-$(date +%s)}
developer_scenario=${WC3_SCENARIO:-normal}
case "$developer_scenario" in normal|knockdown|tech) ;; *) echo 'WC3_SCENARIO must be normal, knockdown or tech.' >&2; exit 2;; esac
if [[ ! "$build_id" =~ ^[A-Za-z0-9._-]+$ ]]; then
    printf 'WC3_BUILD_ID may contain only letters, digits, dots, underscores, and hyphens.\n' >&2
    exit 2
fi

expected_compiler_commit=c31f228c4a43dad1bca4d4acc003b1d12a823331
expected_stdlib_commit=4dfc8a0474bd0b9628ff79d935310c7fc92bce4a
expected_compiler_sha256=9169418755f722bbbfd36f4e4f2e34241e72a0e006510040b3569eb76e4cb6ad
actual_compiler_sha256=$(sha256sum "$compiler_jar" | cut -d ' ' -f 1)
[[ "$actual_compiler_sha256" == "$expected_compiler_sha256" ]] || {
    printf 'Pinned Wurst compiler checksum mismatch.\n' >&2
    exit 1
}
[[ $(git -C "$compiler_checkout" rev-parse HEAD) == "$expected_compiler_commit" ]] || {
    printf 'Wurst compiler source checkout does not match wurst-toolchain.lock.\n' >&2
    exit 1
}
[[ $(git -C "$stdlib_checkout" rev-parse HEAD) == "$expected_stdlib_commit" ]] || {
    printf 'Wurst standard-library checkout does not match wurst-toolchain.lock.\n' >&2
    exit 1
}

mkdir -p "$project_dir/_build" "$project_dir/build/wurst-work" "$project_dir/build/tools" "$(dirname -- "$build_output")"
work_dir=$(mktemp -d "$project_dir/build/wurst-work/build.XXXXXX")
trap 'rm -rf -- "$work_dir"' EXIT
map_script="$work_dir/war3map.lua"
compiled_script="$work_dir/melee.lua"

mkdir -p "$work_dir/wurst" "$work_dir/_build/dependencies" "$work_dir/imports/war3mapImported"
ln -s "$stdlib_checkout" "$work_dir/_build/dependencies/wurststdlib"
cp "$project_dir/wurst.build" "$work_dir/wurst.build"
cp "$project_dir/tools/map-entry.j" "$work_dir/wurst/war3map.j"
for source in FighterAssets Simulation DirectionalInput MatchRules CommandBuffer CombatInput MatchStep KeyBindings PlayerInputState BindingSettings SettingsUI SelectionUI Melee; do
    cp "$project_dir/wurst/$source.wurst" "$work_dir/wurst/$source.wurst"
done
cp "$fighter_assets/FighterAssetInfo.wurst" "$work_dir/wurst/FighterAssetInfo.wurst"
fighter_model_hash=$(sha256sum "$fighter_assets/ArcherFighter.mdx" | cut -d ' ' -f1)
fighter_model_path="war3mapImported\\ArcherFighter-$fighter_model_hash.mdx"
cp "$fighter_assets/ArcherFighter.mdx" "$work_dir/imports/war3mapImported/ArcherFighter-$fighter_model_hash.mdx"
rifleman_model_hash=$(sha256sum "$fighter_assets/RiflemanFighter.mdx" | cut -d ' ' -f1)
rifleman_model_path="war3mapImported\\RiflemanFighter-$rifleman_model_hash.mdx"
cp "$fighter_assets/RiflemanFighter.mdx" "$work_dir/imports/war3mapImported/RiflemanFighter-$rifleman_model_hash.mdx"

printf 'package BuildInfo\npublic constant string BUILD_ID = "%s"\npublic constant boolean KNOCKDOWN_SCENARIO = %s\npublic constant boolean TECH_SCENARIO = %s\n' "$build_id" "$([[ "$developer_scenario" != normal ]] && echo true || echo false)" "$([[ "$developer_scenario" == tech ]] && echo true || echo false)" > "$project_dir/build/generated-BuildInfo.wurst"
cp "$project_dir/build/generated-BuildInfo.wurst" "$work_dir/wurst/BuildInfo.wurst"

(
cd "$work_dir"
"$java" -Xmx512m -XX:ActiveProcessorCount=2 -jar "$compiler_jar" \
    -build -dev -lua -noExtractMapScript -stacktraces \
    -workspaceroot "$work_dir" -inputmap "$base_map" \
    -out "$compiled_script" \
    -lib "$stdlib_checkout"
)

[[ -s "$work_dir/_build/Melee_Prototype.w3x" ]] || {
    printf 'Compiler did not emit the configured map.\n' >&2
    exit 1
}

packager="$project_dir/build/tools/map-pack"
if [[ ! -x "$packager" ]]; then
    stormlib=$(nix eval --raw nixpkgs#stormlib.outPath)
    nix shell nixpkgs#gcc --command gcc \
        -I"$stormlib/include" "$project_dir/map-pack.c" \
        -L"$stormlib/lib" -Wl,-rpath,"$stormlib/lib" -lstorm -o "$packager"
fi

"$packager" extract "$base_map" "$map_script"
[[ $(rg -c '^function main\(' "$map_script") == 1 ]] || {
    printf 'Base map should contain exactly one Lua main function.\n' >&2
    exit 1
}
[[ $(rg -c '^function config\(' "$map_script") == 1 ]] || {
    printf 'Base map should contain exactly one Lua config function.\n' >&2
    exit 1
}
[[ $(rg -c '^function main\(' "$compiled_script") == 1 ]] || {
    printf 'Wurst compiler output should contain exactly one Lua main function.\n' >&2
    exit 1
}
[[ $(rg -c '^function config\(' "$compiled_script") == 1 ]] || {
    printf 'Wurst compiler output should contain exactly one Lua config function.\n' >&2
    exit 1
}

sed -i 's/^function main()/function baseMain()/; s/^function config()/function baseConfig()/' "$map_script"
[[ $(rg -c '^RunInitializationTriggers\(\)' "$map_script") == 1 ]] || {
    printf 'Expected one generated melee initialization call in base map.\n' >&2
    exit 1
}
# The base map is a terrain fixture; its generated melee trigger starts a normal melee match and
# can declare victory before our selection menu begins. Keep map setup but do not run that trigger.
sed -i 's/^RunInitializationTriggers()/-- Suppressed default melee initialization for the platform fighter./' "$map_script"
sed -i 's/^function main()/function wurstMain()/; s/^function config()/function wurstConfig()/' "$compiled_script"
cat "$compiled_script" >> "$map_script"
cat >> "$map_script" <<'LUA'

function main()
    baseMain()
    wurstMain()
end

function config()
    wurstConfig()
end
LUA

nix shell nixpkgs#lua5_3 --command luac -p "$map_script"
output_next="$build_output.next"
cp "$work_dir/_build/Melee_Prototype.w3x" "$output_next"
"$packager" replace "$output_next" "$map_script"
"$packager" extract "$output_next" "$work_dir/verified-ArcherFighter.mdx" "$fighter_model_path"
cmp "$fighter_assets/ArcherFighter.mdx" "$work_dir/verified-ArcherFighter.mdx"
"$packager" extract "$output_next" "$work_dir/verified-RiflemanFighter.mdx" "$rifleman_model_path"
cmp "$fighter_assets/RiflemanFighter.mdx" "$work_dir/verified-RiflemanFighter.mdx"
"$packager" extract "$output_next" "$work_dir/verified.w3a" war3map.w3a
[[ -s "$work_dir/verified.w3a" ]]
"$packager" extract "$output_next" "$work_dir/verified.lua"
cmp "$map_script" "$work_dir/verified.lua"
mv "$output_next" "$build_output"

if [[ ${WC3_DEPLOY_MAP:-0} == 1 ]]; then
    mkdir -p "$maps_dir"
    cp "$build_output" "$maps_dir/Melee_Prototype.w3x.next"
    mv "$maps_dir/Melee_Prototype.w3x.next" "$maps_dir/Melee_Prototype.w3x"
fi

printf 'Built %s\n' "$build_output"
if [[ ${WC3_DEPLOY_MAP:-0} == 1 ]]; then
    printf 'Deployed %s/Melee_Prototype.w3x\n' "$maps_dir"
fi
