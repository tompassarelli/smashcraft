"""Blender boundary: distinct in-place aerial strikes on the existing rigs."""

# Source frames map one-to-one to Simulation's move ticks via generated duration.
# Weapon poses stay with each rig's existing author rather than retargeting bones.
AERIALS = (
    ('Neutral', 3, 2, 25),
    ('Forward', 5, 2, 31),
    ('Back', 6, 2, 33),
    ('Up', 5, 3, 34),
    ('Down', 7, 3, 38),
)


def author_archer_aerials(make_action, tilt_pose):
    def pose(kind, power):
        result = tilt_pose(62*power, 0, power) if kind == 'Forward' else {}
        # Positive thigh Z lifts the foot forward in both imported bone bases.
        legs = {
            'Neutral': (75, -15, -65, -18),
            'Forward': (42, -75, 25, -65),
            'Back': (38, -70, -95, -8),
            'Up': (155, -12, 45, -90),
            'Down': (5, 8, -12, 8),
        }[kind]
        for name, angle in zip(('Bone_Leg1_R', 'Bone_Leg2_R', 'Bone_Leg1_L', 'Bone_Leg2_L'), legs):
            # A tucked anticipation releases to the directional contact pose.
            ready = 32 if 'Leg1' in name else -65
            result[name] = {'axis': 'Z', 'rotation': ready*(1-power)+angle*power}
        result['Bone_Chest'] = {'axis': 'Z', 'rotation': {'Neutral': -8, 'Forward': -15, 'Back': 20, 'Up': 28, 'Down': -25}[kind]*power}
        return result

    for kind, startup, active, duration in AERIALS:
        make_action('Aerial '+kind, {
            0: pose(kind, 0),
            max(1, startup-2): pose(kind, -.15),
            startup: pose(kind, 1),
            startup+active-1: pose(kind, 1),
            startup+active+5: pose(kind, .6),
            duration-5: pose(kind, 0),
            duration: {},
        }, duration)


def author_rifleman_aerials(author):
    contacts = {
        'Neutral': dict(leg_r=75, knee_r=-15, leg_l=-65, knee_l=-18, lean=-8, strike=.3),
        'Forward': dict(leg_r=42, knee_r=-75, leg_l=25, knee_l=-65, lean=-15, strike=1),
        'Back': dict(leg_r=38, knee_r=-70, leg_l=-95, knee_l=-8, lean=20, strike=-.15),
        'Up': dict(leg_r=155, knee_r=-12, leg_l=45, knee_l=-90, lean=28, strike=.25, elevation=65),
        'Down': dict(leg_r=5, knee_r=8, leg_l=-12, knee_l=8, lean=-25, strike=.2, elevation=-65),
    }
    tucked = dict(leg_r=32, knee_r=-65, leg_l=32, knee_l=-65)
    for kind, startup, active, duration in AERIALS:
        contact = contacts[kind]
        recovery = {k: v*.6+tucked.get(k, 0)*.4 for k,v in contact.items()}
        author('Aerial '+kind, {0:tucked, max(1,startup-2):tucked,
               startup:contact, startup+active-1:contact,
               startup+active+5:recovery, duration-5:tucked, duration:{}})
