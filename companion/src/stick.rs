//! Melee's analog-stick conversion, shared by both helpers for every pad.
//! HSD_PadClamp limits a stick radially to its full scale of 80 units
//! (melee:src/sysdolphin/baselib/controller.c, HSD_PadClampCheck3, with
//! clamp_stickMax = scale_stick = 80 and clamp_stickMin = 0 set in
//! melee:src/melee/gm/gmmain.c). Fighter input then zeroes each axis whose
//! magnitude is at most 0.28 of full scale (melee:src/melee/ft/fighter.c,
//! ftCommonData horizontal_stick_deadzone and vertical_stick_deadzone in
//! melee:src/melee/ft/types.h). A value outside the deadzone is kept, not
//! rescaled.
//!
//! Down is stronger than the deadzone. Melee reads a downward stick as one
//! digital intent only at 0.6625 of full scale (53 of 80 units): fast-fall in
//! `ftCommon_CheckFallFast` (melee:src/melee/ft/ftcommon.c, common +0x88,
//! `lstick.y <= -x88`), platform drop in `ftCo_80099F1C`
//! (melee:src/melee/ft/kinds/ftCommon/ftCo_Pass.c, +0x464) and refusing a ledge
//! catch in `ftCliffCommon_80081298` (melee:src/melee/ft/ftcliffcommon.c,
//! +0x480). Retail stores 0x3f29999a for +0x88 and 0x3f28f5c3 (0.66) for the
//! other two, which select the same 53-unit stick position.

/// Melee's axial stick deadzone as a fraction of full scale; retail PlCo.dat
/// stores binary32 0x3e8f5c29, which this literal also rounds to.
pub const STICK_DEADZONE: f32 = 0.28;

/// Melee's downward-stick threshold as a fraction of full scale: 53 of 80
/// stick units, retail common +0x88 (binary32 0x3f29999a).
pub const STICK_DOWN_THRESHOLD: f32 = 0.6625;

/// Whether a `melee_stick` y value (positive is down) reaches the threshold.
pub fn stick_down(y: i16) -> bool {
    f32::from(y) >= STICK_DOWN_THRESHOLD * 32_767.0
}

/// Stick jump reads the effective shield-tilt stick before sharing button jump.
pub fn tap_jump(y: i16, enabled: bool, tilt: bool, shield: bool) -> bool {
    let up = -f32::from(y) / 32_767.0;
    let up = if tilt && shield { up.min(0.65) } else { up };
    enabled && up > STICK_DOWN_THRESHOLD
}

/// C-stick flick thresholds as fractions of full scale. Smash attacks read a
/// sideways flick at `dash_smash_stick_threshold` (common +0x3C, 0.8, binary32
/// 0x3f4ccccd; `ftCo_800DF1C8`) and up/down at +0xCC = 0.6625 and +0xD4 =
/// -0.6625 (0x3f29999a; `ftCo_800DF2D8`, `ftCo_800DF3A8`), all in
/// melee:src/melee/ft/ft_0DF1.c. Get-up up (+0x7F4), ledge-attack up (+0x7F8)
/// and the C-stick up jump use 0.6625 and ledge-attack sideways (+0x7FC) 0.8.
/// Aerials, throws, side get-up (+0x248 = 0.2) and ledge climb (+0x494 = 0.25)
/// sit at or under the 0.28 deadzone, which a single press threshold per
/// direction cannot also serve.
pub const C_STICK_SIDE_THRESHOLD: f32 = 0.8;
pub const C_STICK_VERTICAL_THRESHOLD: f32 = 0.6625;

/// C-stick press directions after Melee's conversion: x is -1 left or +1 right,
/// y is -1 up or +1 down (positive y is down), 0 inside the threshold.
pub fn c_stick(x: i16, y: i16) -> (i8, i8) {
    let (x, y) = melee_stick(x, y);
    let direction = |v: i16, threshold: f32| {
        if f32::from(v).abs() >= threshold * 32_767.0 { v.signum() as i8 } else { 0 }
    };
    (
        direction(x, C_STICK_SIDE_THRESHOLD),
        direction(y, C_STICK_VERTICAL_THRESHOLD),
    )
}

/// One stick in full-scale ±32767 units (SDL values and normalized evdev
/// values), with Melee's radial clamp and axial deadzone applied.
pub fn melee_stick(x: i16, y: i16) -> (i16, i16) {
    let (mut nx, mut ny) = (f32::from(x) / 32_767.0, f32::from(y) / 32_767.0);
    let radius = (nx * nx + ny * ny).sqrt();
    if radius > 1.0 {
        nx /= radius;
        ny /= radius;
    }
    let axis = |value: f32| {
        if value.abs() <= STICK_DEADZONE {
            0
        } else {
            (value * 32_767.0) as i16
        }
    };
    (axis(nx), axis(ny))
}

#[cfg(test)]
#[test]
fn resting_and_drifted_sticks_read_neutral_and_just_outside_reads_direction() {
    // 0.28 * 32767 = 9174.76: 9174 is inside the deadzone, 9175 outside.
    for (x, y) in [(0, 0), (1_500, -2_200), (-9_174, 9_174), (9_174, 0)] {
        assert_eq!(melee_stick(x, y), (0, 0), "{x},{y}");
    }
    assert_eq!(melee_stick(9_175, 0), (9_175, 0));
    assert_eq!(melee_stick(-9_175, 0), (-9_175, 0));
    assert_eq!(melee_stick(0, 9_175), (0, 9_175));
    assert_eq!(melee_stick(i16::MIN, 0), (-32_767, 0));
    // The radial clamp applies before the deadzone, as in Melee.
    let (x, y) = melee_stick(32_767, 32_767);
    assert_eq!((x, y), (23_169, 23_169));
    assert_eq!(melee_stick(9_200, 32_767).0, 0);
}

#[cfg(test)]
#[test]
fn down_needs_melees_strong_threshold_and_horizontal_keeps_the_deadzone() {
    let down = |x, y| stick_down(melee_stick(x, y).1);
    assert!(!down(0, 16_384), "-0.5 passes the deadzone but is not down");
    assert!(down(0, 22_937), "-0.7 is down");
    // 0.6625 * 32767 = 21707.14; melee_stick truncates, so 21709 is the first raw value down.
    assert!(!down(0, 21_708));
    assert!(down(0, 21_709));
    assert!(!down(0, -32_767), "up is not down");
    assert!(!down(32_767, 0), "horizontal is not down");
    assert!(!down(32_767, 16_384), "the radial clamp shrinks a half-down diagonal");
    assert!(down(32_767, 32_767), "a clamped corner is 0.707 down");
    assert_eq!(melee_stick(16_384, 0).0, 16_384, "horizontal is unchanged");
}

#[cfg(test)]
#[test]
fn c_stick_needs_melees_flick_thresholds() {
    assert_eq!(c_stick(16_384, 0), (0, 0), "0.5 sideways");
    assert_eq!(c_stick(22_937, 0), (0, 0), "0.7 sideways");
    assert_eq!(c_stick(26_500, 0), (1, 0), "0.81 right");
    assert_eq!(c_stick(-26_500, 0), (-1, 0), "0.81 left");
    assert_eq!(c_stick(0, -19_660), (0, 0), "0.6 up");
    assert_eq!(c_stick(0, -22_937), (0, -1), "0.7 up");
    assert_eq!(c_stick(0, 22_937), (0, 1), "0.7 down");
    // The radial clamp keeps a corner at 0.707 per axis: vertical but not sideways.
    assert_eq!(c_stick(32_767, 32_767), (0, 1));
}
