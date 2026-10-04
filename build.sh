#!/usr/bin/env bash
set -euo pipefail

project_dir=$(cd -- "$(dirname -- "$0")" && pwd)
map_version=$(cat "$project_dir/map-version")
[[ "$map_version" =~ ^0\.0\.(0|[1-9][0-9]*)$ ]] || {
    echo 'wc3-melee:map-version must contain a version of the form 0.0.N (no leading zeroes).' >&2
    exit 2
}
map_name="Smashcraft $map_version"
if [[ -n ${WC3_DIAGNOSTIC_ID:-} ]]; then
    [[ "$WC3_DIAGNOSTIC_ID" =~ ^[A-Za-z0-9._-]+$ ]] || { echo 'Invalid WC3_DIAGNOSTIC_ID.' >&2; exit 2; }
    map_name="Smashcraft diagnostic $WC3_DIAGNOSTIC_ID"
fi
map_filename="$map_name.w3x"
compiler_checkout=/home/tom/code/wurst-compiler/pins/6b129956f6e7cf9582510f26b99d305526bf3ded
stdlib_checkout=/home/tom/code/wurst-stdlib/pins/e3714f629113
compiler_jar="$project_dir/toolchain/wurstscript.jar"
java=/home/tom/.wurst/wurst-runtime/bin/java
maps_dir='/home/tom/.local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/users/steamuser/Documents/Warcraft III/Maps/00-Smashcraft'
private_assets=${WC3_PRIVATE_ASSETS:?Set WC3_PRIVATE_ASSETS to the private prepared clip directory.}
private_build_root=$(realpath -m -- "$private_assets/build")
case "$private_build_root" in "$project_dir"|"$project_dir"/*) echo 'Private build inputs must be outside the checkout.' >&2; exit 2;; esac
build_output=$(realpath -m -- "${WC3_BUILD_OUTPUT:-$private_build_root/$map_filename}")
[[ "$build_output" == "$private_build_root/"*.w3x ]] || { echo 'WC3_BUILD_OUTPUT must be a .w3x path under the private build directory.' >&2; exit 2; }
original_clips="$private_assets/original-clips-static-lights"
summon_clips="$private_assets/summon-original-clips"
fighter_assets="$project_dir/build/animation-assets"
demon_hunter_assets="$project_dir/build/illidan-animation"
selection_assets="$project_dir/build/selection-assets"
stage_assets="$project_dir/build/stage-assets"
impact_assets="$project_dir/build/impact-assets"
selection_textures=(ArcherName RiflemanName DemonHunterName DemonHunterPortrait DemonHunterTile SelectionBackdrop SelectionTileFrame SelectionCardRed SelectionCardBlue SelectionCardYellow SelectionCardGreen SelectionCardGray SelectionAction StageBackdrop StageChip SelectionSkyDeck SelectionThreeBridges SelectionChipP1 SelectionChipP2 SelectionChipP3 SelectionChipP4 SelectionChipCPU ArcherPortrait RiflemanPortrait ArcherTile RiflemanTile MatchHUD0 MatchHUD1 MatchHUD2 MatchHUD3)

if [[ $# -ne 1 || ! -f "$1" ]]; then
    printf 'Usage: %s BASE_MAP.w3m|BASE_MAP.w3x\n' "$0" >&2
    exit 2
fi
base_map=$(realpath -- "$1")
if [[ ! -s "$fighter_assets/ArcherFighter.mdx" || ! -s "$fighter_assets/RiflemanFighter.mdx" || ! -s "$fighter_assets/FighterAssetInfo.wurst" ]]; then
    printf 'Authored fighter assets are missing. Follow wc3-melee:docs/fighter-animation-work.md to build them.\n' >&2
    exit 1
fi
for texture in "${selection_textures[@]}"; do
    [[ -s "$selection_assets/$texture.tga" ]] || {
        printf 'Missing selection art: %s. Run wc3-melee:tools/selection/build-art.sh and wc3-melee:tools/animations/build-portraits.sh.\n' "$texture" >&2
        exit 1
    }
done
nix shell nixpkgs#bun --command bun "$project_dir/tools/stage/package.ts"
nix shell nixpkgs#bun --command bun "$project_dir/tools/animations/package-illidan.ts"
nix shell nixpkgs#bun --command bun "$project_dir/tools/effects/package.ts"
nix shell nixpkgs#bun --command bun "$project_dir/tools/effects/trap.ts"
build_id=${WC3_BUILD_ID:-$(date +%s)}
developer_scenario=${WC3_SCENARIO:-normal}
case "$developer_scenario" in normal|knockdown|tech|shield-break|ledge|parry|spike|ko) ;; *) echo 'Unknown WC3_SCENARIO.' >&2; exit 2;; esac
input_profile=${WC3_INPUT_PROFILE:-callback}
case "$input_profile" in callback|shadow-d3|shadow-d3-batch2|shadow-d3-r12|shadow-d0-r12|shadow-d1-r12|shadow-d0-r24) ;; *) echo 'Unknown WC3_INPUT_PROFILE.' >&2; exit 2;; esac
input_source=${WC3_INPUT_SOURCE:-keyboard}
case "$input_source" in keyboard|journal) ;; *) echo 'WC3_INPUT_SOURCE must be keyboard or journal.' >&2; exit 2;; esac
keyboard_journal_ingress=${WC3_JOURNAL_INGRESS:-files}
case "$keyboard_journal_ingress" in files|keyboard|editbox) ;; *) echo 'WC3_JOURNAL_INGRESS must be files, keyboard or editbox.' >&2; exit 2;; esac
[[ "$input_source" == journal || "$keyboard_journal_ingress" == files ]] || { echo 'Keyboard and editbox ingress require WC3_INPUT_SOURCE=journal.' >&2; exit 2; }
if [[ "$input_source" == journal && "$input_profile" == callback ]]; then
    echo 'WC3_INPUT_SOURCE=journal requires a shadow input profile.' >&2
    exit 2
fi
input_delay=3
input_rollback=6
shadow_input=false
[[ "$input_profile" == callback ]] || shadow_input=true
case "$input_profile" in shadow-d0-*) input_delay=0 ;; shadow-d1-*) input_delay=1 ;; esac
case "$input_profile" in *-r12) input_rollback=12 ;; *-r24) input_rollback=24 ;; esac
response_probe=${WC3_RESPONSE_SERVICE_PROBE:-0}
case "$response_probe" in 0|1) ;; *) echo 'WC3_RESPONSE_SERVICE_PROBE must be 0 or 1.' >&2; exit 2;; esac
presentation=${WC3_PRESENTATION:-native}
case "$presentation" in native|pool-confirmed|pool-predicted) ;; *) echo 'WC3_PRESENTATION must be native, pool-confirmed or pool-predicted.' >&2; exit 2;; esac
if [[ "$presentation" != native ]]; then
    [[ "$input_profile" == shadow-d*-r12 || "$input_profile" == shadow-d0-r24 ]] || { echo 'Pool presentation requires an R12 or R24 shadow input profile.' >&2; exit 2; }
    [[ -s "$original_clips/wurst/FighterOriginalClipInfo.wurst" ]] || { echo 'Export original clips before building pool presentation.' >&2; exit 1; }
    while IFS=$'\t' read -r source expected_hash; do
        [[ $(sha256sum "$project_dir/$source" | cut -d ' ' -f1) == "$expected_hash" ]] || {
            printf 'Original clips are stale for wc3-melee:%s. Export them again.\n' "$source" >&2
            exit 1
        }
    done < <(jq -r '.records[] | [.source, .sourceSha256] | @tsv' "$original_clips/original-clips-evidence.json")
fi
if [[ ! "$build_id" =~ ^[A-Za-z0-9._-]+$ ]]; then
    printf 'WC3_BUILD_ID may contain only letters, digits, dots, underscores, and hyphens.\n' >&2
    exit 2
fi

expected_compiler_commit=6b129956f6e7cf9582510f26b99d305526bf3ded
expected_stdlib_commit=e3714f629113ee682353c3244065fee3e7d9ae16
expected_compiler_sha256=9495b1f3ad1f1baf53335934e9152874773e6c735b0e5db819b3e7f06c82ed15
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

mkdir -p "$project_dir/_build" "$project_dir/build/tools" "$(dirname -- "$build_output")"
mkdir -p "$private_build_root"
work_dir=$(mktemp -d "$private_build_root/work.XXXXXX")
trap 'rm -rf -- "$work_dir"' EXIT
map_script="$work_dir/war3map.lua"
compiled_script="$work_dir/melee.lua"

mkdir -p "$work_dir/wurst" "$work_dir/_build/dependencies" "$work_dir/imports/war3mapImported"
cp "$summon_clips/wurst/SummonOriginalClipInfo.wurst" "$work_dir/wurst/SummonOriginalClipInfo.wurst"
mapfile -t summon_imports < <(jq -r ' .records[].clips[].filename' "$summon_clips/summon-clips-evidence.json")
for asset in "${summon_imports[@]}"; do
    cp "$summon_clips/imports/war3mapImported/$asset" "$work_dir/imports/war3mapImported/$asset"
done
ln -s "$stdlib_checkout" "$work_dir/_build/dependencies/wurststdlib"
cp "$project_dir/wurst.build" "$work_dir/wurst.build"
[[ $(rg -c '^  name: ' "$work_dir/wurst.build") == 1 ]] || {
    echo 'Expected one buildMapData name in wc3-melee:wurst.build.' >&2
    exit 1
}
sed -i "s/^  name: .*/  name: $map_name/" "$work_dir/wurst.build"
cp "$project_dir/tools/map-entry.j" "$work_dir/wurst/war3map.j"
for source in ConfirmedModelSounds ModelSoundPresentation FighterAssets Simulation TechInput MeleeContactGeometry MeleeScalarMath RollTravel IllidanMotion FighterPose BotRecovery DirectionalInput MatchRules MatchControls MatchHUD CommandBuffer CombatInput NetworkInput InputAdapter MatchStep ReplayState ReplayHistory KeyboardInputCapture InputProtocol InputBatch ParticipantInputs InputLedger FixedInputSchedule ShadowInputSchedule ShadowInputPlayback JournalInputSource JournalPauseBarrier KeyboardJournalIngress JournalTextStream EditboxJournalIngress VocabularyIngress VocabularyProbeCorpus ParryScenario SpikeScenario KeyBindings PlayerInputState BindingSettings SettingsUI SelectionDrag SelectionUI StageSelection StageUI ImpactEvents ImpactState SpecialEffectState SummonPose SummonState SummonPresentation DamagePose CombatEffects FrostEffects ProjectilePose ProjectilePresentation ShieldPose ShieldPresentation SpecialEffects ResponseServiceProbe NativePreloadProbe NativeTransportProbe Melee; do
    cp "$project_dir/wurst/$source.wurst" "$work_dir/wurst/$source.wurst"
