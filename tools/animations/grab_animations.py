"""Blender boundary: holder and captive poses for the Wurst grab actions."""
from pathlib import Path
import re


def timing(action):
    source = (Path(__file__).resolve().parents[2] / 'wurst/Simulation.wurst').read_text()
    # Consume the small Wurst action table; fail if its representation changes.
    def value(function):
        body = source.split('public function ' + function + '(int action) returns int\n', 1)[1].split('\nconstant ', 1)[0].split('\npublic ', 1)[0]
        specific = re.search(r'\tif action == ' + action + r'\n\t\treturn (\d+)\n', body)
        if specific:
            return int(specific[1])
        return int(re.findall(r'^\treturn (\d+)$', body, re.M)[-1])
    return value('grabContactFrame'), value('grabActionDuration')


def author_grabs(author, fighter):
    archer = fighter == 'Archer'
    hold = ({'arm_r': -38, 'forearm_r': 30, 'bow_arm': -20, 'lean': 4}
            if archer else {'grab': 1, 'weapon_pitch': 90, 'weapon_lift': 12, 'lean': 5})
    if archer:
        hold.update({'grab_pose': 1, 'reach_x': 36, 'reach_z': 68})
    # Keep the captive's weapon beside their own body. A forward ready grip
    # crosses the holder at the simulation's 50-unit pair spacing.
    captive = ({'lean': 10, 'head': -12, 'captive_pose': 1, 'hip': -8, 'crouch': 5}
               if archer else {'lean': 10, 'crouch': .25, 'weapon_pitch': 90,
                               'weapon_lift': 12, 'tuck': .12})
    author('Grab Hold', {0: hold, 24: hold}, 24)
    author('Grabbed', {0: captive, 24: captive}, 24)
    actions = [
        ('Pummel', 'GRAB_PUMMEL',
         {'leg_r': 65, 'knee_r': -100, 'lean': -12} if archer else
         {**hold, 'pummel_knee': 1, 'lean': -12}),
        ('Throw Forward', 'THROW_FORWARD',
         {'leg_r': 85, 'knee_r': -10, 'lean': 15, 'arm_r': -55, 'forearm_r': 20} if archer else {'strike': .9, 'lean': -20, 'weapon_lift': 8, 'grab': .2}),
        ('Throw Back', 'THROW_BACK',
         {'hip': -28, 'lean': 38, 'arm_r': -115, 'forearm_r': 15, 'leg_l': -25, 'knee_r': -20} if archer else {'lean': 32, 'weapon_pitch': -100, 'weapon_lift': 25, 'grab': -.6, 'cape_lift': 30}),
        ('Throw Up', 'THROW_UP',
         {'arm_r': -155, 'forearm_r': 5, 'lean': 8, 'head': -18, 'bow_arm': -30} if archer else {'weapon_pitch': -110, 'weapon_lift': 42, 'lean': 12, 'grab': -.5, 'cape_lift': 25}),
        ('Throw Down', 'THROW_DOWN',
         {'arm_r': -80, 'forearm_r': -35, 'lean': -48, 'crouch': 15, 'leg_r': 60, 'knee_r': -15, 'leg_l': -30} if archer else {'weapon_pitch': 65, 'weapon_lift': -30, 'lean': -42, 'crouch': 1, 'grab': .3}),
    ]
    for name, action, contact in actions:
        release, duration = timing(action)
        if archer:
            targets = {'GRAB_PUMMEL': (36, 68, .75, 55),
                       'THROW_FORWARD': (30, 70, 1, 43),
                       'THROW_BACK': (-35, 90, 0, 43),
                       'THROW_UP': (20, 120, 0, 43),
                       'THROW_DOWN': (35, 20, 1, 10)}
            x, z, kick, kick_z = targets[action]
            contact.update({'grab_pose': 1, 'reach_x': x, 'reach_z': z,
                            'kick': kick, 'kick_z': kick_z})
        windup = dict(hold)
        windup.update({'crouch': 12 if archer else .8, 'lean': 18})
        follow = dict(contact)
        follow['lean'] = contact.get('lean', 0) * .65
        rest = dict(hold) if action == 'GRAB_PUMMEL' else ({'grab_pose': 0, 'reach_x': contact['reach_x'], 'reach_z': contact['reach_z'], 'kick_z': contact['kick_z']} if archer else {})
        phases = {0: hold, max(1, release//2): windup, release-1: contact,
                  release+2: follow, duration-1: rest, duration: rest}
        author(name, phases, duration)
        reaction = dict(captive)
        if action == 'GRAB_PUMMEL':
            reaction['lean'] = 26
        elif action == 'THROW_BACK':
            reaction.update({'spin': 135, 'leg_r': 35, 'knee_r': -55})
        elif action == 'THROW_UP':
            reaction.update({'lean': -25, 'leg_r': -30, 'leg_l': 25})
        elif action == 'THROW_DOWN':
            reaction.update({'spin': 85, 'lean': 15, 'leg_r': 35, 'knee_r': -65})
        else:
            reaction.update({'lean': -45, 'leg_r': 35, 'knee_r': -50})
        # Victim translation is supplied by the canonical pair tether. Clips
        # only articulate the body; they cannot move the collision root.
        victim_phases = {0: captive, max(1, release//2): captive, release-1: reaction,
                         duration: captive if action == 'GRAB_PUMMEL' else reaction}
        author('Victim ' + name, victim_phases, duration)
