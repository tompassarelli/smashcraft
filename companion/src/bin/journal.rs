#![deny(unsafe_code)]

#[cfg(target_os = "linux")]
#[path = "../focus.rs"]
mod focus;
#[cfg(target_os = "linux")]
#[path = "../wlr.rs"]
mod wlr;

#[cfg(not(target_os = "linux"))]
fn main() {
    eprintln!("wc3-journal requires Linux evdev event timestamps");
    std::process::exit(2);
}

#[cfg(target_os = "linux")]
mod linux {
    #![allow(unsafe_code)]

    use enigo::{Direction, Enigo, Key as OutputKey, Keyboard, Settings};
    use evdev::{AbsoluteAxisCode as Abs, EventSummary, KeyCode as Key, raw_stream::RawDevice};
    use std::{
        collections::{BTreeMap, BTreeSet, VecDeque},
        env,
        fs::{self, OpenOptions},
        io::{self, Write},
        os::fd::AsRawFd,
        path::{Path, PathBuf},
        sync::{
            Arc,
            atomic::{AtomicBool, Ordering},
        },
        thread,
        time::{Duration, Instant, UNIX_EPOCH},
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
        mailbox_display: Option<String>,
        editbox_display: Option<String>,
        trace: bool,
        window: Option<u32>,
        pid: Option<u32>,
        niri_window: Option<u64>,
        wlr_app_id: Option<String>,
    }

    // At most four seconds of ordinary two-frame records, also bounded below
    // the receiver's 4096-byte text capacity when draining a retained backlog.
    const OUTPUT_RECORD_LIMIT: usize = 120;
    const OUTPUT_BYTE_LIMIT: usize = 2048;

    #[derive(Default)]
    struct PendingOutput {
        records: VecDeque<String>,
        bytes: usize,
    }

    impl PendingOutput {
        fn push(&mut self, wire: String) -> io::Result<()> {
            if self.records.len() >= OUTPUT_RECORD_LIMIT
                || self.bytes + wire.len() + 1 > OUTPUT_BYTE_LIMIT
            {
                return Err(io::Error::other(
                    "journal output queue capacity exceeded (120 records / 2048 bytes); no queued record overwritten; helper stopped",
                ));
            }
            self.bytes += wire.len() + 1;
            self.records.push_back(wire);
            Ok(())
        }

        fn emit_front(
            &mut self,
            eligible: bool,
            emit: impl FnOnce(&str) -> io::Result<()>,
        ) -> io::Result<()> {
            if let Some(wire) = self.records.front().filter(|_| eligible) {
                emit(wire)?;
                self.pop();
            }
            Ok(())
        }

        fn pop(&mut self) -> Option<String> {
            let wire = self.records.pop_front()?;
            self.bytes -= wire.len() + 1;
            Some(wire)
        }

        fn is_empty(&self) -> bool {
            self.records.is_empty()
        }
    }

    const MAILBOX_CHUNK_BYTES: usize = 7;
    const MAILBOX_SIGNAL_COUNT: usize = 54;

    struct MailboxSender {
        dir: PathBuf,
        build: String,
        epoch: u32,
        slot: u32,
        output: Enigo,
        owned: BTreeSet<usize>,
        queued: PendingOutput,
        gate: crate::focus::Gate,
        lost_focus: bool,
        current: Option<String>,
        offset: usize,
        next_chunk: u32,
        toggle: bool,
        awaiting_ack: bool,
        trace: bool,
        emitted_at: Option<Instant>,
        editbox: bool,
    }

    impl MailboxSender {
        fn new(
            dir: &Path,
            build: &str,
            epoch: u32,
            slot: u32,
            display: &str,
            trace: bool,
            editbox: bool,
            target: crate::focus::Target,
        ) -> Result<Self, String> {
            let gate = crate::focus::Gate::new(target)?;
            let settings = Settings {
                x11_display: Some(display.to_owned()),
                linux_delay: 0,
                release_keys_when_dropped: false,
                ..Settings::default()
            };
            let output = Enigo::new(&settings).map_err(|error| error.to_string())?;
            Ok(Self {
                dir: dir.to_owned(),
                build: build.to_owned(),
                epoch,
                slot,
                output,
                owned: BTreeSet::new(),
                queued: PendingOutput::default(),
                gate,
                lost_focus: false,
                current: None,
                offset: 0,
                next_chunk: 1,
                toggle: false,
                awaiting_ack: false,
                trace,
                emitted_at: None,
                editbox,
            })
        }