done
cp "$project_dir/build/model-sounds/wurst/ModelSoundInfo.wurst" "$work_dir/wurst/ModelSoundInfo.wurst"
cp "$fighter_assets/FighterAssetInfo.wurst" "$work_dir/wurst/FighterAssetInfo.wurst"
cp "$project_dir/wurst/FighterPoolPresentation.wurst" "$work_dir/wurst/FighterPoolPresentation.wurst"
if [[ "$presentation" != native ]]; then
    cp "$original_clips/wurst/FighterOriginalClipInfo.wurst" "$work_dir/wurst/FighterOriginalClipInfo.wurst"
    cp "$original_clips/imports/war3mapImported/"*.mdx "$work_dir/imports/war3mapImported/"
else
    cat > "$work_dir/wurst/FighterOriginalClipInfo.wurst" <<'WURST'
package FighterOriginalClipInfo
public constant int ORIGINAL_CLIP_CAPACITY = 1
public constant string ORIGINAL_LIGHT_ACTIVE_ANIMATION = "Stand"
public constant string ORIGINAL_LIGHT_INACTIVE_ANIMATION = "Death"
public constant real ORIGINAL_LIGHT_GATE_SECONDS = 0.5
public tuple fighterOriginalClip(boolean valid, string modelPath, real startSeconds, real endSeconds, boolean looping)
public function originalClipCount(int character) returns int
    return 0
