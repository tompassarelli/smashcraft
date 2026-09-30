#!/usr/bin/env bash
set -euo pipefail
if ! command -v ydotool >/dev/null; then
    exec nix shell nixpkgs#ydotool --command bash "$0" "$@"
fi
project_dir=$(cd -- "$(dirname -- "$0")/.." && pwd)
character=${1:-rifleman}
case "$character" in archer|rifleman) ;; *) echo 'Choose archer or rifleman.' >&2; exit 2;; esac
ready_file='/home/tom/.local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/users/steamuser/Documents/Warcraft III/CustomMapData/wc3-melee-ready.txt'
rg -q 'SCENARIO knockdown' "$ready_file" || { echo 'Load the knockdown scenario and start at character selection first.' >&2; exit 1; }
run_dir="$project_dir/build/animation-probe/$character-clips-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$run_dir"
export YDOTOOL_SOCKET="$project_dir/build/clips-$$.sock"
ydotoold -p "$YDOTOOL_SOCKET" > "$run_dir/input.log" 2>&1 &
input_pid=$!
record_pid=
cleanup() {
    ydotool key 49:0 33:0 31:0 32:0 57:0 39:0 23:0 30:0 28:0 2>/dev/null || true
    if [[ -n "$record_pid" ]]; then kill -TERM "$record_pid" 2>/dev/null || true; wait "$record_pid" 2>/dev/null || true; fi
    kill "$input_pid" 2>/dev/null || true
    wait "$input_pid" 2>/dev/null || true
}
trap cleanup EXIT
sleep 0.6
focus() { [[ $(niri msg --json focused-window | jq -r .title) == 'Warcraft III' ]] || { echo 'Focus changed; stopping input.' >&2; exit 1; }; }
keys() { focus; ydotool key "$@"; }
press() { keys "$1:1"; sleep 0.08; keys "$1:0"; }
mark() { printf '%s %s\n' "$(date +%s.%N)" "$1" >> "$run_dir/actions.txt"; }
focus
wf-recorder -o eDP-1 -f "$run_dir/clips.mp4" -r 60 -F scale=1440:960 -c libx264 -p threads=2 -p preset=ultrafast > "$run_dir/record.log" 2>&1 &
record_pid=$!
press 33
sleep 0.2
if [[ "$character" == archer ]]; then press 31; sleep 0.2; fi
press 28
sleep 0.3
mark knockdown
sleep 1.2
mark getup-attack
press 49
sleep 1.1
mark jab
press 49
sleep 0.8
for angle in level up down; do
    mark "tilt-$angle"
    keys 39:1 33:1
    case "$angle" in up) keys 57:1;; down) keys 32:1;; esac
    press 49
    keys 39:0 33:0 57:0 32:0
    sleep 0.8
done
mark jump-double-jump
press 23
sleep 0.22
press 23
sleep 1.7
for direction in 33 33 32; do
    mark "dodge-$direction"
    keys 30:1
    sleep 0.15
    press "$direction"
    keys 30:0
    sleep 0.9
done
focus
grim -s 1 "$run_dir/final.png"
kill -INT "$record_pid"
wait "$record_pid"
record_pid=
printf 'Recorded native clip sequence at %s; inspect video for visual verdict.\n' "$run_dir"
