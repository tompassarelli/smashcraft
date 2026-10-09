# Cross-platform companion: reuse decision

The keyboard is the baseline (#166): the published map reads Warcraft's own
synchronized key events and needs nothing installed. The companion is an
optional upgrade that turns a controller into the same keys (smashcraft:controller/README.md,
"Always-on controller service"); its journal path serves the integrity build's
native tests.

Implementation is tracked in [#18](https://github.com/tompassarelli/smashcraft/issues/18) (Linux) and [#34](https://github.com/tompassarelli/smashcraft/issues/34) (Windows/macOS) under roadmap [#16](https://github.com/tompassarelli/smashcraft/issues/16). The owner accepted this direction.

3 October 2026. This extends the [controller input research](controller-prior-art.md) for **macOS, Windows and Linux**. The recommendation is **Rust + SDL3 acquisition, enigo keyboard delivery, and small native adapters for foreground identity and launch discovery**. Tauri remains an optional settings/launcher UI. This revises the earlier Linux-only output recommendation: start with enigo's existing X11 backend instead of independently assembling XTest calls, while keeping XTest as the same underlying mechanism.

The deciding evidence is broader than the C# example: SDL's device drivers; Microsoft's XInput/GameInput and SendInput contracts; Apple's foreground/Accessibility APIs; enigo's actual platform implementations; local W3Champions launch/input code; and local Slippi/Dolphin source snapshots plus Melee Unlocked. Each solves a different boundary. **XInput reads controllers; SendInput generates desktop input. Neither is an analog interface into a Warcraft map.** Cross-platform compilation and OS event submission are not native-game acceptance.

Modern pads (Xbox and Switch Pro) set the defaults. GameCube pads remain
bindable, but do not determine the default layout. The Controller page offers
Standard (B/Y jump, RB grab) and Z-jump (RB/Y jump, B grab). Both keep A attack,
X special, LB Tilt (also walks), LT light shield, RT shield and the stick controls.

## 1. Controller acquisition

| Option | Evidence and tradeoff | Choice |
| --- | --- | --- |
| SDL3 + Rust `sdl3` | Maintained cross-platform normalization/mappings, hotplugging, Xbox backends, Steam Deck and GameCube HIDAPI drivers. SDL contains XInput and GameInput paths; the actual chosen backend depends on build, runtime and device. | **Common acquisition layer on all three systems.** Reuse the backend selection and device knowledge; record the selected runtime path during acceptance. |
| `gilrs` | Rust-facing unified controls, SDL mapping format, Linux evdev, macOS support, Windows WGI/XInput. Its README warns that default Windows Gaming Input can require a foreground window associated with the process. | Real alternative when devices already have suitable OS gamepad exposure. A companion must receive input while Warcraft has focus; selecting WGI blindly is unsuitable. Raw GameCube adapters still need another solution. |
| Windows XInput directly | Microsoft documents up to four XInput controllers, two sticks, two analog triggers and gamepad state/rumble. Small API for Xbox-compatible devices; does not cover all HID devices or other operating systems. | Useful diagnostic/reference for a Windows Xbox discrepancy, **not a second production acquisition implementation** without a demonstrated SDL gap. |
| Windows GameInput directly | Microsoft's current API supplies unified devices, polling/callbacks and a common time base; PC runtime is available through NuGet, with supported Windows versions stated by Microsoft. Broader than XInput. | Prefer the maintained SDL integration for this cross-platform program. Direct GameInput would add Windows-specific acquisition and deployment responsibilities without solving macOS/Linux or WC3 ingress. |
| Steam Input | Existing controller remapping/legacy keyboard and gamepad emulation, particularly relevant to Deck/Steam-launched sessions. API integration also entails Steamworks initialization and application context. | Optional launch/session integration, not a prerequisite for a Battle.net companion. Select either Steam's key mapping or the companion's output, and avoid duplicate physical/virtual device consumption. |

Sources: [SDL gamepad contract](https://github.com/libsdl-org/SDL/blob/4a17e772ea9a4ff77dd10fa6ea6f45fc6731eb01/include/SDL3/SDL_gamepad.h), [SDL GameInput driver](https://github.com/libsdl-org/SDL/blob/4a17e772ea9a4ff77dd10fa6ea6f45fc6731eb01/src/joystick/gdk/SDL_gameinputjoystick.cpp), [XInput overview](https://learn.microsoft.com/en-us/windows/win32/xinput/getting-started-with-xinput), [GameInput overview](https://learn.microsoft.com/en-us/gaming/gdk/docs/features/common/input/overviews/input-overview), [Steam Input documentation](https://partner.steamgames.com/doc/features/steam_controller).

Set SDL background acquisition deliberately because the game, not the companion window, must be foreground. Preserve SDL's event-pump/thread requirements; Tauri's webview does not clock gameplay input. Use the maintained mapping database instead of a hand-maintained VID/PID/button inventory. Pin the chosen SDL library and Rust binding together when implementing; their compatibility has not been built or measured here. The binding's own README warns about incomplete features. A required binding omission should be repaired at the binding boundary, not bypassed with a second controller stack.

The inspected SDL GameInput driver explicitly enables GameInput background input and leaves higher-level focus policy to SDL. This is stronger source evidence for companion acquisition than assuming every Windows controller API works identically while its application is background.

### GameCube and local Slippi evidence

The research used exact-revision local Slippi Dolphin/Dolphin source snapshots. The clean local ~/code/resources/melee-unlocked checkout is also relevant: its controller profile types distinguish XInput, PlayStation, GameCube adapters, Switch Pro and HID; its Windows host uses `XInputGetState`; its separate GameCube adapter implementation uses libusb. Its notice identifies Dolphin/Slippi-derived components. It is a Windows native-game implementation and is not evidence for a three-platform external Warcraft bridge.

Slippi Dolphin's adapter code owns USB reports and feeds Dolphin's emulated controller state. Its launcher starts/updates Dolphin; it does not deliver an arbitrary game's keyboard API. The directly reusable permissive alternative is already SDL's [GameCube driver](https://github.com/libsdl-org/SDL/blob/4a17e772ea9a4ff77dd10fa6ea6f45fc6731eb01/src/joystick/hidapi/SDL_hidapi_gamecube.c): four ports, hotplugging, main/C sticks, analog triggers, bottom-of-trigger buttons and conditional rumble. There is no reason to extract GPL Dolphin code or translate its USB decoder.

Distinguish generic PC-mode controllers from Nintendo-compatible Wii U-mode adapters. The latter need initialization and per-port report interpretation and need not appear as ordinary OS gamepads. Linux hidraw/libusb permissions, macOS USB/HID ownership and Windows HID/USB driver choice are device/build-specific. Dolphin's ability to open an adapter does not establish that a simultaneously running companion can claim it. Do not replace drivers or take a device from an active emulator as a speculative setup step. Probe the actual adapter mode, identity, permissions and SDL backend first.

SDL's GameCube driver dynamically rescales from observed axis extrema; its exposed normalized values are **not unchanged GameCube bytes or exact Melee calibration**. Keep pressure and digital trigger-click states distinct in the input model. Exact raw-byte/calibration behavior is a separate requirement and must be demonstrated before changing the selected upstream capability. USB overclocking, polling-rate claims and adapter latency guarantees are outside this static evidence.

## 2. Keyboard delivery: reuse enigo first

[enigo](https://github.com/enigo-rs/enigo/tree/a88d9b7e2cec7043ab5f03e754500a091ea928d1) is an MIT Rust library with explicit press/release and raw-key APIs. Its inspected source uses Windows `SendInput`, macOS `CGEvent`, and X11 through `x11rb` by default. This is a closer fit than porting a complete mapper or maintaining three copies of low-level keyboard construction. Use key transitions, not the text/Unicode typing API. Decide whether a WC3 binding denotes a logical key or a physical position and verify it against the game's actual preset; raw numeric keycodes are platform-specific and cannot be shared unchanged.

The real alternative is thin direct OS bindings: Microsoft's `windows` crate for SendInput; `objc2`/CoreGraphics for CGEvent; `x11rb` for XTest. They are conventional and permissively licensed, but increase code we own. Choose them only when a measured required behavior is missing from enigo, then repair the smallest owning upstream seam where applicable. Native bindings remain useful for focus/launch identity, which enigo does not supply as a game eligibility policy.

| OS output | Permissions and runtime behavior | Acceptance implication |
| --- | --- | --- |
| Windows SendInput | Inserts events into the system input stream, not a specified Warcraft window. UIPI permits injection only into equal/lower integrity processes. Microsoft warns that already-held keyboard state can interfere and that failure does not identify UIPI as its cause. | Keep normal Battle.net/game/companion privilege levels aligned; do not default to administrator. Check submission counts/errors and actual map input. A successful API return is not game consumption. |
| macOS CGEvent posting | enigo checks Accessibility trust with `AXIsProcessTrustedWithOptions`; synthetic events are posted through the HID event tap. | Obtain the OS's actual Accessibility grant for the running application identity. Use a stable app identity for normal use; test permission denial/revocation and release. Do not require Input Monitoring merely for output; only an actual input-monitoring feature can establish that extra need. |
| Linux X11/XWayland | enigo can select the X display and sends through X11. Existing Warcraft testing uses Proton/XWayland. | Select the game session's display. XTest is not a universal native-Wayland injection API. The compositor's actual foreground state must gate output. |
| Linux native Wayland | enigo documents its Wayland/libei backends as experimental. RemoteDesktop/EIS is compositor/session-mediated; protocol availability and consent vary. uinput is a separate virtual-device route requiring scoped device access. | Add the backend only for a named, tested compositor/session. Do not advertise generic Wayland support from an XWayland success or silently route via a privileged virtual keyboard. |

Sources: [enigo Windows implementation](https://github.com/enigo-rs/enigo/blob/a88d9b7e2cec7043ab5f03e754500a091ea928d1/src/win/win_impl.rs), [macOS implementation](https://github.com/enigo-rs/enigo/blob/a88d9b7e2cec7043ab5f03e754500a091ea928d1/src/macos/macos_impl.rs), [backend/permission documentation](https://github.com/enigo-rs/enigo/blob/a88d9b7e2cec7043ab5f03e754500a091ea928d1/README.md), [SendInput contract](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput), [RemoteDesktop portal](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.RemoteDesktop.html).

Enigo tracks held keys and can release them on drop. This is useful cleanup, not focus-loss handling, not multi-source aggregation, and not crash-proof cleanup. Own the action-state policy once: LT holds light shield and RT holds full shield; releasing one must retain the other shield input until both are up. In the standard preset, B and Y share jump semantics but need individually tracked sources; stick-up is only up. Disconnect/focus loss clears owned state; returning focus does not replay stale held actions. Physical keyboard/controller overlap and modifiers must be tested, not reset indiscriminately. No library can provide an atomic guarantee that foreground focus will remain unchanged between a user-space check and global injection; document this residual race and verify the ordinary focus transition.

The locally inspected W3Champions launcher independently confirms these API choices: its native hotkey module uses SendInput on Windows, CGEvent on macOS and XTest on Linux. This is behavioral prior art only: no project license was found in the inspected root/package, and its presence does not establish correctness of those implementations or current platform support. No code was translated or copied.

## 3. Foreground identity and launch boundaries

| Platform | Exact target eligibility | Existing launch/session to preserve |
| --- | --- | --- |
| Windows | `GetForegroundWindow` → `GetWindowThreadProcessId`; match the selected live game process/executable and window, not just title. Handle null/transient foreground and process restart. | Installed Windows Battle.net and native Warcraft. Discover/remember the selected install and keep the existing signed-in account. The process launched by Battle.net is the target, not the launcher PID. |
| macOS | `NSWorkspace.frontmostApplication` gives the app receiving key events. Match its running PID, bundle/executable identity; use the focused window through Accessibility when more precise instance/window distinction is needed. | Installed macOS Battle.net application and its native Warcraft launch path. Record actual game/app architecture and compatibility requirements on the target machine; do not assume Windows Proton or a fixed Intel/Apple-Silicon path applies. |
| Linux | Match the actual compositor's foreground instance plus the XWayland window/display where appropriate. For the current Niri setup, use its existing IPC approach. X11 active-window metadata alone can lag or omit native-Wayland/overview ownership. | Preserve the exact working Proton/Wine runner, prefix, signed-in Battle.net profile and display session. The native Rust companion can read Linux controllers and send X11 events independently of the Windows game runtime. Do not create another prefix/account merely to launch it. |

Authoritative identity contracts: [Windows foreground](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getforegroundwindow), [window-to-process](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getwindowthreadprocessid), [macOS frontmost application](https://developer.apple.com/documentation/appkit/nsworkspace/frontmostapplication), [Accessibility trust](https://developer.apple.com/documentation/applicationservices/1459186-axisprocesstrustedwithoptions).

The retained Linux test recorded an X11 active-window title naming Warcraft while its private compositor capture showed Battle.net. The cause is unresolved; this is a concrete reason to corroborate actual compositor focus, not proof of any particular X11 or launcher defect.

The clean local W3Champions launcher at `86a24f579679f84b58e0b542d76fba1c3feed5a9` has separate Windows/Mac launch strategies. Both request Battle.net's `--exec="launch W3"`; their executable/app paths differ. Treat that as an observed integration, **not a promised stable public Battle.net API**. First preserve the authenticated launcher Play path. Test an automated launch request on each native installation before making it the product's normal path. Prefer structured executable arguments and native application launch services, not copying shell command construction from an old launcher. Authentication belongs to Battle.net; the companion does not extract credentials.

Game focus alone does not identify gameplay versus chat, a modal dialog, or a menu. Explicitly define where the selected map expects mapped controls and how mapping is paused there. Two Warcraft instances require selecting one instance and checking foreground eligibility for that instance; the output API's global nature does not authorize background control of the other client. Tauri window focus is not game-window identity.

## Smallest native acceptance gates

Use one common scripted observation checklist, implemented once, then run it on each actual target OS. No such run occurred during this research.

- **Windows:** native Battle.net Play → selected native Warcraft/map; wired Xbox acquired while the companion is background; X special, B/Y jump, RB grab and LT/RT overlap observed in the map; foreground change/disconnect neutralizes owned keys; ordinary non-admin execution and an explicitly observed permission failure are distinguishable. Record actual native runtime and keyboard layout.
- **macOS:** native Battle.net Play → installed Warcraft/map; permission denied then Accessibility granted for the actual companion identity; background controller acquisition and the same actions/releases; app-switch/disconnect and permission revocation handled without stale action. Record OS, CPU/app architecture and tested controller connection. A device working on Windows does not establish Apple's device support.
- **Linux:** preserve the currently working Battle.net/Proton prefix/display; acquire Xbox and reproduce the same keys with enigo's X11 output while only one mapper emits; verify focus-away to a native Wayland app/overview and disconnect. This closes only the named compositor/XWayland path. A native-Wayland output claim needs a separate run through the named compositor-supported backend.

For a **GameCube support claim on any platform**, additionally open the actual adapter/mode with SDL, use at least two ports, distinguish stick/C-stick/pressure/click input, disconnect/reconnect and observe the corresponding map actions. For Steam Deck, test the actual desktop/gaming session and confirm that Steam Input has not created duplicate delivery. These are device-specific additions to the claim, not prerequisites to a useful wired-Xbox artifact.

If acquisition works but events never reach the map, investigate output, privilege, focus or Warcraft input handling; changing gamepad libraries does not repair that seam. If a library API cannot express a required behavior, preserve the smallest counterexample and repair that capability before expanding the consumer. All these gates prove digital integration only. Continuous analog needs a separate native map-ingress experiment, and physical button-to-pixel or online latency needs measurement beyond timestamps at library boundaries.

## What CI checks on Windows and macOS

The `End-to-end helper test` step of wc3-controller:.github/workflows/ci.yml
(wc3-controller:tests/e2e.rs) runs on GitHub's `windows-latest` runner for
every wc3-controller change (macOS ran it until the extraction, #373). A scripted pad presses every
#18 action (A, X, B, Y, RB, LB, both triggers, Start, four stick and four
C-stick directions), the jump and shield overlaps, a focus switch away and back,
and a disconnect. The real helper binary types into a small SDL stand-in
window whose executable is named like Warcraft III, beside a second stand-in.
The job fails if the game window's key sequence differs at all from the
expected one (lost, extra, repeated or reordered keys), if the other window
gets a key, or if the operating system still holds a key after focus loss or
disconnect.

Simulated layer per runner:

- **Windows**: only the pad. CI installs ViGEmBus and plugs in a virtual
  DualShock 4, a USB HID device the helper opens through SDL's normal hardware
  path (`PS4 Controller`, HIDAPI). The Xbox 360 target would need the
  `xusb22.sys` driver, which Windows Server runners lack, so XInput itself is
  not exercised.
- **macOS**: device acquisition. Creating a virtual HID device needs an
  Apple-restricted entitlement (`IOHIDUserDeviceCreateWithProperties` returns
  nothing on the runner, macOS 26.6, even with SIP off), so the helper's
  `--virtual-pad` feeds an SDL virtual gamepad inside the helper. Mapping,
  focus gating and CGEvent key output are real.

Only a real-hardware tester ([#45](https://github.com/tompassarelli/smashcraft/issues/45))
can show: a physical pad (Xbox over XInput on Windows; any pad on macOS)
detected and read in the background; Warcraft III itself accepting the keys
and its real executable or app identity passing the foreground check;
Battle.net launch; the macOS Accessibility prompt for the user's actual app;
keyboard layouts other than the runner's US QWERTY; and an online match.

## Analog values and quantization

The input row keeps its existing signed-byte `axisX` and `axisZ` (−127 to
127), and unsigned-byte `triggerLeft` and `triggerRight` (0 to 255). Both
candidate pad transports use the same quantization: 17 readings per stick
axis, neutral plus eight in either direction, and four readings per trigger.
The helper applies the existing radial clamp and 0.28 axial dead zone before
choosing the nearest active level. Values outside the dead zone keep their
strength; the active range is not expanded to start from zero.

| Field | Readings |
| --- | --- |
| Stick X and Z | −127, −114, −101, −88, −75, −62, −49, −36, 0, 36, 49, 62, 75, 88, 101, 114, 127 |
| Each trigger | 0, 77, 166, 255 |

Eight active magnitudes retain a distinction between a half push (62) and a
full push (127), while keeping the transport smaller than a full-resolution
pad. Trigger 77 retains the existing light-shield setting; 166 adds a middle
pressure and 255 is full pressure. These counts are Smashcraft's coarse
choice, informed by the following reference behavior.

Melee clamps and scales its stick to 80 units and each analog trigger to 140
units. Its controller code first retains integer stick and trigger readings,
then converts them to normalized floats. The existing helper also retains
Melee's 0.28 fighter-input dead zone. Sources: [Melee pad setup](https://github.com/doldecomp/melee/blob/4eb34e8ebe3421cb04d8e635aa29809183320421/src/melee/gm/gmmain.c#L38)
and [pad clamp and scale](https://github.com/doldecomp/melee/blob/4eb34e8ebe3421cb04d8e635aa29809183320421/src/sysdolphin/baselib/controller.c#L160).

For Ultimate's GameCube-adapter path, HDR's input research describes signed
8-bit device axes, the Switch driver's 15–70 working range and remapping,
and the game's additional 0.2 inner and 0.944 outer dead zones. Together
these leave about 41 distinct active readings in each direction. This is a
specific adapter path rather than a claim about every Ultimate controller.
Source: [HDR's explanation](https://github.com/HDR-Development/hid-hdr/blob/d425dcebfe0cf5165d06e395573b6e8a5ef15197/README.md#curious-about-the-stick-changes).

Ultimate uses a GameCube analog-trigger threshold of 79 as a digital press;
Melee uses analog pressure for shield strength up to 140. Smashcraft keeps
four pressure readings because its existing shield simulation uses pressure.
Source: [OpenGCC's trigger measurements](https://github.com/ZadenRB/OpenGCC_Firmware/wiki/Analog-and-Digital-Trigger-Values).

The packet carries two five-bit stick indices and two two-bit trigger
indices, 14 bits in total. The key candidate holds these bits as F13–F24,
Insert and Delete. Home identifies a present pad; End is held only after all
bits of an update are ready. The map keeps the previous complete pad sample
while End is released, and clears it when Home is released or focus is lost.
The cursor candidate
encodes the same bits as two seven-bit cursor-cell coordinates. Neither
changes the row format, replay records or rollback packets. A keyboard
sample continues to produce its existing full stick and trigger readings.

The references above supply numerical behavior only; no external controller
code is copied. The packet and its coarse levels are authored here.

## Source pins and reuse rights

Reference downloads and API-page snapshots are under smashcraft:build/two-clients/controller-reuse-20261003/sources. Documentation pages were retrieved on 3 October 2026 for API facts; examples were not copied. Source pins below are research evidence, not a dependency installation. The prior report retains exact pins/licenses for gilrs, evdev, hidapi, rusb, AntiMicroX and the mapping database.

| Source | Exact revision | Rights boundary |
| --- | --- | --- |
| SDL3 | `4a17e772ea9a4ff77dd10fa6ea6f45fc6731eb01` | zlib inspected source. Preserve notices and mark source modifications; native bundled dependencies retain separate terms. |
| Rust `sdl3` 0.20.0 | `0ffa35e5f6d68b3bcc56bb724af0ad5e538af6f4` | MIT; preserve license/copyright. |
| enigo, Cargo version 0.6.1 | `a88d9b7e2cec7043ab5f03e754500a091ea928d1` | MIT; preserve license/copyright. Use the library, not an unattributed copy of its backends. |
| Microsoft `windows-rs` | `726257f135393458e94ca592d0f2e36923b3dccc` | MIT or Apache-2.0 texts inspected. Candidate native identity/API bindings; keep applicable notices. |
| `objc2` and framework bindings | `b113b0484100b68726b546dc35814087e5da430b` | `objc2` is MIT; inspected framework crates offer Zlib OR Apache-2.0 OR MIT. Preserve chosen-license notices. Upstream also notes its Apple SDK derivation; Apple framework/SDK terms remain separate. |
| `x11rb` | `86c4252fe023fddd523f0ac3c7c07c40ba266ce0` | MIT source inspected previously; enigo uses its own resolved dependency version at implementation time. |
| Slippi Dolphin | `60f7b63496fb6ec7b9180a04f16f3edc0ad89fe2` | Adapter GPL-2.0-or-later. Factual behavior/reference only, no derivative decoder. |
| Dolphin | `562875dd60fd0ff50b65dbbb611a2096802cd1b9` | Adapter GPL-2.0-or-later; per-file licensing. Factual reference only. |
| Slippi launcher | `0930a2b66bdda78cebd0444c5e56249fea516cbe` | GPL-3.0 declaration. Launcher/runtime separation reference only. |
| Local Melee Unlocked | `4bb37070e4311169259dadaeed06a156523e5c7d` | GPL-3.0-or-later with component-specific notices; read-only behavior/reference. |
| Local W3Champions launcher | `86a24f579679f84b58e0b542d76fba1c3feed5a9` | No root/package license found; factual native-API/launch observations only. |
| Blizzard Controller Support | `eaef1ffa124869d661eb576c8f75009b9ea08f19` | No license found. User-authorized behavioral/integration study is useful and permitted within this task; no copying/translation or derivative implementation. It does not select the architecture. |

All three platforms remain required targets. This report supports the reuse decision and names their acceptance boundaries; it does not assert an implemented companion, permission approval, physical-controller support, successful native launch on an untested OS, continuous analog transport, or a latency result. No live client, focus, mapper, device or system configuration was changed.