public function originalLightCount(int character) returns int
    return -1
public function originalLightPath(int character) returns string
    return ""
public function originalClip(int character, int sequenceIndex) returns fighterOriginalClip
    return fighterOriginalClip(false, "", 0., 0., false)
public function originalClipNamed(int character, string name) returns int
    return -1
WURST
fi
cp "$demon_hunter_assets/DemonHunterAssetInfo.wurst" "$work_dir/wurst/DemonHunterAssetInfo.wurst"
cp "$stage_assets/StageAssetInfo.wurst" "$work_dir/wurst/StageAssetInfo.wurst"
cp "$impact_assets/ImpactAssetInfo.wurst" "$work_dir/wurst/ImpactAssetInfo.wurst"
cp "$impact_assets/FrostAssetInfo.wurst" "$work_dir/wurst/FrostAssetInfo.wurst"
cp "$impact_assets/ShieldAssetInfo.wurst" "$work_dir/wurst/ShieldAssetInfo.wurst"
mapfile -t impact_imports < "$impact_assets/imports.txt"
mapfile -t frost_imports < "$impact_assets/frost-imports.txt"
mapfile -t shield_imports < "$impact_assets/shield-imports.txt"
impact_imports+=("${frost_imports[@]}" "${shield_imports[@]}")
for asset in "${impact_imports[@]}"; do
    cp "$impact_assets/$asset" "$work_dir/imports/war3mapImported/$asset"
