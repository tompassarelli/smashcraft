"""Blender boundary: holder and captive poses for the game's grab actions."""
from pathlib import Path
import re


def timing(action):
    source = (Path(__file__).resolve().parents[2] / 'ts/src/game/sim/moves.ts').read_text()

    def value(function):
        body = source.split('export function ' + function + '(action: GrabAction): number {', 1)[1].split('\n}', 1)[0]
        parts = action.removeprefix('GRAB_').lower().split('_')
        token = parts[0] + ''.join(part.title() for part in parts[1:])
        specific = re.search(r'case GrabAction\.' + token + r':\s+return (\d+);', body)
        if specific:
            return int(specific[1])
        return int(re.search(r'default:\s+return (\d+);', body)[1])
    return value('grabContactFrame'), value('grabActionDuration')


def author_grabs(author, fighter):
    hold = {'grab': 1, 'weapon_pitch': 90, 'weapon_lift': 12, 'lean': 5}
    captive = {'lean': 10, 'crouch': .25, 'weapon_pitch': 90, 'weapon_lift': 12, 'tuck': .12}
    author('Grab Hold', {0: hold, 24: hold}, 24)
    author('Grabbed', {0: captive, 24: captive}, 24)
    actions = [
        ('Pummel', 'GRAB_PUMMEL',
         {**hold, 'pummel_knee': 1, 'lean': -12}),
        ('Throw Forward', 'THROW_FORWARD',
         {'strike': .9, 'lean': -20, 'weapon_lift': 8, 'grab': .2}),
        ('Throw Back', 'THROW_BACK',
         {'lean': 32, 'weapon_pitch': -100, 'weapon_lift': 25, 'grab': -.6, 'cape_lift': 30}),
        ('Throw Up', 'THROW_UP',
         {'weapon_pitch': -110, 'weapon_lift': 42, 'lean': 12, 'grab': -.5, 'cape_lift': 25}),
        ('Throw Down', 'THROW_DOWN',
         {'weapon_pitch': 65, 'weapon_lift': -30, 'lean': -42, 'crouch': 1, 'grab': .3}),
    ]
    for name, action, contact in actions:
        release, duration = timing(action)
        windup = dict(hold)
        windup.update({'crouch': .8, 'lean': 18})
        follow = dict(contact)
        follow['lean'] = contact.get('lean', 0) * .65
        rest = dict(hold) if action == 'GRAB_PUMMEL' else ({})
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


        victim_phases = {0: captive, max(1, release//2): captive, release-1: reaction,
                         duration: captive if action == 'GRAB_PUMMEL' else reaction}
        author('Victim ' + name, victim_phases, duration)
