#!/usr/bin/env bash
set -euo pipefail
root=$(cd -- "$(dirname -- "$0")/.." && pwd)
fixture=$(mktemp -d "${TMPDIR:-/tmp}/wc3-wait-test.XXXXXX")
run_dir=$(mktemp -d "/run/user/$(id -u)/private-desktop.wait-test.XXXXXX")
socket_pid=''
cleanup() {
  if [[ -n "$socket_pid" ]]; then kill "$socket_pid" 2>/dev/null || true; wait "$socket_pid" 2>/dev/null || true; fi
  rm -rf -- "${fixture:?}" "${run_dir:?}"
}
trap cleanup EXIT
mkdir -p "$run_dir/runtime" "$fixture/bin" "$fixture/scripts"
: > "$run_dir/active"
socat "UNIX-LISTEN:$run_dir/runtime/wayland-0,fork" /dev/null >/dev/null 2>&1 &
socket_pid=$!
for _ in {1..50}; do [[ -S "$run_dir/runtime/wayland-0" ]] && break; sleep 0.02; done
[[ -S "$run_dir/runtime/wayland-0" ]]
cat > "$fixture/bin/agents" <<'SH'
#!/usr/bin/env bash
printf '%s/SKILL.md\n' "$WC3_WAIT_FIXTURE"
SH
cat > "$fixture/scripts/private-desktop.sh" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
[[ "$1" == capture && ! -e "$3" ]]
n=$(cat "$WC3_WAIT_FIXTURE/count")
printf '%s\n' "$((n+1))" > "$WC3_WAIT_FIXTURE/count"
case "$WC3_WAIT_CASE" in
 transition) if (( n == 0 )); then echo 'SINGLE PLAYER MULTIPLAYER'; else echo 'CREATE GAME'; fi ;;
 disconnect) echo DISCONNECT ;;
 timeout) echo 'SINGLE PLAYER MULTIPLAYER' ;;
esac > "$3"
SH
cat > "$fixture/bin/magick" <<'SH'
#!/usr/bin/env bash
if [[ "$1" == identify ]]; then echo 2560x1440; else cat "$1"; fi
SH
cat > "$fixture/bin/tesseract" <<'SH'
#!/usr/bin/env bash
cat
SH
chmod +x "$fixture/bin/agents" "$fixture/bin/magick" "$fixture/bin/tesseract" "$fixture/scripts/private-desktop.sh"
export WC3_WAIT_FIXTURE="$fixture" PATH="$fixture/bin:$PATH"
for scenario in transition disconnect timeout; do
  export WC3_WAIT_CASE=$scenario
  echo 0 > "$fixture/count"
  status=0
  "$root/tools/wc3-wait-state" "$run_dir" create-game 1 > "$fixture/result" 2>/dev/null || status=$?
  case "$scenario" in
    transition) [[ "$status" == 0 && $(cat "$fixture/count") == 2 ]]; rg -q '^ready: create-game capture=' "$fixture/result" ;;
    disconnect) [[ "$status" == 1 && $(cat "$fixture/count") == 1 ]]; rg -q '^blocked: disconnected$' "$fixture/result" ;;
    timeout) [[ "$status" == 124 ]]; rg -q '^timeout: expected create-game$' "$fixture/result" ;;
  esac
done
echo 'Passed: observed transition, blocking disconnect, deadline timeout; fresh unique capture paths.'