done
mapfile -t stage_imports < "$stage_assets/imports.txt"
for asset in "${stage_imports[@]}"; do
    cp "$stage_assets/$asset" "$work_dir/imports/war3mapImported/$asset"
done
cp "$project_dir/tools/selection/art/SmashcraftHUD.fdf" "$project_dir/tools/selection/art/SmashcraftHUD.toc" "$work_dir/imports/war3mapImported/"
fighter_model_hash=$(sha256sum "$fighter_assets/ArcherFighter.mdx" | cut -d ' ' -f1)
fighter_model_path="war3mapImported\\ArcherFighter-$fighter_model_hash.mdx"
cp "$fighter_assets/ArcherFighter.mdx" "$work_dir/imports/war3mapImported/ArcherFighter-$fighter_model_hash.mdx"
rifleman_model_hash=$(sha256sum "$fighter_assets/RiflemanFighter.mdx" | cut -d ' ' -f1)
rifleman_model_path="war3mapImported\\RiflemanFighter-$rifleman_model_hash.mdx"
cp "$fighter_assets/RiflemanFighter.mdx" "$work_dir/imports/war3mapImported/RiflemanFighter-$rifleman_model_hash.mdx"
demon_hunter_model_hash=$(sha256sum "$demon_hunter_assets/DemonHunterFighter.mdx" | cut -d ' ' -f1)
demon_hunter_model_path="war3mapImported\\DemonHunterFighter-$demon_hunter_model_hash.mdx"
cp "$demon_hunter_assets/DemonHunterFighter.mdx" "$work_dir/imports/war3mapImported/DemonHunterFighter-$demon_hunter_model_hash.mdx"
for texture in "${selection_textures[@]}"; do
    cp "$selection_assets/$texture.tga" "$work_dir/imports/war3mapImported/$texture.tga"
done

printf 'package BuildInfo\npublic constant string BUILD_ID = "%s"\npublic constant boolean SHADOW_INPUT_PROFILE = %s\npublic constant boolean SHADOW_INPUT_BATCH2 = %s\npublic constant int SHADOW_INPUT_DELAY = %s\npublic constant int SHADOW_INPUT_ROLLBACK = %s\npublic constant boolean KNOCKDOWN_SCENARIO = %s\npublic constant boolean TECH_SCENARIO = %s\npublic constant boolean SHIELD_BREAK_SCENARIO = %s\npublic constant boolean LEDGE_SCENARIO = %s\npublic constant boolean PARRY_SCENARIO = %s\npublic constant boolean SPIKE_SCENARIO = %s\n' "$build_id" "$shadow_input" "$([[ "$input_profile" == shadow-d3-batch2 ]] && echo true || echo false)" "$input_delay" "$input_rollback" "$([[ "$developer_scenario" == knockdown || "$developer_scenario" == tech ]] && echo true || echo false)" "$([[ "$developer_scenario" == tech ]] && echo true || echo false)" "$([[ "$developer_scenario" == shield-break ]] && echo true || echo false)" "$([[ "$developer_scenario" == ledge ]] && echo true || echo false)" "$([[ "$developer_scenario" == parry ]] && echo true || echo false)" "$([[ "$developer_scenario" == spike ]] && echo true || echo false)" > "$work_dir/wurst/BuildInfo.wurst"
printf 'public constant string INPUT_PROFILE = "%s"\npublic constant string PRESENTATION_PROFILE = "%s"\npublic constant boolean POOL_PRESENTATION = %s\npublic constant boolean PREDICTED_PRESENTATION = %s\n' "$input_profile" "$presentation" "$([[ "$presentation" != native ]] && echo true || echo false)" "$([[ "$presentation" == pool-predicted ]] && echo true || echo false)" >> "$work_dir/wurst/BuildInfo.wurst"
printf 'public constant boolean JOURNAL_INPUT_SOURCE = %s\n' "$([[ "$input_source" == journal ]] && echo true || echo false)" >> "$work_dir/wurst/BuildInfo.wurst"
printf 'public constant boolean JOURNAL_KEYBOARD_INGRESS = %s\n' "$([[ "$keyboard_journal_ingress" == keyboard ]] && echo true || echo false)" >> "$work_dir/wurst/BuildInfo.wurst"
printf 'public constant boolean JOURNAL_EDITBOX_INGRESS = %s\n' "$([[ "$keyboard_journal_ingress" == editbox ]] && echo true || echo false)" >> "$work_dir/wurst/BuildInfo.wurst"
printf 'public constant boolean RESPONSE_SERVICE_PROBE = %s\n' "$([[ "$response_probe" == 1 ]] && echo true || echo false)" >> "$work_dir/wurst/BuildInfo.wurst"
printf 'public constant boolean KO_SCENARIO = %s\n' "$([[ "$developer_scenario" == ko ]] && echo true || echo false)" >> "$work_dir/wurst/BuildInfo.wurst"
cp "$work_dir/wurst/BuildInfo.wurst" "$build_output.BuildInfo.wurst"
if [[ "$build_output" == "$project_dir/build/wurst-map/$map_filename" ]]; then
    cp "$work_dir/wurst/BuildInfo.wurst" "$project_dir/build/generated-BuildInfo.wurst"
