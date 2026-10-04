#![deny(unsafe_code)]

#[cfg(not(target_os = "linux"))]
fn main() {
    eprintln!("wc3-journal requires Linux evdev event timestamps");
    std::process::exit(2);
}

#[cfg(target_os = "linux")]
mod linux {
    #![allow(unsafe_code)]

    use evdev::{AbsoluteAxisCode as Abs, EventSummary, KeyCode as Key, raw_stream::RawDevice};
    use std::{
        collections::BTreeMap,
        env,
        fs::{self, OpenOptions},
        io::{self, Write},
        os::fd::AsRawFd,
        path::{Path, PathBuf},
        thread,
        time::{Duration, UNIX_EPOCH},
    };

    const HZ: u128 = 60;
    const LAST_FRAME: u32 = 2_147_483_646;
    const ALPHABET: &[u8; 64] = b"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";
    const MOVE_LEFT: u32 = 1 << 0;
    const MOVE_RIGHT: u32 = 1 << 1;
    const MOVE_DOWN: u32 = 1 << 2;
    const MOVE_UP: u32 = 1 << 3;
    const JUMP: u32 = 1 << 4;
    const ATTACK: u32 = 1 << 5;
    const SPECIAL: u32 = 1 << 6;
    const GRAB: u32 = 1 << 7;
    const LEFT_TRIGGER: u32 = 1 << 8;
    const RIGHT_TRIGGER: u32 = 1 << 9;
    const SMASH_LEFT: u32 = 1 << 10;
    const SMASH_RIGHT: u32 = 1 << 11;
    const SMASH_UP: u32 = 1 << 12;
    const SMASH_DOWN: u32 = 1 << 13;
    const WALK: u32 = 1 << 14;
    const EVIOCSCLOCKID: libc::c_ulong = 0x4004_45a0;

    #[derive(Default, Clone, Copy, Debug, PartialEq, Eq)]
    struct State {
        sources: u32,
        x: i16,
        y: i16,
        cx: i16,
        cy: i16,
        lt: u16,
        rt: u16,
    }

    #[derive(Default, Clone, Copy)]
    struct Edges {
        pressed: u32,
        released: u32,
        special_x: i16,
        special_y: i16,
        dodge_x: i16,
        dodge_y: i16,
        sdi_x: i16,
        sdi_y: i16,
        ledge: i16,
        throw_x: i16,
        throw_y: i16,
    }

    struct Options {
        device: PathBuf,
        out: PathBuf,
        build: String,
        epoch: u32,
        slot: u32,
        delay: u32,
        epoch_ns: u128,
        first_frame: u32,
        stop_frame: Option<u32>,
        ready_file: Option<PathBuf>,
        trace: bool,
    }

    #[derive(Clone, Copy, Debug, PartialEq, Eq)]
    struct FrameSegment {
        epoch_ns: u128,
        first_frame: u32,
    }

    #[derive(Clone, Copy, Debug, PartialEq, Eq)]
    enum ControlState {
        PausePrepare,
        PauseCommit,
        Paused,
        Resumed,
    }

    #[derive(Clone, Debug, PartialEq, Eq)]
    struct ControlCommand {
        build: String,
        epoch: u32,
        slot: u32,
        sequence: u32,
        state: ControlState,
        requested_frame: u32,
    }

