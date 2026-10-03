#![forbid(unsafe_code)]
mod focus;
#[cfg(target_os = "linux")]
mod wlr;

use sdl3::{
    event::Event,
    gamepad::{Axis, Button, Gamepad},
    joystick::JoystickId,
};
use std::{
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    time::{Duration, Instant},
};
use wc3_controller::{
    Mapper, Sample,
    output::{KeyboardOutput, Output},
};

#[derive(Default)]
struct Options {
    seconds: Option<u64>,
    gamepad: Option<u32>,
    emit: bool,
    display: Option<String>,
    window: Option<u32>,
    pid: Option<u32>,
    niri_window: Option<u64>,
    wlr_app_id: Option<String>,
    check_focus: bool,
}

fn options() -> Result<Options, String> {
    let mut o = Options::default();
    let mut args = std::env::args().skip(1);
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--help" | "-h" => {
                println!(
                    "wc3-controller [--list] [--watch-seconds N] [--gamepad ID]\n\
                    Observation only by default. Live output additionally requires:\n\
                    --emit --display DISPLAY --x11-window DECIMAL_ID --pid PID --niri-window ID\n\
                    Or --private-wlr-app-id ID in the isolated labwc test desktop instead of --niri-window.\n\
                    --check-focus checks selected target without opening keyboard output. Windows/macOS refuse live output."
                );
                std::process::exit(0);
            }
            "--list" => {}
            "--emit" => o.emit = true,
            "--check-focus" => o.check_focus = true,
            "--private-wlr-app-id" => {
                o.wlr_app_id = Some(args.next().ok_or("missing private compositor app ID")?)
            }
            "--watch-seconds" => {
                o.seconds = Some(
                    args.next()
                        .ok_or("missing seconds")?
                        .parse()
                        .map_err(|_| "invalid seconds")?,
                )
            }
            "--gamepad" => {
                o.gamepad = Some(
                    args.next()
                        .ok_or("missing gamepad ID")?
                        .parse()
                        .map_err(|_| "invalid gamepad ID")?,
                )
            }
            "--display" => o.display = Some(args.next().ok_or("missing display")?),
            "--x11-window" => {
                o.window = Some(
                    args.next()
                        .ok_or("missing X11 window")?
                        .parse()
                        .map_err(|_| "invalid decimal X11 window")?,
                )
            }
            "--pid" => {
                o.pid = Some(
                    args.next()
                        .ok_or("missing PID")?
                        .parse()
                        .map_err(|_| "invalid PID")?,
                )
            }
            "--niri-window" => {
                o.niri_window = Some(
                    args.next()
                        .ok_or("missing Niri window")?
                        .parse()
                        .map_err(|_| "invalid Niri window")?,
                )
            }
            _ => return Err(format!("unknown argument: {arg}")),
        }
    }
    if o.emit && o.seconds.is_none() {
        return Err("--emit requires a bounded --watch-seconds duration".into());
    }
    Ok(o)
}

fn sample(pad: &Gamepad) -> Sample {
    Sample {
        left_x: pad.axis(Axis::LeftX),
        left_y: pad.axis(Axis::LeftY),
        right_x: pad.axis(Axis::RightX),
        right_y: pad.axis(Axis::RightY),
        left_trigger: pad.axis(Axis::TriggerLeft),
        right_trigger: pad.axis(Axis::TriggerRight),
        a: pad.button(Button::South),
        b: pad.button(Button::East),
        x: pad.button(Button::West),
        y: pad.button(Button::North),
        lb: pad.button(Button::LeftShoulder),
        rb: pad.button(Button::RightShoulder),
        start: pad.button(Button::Start),
    }
}

