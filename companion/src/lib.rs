#![forbid(unsafe_code)]

pub mod output;

use std::collections::BTreeSet;

pub const LEFT_THRESHOLD: i16 = 7000;
pub const RIGHT_THRESHOLD: i16 = 11000;
pub const TRIGGER_THRESHOLD: i16 = 4000;

/// SDL-normalized input, not original device packet values. Buttons use Xbox labels.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct Sample {
    pub left_x: i16,
    pub left_y: i16,
    pub right_x: i16,
    pub right_y: i16,
    pub left_trigger: i16,
    pub right_trigger: i16,
    pub a: bool,
    pub b: bool,
    pub x: bool,
    pub y: bool,
    pub lb: bool,
    pub rb: bool,
    pub start: bool,
}

impl Sample {
    pub fn neutral(&self) -> bool {
        self.left_x.unsigned_abs() <= LEFT_THRESHOLD as u16
            && self.left_y.unsigned_abs() <= LEFT_THRESHOLD as u16
            && self.right_x.unsigned_abs() <= RIGHT_THRESHOLD as u16
            && self.right_y.unsigned_abs() <= RIGHT_THRESHOLD as u16
            && self.left_trigger <= TRIGGER_THRESHOLD
            && self.right_trigger <= TRIGGER_THRESHOLD
            && ![self.a, self.b, self.x, self.y, self.lb, self.rb, self.start].contains(&true)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Action {
    Attack,
    Special,
    Jump,
    Grab,
    Shield,
    Walk,
    Start,
    Left,
    Right,
    Down,
    Up,
    CLeft,
    CRight,
    CUp,
    CDown,
}

impl Action {
    pub fn key(self) -> char {
        match self {
            Self::Attack => 'n',
            Self::Special => 'u',
            Self::Jump => 'i',
            Self::Grab => 'o',
            Self::Shield => 'q',
            Self::Walk => 'p',
            Self::Start => 'y',
            Self::Left => 'w',
            Self::Right => 'r',
            Self::Down => 'e',
            Self::Up => ' ',
            Self::CLeft => 'b',
            Self::CRight => 'm',
            Self::CUp => 'j',
            Self::CDown => 'h',
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Transition {
    pub action: Action,
    pub pressed: bool,
}

/// One selected controller. Loss of eligibility or connection clears its actions;
/// held inputs cannot reactivate until a neutral sample arrives while eligible.
#[derive(Default)]
pub struct Mapper {
    held: BTreeSet<Action>,
    armed: bool,
}

impl Mapper {
    pub fn armed(&self) -> bool {
        self.armed
    }

    pub fn update(&mut self, sample: Option<&Sample>, eligible: bool) -> Vec<Transition> {
        let Some(sample) = sample.filter(|_| eligible) else {
            self.armed = false;
            return self.replace(BTreeSet::new());
        };
        if !self.armed {
            self.armed = sample.neutral();
            return Vec::new();
        }
        let up = sample.left_y < -LEFT_THRESHOLD;
        // Union source states before diffing, so releasing one source never
        // releases an action another source still owns.
        let bindings = [
            (Action::Attack, sample.a),
            (Action::Special, sample.x),
            (Action::Jump, sample.b || sample.y || up),
            (Action::Grab, sample.rb),
            (
                Action::Shield,
                sample.left_trigger > TRIGGER_THRESHOLD || sample.right_trigger > TRIGGER_THRESHOLD,
            ),
            (Action::Walk, sample.lb),
            (Action::Start, sample.start),
            (Action::Left, sample.left_x < -LEFT_THRESHOLD),
            (Action::Right, sample.left_x > LEFT_THRESHOLD),
            (Action::Down, sample.left_y > LEFT_THRESHOLD),
            (Action::Up, up),
            (Action::CLeft, sample.right_x < -RIGHT_THRESHOLD),
            (Action::CRight, sample.right_x > RIGHT_THRESHOLD),
            (Action::CUp, sample.right_y < -RIGHT_THRESHOLD),
            (Action::CDown, sample.right_y > RIGHT_THRESHOLD),
        ];
        self.replace(
            bindings
                .into_iter()
                .filter_map(|(action, active)| active.then_some(action))
                .collect(),
        )
    }

    fn replace(&mut self, next: BTreeSet<Action>) -> Vec<Transition> {
        let mut changes: Vec<_> = self
            .held
            .difference(&next)
            .map(|&action| Transition {
                action,
                pressed: false,
            })
            .collect();
        changes.extend(next.difference(&self.held).map(|&action| Transition {
            action,
            pressed: true,
        }));
        self.held = next;
        changes
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn tick(map: &mut Mapper, sample: &Sample) -> Vec<Transition> {
        map.update(Some(sample), true)
    }
    fn edge(action: Action, pressed: bool) -> Transition {
        Transition { action, pressed }
    }
    fn armed() -> Mapper {
        let mut map = Mapper::default();
        tick(&mut map, &Sample::default());
        map
    }

    #[test]
    fn triggers_share_shield_until_last_release() {
        let mut map = armed();
        let mut s = Sample {
            left_trigger: 20000,
            ..Sample::default()
        };
        assert_eq!(tick(&mut map, &s), vec![edge(Action::Shield, true)]);
        s.right_trigger = 30000;
        assert!(tick(&mut map, &s).is_empty());
        s.left_trigger = 0;
        assert!(tick(&mut map, &s).is_empty());
        s.right_trigger = 0;
        assert_eq!(tick(&mut map, &s), vec![edge(Action::Shield, false)]);
    }

    #[test]
    fn jump_buttons_and_stick_up_share_one_held_action() {
        let mut map = armed();
        let mut s = Sample {
            b: true,
            y: true,
            left_y: -20000,
            ..Sample::default()
        };
        assert_eq!(
            tick(&mut map, &s),
            vec![edge(Action::Jump, true), edge(Action::Up, true)]
        );
        s.b = false;
        assert!(tick(&mut map, &s).is_empty());
        s.y = false;
        assert!(tick(&mut map, &s).is_empty());
        s.left_y = 0;
        assert_eq!(
            tick(&mut map, &s),
            vec![edge(Action::Jump, false), edge(Action::Up, false)]
        );
        s.left_y = -20000;
        assert_eq!(
            tick(&mut map, &s),
            vec![edge(Action::Jump, true), edge(Action::Up, true)]
        );
    }

    #[test]
    fn focus_loss_and_disconnect_release_once_then_require_neutral() {
        for disconnect in [false, true] {
            let mut map = armed();
            let held = Sample {
                a: true,
                left_trigger: 20000,
                ..Sample::default()
            };
            tick(&mut map, &held);
            assert_eq!(
                map.update(if disconnect { None } else { Some(&held) }, disconnect),
                vec![edge(Action::Attack, false), edge(Action::Shield, false)]
            );
            assert!(!map.armed());
            assert!(tick(&mut map, &held).is_empty());
            assert!(!map.armed());
            tick(&mut map, &Sample::default());
            assert!(map.armed());
            assert_eq!(
                tick(&mut map, &held),
                vec![edge(Action::Attack, true), edge(Action::Shield, true)]
            );
        }
    }

    #[test]
    fn startup_held_input_cannot_arm_and_extreme_axis_is_safe() {
        let mut map = Mapper::default();
        let s = Sample {
            left_x: i16::MIN,
            ..Sample::default()
        };
        assert!(!s.neutral());
        assert!(tick(&mut map, &s).is_empty());
        assert!(!map.armed());
    }

    #[test]
    fn buttons_and_stick_directions_match_requested_keys() {
        let mut map = armed();
        let s = Sample {
            a: true,
            x: true,
            rb: true,
            lb: true,
            start: true,
            left_x: -20000,
            left_y: 20000,
            right_x: 20000,
            right_y: -20000,
            ..Sample::default()
        };
        let keys: BTreeSet<_> = tick(&mut map, &s).iter().map(|t| t.action.key()).collect();
        assert_eq!(
            keys,
            ['n', 'u', 'o', 'p', 'y', 'w', 'e', 'm', 'j']
                .into_iter()
                .collect()
        );
        assert_eq!(Action::Right.key(), 'r');
        assert_eq!(Action::CLeft.key(), 'b');
        assert_eq!(Action::CDown.key(), 'h');
    }
}