        fn enqueue(&mut self, wire: String) -> io::Result<()> {
            if wire.is_empty() || !wire.bytes().all(|byte| (32..=126).contains(&byte)) {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidInput,
                    "mailbox wire must be printable ASCII",
                ));
            }
            if self.editbox && wire.contains(';') {
                return Err(io::Error::other("controller record contains delimiter"));
            }
            self.queued.push(wire)
        }

        fn eligible(&mut self) -> io::Result<bool> {
            let eligible = self.gate.eligible().map_err(io::Error::other)?;
            self.lost_focus |= !eligible;
            Ok(eligible)
        }

        fn ack_path(&self) -> PathBuf {
            mailbox_ack_path(
                &self.dir,
                &self.build,
                self.epoch,
                self.slot,
                self.next_chunk,
            )
        }

        fn is_idle(&self) -> bool {
            self.queued.is_empty() && self.current.is_none() && !self.awaiting_ack
        }

        fn step(&mut self) -> io::Result<()> {
            if self.editbox {
                if !self.queued.is_empty() {
                    let eligible = self.eligible()?;
                    let output = &mut self.output;
                    let trace = self.trace;
                    self.queued.emit_front(eligible, |wire| {
                        let started = Instant::now();
                        output
                            .text(&(wire.to_owned() + ";"))
                            .map_err(|error| io::Error::other(error.to_string()))?;
                        if trace {
                            eprintln!(
                                "editbox_emit bytes={} elapsed_us={} wire={wire}",
                                wire.len() + 1,
                                started.elapsed().as_micros()
                            );
                        }
                        Ok(())
                    })?;
                }
                return Ok(());
            }
            if self.awaiting_ack {
                if !mailbox_ack_matches(
                    &self.ack_path(),
                    &self.build,
                    self.epoch,
                    self.slot,
                    self.next_chunk,
                )? {
                    return Ok(());
                }
                if self.trace {
                    if let Some(emitted_at) = self.emitted_at.take() {
                        eprintln!(
                            "mailbox_ack chunk={} wait_us={}",
                            self.next_chunk,
                            emitted_at.elapsed().as_micros()
                        );
                    }
                }
                fs::remove_file(self.ack_path())?;
                self.awaiting_ack = false;
                self.next_chunk += 1;
                if self
                    .current
                    .as_ref()
                    .is_some_and(|wire| self.offset >= wire.len())
                {
                    self.current = None;
                    self.offset = 0;
                }
            }
            if self.current.is_none() {
                self.current = self.queued.pop();
                if self.current.is_none() {
                    return Ok(());
                }
            }
            let wire = self.current.as_ref().expect("current mailbox message");
            let bytes = wire.as_bytes();
            let end = (self.offset + MAILBOX_CHUNK_BYTES).min(bytes.len());
            let chunk = bytes[self.offset..end].to_vec();
            let final_chunk = end == bytes.len();
            let signals = mailbox_signal_values(&chunk, final_chunk, !self.toggle)?;
            let started = self.trace.then(Instant::now);
            let transitions = if self.trace {
                (0..MAILBOX_SIGNAL_COUNT)
                    .filter(|signal| self.owned.contains(signal) != signals[*signal])
                    .count()
            } else {
                0
            };

            // Change payload and framing while the old commit toggle remains
            // stable. Flip that key last so the game never samples a partial
            // chunk as committed.
            for signal in 0..MAILBOX_SIGNAL_COUNT - 1 {
                if !self.set_signal(signal, signals[signal])? {
                    return Ok(());
                }
            }
            if !self.set_signal(53, signals[53])? {
                return Ok(());
            }
            self.toggle = !self.toggle;
            self.offset = end;
            self.awaiting_ack = true;
            if let Some(started) = started {
                self.emitted_at = Some(Instant::now());
                eprintln!(
                    "mailbox_emit chunk={} bytes={} transitions={} elapsed_us={}",
                    self.next_chunk,
                    chunk.len(),
                    transitions,
                    started.elapsed().as_micros(),
                );
            }
            Ok(())
        }

        fn set_signal(&mut self, signal: usize, down: bool) -> io::Result<bool> {
            let was_down = self.owned.contains(&signal);
            if was_down == down {
                return Ok(true);
            }
            if !self.eligible()? {
                return Ok(false);
            }
            self.output
                .key(
                    mailbox_output_key(signal),
                    if down {
                        Direction::Press
                    } else {
                        Direction::Release
                    },
                )
                .map_err(|error| io::Error::other(error.to_string()))?;
            if down {
                self.owned.insert(signal);
            } else {
                self.owned.remove(&signal);
            }
            Ok(true)
        }

        fn release_all(&mut self) {
            for signal in self.owned.clone() {
                let _ = self.set_signal(signal, false);
            }
        }
    }

    impl Drop for MailboxSender {
        fn drop(&mut self) {
            self.release_all();
        }
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
        "wc3-journal --device /dev/input/eventN --out DIR --ready-file PATH --epoch-monotonic-ns NS [--mailbox-display :N | --editbox-display :N] [--first-frame N] [--stop-frame N] [--trace]\n\
         Keyboard output also requires --x11-window DECIMAL_ID --pid PID and exactly one of --niri-window ID / --private-wlr-app-id ID.\n\
         Assigns Linux kernel CLOCK_MONOTONIC input_event times to half-open 60 Hz frames. The capture segment starts at the explicit host monotonic epoch; first-frame defaults to 1."
    }

    fn mailbox_ack_path(dir: &Path, build: &str, epoch: u32, slot: u32, chunk: u32) -> PathBuf {
        dir.join(format!(
            "smashcraft-journal-mailbox-ack-{build}-e{epoch}-s{slot}-c{chunk}.txt"
        ))
    }

    fn mailbox_ack_matches(
        path: &Path,
        build: &str,
        epoch: u32,
        slot: u32,
        chunk: u32,
    ) -> io::Result<bool> {
        let contents = match fs::read_to_string(path) {
            Ok(contents) => contents,
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(false),
            Err(error) => return Err(error),
        };
        if contents
            .lines()
            .rev()
            .find(|line| !line.trim().is_empty())
            .map(str::trim)
            != Some("endfunction")
        {
            return Ok(false);
        }
        let fields = contents
            .split_whitespace()
            .filter_map(|token| token.trim_matches('"').split_once('='));
        let fields = fields.collect::<BTreeMap<_, _>>();
        Ok(fields.get("v") == Some(&"1")
            && fields.get("build") == Some(&build)
            && fields
                .get("epoch")
                .and_then(|value| value.parse::<u32>().ok())
                == Some(epoch)
            && fields
                .get("slot")
                .and_then(|value| value.parse::<u32>().ok())
                == Some(slot)
            && fields
                .get("chunk")
                .and_then(|value| value.parse::<u32>().ok())
                == Some(chunk))
    }

    fn mailbox_virtual_key(signal: usize) -> u16 {
        match signal {
            0..=9 => 0x30 + signal as u16,
            10..=33 => 0x41 + (signal - 10) as u16,
            34 => 0x5A,
            35..=45 => [
                0xBD, 0xBB, 0xDB, 0xDD, 0xDC, 0xBA, 0xDE, 0xBC, 0xBE, 0xBF, 0xC0,
            ][signal - 35],
            46..=53 => 0x7C + (signal - 46) as u16,
            _ => unreachable!("mailbox signal is in 0..54"),
        }
    }

    fn mailbox_signal_values(
        chunk: &[u8],
        final_chunk: bool,
        toggle: bool,
    ) -> io::Result<[bool; MAILBOX_SIGNAL_COUNT]> {
        if chunk.is_empty() || chunk.len() > MAILBOX_CHUNK_BYTES {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "invalid keyboard mailbox chunk",
            ));
        }
        let mut signals = [false; MAILBOX_SIGNAL_COUNT];
        for (offset, byte) in chunk.iter().enumerate() {
            if !(32..=126).contains(byte) {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidInput,
                    "keyboard mailbox requires printable ASCII",
                ));
            }
            for bit in 0..7 {
                signals[offset * 7 + bit] = byte & (1 << bit) != 0;
            }
        }
        for bit in 0..3 {
            signals[49 + bit] = chunk.len() & (1 << bit) != 0;
        }
        signals[52] = final_chunk;
        signals[53] = toggle;
        Ok(signals)
    }

    fn mailbox_output_key(signal: usize) -> OutputKey {
        match mailbox_virtual_key(signal) {
            vk @ 0x30..=0x39 => OutputKey::Unicode(char::from(vk as u8)),
            vk @ 0x41..=0x5A => OutputKey::Unicode(char::from(vk as u8 + 32)),
            0xBD => OutputKey::Unicode('-'),
            0xBB => OutputKey::Unicode('='),
            0xDB => OutputKey::Unicode('['),
            0xDD => OutputKey::Unicode(']'),
            0xDC => OutputKey::Unicode('\\'),
            0xBA => OutputKey::Unicode(';'),
            0xDE => OutputKey::Unicode('\''),
            0xBC => OutputKey::Unicode(','),
            0xBE => OutputKey::Unicode('.'),
            0xBF => OutputKey::Unicode('/'),
            0xC0 => OutputKey::Unicode('`'),
            0x7C => OutputKey::F13,
            0x7D => OutputKey::F14,
            0x7E => OutputKey::F15,
            0x7F => OutputKey::F16,
            0x80 => OutputKey::F17,
            0x81 => OutputKey::F18,
            0x82 => OutputKey::F19,
            0x83 => OutputKey::F20,
            _ => unreachable!("mailbox key mapping is complete"),
        }
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
            mailbox_display: values.get("--mailbox-display").cloned(),
            editbox_display: values.get("--editbox-display").cloned(),
            trace,
            window: values
                .get("--x11-window")
                .map(|s| s.parse().map_err(|_| "invalid --x11-window"))
                .transpose()?,
            pid: values
                .get("--pid")
                .map(|s| s.parse().map_err(|_| "invalid --pid"))
                .transpose()?,
            niri_window: values
                .get("--niri-window")
                .map(|s| s.parse().map_err(|_| "invalid --niri-window"))
                .transpose()?,
            wlr_app_id: values.get("--private-wlr-app-id").cloned(),
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

    fn control_if_complete(contents: &str) -> Result<Option<ControlCommand>, String> {
        // PreloadGenEnd creates the file before finishing its contents. The
        // generated function's closing line is the publication boundary.
        if contents
            .lines()
            .rev()
            .find(|line| !line.trim().is_empty())
            .map(str::trim)
            != Some("endfunction")
        {
            return Ok(None);
        }
        parse_control(contents).map(Some)
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
    fn control_reader_waits_for_the_native_writer_to_finish() {
        let command = "function PreloadFiles takes nothing returns nothing\ncall Preload( \"SMASHCRAFT JOURNAL CONTROL v=1 build=playable epoch=7 slot=2 sequence=3 state=PAUSE frame=91\" )\nendfunction\n";
        for length in 0..command.find("endfunction").unwrap() + "endfunction".len() {
            assert_eq!(control_if_complete(&command[..length]).unwrap(), None);
        }
        assert_eq!(
            control_if_complete(command).unwrap(),
            Some(parse_control(command).unwrap())
        );
        assert!(control_if_complete(&command.replace("v=1", "v=2")).is_err());
    }

    #[test]
    fn keyboard_mailbox_preserves_ascii_chunks_and_uses_nonconflicting_vks() {
        let mut codes = BTreeSet::new();
        for signal in 0..MAILBOX_SIGNAL_COUNT {
            let vk = mailbox_virtual_key(signal);
            assert!(codes.insert(vk), "duplicate carrier VK {vk:#x}");
            assert!(
                ![
                    0x1B, 0x09, 0x0D, 0x59, 0x70, 0x74, 0x79, 0x10, 0x11, 0x12, 0x5B, 0x5C
                ]
                .contains(&vk)
            );
        }
        for message in ["I40001a", "ACK1|4|P", "ACK1|4|PREPARE|19"] {
            for (index, chunk) in message.as_bytes().chunks(MAILBOX_CHUNK_BYTES).enumerate() {
                let final_chunk = (index + 1) * MAILBOX_CHUNK_BYTES >= message.len();
                let values = mailbox_signal_values(chunk, final_chunk, index % 2 == 0).unwrap();
                let decoded_length = (0..3)
                    .map(|bit| usize::from(values[49 + bit]) << bit)
                    .sum::<usize>();
                assert_eq!(decoded_length, chunk.len());
                let decoded = (0..decoded_length)
                    .map(|offset| {
                        let byte = (0..7)
                            .map(|bit| u8::from(values[offset * 7 + bit]) << bit)
                            .sum::<u8>();
                        char::from(byte)
                    })
                    .collect::<String>();
                assert_eq!(decoded.as_bytes(), chunk);
                assert_eq!(values[52], final_chunk);
                assert_eq!(values[53], index % 2 == 0);
            }
        }
    }

    #[test]
    fn keyboard_mailbox_ack_requires_complete_matching_identity() {
        let dir = std::env::temp_dir().join(format!("mailbox-ack-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let path = mailbox_ack_path(&dir, "test", 7, 2, 9);
        fs::write(&path, "function PreloadFiles takes nothing returns nothing\ncall Preload( \"SMASHCRAFT KEYBOARD ACK v=1 build=test epoch=7 slot=2 chunk=9\" )\n").unwrap();
        assert!(!mailbox_ack_matches(&path, "test", 7, 2, 9).unwrap());
        fs::write(&path, "function PreloadFiles takes nothing returns nothing\ncall Preload( \"SMASHCRAFT KEYBOARD ACK v=1 build=test epoch=7 slot=2 chunk=9\" )\nendfunction\n").unwrap();
        assert!(mailbox_ack_matches(&path, "test", 7, 2, 9).unwrap());
        assert!(!mailbox_ack_matches(&path, "test", 7, 2, 10).unwrap());
        fs::remove_dir_all(dir).unwrap();
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

    fn pause_request_wire(
        event: &evdev::InputEvent,
        start_held: &mut bool,
        epoch: u32,
        sequence: u32,
        paused: bool,
        pending: bool,
    ) -> Option<String> {
        let EventSummary::Key(_, Key::BTN_START, value) = event.destructure() else {
            return None;
        };
        let pressed = value == 1 && !*start_held;
        if value != 2 {
            *start_held = value != 0;
        }
        if !pressed || pending {
            return None;
        }
        Some(format!(
            "JP1{epoch:010}{sequence:010}{}",
            if paused { 'R' } else { 'P' }
        ))
    }

    #[test]
    fn controller_start_requests_pause_and_resume_once_per_press() {
        let down = evdev::InputEvent::new(evdev::EventType::KEY.0, Key::BTN_START.0, 1);
        let repeat = evdev::InputEvent::new(evdev::EventType::KEY.0, Key::BTN_START.0, 2);
        let up = evdev::InputEvent::new(evdev::EventType::KEY.0, Key::BTN_START.0, 0);
        let mut held = false;
        assert_eq!(
            pause_request_wire(&down, &mut held, 7, 1, false, false).as_deref(),
            Some("JP100000000070000000001P")
        );
        assert_eq!(
            pause_request_wire(&repeat, &mut held, 7, 1, false, false),
            None
        );
        assert_eq!(
            pause_request_wire(&down, &mut held, 7, 3, true, false),
            None
        );
        assert_eq!(pause_request_wire(&up, &mut held, 7, 3, true, false), None);
        assert_eq!(
            pause_request_wire(&down, &mut held, 7, 3, true, false).as_deref(),
            Some("JP100000000070000000003R")
        );
        pause_request_wire(&up, &mut held, 7, 3, true, true);
        assert_eq!(pause_request_wire(&down, &mut held, 7, 3, true, true), None);
        assert_eq!(
            pause_request_wire(&down, &mut held, 7, 3, true, false),
            None
        );
    }

    fn update_state(
        ranges: &[Option<evdev::AbsInfo>; 6],
        state: &mut State,
        event: evdev::InputEvent,
    ) {
        let summary = event.destructure();
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
    }

    struct FocusInput {
        eligible: bool,
        armed: bool,
        gameplay_armed: bool,
        physical: State,
        accept_since_ns: u128,
    }

    impl FocusInput {
        fn observe(&mut self, eligible: bool, lost: bool, now: u128) -> bool {
            let disarm = lost || !eligible;
            let release = disarm && self.armed;
            if disarm || self.eligible != eligible {
                self.armed = false;
                self.gameplay_armed = false;
                self.accept_since_ns = self.accept_since_ns.max(now);
            }
            self.eligible = eligible;
            release
        }

        fn accepts(
            &mut self,
            ranges: &[Option<evdev::AbsInfo>; 6],
            event: evdev::InputEvent,
            start_held: bool,
            gameplay: bool,
        ) -> Result<bool, String> {
            if matches!(
                event.destructure(),
                EventSummary::Synchronization(_, evdev::SynchronizationCode::SYN_DROPPED, _)
            ) {
                return Err("kernel reported SYN_DROPPED; lost original input edges cannot be reconstructed".into());
            }
            update_state(ranges, &mut self.physical, event);
            let current = event_ns(&event)? >= self.accept_since_ns;
            if !self.eligible {
                self.armed = false;
                self.gameplay_armed = false;
                return Ok(false);
            }
            if !self.armed {
                self.armed = current && action_state(self.physical) == 0 && !start_held;
                self.gameplay_armed = self.armed && gameplay;
                return Ok(false);
            }
            if !gameplay {
                self.gameplay_armed = false;
                return Ok(false);
            }
            if !self.gameplay_armed {
                self.gameplay_armed = current && action_state(self.physical) == 0 && !start_held;
                return Ok(false);
            }
            Ok(current)
        }

        fn rearm(&mut self, now: u128, start_held: bool, gameplay: bool) {
            if !gameplay {
                self.gameplay_armed = false;
            }
            if now >= self.accept_since_ns
                && self.eligible
                && (!self.armed || (gameplay && !self.gameplay_armed))
                && action_state(self.physical) == 0
                && !start_held
            {
                self.armed = true;
                self.gameplay_armed = gameplay;
                self.accept_since_ns = self.accept_since_ns.max(now);
            }
        }
    }

    #[test]
    fn focus_loss_retains_assigned_rows_and_releases_after_the_open_frame() {
        let mut state = State {
            sources: 1,
            ..State::default()
        };
        let mut edges = BTreeMap::from([(
            2,
            Edges {
                pressed: ATTACK,
                ..Edges::default()
            },
        )]);
        let mut snapshots = BTreeMap::from([(2, state)]);
        let segment = FrameSegment {
            epoch_ns: 0,
            first_frame: 1,
        };
        let frame = release_for_focus_loss(
            &mut state,
            &mut edges,
            &mut snapshots,
            2,
            segment,
            20_000_000,
        )
        .unwrap();
        assert_eq!(frame, 3);
        assert_eq!(edges[&2].pressed, ATTACK);
        assert_eq!(snapshots[&2].sources, 1);
        assert_eq!(edges[&3].released, ATTACK);
        assert_eq!(snapshots[&3], State::default());
        assert_eq!(state, State::default());
        assert_eq!(frame_at(100_000_000, segment).unwrap(), 7);
    }

    #[test]
    fn focus_queue_preserves_order_suppresses_output_and_fails_without_overwrite() {
        let mut queue = PendingOutput::default();
        let first = encode_packet(
            7,
            17,
            &[encode_row(
                State {
                    sources: 1,
                    ..State::default()
                },
                0,
                Edges::default(),
            )],
        );
        queue.push(first.clone()).unwrap();
        queue.push("ACK1|2|P|18".into()).unwrap();
        queue
            .emit_front(false, |_| panic!("unfocused keyboard emission"))
            .unwrap();
        assert_eq!(queue.records.len(), 2);
        assert!(
            queue
                .emit_front(true, |_| Err(io::Error::other("output failed")))
                .is_err()
        );
        assert_eq!(queue.records.front(), Some(&first));
        let mut emitted = Vec::new();
        queue
            .emit_front(true, |wire| {
                emitted.push(wire.to_owned());
                Ok(())
            })
            .unwrap();
        queue
            .emit_front(true, |wire| {
                emitted.push(wire.to_owned());
                Ok(())
            })
            .unwrap();
        assert_eq!(emitted, [first, "ACK1|2|P|18".into()]);
        assert!(queue.is_empty());
        assert_eq!(queue.bytes, 0);
        for _ in 0..OUTPUT_RECORD_LIMIT {
            queue.push("0".into()).unwrap();
        }
        assert!(queue.push("extra".into()).is_err());
        assert_eq!(queue.records.len(), OUTPUT_RECORD_LIMIT);
        let mut bytes = PendingOutput::default();
        bytes.push("a".repeat(OUTPUT_BYTE_LIMIT - 1)).unwrap();
        assert!(bytes.push("b".into()).is_err());
        assert_eq!(bytes.bytes, OUTPUT_BYTE_LIMIT);
    }

    #[test]
    fn focus_return_requires_neutral_and_preserves_start_during_pause() {
        let ranges = [None; 6];
        let down = evdev::InputEvent::new(evdev::EventType::KEY.0, Key::BTN_SOUTH.0, 1);
        let up = evdev::InputEvent::new(evdev::EventType::KEY.0, Key::BTN_SOUTH.0, 0);
        let mut input = FocusInput {
            eligible: true,
            armed: true,
            gameplay_armed: true,
            physical: State::default(),
            accept_since_ns: 0,
        };
        assert!(input.accepts(&ranges, down, false, true).unwrap());
        assert!(input.observe(false, true, 0));
        assert!(!input.accepts(&ranges, up, false, true).unwrap());
        assert!(!input.accepts(&ranges, down, false, true).unwrap());
        input.observe(true, false, 0);
        input.rearm(0, false, true);
        assert!(!input.armed);
        assert!(!input.accepts(&ranges, up, false, true).unwrap());
        assert!(input.armed);
        assert!(input.accepts(&ranges, down, false, true).unwrap());
        // Paused gameplay disarms independently of the focus-qualified Start control.
        assert!(!input.accepts(&ranges, down, false, false).unwrap());
        assert!(input.armed);
        assert!(!input.gameplay_armed);
        input.gameplay_armed = true;
        input.rearm(0, false, false);
        assert!(!input.gameplay_armed);
        let start = evdev::InputEvent::new(evdev::EventType::KEY.0, Key::BTN_START.0, 1);
        assert!(pause_request_wire(&start, &mut false, 7, 3, true, !input.armed).is_some());
        assert!(!input.accepts(&ranges, down, false, true).unwrap());
        assert!(!input.accepts(&ranges, up, false, true).unwrap());
        assert!(input.accepts(&ranges, down, false, true).unwrap());
        input.observe(false, true, 1);
        input.observe(true, false, 2);
        // A recovered queue item older than the focus boundary cannot rearm.
        assert!(!input.accepts(&ranges, up, false, true).unwrap());
        assert!(!input.armed);
        input.rearm(2, false, true);
        assert!(input.armed);
        assert!(!input.accepts(&ranges, down, false, true).unwrap());
    }

    fn release_for_focus_loss(
        state: &mut State,
        edges: &mut BTreeMap<u32, Edges>,
        snapshots: &mut BTreeMap<u32, State>,
        next_frame: u32,
        segment: FrameSegment,
        now: u128,
    ) -> Result<u32, String> {
        // Already assigned rows remain immutable, including the open frame.
        let after_assigned = edges
            .keys()
            .chain(snapshots.keys())
            .max()
            .copied()
            .map_or(next_frame, |frame| frame.saturating_add(1));
        let frame = frame_at(now.max(segment.epoch_ns), segment)?
            .max(next_frame)
            .max(after_assigned);
        if frame > LAST_FRAME {
            return Err("focus release exceeds supported frame range".into());
        }
        edges.entry(frame).or_default().released |= action_state(*state);
        *state = State::default();
        snapshots.insert(frame, *state);
        Ok(frame)
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
        update_state(ranges, state, event);
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
        let base = dir.join(format!(
            "smashcraft-journal-{build}-e{epoch}-s{slot}-n{first}"
        ));
        publish_vocabulary(&base, &encode_packet(epoch, first, rows))
    }

    fn submit_packet(
        dir: &Path,
        build: &str,
        epoch: u32,
        slot: u32,
        first: u32,
        rows: &[String],
        mailbox: &mut Option<MailboxSender>,
    ) -> io::Result<()> {
        if let Some(mailbox) = mailbox.as_mut() {
            mailbox.enqueue(encode_packet(epoch, first, rows))
        } else {
            publish(dir, build, epoch, slot, first, rows)
        }
    }

    fn vocabulary_path(base: &Path, suffix: &str) -> PathBuf {
        let mut path = base.as_os_str().to_os_string();
        path.push(suffix);
        path.into()
    }

    fn publish_symbol(target: &Path, symbol: u8) -> io::Result<()> {
        let temp = vocabulary_path(target, &format!(".{}.tmp", std::process::id()));
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp)?;
        let result = (|| {
            writeln!(file, "function PreloadFiles takes nothing returns nothing")?;
            writeln!(
                file,
                "call BlzSetAbilityTooltip('$wsl', \"{}\", 0)",
                char::from(symbol)
            )?;
            writeln!(file, "endfunction")?;
            drop(file);
            // A hard link publishes complete bytes without replacing a peer or
            // previously published immutable symbol, including after a restart.
            fs::hard_link(&temp, target)
        })();
        let cleanup = fs::remove_file(temp);
        result.and(cleanup)
    }

    fn publish_vocabulary(base: &Path, wire: &str) -> io::Result<()> {
        // The marker is an alphabet index. '|' is the sole additional fixed
        // script needed by the existing ACK1 control wire.
        if wire.is_empty()
            || wire.len() >= ALPHABET.len()
            || !wire
                .bytes()
                .all(|symbol| ALPHABET.contains(&symbol) || symbol == b'|')
        {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "invalid vocabulary payload",
            ));
        }
        let marker = vocabulary_path(base, "-length.pld");
        if marker.exists() {
            return Err(io::Error::new(
                io::ErrorKind::AlreadyExists,
                "immutable journal packet already exists",
            ));
        }
        for (offset, symbol) in wire.bytes().enumerate() {
            publish_symbol(&vocabulary_path(base, &format!("-c{offset}.pld")), symbol)?;
        }
        // Readers do not inspect symbols until this final publication succeeds.
        publish_symbol(&marker, ALPHABET[wire.len()])
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
        let base = dir.join(format!(
            "smashcraft-journal-ack-{build}-e{epoch}-s{slot}-n{sequence}"
        ));
        let state = match state {
            ControlState::PausePrepare => "PREPARE",
            ControlState::PauseCommit => "COMMIT",
            ControlState::Paused => "PAUSE",
            ControlState::Resumed => "RESUME",
        };
        publish_vocabulary(&base, &format!("ACK1|{sequence}|{state}|{frame}"))
    }

    fn submit_control_ack(
        dir: &Path,
        build: &str,
        epoch: u32,
        slot: u32,
        sequence: u32,
        state: ControlState,
        frame: u32,
        mailbox: &mut Option<MailboxSender>,
    ) -> io::Result<()> {
        if let Some(mailbox) = mailbox.as_mut() {
            let state = match state {
                ControlState::PausePrepare => "PREPARE",
                ControlState::PauseCommit => "COMMIT",
                ControlState::Paused => "PAUSE",
                ControlState::Resumed => "RESUME",
            };
            mailbox.enqueue(format!("ACK1|{sequence}|{state}|{frame}"))
        } else {
            publish_control_ack(dir, build, epoch, slot, sequence, state, frame)
        }
    }

    #[test]
    fn vocabulary_publication_preserves_packets_acks_and_immutable_commit_boundary() {
        let dir = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("target")
            .join(format!("journal-vocabulary-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let read_symbol = |path: PathBuf| {
            let script = fs::read_to_string(path).unwrap();
            let symbol = script.strip_prefix("function PreloadFiles takes nothing returns nothing\ncall BlzSetAbilityTooltip('$wsl', \"")
                .unwrap().strip_suffix("\", 0)\nendfunction\n").unwrap();
            assert_eq!(symbol.len(), 1);
            symbol.as_bytes()[0]
        };
        let read_wire = |base: &Path| {
            let marker = read_symbol(vocabulary_path(base, "-length.pld"));
            let length = ALPHABET
                .iter()
                .position(|symbol| *symbol == marker)
                .unwrap();
            (0..length)
                .map(|offset| {
                    char::from(read_symbol(vocabulary_path(
                        base,
                        &format!("-c{offset}.pld"),
                    )))
                })
                .collect::<String>()
        };
        let press = encode_row(
            State {
                sources: 1,
                ..State::default()
            },
            0,
            Edges::default(),
        );
        let release = encode_row(State::default(), ATTACK, Edges::default());
        let rows = [press, release];
        // The filename and I4 header both retain frame 4 (including delay).
        publish(&dir, "vocabulary", 91, 2, 4, &rows).unwrap();
        let base = dir.join("smashcraft-journal-vocabulary-e91-s2-n4");
        let wire = encode_packet(91, 4, &rows);
        assert_eq!(read_wire(&base), wire);
        assert_eq!(
            publish(&dir, "vocabulary", 91, 2, 4, &["0".into()])
                .unwrap_err()
                .kind(),
            io::ErrorKind::AlreadyExists
        );
        assert_eq!(read_wire(&base), wire);
        for (sequence, state, expected) in [
            (1, ControlState::PausePrepare, "ACK1|1|PREPARE|6"),
            (2, ControlState::Paused, "ACK1|2|PAUSE|6"),
            (3, ControlState::Resumed, "ACK1|3|RESUME|6"),
        ] {
            publish_control_ack(&dir, "vocabulary", 91, 2, sequence, state, 6).unwrap();
            assert_eq!(
                read_wire(&dir.join(format!(
                    "smashcraft-journal-ack-vocabulary-e91-s2-n{sequence}"
                ))),
                expected
            );
        }
        // A collision halfway through must never expose a committed packet.
        let partial = dir.join("partial");
        let collision = vocabulary_path(&partial, "-c1.pld");
        publish_symbol(&collision, b'Z').unwrap();
        assert_eq!(
            publish_vocabulary(&partial, "I412300").unwrap_err().kind(),
            io::ErrorKind::AlreadyExists
        );
        assert!(!vocabulary_path(&partial, "-length.pld").exists());
        assert_eq!(read_symbol(collision), b'Z');
        let invalid = dir.join("invalid");
        assert_eq!(
            publish_vocabulary(&invalid, "unsafe\"").unwrap_err().kind(),
            io::ErrorKind::InvalidInput
        );
        assert!(!vocabulary_path(&invalid, "-c0.pld").exists());
        for entry in fs::read_dir(&dir).unwrap() {
            let path = entry.unwrap().path();
            assert_eq!(path.extension().unwrap(), "pld");
            let symbol = read_symbol(path.clone());
            assert!(ALPHABET.contains(&symbol) || symbol == b'|');
            fs::remove_file(path).unwrap();
        }
        fs::remove_dir(dir).unwrap();
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
        if o.mailbox_display.is_some() && o.editbox_display.is_some() {
            return Err("select only one keyboard ingress".into());
        }
        let mut mailbox = o
            .editbox_display
            .as_ref()
            .or(o.mailbox_display.as_ref())
            .as_deref()
            .map(|display| {
                MailboxSender::new(
                    &o.out,
                    &o.build,
                    o.epoch,
                    o.slot,
                    display,
                    o.trace,
                    o.editbox_display.is_some(),
                    crate::focus::Target {
                        display: display.clone(),
                        window: o.window.ok_or("keyboard output requires --x11-window")?,
                        pid: o.pid.ok_or("keyboard output requires --pid")?,
                        niri_window: o.niri_window,
                        wlr_app_id: o.wlr_app_id.clone(),
                    },
                )
            })
            .transpose()?;
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
        let physical = state;
        state = State::default();
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
        let mut start_held = false;
        let mut focus_input = FocusInput {
            eligible: true,
            armed: action_state(physical) == 0,
            gameplay_armed: action_state(physical) == 0,
            physical,
            accept_since_ns: o.epoch_ns,
        };
        let mut paused = false;
        let mut prepared = false;
        let mut stop_capture = false;
        let mut pause_barrier = None::<u32>;
        let mut pending = Vec::<String>::new();
        let running = Arc::new(AtomicBool::new(true));
        let signal_running = Arc::clone(&running);
        ctrlc::set_handler(move || signal_running.store(false, Ordering::Relaxed))
            .map_err(|error| format!("install interrupt handler: {error}"))?;
        loop {
            if !running.load(Ordering::Relaxed) {
                if o.trace {
                    eprintln!("shutdown signal=SIGINT mailbox_release=begin");
                }
                return Ok(());
            }
            // Only seal intervals completed before this queue drain. Taking
            // the cutoff afterwards races events arriving between read and seal.
            let now = monotonic_ns().map_err(|e| e.to_string())?;
            let before_armed = (focus_input.armed, focus_input.gameplay_armed);
            let eligible = mailbox
                .as_mut()
                .map(MailboxSender::eligible)
                .transpose()
                .map_err(|error| format!("journal focus: {error}"))?
                .unwrap_or(true);
            let lost = mailbox
                .as_mut()
                .is_some_and(|sender| std::mem::take(&mut sender.lost_focus));
            let focus_now = monotonic_ns().map_err(|e| e.to_string())?;
            let changed = focus_input.eligible != eligible;
            if focus_input.observe(eligible, lost, focus_now) && !paused && !stop_capture {
                let frame = release_for_focus_loss(
                    &mut state,
                    &mut edges,
                    &mut snapshots,
                    next_frame,
                    segment,
                    focus_now,
                )?;
                focus_input.accept_since_ns = focus_input.accept_since_ns.max(
                    segment.epoch_ns
                        + (u128::from(frame - segment.first_frame) * 1_000_000_000).div_ceil(HZ),
                );
                eprintln!("focus_release mono_ns={focus_now} frame={frame}");
            }
            if changed {
                eprintln!("game-eligible={eligible} mono_ns={now} neutral_rearm=required");
            }
            let events = match device.fetch_events() {
                Ok(events) => events.collect::<Vec<_>>(),
                Err(error) if error.kind() == io::ErrorKind::WouldBlock => Vec::new(),
                Err(error) => return Err(format!("evdev read: {error}")),
            };
            for event in events {
                let was_armed = focus_input.armed;
                if o.editbox_display.is_some() {
                    if let Some(wire) = pause_request_wire(
                        &event,
                        &mut start_held,
                        o.epoch,
                        control_sequence,
                        paused,
                        prepared
                            || pause_barrier.is_some()
                            || stop_capture
                            || !eligible
                            || !was_armed,
                    ) {
                        mailbox
                            .as_mut()
                            .expect("editbox sender")
                            .enqueue(wire)
                            .map_err(|error| format!("controller pause request: {error}"))?;
                    }
                }
                let accepts =
                    focus_input.accepts(&axes, event, start_held, !paused && !stop_capture)?;
                if accepts {
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
                } else if o.trace
                    && matches!(
                        event.destructure(),
                        EventSummary::Key(..) | EventSummary::AbsoluteAxis(..)
                    )
                {
                    eprintln!(
                        "suppressed mono_ns={} reason=focus-pause-or-neutral",
                        event_ns(&event)?
                    );
                }
            }
            focus_input.rearm(focus_now, start_held, !paused && !stop_capture);
            if before_armed != (focus_input.armed, focus_input.gameplay_armed) {
                eprintln!(
                    "input_armed={} gameplay_armed={} mono_ns={focus_now}",
                    focus_input.armed, focus_input.gameplay_armed
                );
            }
            let command_path = control_path(&o.out, &o.build, o.epoch, o.slot, control_sequence);
            let command = match fs::read_to_string(&command_path) {
                Ok(contents) => {
                    let command = control_if_complete(&contents)?;
                    if let Some(command) = command.as_ref() {
                        if command.build != o.build
                            || command.epoch != o.epoch
                            || command.slot != o.slot
                            || command.sequence != control_sequence
                        {
                            return Err(
                                "journal control identity does not match the active session".into(),
                            );
                        }
                    }
                    command
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
                    submit_control_ack(
                        &o.out,
                        &o.build,
                        o.epoch,
                        o.slot,
                        command.sequence,
                        command.state,
                        next_frame,
                        &mut mailbox,
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
            if !paused && !stop_capture && now >= segment.epoch_ns {
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
                        stop_capture = true;
                        break;
                    }
                    if let Some(frame_state) = snapshots.remove(&next_frame) {
                        row_state = frame_state;
                    }
                    let edge = edges.remove(&next_frame).unwrap_or_default();
                    let row = encode_row(row_state, previous, edge);
                    previous = action_state(row_state);
                    pending.push(row);
                    if pending.len() == 2 {
                        submit_packet(
                            &o.out,
                            &o.build,
                            o.epoch,
                            o.slot,
                            next_frame - 1,
                            &pending,
                            &mut mailbox,
                        )
                        .map_err(|e| e.to_string())?;
                        pending.clear();
                    }
                    if o.trace {
                        eprintln!("published_frame={next_frame}");
                    }
                    if o.stop_frame == Some(next_frame) {
                        if !pending.is_empty() {
                            submit_packet(
                                &o.out,
                                &o.build,
                                o.epoch,
                                o.slot,
                                next_frame,
                                &pending,
                                &mut mailbox,
                            )
                            .map_err(|e| e.to_string())?;
                            pending.clear();
                        }
                        stop_capture = true;
                        break;
                    }
                    next_frame += 1;
                }
                if let Some(command) = pause_after_seal {
                    if !pending.is_empty() {
                        submit_packet(
                            &o.out,
                            &o.build,
                            o.epoch,
                            o.slot,
                            next_frame - pending.len() as u32,
                            &pending,
                            &mut mailbox,
                        )
                        .map_err(|e| e.to_string())?;
                        pending.clear();
                    }
                    paused = true;
                    prepared = true;
                    submit_control_ack(
                        &o.out,
                        &o.build,
                        o.epoch,
                        o.slot,
                        command.sequence,
                        ControlState::PausePrepare,
                        next_frame,
                        &mut mailbox,
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
                        submit_packet(
                            &o.out,
                            &o.build,
                            o.epoch,
                            o.slot,
                            next_frame - pending.len() as u32,
                            &pending,
                            &mut mailbox,
                        )
                        .map_err(|e| e.to_string())?;
                        pending.clear();
                    }
                    paused = true;
                    submit_control_ack(
                        &o.out,
                        &o.build,
                        o.epoch,
                        o.slot,
                        control_sequence - 1,
                        ControlState::Paused,
                        barrier,
                        &mut mailbox,
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
            if let Some(mailbox) = mailbox.as_mut() {
                mailbox
                    .step()
                    .map_err(|error| format!("keyboard mailbox output: {error}"))?;
            }
            if stop_capture && mailbox.as_ref().is_none_or(MailboxSender::is_idle) {
                return Ok(());
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
