#!/usr/bin/env bash
set -euo pipefail
if ! command -v ydotool >/dev/null; then
    exec nix shell nixpkgs#ydotool --command bash "$0" "$@"
fi
project_dir=$(cd -- "$(dirname -- "$0")/.." && pwd)
cd "$project_dir"
case "${1:-descent}" in
    descent) dodge_delay=0.25 ;;
    early) dodge_delay=0.095 ;;
    *) echo 'Usage: probe-ground-slide.sh [descent|early]' >&2; exit 2 ;;
esac
mkdir -p build/animation-probe
export YDOTOOL_SOCKET="$PWD/build/animation-probe/wavedash-input.sock"
ydotoold -p "$YDOTOOL_SOCKET" > build/animation-probe/wavedash-input.log 2>&1 &
input_pid=$!
record_pid=
trace_file='/home/tom/.local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/users/steamuser/Documents/Warcraft III/CustomMapData/wc3-melee-input-trace.txt'
touch build/animation-probe/ground-slide-started
cleanup() {
    ydotool key 23:0 30:0 31:0 32:0 49:0 65:0 2>/dev/null || true
    if [[ -n "$record_pid" ]]; then kill -INT "$record_pid" 2>/dev/null || true; wait "$record_pid" 2>/dev/null || true; fi
    kill "$input_pid" 2>/dev/null || true
    wait "$input_pid" 2>/dev/null || true
}
trap cleanup EXIT
sleep 0.6
window_id=$(niri msg --json windows | jq -er '.[]|select(.title=="Warcraft III")|.id')
check_focus() { [[ $(niri msg --json focused-window | jq -r .id) == "$window_id" ]] || { echo 'Focus changed; stopping input.' >&2; exit 1; }; }
press() { check_focus; ydotool key "$1:1"; sleep 0.08; ydotool key "$1:0"; sleep 0.2; }
check_focus
wf-recorder -o eDP-1 -f build/animation-probe/wavedash-client.mp4 -r 60 -F scale=1440:960 -c libx264 -p threads=2 -p preset=ultrafast > build/animation-probe/wavedash-record.log 2>&1 &
record_pid=$!
press 49
check_focus
ydotool key 49:1
sleep 0.06
ydotool key -d 0 49:0 65:1 23:1 23:0 65:0
sleep "$dodge_delay"
ydotool key -d 0 31:1 32:1 30:1
sleep 0.15
ydotool key 30:0 32:0 31:0
sleep 5
check_focus
grim -s 1 build/animation-probe/wavedash-result.png
kill -INT "$record_pid"
wait "$record_pid"
record_pid=
if [[ ! "$trace_file" -nt build/animation-probe/ground-slide-started ]]; then
    echo 'No fresh input trace; ground slide remains unverified.' >&2
    exit 1
fi
cp "$trace_file" build/animation-probe/wavedash-ground-slide-trace.txt
awk -F '"' '
    /call Preload/ {
        split($2, field, " ")
        if (field[3] != "motion") next
        if (field[7] == 10 && field[11] == 0) {
            landing = 1; moved = 0; startX = field[9]; startTick = field[1]
        } else if (landing) {
            if (field[11] != 0) { landing = 0; next }
            if (field[9] != startX) moved = 1
            if (field[7] == 0 && moved && field[1] - startTick == 10) {
                printf "Ground slide observed: %.3f world units; 10 recovery ticks.\n", field[9] - startX
                verified = 1
                exit
            }
        }
    }
    END { if (!verified) exit 1 }
' build/animation-probe/wavedash-ground-slide-trace.txt
