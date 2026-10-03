#[cfg(target_os = "linux")]
mod linux {
    use serde_json::Value;
    use std::{
        fs,
        io::{BufRead, BufReader, Write},
        os::unix::net::UnixStream,
        path::PathBuf,
        time::Duration,
    };
    use x11rb::{
        protocol::xproto::{AtomEnum, ConnectionExt},
        rust_connection::RustConnection,
    };

    pub struct Target {
        pub display: String,
        pub window: u32,
        pub pid: u32,
        pub niri_window: Option<u64>,
        pub wlr_app_id: Option<String>,
    }

    pub struct Gate {
        target: Target,
        socket: Option<PathBuf>,
        wlr: Option<crate::wlr::Monitor>,
        x11: RustConnection,
        pid_atom: u32,
        birth: String,
    }

    fn process_birth(pid: u32) -> Result<String, String> {
        let stat = fs::read_to_string(format!("/proc/{pid}/stat")).map_err(|e| e.to_string())?;
        stat.rsplit_once(')')
            .and_then(|(_, fields)| fields.split_whitespace().nth(19))
            .map(str::to_owned)
            .ok_or_else(|| "cannot read selected process identity".into())
    }

    impl Gate {
        pub fn new(target: Target) -> Result<Self, String> {
            if target.niri_window.is_some() == target.wlr_app_id.is_some() {
                return Err(
                    "select exactly one foreground adapter: --niri-window or --private-wlr-app-id"
                        .into(),
                );
            }
            let socket = if target.niri_window.is_some() {
                Some(
                    std::env::var_os("NIRI_SOCKET")
                        .map(PathBuf::from)
                        .ok_or("NIRI_SOCKET is missing")?,
                )
            } else {
                None
            };
            let wlr = target
                .wlr_app_id
                .clone()
                .map(crate::wlr::Monitor::new)
                .transpose()?;
            let command =
                fs::read(format!("/proc/{}/cmdline", target.pid)).map_err(|e| e.to_string())?;
            let is_game = command.split(|b| *b == 0).any(|arg| {
                let arg = String::from_utf8_lossy(arg);
                arg.rsplit(['/', '\\'])
                    .next()
                    .is_some_and(|name| name.eq_ignore_ascii_case("Warcraft III.exe"))
            });
            if !is_game {
                return Err("selected PID does not identify Warcraft III.exe".into());
            }
            let birth = process_birth(target.pid)?;
            let (x11, _) = x11rb::connect(Some(&target.display)).map_err(|e| e.to_string())?;
            let pid_atom = x11
                .intern_atom(false, b"_NET_WM_PID")
                .map_err(|e| e.to_string())?
                .reply()
                .map_err(|e| e.to_string())?
                .atom;
            let gate = Self {
                target,
                socket,
                wlr,
                x11,
                pid_atom,
                birth,
            };
            gate.check_window_pid()?;
            Ok(gate)
        }

        fn request(&self, request: &str) -> Result<Value, String> {
            let mut socket =
                UnixStream::connect(self.socket.as_ref().ok_or("Niri socket not selected")?)
                    .map_err(|e| e.to_string())?;
            socket
                .set_read_timeout(Some(Duration::from_millis(50)))
                .map_err(|e| e.to_string())?;
            socket
                .set_write_timeout(Some(Duration::from_millis(50)))
                .map_err(|e| e.to_string())?;
            writeln!(socket, "\"{request}\"").map_err(|e| e.to_string())?;
            socket
                .shutdown(std::net::Shutdown::Write)
                .map_err(|e| e.to_string())?;
            let mut reply = String::new();
            BufReader::new(socket)
                .read_line(&mut reply)
                .map_err(|e| e.to_string())?;
            let parsed: Value = serde_json::from_str(&reply).map_err(|e| e.to_string())?;
            parsed
                .get("Ok")
                .and_then(|ok| ok.get(request))
                .cloned()
                .ok_or_else(|| format!("Niri did not return {request}"))
        }

        fn check_window_pid(&self) -> Result<(), String> {
            let property = self
                .x11
                .get_property(
                    false,
                    self.target.window,
                    self.pid_atom,
                    AtomEnum::CARDINAL,
                    0,
                    1,
                )
                .map_err(|e| e.to_string())?
                .reply()
                .map_err(|e| e.to_string())?;
            if property.value32().and_then(|mut v| v.next()) != Some(self.target.pid) {
                return Err("selected X11 window no longer belongs to selected game PID".into());
            }
            Ok(())
        }

        pub fn eligible(&mut self) -> Result<bool, String> {
            if process_birth(self.target.pid)? != self.birth {
                return Err("selected game process restarted".into());
            }
            self.check_window_pid()?;
            if let Some(wlr) = &mut self.wlr {
                if !wlr.eligible()? {
                    return Ok(false);
                }
            } else {
                let overview = self.request("OverviewState")?;
                if overview.get("is_open").and_then(Value::as_bool) != Some(false) {
                    return Ok(false);
                }
                let window = self.request("FocusedWindow")?;
                if window.get("id").and_then(Value::as_u64) != self.target.niri_window
                    || window.get("pid").and_then(Value::as_u64) != Some(u64::from(self.target.pid))
                    || window.get("is_focused").and_then(Value::as_bool) != Some(true)
                {
                    return Ok(false);
                }
            }
            // Require the exact focus recipient, not stale _NET_ACTIVE_WINDOW metadata.
            let focus = self
                .x11
                .get_input_focus()
                .map_err(|e| e.to_string())?
                .reply()
                .map_err(|e| e.to_string())?;
            Ok(focus.focus == self.target.window)
        }
    }
}

#[cfg(target_os = "linux")]
pub use linux::{Gate, Target};
