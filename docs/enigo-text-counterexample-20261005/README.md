# Pinned Enigo X11 text-emission counterexample

**Owning defect: Enigo 0.6.1's X11 delay state. No library or consumer fix is
claimed.** On a new private Xvfb display, the actual unchanged Enigo text API
with `linux_delay=0` emitted all 290 expected terminal bytes exactly, but its
24 calls took median 108.835 ms, minimum 18.243 ms and maximum 518.153 ms.
Four consecutive eight-byte packets took 196.084–196.860 ms each. Five
21-byte packets took 515.848–518.153 ms each. These are host-monotonic call
durations, not physical-device or Warcraft response measurements.

The stimulus is the first 24 packet strings from the failed native candidate's
A-helper log. It includes the short tap and analog start. Semicolon framing is
unchanged. The replay is immediate, intentionally reproducing the helper's
backlog-draining case. It is not paced at 60 Hz and is not a gameplay claim.
The receiver is a real xterm on scratch display :3, receiving terminal text;
`cmp` passed on all 290 bytes including the terminating newline. Xvfb and xterm
exited, and the capacity wrapper reported RELEASED. Neither Warcraft display
was touched.

Source: crates.io enigo 0.6.1, recorded git revision
b297a14e807abdf818b7809a70b445ade4fc5897, MIT license. Existing dependency source
was inspected without modification or copying into this repository. The probe
is authored against its public API. Current relevant seams in Enigo:

- `src/linux/x11rb.rs`: `Con::new` stores configured delay in `Con.delay`, but
  `raw` takes its XTEST delay from `KeyMap.pending_delays()`. The same pending
  delay goes to both press and release; each `raw` waits for an X server sync.
- `src/linux/keymap.rs`: `KeyMap::new` selects a separate hardcoded 12 ms delay.
  `key_to_keycode` returns immediately for an already-mapped symbol without
  updating or clearing pending delay. A remapped uppercase symbol can therefore
  leave a delay that gets applied again to following ordinary digits and
  punctuation. Lookup only checks level zero, so ordinary shifted Latin symbols
  enter the remapping path.

The generic owning repair must make the configured delay authoritative for
all X11 text/key paths, scope pending timing to the actual event rather than
leaking it across existing mappings, and preserve correct shifted-symbol text.
No ASCII-only consumer emitter, patched registry, raw-key bypass, feature swap,
or dependency downgrade was introduced. The parent owns admission and repair
of this library boundary, then repinning and the native gameplay continuation.
Exact byte fidelity in xterm does not establish Wine editbox fidelity or explain
the separate native map admission failure.

## Reproduce

The existing pinned Cargo environment and native libraries are required.
Build the example in wc3-melee:companion, then run the script within a bounded
capacity scope with Xvfb, xterm and xdotool available. The script selects a new
X display through `-displayfd`; it never chooses a retained display number.

```sh
cd ~/code/wc3-melee/worktrees/input-retention-20261005/companion
export PATH="$HOME/.rustup/toolchains/1.96.1-x86_64-unknown-linux-gnu/bin:$PATH"
/nix/store/g7skjk9lrdnshaxd7px62bchq6yg0bbh-bun-1.3.13/bin/bun \
  ~/.codex/skills/machine-capacity-distilled/scripts/machine-capacity.mjs run \
  --class moderate --owner codex:enigo-counterexample --timeout-seconds 120 -- \
  nix-shell -p stdenv.cc cmake pkg-config libxkbcommon udev xorg-server xterm xdotool \
  --run 'set -e; cargo build --locked --jobs 2 --example enigo_text_probe; bash /home/tom/code/wc3-melee/worktrees/input-retention-20261005/tools/enigo-text-counterexample.sh'
```

The raw fixture, observed timings and received text are alongside this record.
New output goes to wc3-melee:build/enigo-text-counterexample. The Rust example
retains Enigo's temporary mappings until the receiver has consumed the expected
byte count, then drops the connection normally.