    fn usage() -> &'static str {
        "wc3-journal --device /dev/input/eventN --out DIR --ready-file PATH --epoch-monotonic-ns NS [--first-frame N] [--stop-frame N] [--trace]\n\
         Assigns Linux kernel CLOCK_MONOTONIC input_event times to half-open 60 Hz frames. The capture segment starts at the explicit host monotonic epoch; first-frame defaults to 1."
    }

    fn options() -> Result<Options, String> {
        let mut values = BTreeMap::<String, String>::new();
        let mut trace = false;
        let mut args = env::args().skip(1);
        while let Some(arg) = args.next() {
            if arg == "--help" || arg == "-h" {
                println!("{}", usage());
                std::process::exit(0);
            }
            if arg == "--trace" {
                trace = true;
                continue;
            }
            if !arg.starts_with("--") {
                return Err(format!("unexpected argument {arg:?}\n{}", usage()));
            }
            let value = args
                .next()
                .ok_or_else(|| format!("missing value for {arg}"))?;
            values.insert(arg, value);
        }
        let take = |key: &str| {
            values
                .get(key)
                .ok_or_else(|| format!("missing {key}\n{}", usage()))
        };
        let parse = |key: &str| -> Result<u32, String> {
            take(key)?.parse().map_err(|_| format!("invalid {key}"))
        };
        let epoch_ns = take("--epoch-monotonic-ns")?
            .parse::<u128>()
            .map_err(|_| "invalid --epoch-monotonic-ns")?;
        let ready_file = values.get("--ready-file").map(PathBuf::from);
        let (build, epoch, slot, delay) = if let Some(path) = ready_file.as_ref() {
            read_ready(path)?
        } else {
            (
                take("--build")?.clone(),
                parse("--epoch")?,
                parse("--slot")?,
                parse("--delay")?,
            )
        };
        if build.is_empty()
            || build.len() > 80
            || !build
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
        {
            return Err("--build must be 1..80 ASCII letters, digits, '-' or '_'".into());
        }
        Ok(Options {
            device: take("--device")?.into(),
            out: take("--out")?.into(),
            build,
            epoch,
            slot,
            delay,
            epoch_ns,
            first_frame: values
                .get("--first-frame")
                .map(|s| s.parse().map_err(|_| "invalid --first-frame"))
                .transpose()?
                .unwrap_or(1),
            stop_frame: values
                .get("--stop-frame")
                .map(|s| s.parse().map_err(|_| "invalid --stop-frame"))
                .transpose()?,
            ready_file,
            trace,
        })
    }

    fn read_ready(path: &Path) -> Result<(String, u32, u32, u32), String> {
        let contents = fs::read_to_string(path).map_err(|error| {
            format!(
                "read native journal readiness receipt {}: {error}",
                path.display()
            )
        })?;
        parse_ready(&contents)
    }

    fn parse_ready(contents: &str) -> Result<(String, u32, u32, u32), String> {
        let mut fields = BTreeMap::<String, String>::new();
        for token in contents.split_whitespace() {
            let token = token.strip_suffix('"').unwrap_or(token);
            let Some((key, value)) = token.split_once('=') else {
                continue;
            };
            if let Some(previous) = fields.insert(key.into(), value.into()) {
                if previous != value {
                    return Err(format!("conflicting {key} values in readiness receipt"));
                }
            }
        }
        let value = |key: &str| {
            fields
                .get(key)
                .ok_or_else(|| format!("readiness receipt lacks {key}"))
        };
        let build = value("build")?.clone();
        let number = |key: &str| {
            value(key)?
                .parse::<u32>()
                .map_err(|_| format!("invalid {key} in readiness receipt"))
        };
        let epoch = number("epoch")?;
        let slot = number("slot")?;
        let delay = number("delay")?;
        if number("first_frame")? != 1 + delay {
            return Err("readiness receipt first_frame must equal 1 + delay".into());
        }
        Ok((build, epoch, slot, delay))
    }

    fn parse_control(contents: &str) -> Result<ControlCommand, String> {
        let mut fields = BTreeMap::<String, String>::new();
        for token in contents.split_whitespace() {
            let token = token.trim_matches('"');
            if let Some((key, value)) = token.split_once('=') {
                fields.insert(key.into(), value.into());
            }
        }
        let value = |key: &str| {
            fields
                .get(key)
                .ok_or_else(|| format!("control command lacks {key}"))
        };
        if value("v")? != "1" {
            return Err("unsupported journal control version".into());
        }
        let number = |key: &str| {
            value(key)?
                .parse::<u32>()
                .map_err(|_| format!("invalid {key} in control command"))
        };
        let state = match value("state")?.as_str() {
            "PAUSE" => ControlState::PausePrepare,
            "PAUSE_COMMIT" => ControlState::PauseCommit,
            "RESUME" => ControlState::Resumed,
            _ => return Err("invalid journal control state".into()),
        };
        let requested_frame = number("frame")?;
        if requested_frame == 0 || requested_frame > LAST_FRAME {
            return Err("control frame is outside the supported range".into());
        }
        Ok(ControlCommand {
            build: value("build")?.clone(),
            epoch: number("epoch")?,
            slot: number("slot")?,
            sequence: number("sequence")?,
            state,
            requested_frame,
        })
    }

    #[test]
    fn reads_native_preload_readiness() {
        let receipt = "function PreloadFiles takes nothing returns nothing\n\tcall Preload( \"SMASHCRAFT JOURNAL v=1 build=netcode-0022 epoch=1 slot=3\" )\n\tcall Preload( \"input=shadow-d0-r24 delay=0 rollback=24 first_frame=1\" )\nendfunction\n";
        assert_eq!(
            parse_ready(receipt).unwrap(),
            ("netcode-0022".into(), 1, 3, 0)
        );
        assert!(parse_ready(&receipt.replace("first_frame=1", "first_frame=2")).is_err());
    }

    #[test]
    fn reads_sequenced_pause_and_resume_control_receipts() {
        let pause = "function PreloadFiles takes nothing returns nothing\ncall Preload( \"SMASHCRAFT JOURNAL CONTROL v=1 build=playable epoch=7 slot=2 sequence=3 state=PAUSE frame=91\" )\nendfunction";
        assert_eq!(
            parse_control(pause).unwrap(),
            ControlCommand {
                build: "playable".into(),
                epoch: 7,
                slot: 2,
                sequence: 3,
                state: ControlState::PausePrepare,
                requested_frame: 91,
            }
        );
        let resume = pause.replace("sequence=3 state=PAUSE", "sequence=4 state=RESUME");
        assert_eq!(parse_control(&resume).unwrap().state, ControlState::Resumed);
        assert!(parse_control(&pause.replace("frame=91", "frame=0")).is_err());
    }

    #[test]
    fn resumed_segment_excludes_the_entire_pause_gap() {
        let initial = FrameSegment {
            epoch_ns: 1_000_000_000,
            first_frame: 1,
        };
        let before_pause = frame_at(2_000_000_000, initial).unwrap();
        assert_eq!(before_pause, 61);
        let resumed = FrameSegment {
            epoch_ns: 302_000_000_000,
            first_frame: 61,
        };
        assert_eq!(frame_at(302_250_000_000, resumed).unwrap(), 76);
        assert_eq!(frame_at(302_000_000_000, resumed).unwrap(), before_pause);
    }

    #[test]
    fn queued_short_press_keeps_its_original_frames_across_a_250ms_service_stall() {
        let segment = FrameSegment {
            epoch_ns: 10_000_000_000,
            first_frame: 1,
        };
        let button_down_ns = 10_015_000_000;
        let button_up_ns = 10_035_000_000;
        // Both kernel events are processed together after the 250ms delay;
        // frame assignment still uses the original event timestamps.
        let delayed_service_now_ns = 10_285_000_000;
        assert!(delayed_service_now_ns - button_up_ns >= 250_000_000);
        assert_eq!(frame_at(button_down_ns, segment).unwrap(), 1);
        assert_eq!(frame_at(button_up_ns, segment).unwrap(), 3);
    }

    #[test]
    fn resume_starts_neutral_and_never_replays_held_pause_state() {
        let paused_state = State {
            sources: 1 << 0,
            ..State::default()
        };
        assert_ne!(action_state(paused_state), 0);
        let resumed_state = State::default();
        assert_eq!(action_state(resumed_state), 0);
        assert_eq!(
            encode_row(resumed_state, 0, Edges::default()),
            compact(0, 1)
        );
    }

    fn monotonic_ns() -> io::Result<u128> {
        let mut ts = libc::timespec {
            tv_sec: 0,
            tv_nsec: 0,
        };
        // SAFETY: ts is a valid writable timespec and CLOCK_MONOTONIC has no additional preconditions.
        if unsafe { libc::clock_gettime(libc::CLOCK_MONOTONIC, &mut ts) } != 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(ts.tv_sec as u128 * 1_000_000_000 + ts.tv_nsec as u128)
    }

    fn set_monotonic_event_clock(device: &RawDevice) -> io::Result<()> {
        let clock = libc::CLOCK_MONOTONIC;
        // SAFETY: ioctl receives the live evdev fd and a pointer to one initialized clock id.
        let result = unsafe { libc::ioctl(device.as_raw_fd(), EVIOCSCLOCKID, &clock) };
        if result < 0 {
            Err(io::Error::last_os_error())
        } else {
            Ok(())
        }
    }

    fn set_nonblocking(device: &RawDevice) -> io::Result<()> {
        // SAFETY: fcntl reads and updates flags on the live evdev descriptor.
        let flags = unsafe { libc::fcntl(device.as_raw_fd(), libc::F_GETFL) };
        if flags < 0 {
            return Err(io::Error::last_os_error());
        }
        // SAFETY: F_SETFL accepts the original descriptor flags plus O_NONBLOCK.
        let result =
            unsafe { libc::fcntl(device.as_raw_fd(), libc::F_SETFL, flags | libc::O_NONBLOCK) };
        if result < 0 {
            Err(io::Error::last_os_error())
        } else {
            Ok(())
        }
    }

    fn compact(mut value: u32, width: usize) -> String {
        let mut bytes = vec![b'0'; width];
        for i in (0..width).rev() {
            bytes[i] = ALPHABET[(value % 64) as usize];
            value /= 64;
        }
        String::from_utf8(bytes).expect("base64 alphabet is UTF-8")
    }

    fn signed(value: i16) -> u32 {
        if value < 0 {
            (-2 * i32::from(value) - 1) as u32
        } else {
            2 * value as u32
        }
    }

    fn action_state(s: State) -> u32 {
        let mut held = 0;
        if s.sources & (1 << 0) != 0 {
            held |= ATTACK;
        }
        if s.sources & (1 << 1) != 0 || s.sources & (1 << 3) != 0 {
            held |= JUMP;
        }
        if s.sources & (1 << 2) != 0 {
            held |= SPECIAL;
        }
        if s.sources & (1 << 4) != 0 {
            held |= WALK;
        }
        if s.sources & (1 << 5) != 0 {
            held |= GRAB;
        }
        if s.x < -7_000 {
            held |= MOVE_LEFT;
        }
        if s.x > 7_000 {
            held |= MOVE_RIGHT;
        }
        if s.y > 7_000 {
            held |= MOVE_DOWN;
        }
        if s.y < -7_000 {
            held |= MOVE_UP | JUMP;
        }
        if s.cx < -11_000 {
            held |= SMASH_LEFT;
        }
        if s.cx > 11_000 {
            held |= SMASH_RIGHT;
        }
        if s.cy < -11_000 {
            held |= SMASH_UP;
        }
        if s.cy > 11_000 {
            held |= SMASH_DOWN;
        }
        if s.lt > 4_000 {
            held |= LEFT_TRIGGER;
        }
        if s.rt > 4_000 {
            held |= RIGHT_TRIGGER;
        }
        held
    }

    fn axis_byte(raw: i16) -> i16 {
        (i32::from(raw) * 127 / 32_767).clamp(-127, 127) as i16
    }

    fn encode_row(state: State, previous: u32, edges: Edges) -> String {
        let held = action_state(state);
        let pressed = edges.pressed | (held & !previous);
        let released = edges.released | (previous & !held);
        let mut flags = 0u32;
        let mut body = String::new();
        if held != 0 {
            flags |= 1;
            body.push_str(&compact(held, 3));
        }
        if pressed != 0 || released != 0 {
            flags |= 2;
            body.push_str(&compact(pressed, 3));
            body.push_str(&compact(released, 3));
        }
        let x = axis_byte(state.x);
        let y = axis_byte((-i32::from(state.y)).clamp(-32_767, 32_767) as i16);
        let axes = signed(x) * 255 + signed(y);
        if axes != 0 {
            flags |= 4;
            body.push_str(&compact(axes, 3));
        }
        let lt = u32::from(state.lt.min(32_767)) * 255 / 32_767;
        let rt = u32::from(state.rt.min(32_767)) * 255 / 32_767;
        let triggers = lt * 256 + rt;
        if triggers != 0 {
            flags |= 8;
            body.push_str(&compact(triggers, 3));
        }
        let metadata = signed(edges.special_x)
            + 3 * signed(edges.special_y)
            + 9 * signed(edges.dodge_x)
            + 27 * signed(edges.dodge_y)
            + 81 * signed(edges.sdi_x)
            + 243 * signed(edges.sdi_y)
            + 729 * signed(edges.ledge);
        if metadata != 0 {
            flags |= 16;
            body.push_str(&compact(metadata, 2));
        }
        let throws = signed(edges.throw_x) * 255 + signed(edges.throw_y);
        if throws != 0 {
            flags |= 32;
            body.push_str(&compact(throws, 3));
        }
        compact(flags, 1) + &body
    }

    fn encode_packet(epoch: u32, first: u32, rows: &[String]) -> String {
        let mut wire = format!("I4{}", compact(rows.len() as u32, 1));
        encode_counter(epoch, &mut wire);
        encode_counter(first, &mut wire);
        for row in rows {
            wire.push_str(row);
        }
        wire
    }

    fn encode_counter(mut value: u32, wire: &mut String) {
        loop {
            let digit = value & 31;
            value >>= 5;
            wire.push(ALPHABET[(digit | if value == 0 { 0 } else { 32 }) as usize] as char);
            if value == 0 {
                return;
            }
        }
    }

    fn event_ns(event: &evdev::InputEvent) -> Result<u128, String> {
        event
            .timestamp()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .map_err(|_| "negative evdev CLOCK_MONOTONIC timestamp".into())
    }

    fn frame_at(t: u128, segment: FrameSegment) -> Result<u32, String> {
        if t < segment.epoch_ns {
            return Err(format!(
                "event at {t} predates declared capture segment {}",
                segment.epoch_ns
            ));
        }
        let f = segment.first_frame as u128 + ((t - segment.epoch_ns) * HZ / 1_000_000_000);
        if f > LAST_FRAME as u128 {
            return Err("frame counter exhausted".into());
        }
        Ok(f as u32)
    }

    fn normalized_axis(ranges: &[Option<evdev::AbsInfo>; 6], code: Abs, value: i32) -> i16 {
        let Some(info) = ranges.get(code.0 as usize).copied().flatten() else {
            return 0;
        };
        let lo = info.minimum();
        let hi = info.maximum();
        if hi <= lo {
            return 0;
        }
        let mid = (lo + hi) / 2;
        if value >= mid {
            ((value - mid) * 32_767 / (hi - mid).max(1)).clamp(0, 32_767) as i16
        } else {
            ((value - mid) * 32_768 / (mid - lo).max(1)).clamp(-32_768, 0) as i16
        }
    }

    fn normalized_trigger(ranges: &[Option<evdev::AbsInfo>; 6], code: Abs, value: i32) -> u16 {
        let Some(info) = ranges.get(code.0 as usize).copied().flatten() else {
            return 0;
        };
        let range = info.maximum() - info.minimum();
        if range <= 0 {
            return 0;
        }
        ((value - info.minimum()).clamp(0, range) * 32_767 / range) as u16
    }

    fn apply_event(
        ranges: &[Option<evdev::AbsInfo>; 6],
        state: &mut State,
        event: evdev::InputEvent,
        edges: &mut BTreeMap<u32, Edges>,
        snapshots: &mut BTreeMap<u32, State>,
        earliest_unwritten: u32,
        segment: FrameSegment,
        trace: bool,
    ) -> Result<(), String> {
        let summary = event.destructure();
        if matches!(
            &summary,
            EventSummary::Synchronization(_, evdev::SynchronizationCode::SYN_DROPPED, _)
        ) {
            return Err(
                "kernel reported SYN_DROPPED; lost original input edges cannot be reconstructed"
                    .into(),
            );
        }
        let mapped = match &summary {
            EventSummary::Key(_, key, _) => matches!(
                *key,
                Key::BTN_SOUTH
                    | Key::BTN_EAST
                    | Key::BTN_WEST
                    | Key::BTN_NORTH
                    | Key::BTN_TL
                    | Key::BTN_TR
            ),
            EventSummary::AbsoluteAxis(_, code, _) => matches!(
                *code,
                Abs::ABS_X | Abs::ABS_Y | Abs::ABS_RX | Abs::ABS_RY | Abs::ABS_Z | Abs::ABS_RZ
            ),
            _ => false,
        };
        if !mapped {
            return Ok(());
        }
        let timestamp = event_ns(&event)?;
        let frame = frame_at(timestamp, segment)?;
        if frame < earliest_unwritten {
            return Err(format!(
                "late kernel event belongs to frame {frame}, already-published cursor is {earliest_unwritten}; original frame retained and journal stopped"
            ));
        }
        let mut edge = Edges::default();
        let before = action_state(*state);
        let before_x = i16::from(before & MOVE_RIGHT != 0) - i16::from(before & MOVE_LEFT != 0);
        let before_y = i16::from(before & MOVE_UP != 0) - i16::from(before & MOVE_DOWN != 0);
        match summary {
            EventSummary::Key(_, key, value) => {
                let bit = match key {
                    Key::BTN_SOUTH => Some(1 << 0),
                    Key::BTN_EAST => Some(1 << 1),
                    Key::BTN_WEST => Some(1 << 2),
                    Key::BTN_NORTH => Some(1 << 3),
                    Key::BTN_TL => Some(1 << 4),
                    Key::BTN_TR => Some(1 << 5),
                    _ => None,
                };
                if let Some(bit) = bit {
                    if value == 1 {
                        state.sources |= bit;
                    } else if value == 0 {
                        state.sources &= !bit;
                    }
                }
            }
            EventSummary::AbsoluteAxis(_, code, value) => match code {
                Abs::ABS_X => state.x = normalized_axis(ranges, code, value),
                Abs::ABS_Y => state.y = normalized_axis(ranges, code, value),
                Abs::ABS_RX => state.cx = normalized_axis(ranges, code, value),
                Abs::ABS_RY => state.cy = normalized_axis(ranges, code, value),
                Abs::ABS_Z => state.lt = normalized_trigger(ranges, code, value),
                Abs::ABS_RZ => state.rt = normalized_trigger(ranges, code, value),
                _ => {}
            },
            _ => {}
        }
        let after = action_state(*state);
        edge.pressed = after & !before;
        edge.released = before & !after;
        let e = edges.entry(frame).or_default();
        let special_pending = e.pressed & SPECIAL != 0;
        e.pressed |= edge.pressed;
        e.released |= edge.released;
        if edge.pressed & SPECIAL != 0 && !special_pending {
            e.special_x = i16::from(state.x.unsigned_abs() > 7_000) * state.x.signum();
            e.special_y = -i16::from(state.y.unsigned_abs() > 7_000) * state.y.signum();
        }
        if edge.pressed & (LEFT_TRIGGER | RIGHT_TRIGGER) != 0 {
            e.dodge_x = i16::from(state.x.unsigned_abs() > 7_000) * state.x.signum();
            e.dodge_y = -i16::from(state.y.unsigned_abs() > 7_000) * state.y.signum();
        }
        if edge.pressed & MOVE_UP != 0 {
            e.ledge = 1;
        }
        if edge.pressed & MOVE_DOWN != 0 {
            e.ledge = -1;
        }
        let after_x = i16::from(after & MOVE_RIGHT != 0) - i16::from(after & MOVE_LEFT != 0);
        let after_y = i16::from(after & MOVE_UP != 0) - i16::from(after & MOVE_DOWN != 0);
        if (after_x != 0 && after_x != before_x) || (after_y != 0 && after_y != before_y) {
            e.sdi_x = after_x;
            e.sdi_y = after_y;
        }
        for (bit, x, y) in [
            (MOVE_LEFT, -1, 0),
            (MOVE_RIGHT, 1, 0),
            (MOVE_DOWN, 0, -1),
            (MOVE_UP, 0, 1),
            (SMASH_LEFT, -1, 0),
            (SMASH_RIGHT, 1, 0),
            (SMASH_DOWN, 0, -1),
            (SMASH_UP, 0, 1),
        ] {
            if edge.pressed & bit != 0 {
                e.throw_x = (e.throw_x + x).clamp(-127, 127);
                e.throw_y = (e.throw_y + y).clamp(-127, 127);
            }
        }
        snapshots.insert(frame, *state);
        if trace {
            println!(
                "event mono_ns={timestamp} frame={frame} held={after} pressed={} released={}",
                edge.pressed, edge.released
            );
        }
        Ok(())
    }

    fn publish(
        dir: &Path,
        build: &str,
        epoch: u32,
        slot: u32,
        first: u32,
        rows: &[String],
    ) -> io::Result<()> {
        let target = dir.join(format!(
            "smashcraft-journal-{build}-e{epoch}-s{slot}-n{first}.pld"
        ));
        if target.exists() {
            return Err(io::Error::new(
                io::ErrorKind::AlreadyExists,
                format!("immutable journal row already exists: {}", target.display()),
            ));
        }
        let wire = encode_packet(epoch, first, rows);
        let temp = dir.join(format!(
            ".journal-{epoch}-{slot}-{first}-{}.tmp",
            std::process::id()
        ));
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp)?;
        // Warcraft's FileIO executes a preload function and reads the tooltip;
        // a bare packet string is not a loadable preload file.
        writeln!(file, "function PreloadFiles takes nothing returns nothing")?;
        writeln!(file, "call BlzSetAbilityTooltip('$wsl', \"{wire}\", 0)")?;
        writeln!(file, "endfunction")?;
        drop(file);
        fs::hard_link(&temp, &target)?;
        fs::remove_file(temp)?;
        Ok(())
    }

    fn control_path(dir: &Path, build: &str, epoch: u32, slot: u32, sequence: u32) -> PathBuf {
        dir.join(format!(
            "smashcraft-journal-control-{build}-e{epoch}-s{slot}-n{sequence}.txt"
        ))
    }

    fn publish_control_ack(
        dir: &Path,
        build: &str,
        epoch: u32,
        slot: u32,
        sequence: u32,
        state: ControlState,
        frame: u32,
    ) -> io::Result<()> {
        let target = dir.join(format!(
            "smashcraft-journal-ack-{build}-e{epoch}-s{slot}-n{sequence}.pld"
        ));
        if target.exists() {
            return Err(io::Error::new(
                io::ErrorKind::AlreadyExists,
                "journal control acknowledgment already exists",
            ));
        }
        let state = match state {
            ControlState::PausePrepare => "PREPARE",
            ControlState::PauseCommit => "COMMIT",
            ControlState::Paused => "PAUSE",
            ControlState::Resumed => "RESUME",
        };
        let temp = dir.join(format!(
            ".journal-ack-{epoch}-{slot}-{sequence}-{}.tmp",
            std::process::id()
        ));
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp)?;
        writeln!(file, "function PreloadFiles takes nothing returns nothing")?;
        writeln!(
            file,
            "call BlzSetAbilityTooltip('$wsl', \"ACK1|{sequence}|{state}|{frame}\", 0)"
        )?;
        writeln!(file, "endfunction")?;
        drop(file);
        fs::hard_link(&temp, &target)?;
        fs::remove_file(temp)?;
        Ok(())
    }

    fn run() -> Result<(), String> {
        let o = options()?;
        if o.epoch == 0 || o.slot > 3 || o.delay > 64 {
            return Err("epoch must be positive, slot 0..3, delay 0..64".into());
        }
        if o.first_frame == 0 || o.first_frame > LAST_FRAME - o.delay {
            return Err("first-frame must be a valid positive capture-segment frame".into());
        }
        fs::create_dir_all(&o.out).map_err(|e| e.to_string())?;
        let mut device =
            RawDevice::open(&o.device).map_err(|e| format!("open {}: {e}", o.device.display()))?;
        set_monotonic_event_clock(&device)
            .map_err(|e| format!("set EVIOCSCLOCKID(CLOCK_MONOTONIC): {e}"))?;
        set_nonblocking(&device).map_err(|e| format!("set evdev nonblocking mode: {e}"))?;
        eprintln!(
            "source={} name={:?} clock=CLOCK_MONOTONIC epoch_ns={} frame_rule=segment_frame+floor((t-segment_epoch)*60/1e9) first={} delay={} pause_policy=sequenced-map-control",
            o.device.display(),
            device.name(),
            o.epoch_ns,
            o.first_frame,
            o.delay
        );
        if let Some(path) = &o.ready_file {
            eprintln!("readiness_receipt={}", path.display());
        }
        let mut axes = [None; 6];
        for (code, info) in device.get_absinfo().map_err(|e| e.to_string())? {
            if code.0 < axes.len() as u16 {
                axes[code.0 as usize] = Some(info);
            }
        }
        for required in [
            Abs::ABS_X,
            Abs::ABS_Y,
            Abs::ABS_RX,
            Abs::ABS_RY,
            Abs::ABS_Z,
            Abs::ABS_RZ,
        ] {
            if axes.get(required.0 as usize).is_none_or(Option::is_none) {
                return Err(format!(
                    "selected device lacks required Linux Xbox axis {required:?}"
                ));
            }
        }
        let key_state = device.get_key_state().map_err(|e| e.to_string())?;
        if [
            Key::BTN_SOUTH,
            Key::BTN_WEST,
            Key::BTN_EAST,
            Key::BTN_NORTH,
            Key::BTN_TL,
            Key::BTN_TR,
            Key::BTN_START,
        ]
        .iter()
        .any(|k| key_state.contains(*k))
        {
            return Err("release all mapped buttons before starting journal epoch".into());
        }
        let axis_value = |code: Abs| axes[code.0 as usize].map_or(0, |info| info.value());
        let mut state = State {
            x: normalized_axis(&axes, Abs::ABS_X, axis_value(Abs::ABS_X)),
            y: normalized_axis(&axes, Abs::ABS_Y, axis_value(Abs::ABS_Y)),
            cx: normalized_axis(&axes, Abs::ABS_RX, axis_value(Abs::ABS_RX)),
            cy: normalized_axis(&axes, Abs::ABS_RY, axis_value(Abs::ABS_RY)),
            lt: normalized_trigger(&axes, Abs::ABS_Z, axis_value(Abs::ABS_Z)),
            rt: normalized_trigger(&axes, Abs::ABS_RZ, axis_value(Abs::ABS_RZ)),
            ..State::default()
        };
        let mut row_state = state;
        let mut edges = BTreeMap::<u32, Edges>::new();
        let mut snapshots = BTreeMap::<u32, State>::new();
        let mut previous = action_state(state);
        let mut next_frame = o.first_frame + o.delay;
        let mut segment = FrameSegment {
            epoch_ns: o.epoch_ns,
            first_frame: next_frame,
        };
        let mut control_sequence = 1;
        let mut paused = false;
        let mut prepared = false;
        let mut pause_barrier = None::<u32>;
        let mut pending = Vec::<String>::new();
        loop {
            // Only seal intervals completed before this queue drain. Taking
            // the cutoff afterwards races events arriving between read and seal.
            let now = monotonic_ns().map_err(|e| e.to_string())?;
            let events = match device.fetch_events() {
                Ok(events) => events.collect::<Vec<_>>(),
                Err(error) if error.kind() == io::ErrorKind::WouldBlock => Vec::new(),
                Err(error) => return Err(format!("evdev read: {error}")),
            };
            for event in events {
                if !paused {
                    apply_event(
                        &axes,
                        &mut state,
                        event,
                        &mut edges,
                        &mut snapshots,
                        next_frame,
                        segment,
                        o.trace,
                    )?;
                }
            }
            let command_path = control_path(&o.out, &o.build, o.epoch, o.slot, control_sequence);
            let command = match fs::read_to_string(&command_path) {
                Ok(contents) => {
                    let command = parse_control(&contents)?;
                    if command.build != o.build
                        || command.epoch != o.epoch
                        || command.slot != o.slot
                        || command.sequence != control_sequence
                    {
                        return Err(
                            "journal control identity does not match the active session".into()
                        );
                    }
                    Some(command)
                }
                Err(error) if error.kind() == io::ErrorKind::NotFound => None,
                Err(error) => return Err(format!("read journal control command: {error}")),
            };
            let mut pause_after_seal = None;
            if let Some(command) = command {
                if command.state == ControlState::PausePrepare && !paused {
                    pause_after_seal = Some(command);
                } else if command.state == ControlState::PauseCommit && paused && prepared {
                    if command.requested_frame < next_frame {
                        return Err(format!(
                            "pause barrier {} precedes helper frontier {next_frame}",
                            command.requested_frame
                        ));
                    }
                    paused = false;
                    prepared = false;
                    pause_barrier = Some(command.requested_frame);
                    segment = FrameSegment {
                        epoch_ns: now,
                        first_frame: next_frame,
                    };
                    state = State::default();
                    row_state = State::default();
                    previous = 0;
                    edges.clear();
                    snapshots.clear();
                    pending.clear();
                    if o.trace {
                        eprintln!(
                            "control sequence={} state=PAUSE_COMMIT target={} frontier={} epoch_ns={now}",
                            command.sequence, command.requested_frame, next_frame
                        );
                    }
                    control_sequence += 1;
                } else if command.state == ControlState::Resumed && paused && !prepared {
                    if command.requested_frame != next_frame {
                        return Err(format!(
                            "resume requested frame {} does not match paused cursor {next_frame}",
                            command.requested_frame
                        ));
                    }
                    segment = FrameSegment {
                        epoch_ns: now,
                        first_frame: next_frame,
                    };
                    state = State::default();
                    row_state = State::default();
                    previous = 0;
                    edges.clear();
                    snapshots.clear();
                    pending.clear();
                    paused = false;
                    publish_control_ack(
                        &o.out,
                        &o.build,
                        o.epoch,
                        o.slot,
                        command.sequence,
                        command.state,
                        next_frame,
                    )
                    .map_err(|e| e.to_string())?;
                    if o.trace {
                        eprintln!(
                            "control sequence={} state=RESUME frame={} epoch_ns={now}",
                            command.sequence, next_frame
                        );
                    }
                    control_sequence += 1;
                } else if command.state != ControlState::PauseCommit {
                    return Err("journal pause/resume commands are out of order".into());
                }
            }
            if !paused && now >= segment.epoch_ns {
                let mut completed_through = (((now - segment.epoch_ns) * HZ / 1_000_000_000)
                    + u128::from(segment.first_frame)
                    - 1)
                .min(LAST_FRAME as u128) as u32;
                if pause_after_seal.is_some() {
                    if let Some(last_assigned) = edges.keys().chain(snapshots.keys()).max() {
                        completed_through = completed_through.max(*last_assigned);
                    }
                }
                if let Some(barrier) = pause_barrier {
                    completed_through = completed_through.min(barrier - 1);
                }
                while next_frame <= completed_through {
                    if o.stop_frame.is_some_and(|stop| next_frame > stop) {
                        return Ok(());
                    }
                    if let Some(frame_state) = snapshots.remove(&next_frame) {
                        row_state = frame_state;
                    }
                    let edge = edges.remove(&next_frame).unwrap_or_default();
                    let row = encode_row(row_state, previous, edge);
                    previous = action_state(row_state);
                    pending.push(row);
                    if pending.len() == 2 {
                        publish(&o.out, &o.build, o.epoch, o.slot, next_frame - 1, &pending)
                            .map_err(|e| e.to_string())?;
                        pending.clear();
                    }
                    if o.trace {
                        eprintln!("published_frame={next_frame}");
                    }
                    if o.stop_frame == Some(next_frame) {
                        if !pending.is_empty() {
                            publish(&o.out, &o.build, o.epoch, o.slot, next_frame, &pending)
                                .map_err(|e| e.to_string())?;
                        }
                        return Ok(());
                    }
                    next_frame += 1;
                }
                if let Some(command) = pause_after_seal {
                    if !pending.is_empty() {
                        publish(
                            &o.out,
                            &o.build,
                            o.epoch,
                            o.slot,
                            next_frame - pending.len() as u32,
                            &pending,
                        )
                        .map_err(|e| e.to_string())?;
                        pending.clear();
                    }
                    paused = true;
                    prepared = true;
                    publish_control_ack(
                        &o.out,
                        &o.build,
                        o.epoch,
                        o.slot,
                        command.sequence,
                        ControlState::PausePrepare,
                        next_frame,
                    )
                    .map_err(|e| e.to_string())?;
                    if o.trace {
                        eprintln!(
                            "control sequence={} state=PREPARE frame={} epoch_ns={now}",
                            command.sequence, next_frame
                        );
                    }
                    control_sequence += 1;
                }
                if pause_barrier.is_some_and(|barrier| next_frame >= barrier) {
                    let barrier = pause_barrier.take().unwrap();
                    if next_frame != barrier {
                        return Err("pause barrier cursor advanced past its requested frame".into());
                    }
                    if !pending.is_empty() {
                        publish(
                            &o.out,
                            &o.build,
                            o.epoch,
                            o.slot,
                            next_frame - pending.len() as u32,
                            &pending,
                        )
                        .map_err(|e| e.to_string())?;
                        pending.clear();
                    }
                    paused = true;
                    publish_control_ack(
                        &o.out,
                        &o.build,
                        o.epoch,
                        o.slot,
                        control_sequence - 1,
                        ControlState::Paused,
                        barrier,
                    )
                    .map_err(|e| e.to_string())?;
                    if o.trace {
                        eprintln!(
                            "control sequence={} state=PAUSE frame={barrier} epoch_ns={now}",
                            control_sequence - 1
                        );
                    }
                }
            }
            thread::sleep(Duration::from_millis(1));
        }
    }

    pub fn main() {
        if let Err(error) = run() {
            eprintln!("wc3-journal: {error}");
            std::process::exit(1);
        }
    }
}

#[cfg(target_os = "linux")]
fn main() {
    linux::main();
}
