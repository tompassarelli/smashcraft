#!/usr/bin/env bash
set -euo pipefail
project_dir=$(cd -- "$(dirname -- "$0")" && pwd)
if [[ ${WC3_LOOP_DEPS:-} != 1 ]]; then
    exec nix shell nixpkgs#ydotool --command env WC3_LOOP_DEPS=1 bash "$0" "$@"
fi
mode=${1:-reload}
ready_file='/home/tom/.local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/users/steamuser/Documents/Warcraft III/CustomMapData/wc3-melee-ready.txt'
trace_file="$(dirname -- "$ready_file")/wc3-melee-input-trace.txt"
case "$mode" in reload|probe|quit) ;; *) echo 'Usage: loop.sh reload|probe|quit' >&2; exit 2;; esac
game_pid=$(pgrep -u "$(id -u)" -f '^C:.*Warcraft III.exe' | head -1) || {
    echo 'Open Warcraft III through the existing Steam/Battle.net entry first.' >&2
    exit 1
}
window_id=$(niri msg --json windows | jq -er '.[] | select(.title == "Warcraft III") | .id')
run_id=$(date +%Y%m%d-%H%M%S)
run_dir="$project_dir/build/loop/$run_id-$mode"
mkdir -p "$run_dir"
start_ms=$(date +%s%3N)
mark() { printf '%s\t%s\n' "$(( $(date +%s%3N) - start_ms ))" "$*" | tee -a "$run_dir/timings.tsv"; }
printf '%s\n' "$game_pid" > "$run_dir/game.pid"
export YDOTOOL_SOCKET="$run_dir/input.sock"
ydotoold -p "$YDOTOOL_SOCKET" > "$run_dir/input.log" 2>&1 &
input_pid=$!
trap 'kill "$input_pid" 2>/dev/null || true; wait "$input_pid" 2>/dev/null || true' EXIT
for attempt in $(seq 1 100); do [[ -S "$YDOTOOL_SOCKET" ]] && break; sleep 0.05; done
[[ -S "$YDOTOOL_SOCKET" ]]
niri msg action focus-window --id "$window_id"
for attempt in $(seq 1 30); do
    [[ $(niri msg --json focused-window | jq -r .id) == "$window_id" ]] && break
    sleep 0.05
done
require_focus() {
    if [[ $(niri msg --json focused-window | jq -r .id) != "$window_id" ]]; then
        mark 'desktop focus changed; stopped before further input'
        exit 1
    fi
}
press() { require_focus; ydotool key "$1:1" "$1:0"; }
press_ctrl() { require_focus; ydotool key 29:1 "$1:1" "$1:0" 29:0; }
capture() { require_focus; grim -s 1 "$run_dir/current.png"; }
if [[ "$mode" == probe ]]; then
    capture
    cp "$run_dir/current.png" "$run_dir/before.png"
    require_focus
    ydotool key 31:1
    sleep 0.25
    ydotool key 31:0
    sleep 0.1
    capture
    cp "$run_dir/current.png" "$run_dir/after.png"
    mark 'left-input probe captured; inspect before.png and after.png'
    exit
fi
ocr_package=$(nix build --no-link --print-out-paths --impure --expr '(builtins.getFlake "nixpkgs").legacyPackages.x86_64-linux.tesseract.override { enableLanguages = [ "eng" ]; }')
read_screen() {
    capture
    magick "$run_dir/current.png" -alpha off -colorspace Gray -threshold 75% -negate -bordercolor white -border 20 -type TrueColor "$run_dir/ocr.png"
    OMP_THREAD_LIMIT=1 "$ocr_package/bin/tesseract" "$run_dir/ocr.png" stdout --psm 11 2>/dev/null > "$run_dir/screen.txt"
}
if [[ "$mode" == quit ]]; then
    press 63
    mark 'quit-map sent'
else
    build_id=$(date +%H%M%S)
    printf '%s\n' "$build_id" > "$run_dir/build-id"
    mark 'build started'
    WC3_DEPLOY_MAP=1 WC3_BUILD_ID="$build_id" "$project_dir/build.sh" '/home/tom/.local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/users/steamuser/Documents/Warcraft III/Maps/Melee_Prototype_Base.w3m'
    mark 'build finished'
    press_ctrl 19
    mark 'Ctrl+R restart-map sent'
fi
continued=0
trace_requested=0
deadline=$((SECONDS + 45))
while (( SECONDS < deadline )); do
    kill -0 "$game_pid"
    if [[ "$mode" == reload && -f "$ready_file" ]] && rg -Fq "BUILD $build_id" "$ready_file"; then
        if (( !trace_requested )); then
            cp "$ready_file" "$run_dir/ready.txt"
            touch "$run_dir/trace-requested"
            press_ctrl 20
            trace_requested=1
            mark "new build $build_id initialized; Ctrl+T responsiveness probe sent"
        fi
        if [[ -f "$trace_file" && "$trace_file" -nt "$run_dir/trace-requested" ]] &&
            rg -Fq "start $build_id" "$trace_file" &&
            rg -q ' [0-9.]+ end"' "$trace_file"; then
            capture
            cp "$trace_file" "$run_dir/trace.txt"
            cp "$run_dir/current.png" "$run_dir/ready.png"
            mark "new build $build_id accepted input and completed simulation trace; game process retained"
            exit
        fi
    fi
    if [[ "$mode" == reload ]] && (( continued )); then
        sleep 0.1
        continue
    fi
    read_screen
    if [[ "$mode" == quit ]]; then
        if rg -qi 'CREATE GAME|SINGLE PLAYER|SINGLE-PLAYER|CAMPAIGN|CUSTOM GAMES' "$run_dir/screen.txt"; then
            mark 'menu visible; game process retained'
            exit
        fi
    else
        if (( !continued )) && rg -qi 'PRESS ANY KEY|TO CONTINUE' "$run_dir/screen.txt"; then
            mark 'loading complete'
            press 28
            continued=1
        fi
    fi
    sleep 0.15
done
read_screen
mark "observation timeout; inspect $run_dir/current.png and screen.txt"
exit 1