fi

(
cd "$work_dir"
"$java" -Xmx1024m -XX:ActiveProcessorCount=2 -jar "$compiler_jar" \
    -build -dev -lua -noExtractMapScript -stacktraces \
    -workspaceroot "$work_dir" -inputmap "$base_map" \
    -out "$compiled_script" \
    -lib "$stdlib_checkout"
)

[[ -s "$work_dir/_build/Smashcraft.w3x" ]] || {
    printf 'Compiler did not emit the configured map.\n' >&2
    exit 1
}

packager="$project_dir/build/tools/map-pack"
if [[ ! -x "$packager" ]]; then
    stormlib=$(nix build --no-link --print-out-paths nixpkgs#stormlib)
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
cp "$work_dir/_build/Smashcraft.w3x" "$output_next"
"$packager" replace "$output_next" "$map_script"
"$packager" extract "$output_next" "$work_dir/verified-ArcherFighter.mdx" "$fighter_model_path"
cmp "$fighter_assets/ArcherFighter.mdx" "$work_dir/verified-ArcherFighter.mdx"
"$packager" extract "$output_next" "$work_dir/verified-RiflemanFighter.mdx" "$rifleman_model_path"
cmp "$fighter_assets/RiflemanFighter.mdx" "$work_dir/verified-RiflemanFighter.mdx"
"$packager" extract "$output_next" "$work_dir/verified-DemonHunterFighter.mdx" "$demon_hunter_model_path"
cmp "$demon_hunter_assets/DemonHunterFighter.mdx" "$work_dir/verified-DemonHunterFighter.mdx"
for texture in "${selection_textures[@]}"; do
    "$packager" extract "$output_next" "$work_dir/verified-$texture.tga" "war3mapImported\\$texture.tga"
    cmp "$selection_assets/$texture.tga" "$work_dir/verified-$texture.tga"
done
for asset in "${stage_imports[@]}"; do
    "$packager" extract "$output_next" "$work_dir/verified-$asset" "war3mapImported\\$asset"
    cmp "$stage_assets/$asset" "$work_dir/verified-$asset"
done
for asset in "${summon_imports[@]}"; do
    "$packager" extract "$output_next" "$work_dir/verified-$asset" "war3mapImported\\$asset"
    cmp "$summon_clips/imports/war3mapImported/$asset" "$work_dir/verified-$asset"
done
for asset in "${impact_imports[@]}"; do
    "$packager" extract "$output_next" "$work_dir/verified-$asset" "war3mapImported\\$asset"
    cmp "$impact_assets/$asset" "$work_dir/verified-$asset"
done
"$packager" extract "$output_next" "$work_dir/verified.w3a" war3map.w3a
[[ -s "$work_dir/verified.w3a" ]]
"$packager" extract "$output_next" "$work_dir/verified.lua"
cmp "$map_script" "$work_dir/verified.lua"
mv "$output_next" "$build_output"

if [[ ${WC3_DEPLOY_MAP:-0} == 1 ]]; then
    mkdir -p "$maps_dir"
    cp "$build_output" "$maps_dir/$map_filename.next"
    mkdir -p "$private_build_root/map-archive"
    map_archive=$(mktemp -d "$private_build_root/map-archive/deploy.XXXXXX")
    shopt -s nullglob
    for installed_map in "$maps_dir"/Smashcraft*.w3x; do
        mv -- "$installed_map" "$map_archive/"
    done
    mv "$maps_dir/$map_filename.next" "$maps_dir/$map_filename"
fi

printf 'Built %s\n' "$build_output"
if [[ ${WC3_DEPLOY_MAP:-0} == 1 ]]; then
    printf 'Deployed %s/%s\n' "$maps_dir" "$map_filename"
fi
