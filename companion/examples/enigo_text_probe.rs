//! Reproduce the pinned Enigo X11 text boundary on a dedicated scratch display.
use enigo::{Enigo, Keyboard, Settings};
use std::{env, error::Error, fs, time::Instant};

fn main() -> Result<(), Box<dyn Error>> {
    let args: Vec<String> = env::args().collect();
    if args.len() != 4 {
        return Err(
            "usage: enigo_text_probe EXPLICIT_SCRATCH_DISPLAY PACKETS_FILE RECEIVED_FILE".into(),
        );
    }
    let packets = fs::read_to_string(&args[2])?;
    let mut output = Enigo::new(&Settings {
        x11_display: Some(args[1].clone()),
        linux_delay: 0,
        ..Settings::default()
    })?;
    for (index, packet) in packets.lines().enumerate() {
        let started = Instant::now();
        output.text(packet)?;
        println!(
            "packet={index} bytes={} elapsed_us={} wire={packet}",
            packet.len(),
            started.elapsed().as_micros()
        );
    }
    // XTEST key release completion and the receiver's terminal input are separate
    // boundaries. Wait for the receiver's receipt before dropping new mappings.
    output.text("\n")?;
    let expected_bytes = packets.lines().map(str::len).sum::<usize>() + 1;
    let deadline = Instant::now() + std::time::Duration::from_secs(2);
    while fs::metadata(&args[3]).map_or(0, |m| m.len()) < expected_bytes as u64 {
        if Instant::now() >= deadline {
            return Err("text receiver did not complete".into());
        }
        std::thread::sleep(std::time::Duration::from_millis(5));
    }
    Ok(())
}
