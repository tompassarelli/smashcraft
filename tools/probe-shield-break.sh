#!/usr/bin/env bash
set -euo pipefail
if ! command -v ydotool >/dev/null; then
    exec nix shell nixpkgs#ydotool --command bash "$0" "$@"
fi
project_dir=$(cd -- "$(dirname -- "$0")/.." && pwd)
run_dir="$project_dir/build/animation-probe/shield-break-${1:-idle}"
case "${1:-idle}" in idle|mash) ;; *) exit 2;; esac
mkdir -p "$run_dir"
trace_file='/home/tom/.local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/users/steamuser/Documents/Warcraft III/CustomMapData/wc3-melee-input-trace.txt'
export YDOTOOL_SOCKET="$project_dir/build/shield-break.sock"
ydotoold -p "$YDOTOOL_SOCKET" > "$run_dir/input.log" 2>&1 &
input_pid=$!
cleanup() {
    ydotool key 30:0 49:0 29:0 20:0 2>/dev/null || true
    kill "$input_pid" 2>/dev/null || true
    wait "$input_pid" 2>/dev/null || true
}
trap cleanup EXIT
sleep 0.6
focus() { [[ $(niri msg --json focused-window | jq -r .title) == 'Warcraft III' ]]; }
press() { focus; ydotool key "$1:1"; sleep 0.08; ydotool key "$1:0"; sleep 0.08; }
trace() { focus; ydotool key 29:1 20:1 20:0 29:0; }
touch "$run_dir/started"
press 49
press 49
trace
focus
ydotool key 30:1
sleep 0.4
grim -s 1 "$run_dir/launch.png"
ydotool key 30:0
sleep 1
grim -s 1 "$run_dir/recovery.png"
sleep 1
grim -s 1 "$run_dir/dizzy.png"
if [[ ${1:-idle} == mash ]]; then
    for attempt in $(seq 1 20); do press 49; done
fi
sleep 8
focus
grim -s 1 "$run_dir/released.png"
[[ "$trace_file" -nt "$run_dir/started" ]]
cp "$trace_file" "$run_dir/trace.txt"
for phase in 1 2 3 4 0; do rg -q "shield-break $phase z" "$run_dir/trace.txt"; done
rg 'shield-break ' "$run_dir/trace.txt"
