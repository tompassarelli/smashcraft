"""Blender boundary: distinct in-place aerial strikes on the existing rigs."""



AERIALS = (
    ('Neutral', 3, 28, 41),
    ('Forward', 5, 2, 31),
    ('Back', 3, 16, 37),
    ('Up', 5, 3, 34),
    ('Down', 7, 3, 38),
)
RIFLEMAN_NEUTRAL_ROTATIONS = {
    'Bone_Leg1_R': (28.534, 1.343, 63.502),
    'Bone_Leg2_R': (3.937, 3.037, 55.643),
    'Bone_Leg1_L': (-26.254, -0.004, -65.921),
    'Bone_Leg2_L': (0.951, -8.916, -43.790),
}


def author_rifleman_aerials(author):
    contacts = {
        'Neutral': dict(leg_r=63.502, knee_r=55.643, leg_l=-65.921, knee_l=-43.790,
                        neutral_kick=1, weapon_lift=14, lean=5, strike=.1),
        'Forward': dict(leg_r=42, knee_r=-75, leg_l=25, knee_l=-65, lean=-15, strike=1),


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