fn run() -> Result<(), String> {
    let o = options()?;
    #[cfg(target_os = "linux")]
    let mut gate = if o.emit || o.check_focus {
        Some(focus::Gate::new(focus::Target {
            display: o.display.clone().ok_or("--emit requires --display")?,
            window: o.window.ok_or("--emit requires --x11-window")?,
            pid: o.pid.ok_or("--emit requires --pid")?,
            niri_window: o.niri_window,
            wlr_app_id: o.wlr_app_id,
        })?)
    } else {
        None
    };
    #[cfg(not(target_os = "linux"))]
    if o.emit || o.check_focus {
        return Err("live output is unavailable until native foreground game identity is implemented on this OS".into());
    }

    #[cfg(target_os = "linux")]
    if o.check_focus {
        println!(
            "game-eligible={} (read-only; no keyboard backend opened)",
            gate.as_mut()
                .ok_or("missing foreground adapter")?
                .eligible()?
        );
        return Ok(());
    }
    if !sdl3::hint::set("SDL_JOYSTICK_ALLOW_BACKGROUND_EVENTS", "1") {
        return Err("SDL refused background controller acquisition".into());
    }
    let sdl = sdl3::init().map_err(|e| e.to_string())?;
    let gamepads = sdl.gamepad().map_err(|e| e.to_string())?;
    let mut events = sdl.event_pump().map_err(|e| e.to_string())?;
    events.pump_events();
    let ids = gamepads.gamepads().map_err(|e| e.to_string())?;
    println!(
        "mode={} SDL={} gamepads={}",
        if o.emit {
            "keyboard-output"
        } else {
            "observation-only"
        },
        sdl3::version::version(),
        ids.len()
    );
    for id in &ids {
        let pad = gamepads.open(*id).map_err(|e| e.to_string())?;
        println!(
            "gamepad id={id} name={:?} path={:?} vendor={:?} product={:?}\nmapping={:?}\nnormalized={:?}",
            pad.name(),
            pad.path(),
            pad.vendor_id(),
            pad.product_id(),
            pad.mapping(),
            sample(&pad)
        );
    }
    let Some(seconds) = o.seconds else {
        return Ok(());
    };
    let id = match o.gamepad {
        Some(id) if ids.contains(&JoystickId::from(id)) => JoystickId::from(id),
        Some(_) => return Err("selected gamepad is not connected".into()),
        None if ids.len() == 1 => ids[0],
        None => {
            return Err("watch requires exactly one gamepad or an explicit --gamepad ID".into());
        }
    };
    let pad = gamepads.open(id).map_err(|e| e.to_string())?;
    let mut keyboard = if o.emit {
        Some(KeyboardOutput::new(o.display)?)
    } else {
        None
    };
    let running = Arc::new(AtomicBool::new(true));
    let signal_running = Arc::clone(&running);
    ctrlc::set_handler(move || signal_running.store(false, Ordering::Relaxed))
        .map_err(|e| e.to_string())?;
    let start = Instant::now();
    let mut mapper = Mapper::default();
    let mut last_sample = None;
    let mut last_eligibility = None;
    let mut last_error: Option<String> = None;
    let mut last_armed = false;
    println!(
        "selected={id}; release all mapped controls to arm; observation transitions are previews only"
    );
    while running.load(Ordering::Relaxed) && start.elapsed() < Duration::from_secs(seconds) {
        for event in events.poll_iter() {
            match event {
                Event::GamepadAxisMotion { .. }
                | Event::GamepadButtonDown { .. }
                | Event::GamepadButtonUp { .. }
                | Event::GamepadAdded { .. }
                | Event::GamepadRemoved { .. }
                | Event::GamepadRemapped { .. } => {
                    println!("t_us={} sdl_event={event:?}", start.elapsed().as_micros())
                }
                Event::Quit { .. } => running.store(false, Ordering::Relaxed),
                _ => {}
            }
        }
        let current = pad.connected().then(|| sample(&pad));
        let mut eligible = true;
        #[cfg(target_os = "linux")]
        if let Some(gate) = &mut gate {
            match gate.eligible() {
                Ok(value) => {
                    eligible = value;
                    last_error = None;
                }
                Err(error) => {
                    eligible = false;
                    if last_error.as_ref() != Some(&error) {
                        eprintln!("eligibility unavailable: {error}");
                    }
                    last_error = Some(error);
                }
            }
        }
        #[cfg(not(target_os = "linux"))]
        let _ = (&mut eligible, &mut last_error);
        if last_eligibility != Some(eligible) {
            println!(
                "t_us={} {}={eligible}",
                start.elapsed().as_micros(),
                if o.emit {
                    "game-eligible"
                } else {
                    "preview-enabled"
                }
            );
            last_eligibility = Some(eligible);
        }
        if current != last_sample {
            println!(
                "t_us={} normalized={current:?}",
                start.elapsed().as_micros()
            );
            last_sample = current.clone();
        }
        for transition in mapper.update(current.as_ref(), eligible) {
            if let Some(keyboard) = &mut keyboard {
                keyboard.apply(transition)?;
            }
            println!(
                "t_us={} {}={transition:?}",
                start.elapsed().as_micros(),
                if o.emit { "submitted" } else { "preview" }
            );
        }
        if mapper.armed() != last_armed {
            println!(
                "t_us={} armed={}",
                start.elapsed().as_micros(),
                mapper.armed()
            );
            last_armed = mapper.armed();
        }
        std::thread::sleep(Duration::from_millis(4));
    }
    for transition in mapper.update(None, false) {
        if let Some(keyboard) = &mut keyboard {
            keyboard.apply(transition)?;
        }
        println!(
            "t_us={} shutdown={transition:?}",
            start.elapsed().as_micros()
        );
    }
    if let Some(keyboard) = &mut keyboard {
        keyboard.release_owned()?;
    }
    Ok(())
}

fn main() {
    if let Err(error) = run() {
        eprintln!("wc3-controller: {error}");
        std::process::exit(1);
    }
}
