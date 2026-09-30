"""Blender boundary: distinct in-place aerial strikes on the existing rigs."""

# Source frames map one-to-one to Simulation's move ticks via generated duration.
# Weapon poses stay with each rig's existing author rather than retargeting bones.
AERIALS = (
    ('Neutral', 3, 28, 41),
    ('Forward', 5, 2, 31),
    ('Back', 3, 16, 37),
    ('Up', 5, 3, 34),
    ('Down', 7, 3, 38),
)
ARCHER_AERIALS = tuple(
    (kind, startup, 20 if kind == 'Down' else active, duration)
    for kind, startup, active, duration in AERIALS
)

# Local XYZ angles measured from stage-plane joint directions on each stock rig.
# A Z-only lift points Archer's shin into camera depth and hides the kick.
ARCHER_NEUTRAL_ROTATIONS = {
    'Bone_Leg1_R': (51.826, 5.088, 67.167),
    'Bone_Leg2_R': (9.004, -0.111, 56.370),
    'Bone_Leg1_L': (-28.482, -3.005, -61.874),
    'Bone_Leg2_L': (-3.084, -2.057, -53.440),
    'Bone_Arm1_L': (-17.299, -13.453, 49.832),
    'Bone_Arm2_L': (17.561, 30.630, -47.977),
}
RIFLEMAN_NEUTRAL_ROTATIONS = {
    'Bone_Leg1_R': (28.534, 1.343, 63.502),
    'Bone_Leg2_R': (3.937, 3.037, 55.643),
    'Bone_Leg1_L': (-26.254, -0.004, -65.921),
    'Bone_Leg2_L': (0.951, -8.916, -43.790),
}


def author_archer_aerials(make_action, tilt_pose):
    def pose(kind, power):
        result = tilt_pose(62*power, 0, power) if kind == 'Forward' else {}
        # Positive thigh Z lifts the foot forward in both imported bone bases.
        legs = {
            'Neutral': (75, 20, -35, -80),
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
        if kind == 'Neutral':
            for name, angles in ARCHER_NEUTRAL_ROTATIONS.items():
                ready = (32 if 'Leg1' in name else -65) if 'Leg' in name else 0
                x, y, z = angles
                result[name] = {'rotations': [('Z', ready*(1-power)+z*power),
                                             ('Y', y*power), ('X', x*power)]}
            result['Bone_Chest'] = {'axis': 'Z', 'rotation': 12*power}
        return result

    for kind, startup, active, duration in ARCHER_AERIALS:
        if kind == 'Down':
            # Archer's diving kick starts as a compact tuck, then lengthens one
            # camera-facing leg below her while the far leg stays folded.
            # The bow remains on its original hand/bone chain; root travel is
            # still simulation-owned.
            startup_pose = {
                'Bone_Pelvis': {'location': (0, -6, 0)},
                'Bone_Chest': {'axis': 'Z', 'rotation': -34},
                'Bone_Head': {'axis': 'Z', 'rotation': 14},
                'Bone_Leg1_R': {'axis': 'Z', 'rotation': 54},
                'Bone_Leg2_R': {'axis': 'Z', 'rotation': -92},
                'Bone_Leg1_L': {'axis': 'Z', 'rotation': 48},
                'Bone_Leg2_L': {'axis': 'Z', 'rotation': -88},
            }
            contact_pose = {
                'Bone_Pelvis': {'location': (0, -2, 0)},
                'Bone_Chest': {'axis': 'Z', 'rotation': -48},
                'Bone_Head': {'axis': 'Z', 'rotation': 18},
                'Bone_Leg1_R': {'axis': 'Z', 'rotation': 2},
                'Bone_Leg2_R': {'axis': 'Z', 'rotation': 4},
                'Bone_Leg1_L': {'axis': 'Z', 'rotation': 68},
                'Bone_Leg2_L': {'axis': 'Z', 'rotation': -98},
            }
            recovery_pose = {
                'Bone_Pelvis': {'location': (0, -4, 0)},
                'Bone_Chest': {'axis': 'Z', 'rotation': -22},
                'Bone_Head': {'axis': 'Z', 'rotation': 8},
                'Bone_Leg1_R': {'axis': 'Z', 'rotation': 24},
                'Bone_Leg2_R': {'axis': 'Z', 'rotation': -38},
                'Bone_Leg1_L': {'axis': 'Z', 'rotation': 48},
                'Bone_Leg2_L': {'axis': 'Z', 'rotation': -82},
            }
            recovery_frame = min(startup + active + 5, duration - 6)
            make_action('Aerial Down', {
                0: startup_pose,
                max(1, startup - 2): startup_pose,
                startup: contact_pose,
                startup + active - 1: contact_pose,
                recovery_frame: recovery_pose,
                duration - 5: pose('Neutral', 0),
                duration: {},
            }, duration)
            continue
        make_action('Aerial '+kind, {
            0: pose(kind, 0),
            max(1, startup-2): pose(kind, -.15),
            startup: pose(kind, 1),
            startup+active-1: pose(kind, 1),
            min(startup+active+5, duration-6): pose(kind, .6),
            duration-5: pose(kind, 0),
            duration: {},
        }, duration)


def author_rifleman_aerials(author):
    contacts = {
        'Neutral': dict(leg_r=63.502, knee_r=55.643, leg_l=-65.921, knee_l=-43.790,
                        neutral_kick=1, weapon_lift=14, lean=5, strike=.1),
        'Forward': dict(leg_r=42, knee_r=-75, leg_l=25, knee_l=-65, lean=-15, strike=1),
        # Right leg is nearest the stage camera. Its rest knee is already bent;
        # positive knee rotation straightens the backward extension.
        'Back': dict(leg_r=-100, knee_r=40, leg_l=60, knee_l=-85, lean=25, strike=-.15,
                     cape_lift=125),
        'Up': dict(leg_r=155, knee_r=-12, leg_l=45, knee_l=-90, lean=28, strike=.25, elevation=65),
        'Down': dict(leg_r=5, knee_r=8, leg_l=-12, knee_l=8, lean=-25, strike=.2, elevation=-65),
    }
    tucked = dict(leg_r=32, knee_r=-65, leg_l=32, knee_l=-65)
    for kind, startup, active, duration in AERIALS:
        contact = contacts[kind]
        recovery = {k: v*.6+tucked.get(k, 0)*.4 for k,v in contact.items()}
        author('Aerial '+kind, {0:tucked, max(1,startup-2):tucked,
               startup:contact, startup+active-1:contact,
               min(startup+active+5, duration-6):recovery, duration-5:tucked, duration:{}})
