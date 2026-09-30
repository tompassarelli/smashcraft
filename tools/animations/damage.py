"""Authored damage poses; displacement and freeze duration belong to simulation."""


def author_archer_damage(author):
    ground = {"lean": -32, "head": 20, "hip": 12, "crouch": 5,
              "draw": 18, "bow_arm": -18, "leg_r": 22, "knee_r": -26,
              "leg_l": -12, "knee_l": 12}
    air = {"spin": -24, "lean": -28, "head": 16, "hip": 10,
           "draw": 34, "bow_arm": -30, "leg_r": 58, "knee_r": -64,
           "leg_l": -34, "knee_l": 28}
    tumble = {**air, "spin": -62, "lean": -18, "leg_r": 72,
              "knee_r": -80, "leg_l": -42, "knee_l": 36}
    shield = {"lean": 22, "head": -12, "crouch": 8, "hip": -10,
              "draw": -18, "bow_arm": 14, "leg_r": 24, "knee_r": -28,
              "leg_l": 16, "knee_l": -20}
    for name, contact in [("Damage Ground", ground), ("Damage Air", air),
                          ("Damage Tumble", tumble), ("Damage Shield", shield)]:
        settled = {key: value * .8 for key, value in contact.items()}
        # Frame zero already contains recoil: hitlag must never freeze idle.
        # The last pose remains a reaction until simulation releases hitstun.
        author(name, {0: contact, 3: contact, 12: settled, 24: settled}, 24)


def author_rifleman_damage(author):
    ground = {"lean": -30, "crouch": .45, "leg_r": 18, "knee_r": -24,
              "leg_l": -12, "knee_l": 10, "weapon_pitch": -18, "cape_lift": 25}
    air = {"spin": -24, "lean": -25, "leg_r": 60, "knee_r": -64,
           "leg_l": -40, "knee_l": 34, "weapon_pitch": -30, "cape_lift": 85}
    tumble = {**air, "spin": -62, "lean": -18, "leg_r": 78,
              "knee_r": -80, "leg_l": -48, "cape_lift": 105}
    shield = {"lean": 20, "crouch": .65, "leg_r": 22, "knee_r": -26,
              "leg_l": 14, "knee_l": -18, "weapon_pitch": -12}
    for name, contact in [("Damage Ground", ground), ("Damage Air", air),
                          ("Damage Tumble", tumble), ("Damage Shield", shield)]:
        settled = {key: value * .8 for key, value in contact.items()}
        author(name, {0: contact, 3: contact, 12: settled, 24: settled})
