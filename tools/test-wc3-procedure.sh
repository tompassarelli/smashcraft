#!/usr/bin/env bash
set -euo pipefail
root=$(cd -- "$(dirname -- "$0")/.." && pwd)
fixture=$(mktemp -d "${TMPDIR:-/tmp}/wc3-procedure-test.XXXXXX")
run_dir=$(mktemp -d "/run/user/$(id -u)/private-desktop.procedure-test.XXXXXX")
socket_pid=''
cleanup() {
  if [[ -n "$socket_pid" ]]; then kill "$socket_pid" 2>/dev/null || true; wait "$socket_pid" 2>/dev/null || true; fi
  rm -rf -- "$fixture" "$run_dir"
}
trap cleanup EXIT
mkdir -p "$run_dir/runtime" "$fixture/bin"
printf ':991\n' > "$run_dir/display"
: > "$run_dir/xauthority"
socat "UNIX-LISTEN:$run_dir/runtime/wayland-0,fork" /dev/null >/dev/null 2>&1 &
socket_pid=$!
for _ in {1..50}; do [[ -S "$run_dir/runtime/wayland-0" ]] && break; sleep 0.02; done
[[ -S "$run_dir/runtime/wayland-0" ]]
cat > "$fixture/bin/xdotool" <<'SH'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$WC3_PROCEDURE_CALLS"
if [[ "$1" == getactivewindow ]]; then printf '%s\n' "${WC3_PROCEDURE_TITLE:-Warcraft III}"; fi
SH
chmod +x "$fixture/bin/xdotool"
export WC3_PROCEDURE_CALLS="$fixture/calls" PATH="$fixture/bin:$PATH"

"$root/tools/wc3-procedure" "$run_dir" match-running export-ui-service > "$fixture/sent"
[[ $(wc -l < "$WC3_PROCEDURE_CALLS") == 3 ]] || { cat "$WC3_PROCEDURE_CALLS" >&2; exit 1; }
sed -n '2p' "$WC3_PROCEDURE_CALLS" | rg -q '^keydown Escape sleep 0\.120 keyup Escape keydown ctrl keydown h sleep 0\.150 keyup h keyup ctrl sleep 0\.200$'
if "$root/tools/wc3-procedure" "$run_dir" character-select export-ui-service > /dev/null 2>&1; then echo 'Mismatched caller state was accepted.' >&2; exit 1; fi
: > "$WC3_PROCEDURE_CALLS"
export WC3_PROCEDURE_TITLE='Battle.net'
if "$root/tools/wc3-procedure" "$run_dir" match-running export-ui-service > /dev/null 2>&1; then echo 'Non-game focus was accepted.' >&2; exit 1; fi
[[ $(wc -l < "$WC3_PROCEDURE_CALLS") == 1 ]]
echo 'Passed: one batched input invocation, state mismatch rejection, non-game focus rejection.'
