"""Blender boundary: re-author the original fighters' weak strike clips (#156).

Each clip keeps its editable scene's other channels (mesh visibility, particle
gates) and replaces only the skeleton's keys, so the body winds up, reaches
toward the move's strike volume on its first active frame and follows through
over recovery. A clip is as many frames as its move, so clip frame N is attack
frame N. Run after the fighter's own authoring scripts:

  blender --background --python tools/animations/strikes.py -- archer|rifleman|illidan
"""
import json
import os
import sys
from math import radians, sqrt
from pathlib import Path

import addon_utils
import bpy
from mathutils import Matrix, Quaternion, Vector

project = Path(__file__).resolve().parents[2]
fighter = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else ''
SCENES = {
    'archer': project / 'build/animation-assets/archer-fighter',
    'rifleman': project / 'build/animation-assets/rifleman-fighter',
    'illidan': project / 'build/illidan-animation/demonhunter-fighter',
}
if fighter not in SCENES:
    raise ValueError('pass -- archer, rifleman or illidan')
sys.path.insert(0, os.environ.get('WC3_MDL_ADDON', '/home/tom/code/mdl-exporter4/worktrees/blender5'))
addon_utils.enable('export_mdl', default_set=True)
preferences = bpy.context.preferences.addons['export_mdl'].preferences
preferences.resourceFolder = str(project / 'build/animation-assets/textures')
preferences.textureExtension = 'png'
bpy.ops.wm.open_mainfile(filepath=str(SCENES[fighter].with_suffix('.blend')))
scene = bpy.context.scene
rig = next(o for o in scene.objects if o.type == 'ARMATURE')
bones = rig.pose.bones


def update():
    bpy.context.view_layer.update()


# Limb chains (upper, lower, end) and the elbow/knee pole side per fighter.
# The rigs share Warcraft's humanoid names; Archer's right hand ends at its
# reference node, as her original ground attacks solved it.
ARMS = {s: (f'Bone_Arm1_{s}', f'Bone_Arm2_{s}', f'Bone_Hand_{s}') for s in 'RL'}
if fighter == 'archer':
    ARMS['R'] = ('Bone_Arm1_R', 'Bone_Arm2_R', 'Hand Right Ref ')
LEGS = {s: (f'Bone_Leg1_{s}', f'Bone_Leg2_{s}', f'Bone_Foot_{s}') for s in 'RL'}
# The far end of each held weapon, aimed by turning its hand.
WEAPON_TIPS = {'archer': {'L': 'Box01'}, 'illidan': {'R': 'Plane36', 'L': 'Plane22'}, 'rifleman': {}}[fighter]
# Camera-side lateral offset (the stage camera looks along +Y).
SIDE = {'R': -1, 'L': 1}


def aim_bone(bone, endpoint, target):
    pivot = bone.matrix.translation.copy()
    q = (endpoint - pivot).rotation_difference(target - pivot)
    bone.matrix = Matrix.Translation(pivot) @ q.to_matrix().to_4x4() @ Matrix.Translation(-pivot) @ bone.matrix
    update()


def solve(chain, target, pole):
    upper, lower, end = (bones[n] for n in chain)
    start, joint, tip = (b.matrix.translation.copy() for b in (upper, lower, end))
    a, b = (joint - start).length, (tip - joint).length
    direction = (target - start).normalized()
    distance = min(max((target - start).length, abs(a - b) + .01), a + b - .01)
    across = pole - start
    across -= direction * across.dot(direction)
    if across.length < 1e-3:
        across = Vector((0, 1, 0))
    along = (a * a - b * b + distance * distance) / (2 * distance)
    bend = start + direction * along + across.normalized() * sqrt(max(0, a * a - along * along))
    aim_bone(upper, joint, bend)
    aim_bone(lower, end.matrix.translation.copy(), start + direction * distance)


def turn_about(names, pivot, angle):
    rotation = Matrix.Translation(pivot) @ Matrix.Rotation(radians(angle), 4, 'Y') @ Matrix.Translation(-pivot)
    for name in names:
        bones[name].matrix = rotation @ bones[name].matrix
    update()


def rig_slot(action):
    return next(s for s in action.slots if s.identifier[2:] == rig.name)


def sample(action, frame):
    rig.animation_data.action = action
    rig.animation_data.action_slot = rig_slot(action)
    scene.frame_set(frame)
    update()
    return {b.name: b.matrix_basis.copy() for b in bones}


def blend(a, b, t):
    out = {}
    for name, m in a.items():
        la, ra, sa = m.decompose()
        lb, rb, sb = b[name].decompose()
        out[name] = Matrix.LocRotScale(la.lerp(lb, t), ra.slerp(rb, t), sa.lerp(sb, t))
    return out


def ease(t):
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return tuple(x * (1 - t) + y * t for x, y in zip(a, b)) if isinstance(a, tuple) else a * (1 - t) + b * t


SCALARS = {'lean': 0., 'spin': 0., 'rise': 0., 'cloth': 0., 'rifle_pitch': 0., 'step': (0., 0.), 'rifle_lift': (0., 0.)}
TARGETS = ('hand_R', 'hand_L', 'foot_R', 'foot_L', 'aim_R', 'aim_L')


def params_at(keys, frame):
    frames = sorted(keys)
    left = max(k for k in frames if k <= frame)
    right = min(k for k in frames if k >= frame)
    t = 0. if left == right else ease((frame - left) / (right - left))
    p = {k: lerp(keys[left].get(k, d), keys[right].get(k, d), t) for k, d in SCALARS.items()}
    for k in TARGETS:
        a, b = keys[left].get(k), keys[right].get(k)
        if a is None and b is None:
            continue
        # A target present on one side only fades in or out of the base pose.
        p[k] = (Vector(lerp(a or b, b or a, t)), (1 - t if b is None else t if a is None else 1.))
    return p


def pose(p, base, standing, plant):
    for name, m in blend(base, standing, p['rise']).items():
        bones[name].matrix_basis = m
    bones['Bone_Root'].location = (0, 0, 0)
    update()
    planted = {s: bones[LEGS[s][2]].matrix.translation.copy() for s in 'RL'}
    hands = {s: bones[ARMS[s][2]].matrix.translation.copy() for s in 'RL'}
    chest_before = bones['Bone_Chest'].matrix.copy()
    body = [b.name for b in bones if b.parent is not None and b.parent.name == 'Bone_Root']
    pivot = bones['Bone_Pelvis'].matrix.translation.copy()
    if p['spin']:
        turn_about(body, pivot, p['spin'])
    dx, dz = p['step']
    for name in body:
        bones[name].matrix = Matrix.Translation(Vector((dx, 0, dz))) @ bones[name].matrix
    update()
    if p['lean']:
        turn_about(['Bone_Chest'], bones['Bone_Chest'].matrix.translation.copy(), p['lean'])
    ride = bones['Bone_Chest'].matrix @ chest_before.inverted()
    hip = bones['Bone_Pelvis'].matrix.translation
    for s in 'RL':
        target = p.get('foot_' + s)
        if target is None and not plant:
            continue
        goal = planted[s] if target is None else planted[s].lerp(target[0], target[1])
        solve(LEGS[s], goal, hip + Vector((40, SIDE[s] * 12, 10)))
    if fighter == 'rifleman':
        place_rifle(p, ride)
    else:
        chest = bones['Bone_Chest'].matrix.translation
        for s in 'RL':
            target = p.get('hand_' + s)
            if target is None:
                continue
            solve(ARMS[s], (ride @ hands[s]).lerp(target[0], target[1]), chest + Vector((-25, SIDE[s] * 45, -10)))
    for s, tip in WEAPON_TIPS.items():
        aim = p.get('aim_' + s)
        if aim is None:
            continue
        hand = bones[ARMS[s][2] if fighter != 'archer' else 'Bone_Hand_L']
        point = bones[tip].matrix.translation.copy()
        pivot = hand.matrix.translation.copy()
        q = Quaternion().slerp((point - pivot).rotation_difference(aim[0] - pivot), aim[1])
        hand.matrix = Matrix.Translation(pivot) @ q.to_matrix().to_4x4() @ Matrix.Translation(-pivot) @ hand.matrix
        update()
    if fighter == 'archer' and p['cloth']:
        # The long shoulder cloth hangs from the moving shoulder and trails
        # behind the strike instead of covering the striking limb.
        cloth = bones['Object08']
        location, orientation, scale = cloth.matrix.decompose()
        orientation = orientation.slerp(Quaternion(Vector((0, 1, 0)), radians(25)) @ cloth_rest, p['cloth'])
        cloth.matrix = Matrix.LocRotScale(location, orientation, scale)
        update()


def place_rifle(p, ride):
    # Rifle01 is a separate root: carry it with the chest, pitch it about the
    # two-hand grip (positive raises the muzzle), then solve both arms back to
    # their original grip points.
    rifle = bones['Rifle01']
    weapon = ride @ rifle_base
    center = ride @ grip_center
    dx, dz = p['rifle_lift']
    weapon = (Matrix.Translation(center + Vector((dx, 0, dz))) @ Matrix.Rotation(radians(-p['rifle_pitch']), 4, 'Y')
              @ Matrix.Translation(-center) @ weapon)
    rifle.matrix = weapon
    update()
    chest = bones['Bone_Chest'].matrix.translation
    for s in 'RL':
        solve(ARMS[s], weapon @ grips[s], chest + Vector((-20, SIDE[s] * 30, -15)))
        bones[f'Bone_Hand_{s}'].matrix = weapon @ rifle_base.inverted() @ hand_base[s]
    update()


def posed(name):
    # Illidan's stock attachments and alternate (demon-form) bones only follow
    # their parents; keying them every frame multiplies his export time.
    return fighter != 'illidan' or (name.startswith('Bone_') and 'Alternate' not in name)


def retime(action, slot, old_last, last):
    # Other channels (mesh visibility, particle gates) keep their place in the clip.
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                if bag.slot == slot:
                    for curve in list(bag.fcurves):
                        bag.fcurves.remove(curve)
                elif old_last != last:
                    for curve in bag.fcurves:
                        for key in curve.keyframe_points:
                            key.co.x = round(key.co.x * last / old_last)
                            key.handle_left.x = key.handle_right.x = key.co.x


def author(name, keys, plant=True, base_from=None, standing_from=None):
    action = bpy.data.actions.get(name)
    if action is None:
        source = bpy.data.actions[base_from]
        action = source.copy()
        action.name = name
    slot = rig_slot(action)
    base = sample(bpy.data.actions[base_from] if base_from else action, 0)
    standing = sample(bpy.data.actions[standing_from[0]], standing_from[1]) if standing_from else base
    old_last = int(action.frame_range[1])
    last = max(keys)
    retime(action, slot, old_last, last)
    action.use_frame_range = False
    rig.animation_data.action = action
    rig.animation_data.action_slot = slot
    previous = {}
    for frame in range(last + 1):
        scene.frame_set(frame)
        pose(params_at(keys, frame), base, standing, plant)
        for bone in bones:
            if frame not in (0, last) and not posed(bone.name):
                continue
            bone.rotation_mode = 'QUATERNION'
            q = bone.rotation_quaternion.copy()
            if bone.name in previous and previous[bone.name].dot(q) < 0:
                q.negate()
                bone.rotation_quaternion = q
            previous[bone.name] = q.copy()
            bone.keyframe_insert('rotation_quaternion', frame=frame, group=bone.name)
            if bone.name != 'Bone_Root':
                bone.keyframe_insert('location', frame=frame, group=bone.name)
            bone.keyframe_insert('scale', frame=frame, group=bone.name)
    print('STRIKE_CLIP', fighter, name, last, flush=True)
    return action


def swing(startup, active, total, wind, strike, follow, wind_at=None, follow_at=None, settle=None):
    """Rest, anticipation, a strike held over the active frames, follow-through, rest."""
    keys = {0: {}, wind_at or max(1, startup - 2): wind, startup: strike, startup + active - 1: strike,
            follow_at or min(total - 6, startup + active + 4): follow, total: {}}
    if settle is not None:
        keys[settle[0]] = settle[1]
    return keys


if fighter == 'archer':
    sample(bpy.data.actions['Stand Ready'], 0)
    cloth_rest = bones['Object08'].matrix.to_quaternion()
    # Jab (4/2/21): the bow arm drives the upper limb forward like a short spear.
    author('Attack Jab', swing(4, 2, 21,
        wind={'step': (-3, 0), 'lean': -6, 'hand_L': (14, 2, 64), 'hand_R': (-14, -18, 60), 'aim_L': (20, 0, 110), 'cloth': .5},
        strike={'step': (12, -2), 'lean': 16, 'hand_L': (52, -2, 64), 'hand_R': (-10, -16, 58), 'aim_L': (140, -4, 66),
                'foot_L': (40, 8, 1), 'cloth': 1},
        follow={'step': (8, -1), 'lean': 10, 'hand_L': (44, -2, 63), 'aim_L': (130, -4, 72), 'foot_L': (36, 8, 1), 'cloth': .7},
        settle=(14, {'step': (2, 0), 'lean': 3, 'hand_L': (38, -4, 64), 'aim_L': (60, 0, 130), 'cloth': .2})))
    # Forward tilts (5/2/28): a lunging side kick with the camera-side leg,
    # level, rising to head height, or skimming the floor.
    chamber = {'step': (-4, -4), 'foot_R': (8, -12, 34), 'hand_L': (10, 6, 58), 'cloth': .5}
    for name, foot, lean, step, wind in [('Forward Tilt', (90, -12, 48), -26, (24, 2), {**chamber, 'step': (-8, -2), 'lean': -10}),
                                         ('Forward Tilt Up', (68, -12, 116), -38, (18, 2), {**chamber, 'step': (-8, -6), 'lean': 4}),
                                         # The low kick chambers high and back so the drop to the floor reads.
                                         ('Forward Tilt Down', (94, -12, 4), 4, (32, -18), {**chamber, 'step': (-8, 2), 'lean': -14, 'foot_R': (4, -12, 44)})]:
        author(name, swing(5, 2, 28,
            wind=wind,
            strike={'step': step, 'lean': lean, 'foot_R': foot, 'foot_L': (34 + step[0] * .4, 8, 1),
                    'hand_L': (-18, 10, 66), 'hand_R': (-22, -18, 64), 'cloth': 1},
            follow={'step': (step[0] * .7, step[1] * .5), 'lean': lean * .6, 'foot_R': ((foot[0] + 20) * .6, -12, foot[2] * .7 + 10),
                    'foot_L': (34 + step[0] * .4, 8, 1), 'cloth': .7},
            settle=(18, {'step': (step[0] * .25, 0), 'foot_R': (6, -12, 6), 'cloth': .2})))
    # Up tilt (6/2/29): the bow sweeps from behind her hip over her head and
    # chops forward, its upper limb leading.
    author('Up Tilt', swing(6, 2, 29,
        wind={'step': (-4, -6), 'lean': -10, 'hand_L': (-22, 8, 50), 'aim_L': (-90, 8, 20), 'cloth': .5},
        strike={'step': (6, 4), 'lean': -14, 'hand_L': (26, 0, 100), 'aim_L': (150, 0, 124), 'hand_R': (-14, -18, 64), 'cloth': 1},
        follow={'step': (6, 0), 'lean': 8, 'hand_L': (34, 0, 70), 'aim_L': (90, 0, 10), 'cloth': .7},
        wind_at=3, settle=(19, {'step': (2, 0), 'hand_L': (36, -4, 70), 'aim_L': (60, 0, 130), 'cloth': .2})))
    # Down tilt (5/2/28), also the sliding dash attack's clip: she drops into
    # a crouch and sweeps the camera-side leg along the floor.
    author('Down Tilt', swing(5, 2, 28,
        wind={'step': (-10, -6), 'lean': -8, 'foot_R': (-8, -12, 20), 'hand_L': (4, 6, 60), 'cloth': .5},
        strike={'step': (30, -30), 'lean': 24, 'foot_R': (120, -12, 3), 'foot_L': (40, 8, 1), 'hand_L': (40, 6, 26), 'cloth': 1},
        follow={'step': (24, -26), 'lean': 18, 'foot_R': (92, -12, 4), 'foot_L': (40, 8, 1), 'hand_L': (34, 6, 30), 'cloth': .7},
        settle=(19, {'step': (3, -6), 'foot_R': (10, -12, 6), 'cloth': .2})))
    # Get-up attack (16/3/49): she sits up from her back, sweeps the
    # camera-side leg out in front at hip height while the bow swings behind
    # her, then stands. Grounded afterwards like her other recoveries.
    attack = author('Get Up Attack', {
        0: {},
        8: {'rise': .15, 'step': (-12, 0), 'foot_R': (10, -12, 24), 'hand_L': (-8, 4, 40)},
        16: {'rise': .3, 'step': (22, 6), 'foot_R': (102, -12, 44), 'hand_L': (-46, 4, 52), 'aim_L': (-130, 4, 40)},
        18: {'rise': .32, 'step': (22, 6), 'foot_R': (102, -12, 44), 'hand_L': (-46, 4, 52), 'aim_L': (-130, 4, 40)},
        26: {'rise': .55, 'step': (10, 0), 'foot_R': (46, -12, 20)},
        38: {'rise': .9},
        49: {'rise': 1.},
    }, plant=False, standing_from=('Get Up Attack', 45))
    sys.path.insert(0, str(project / 'tools/animations'))
    sys.dont_write_bytecode = True
    from grounding import ground_recovery
    ground_recovery(rig, attack, 49)
elif fighter == 'rifleman':
    def hold_rifle(action, frame=0):
        # The rifle's chest-relative hold and both grips, from a reference pose.
        global rifle_base, hand_base, grips, grip_center
        sample(bpy.data.actions[action], frame)
        rifle_base = bones['Rifle01'].matrix.copy()
        hand_base = {s: bones[f'Bone_Hand_{s}'].matrix.copy() for s in 'RL'}
        grips = {s: rifle_base.inverted() @ hand_base[s].translation for s in 'RL'}
        grip_center = (hand_base['R'].translation + hand_base['L'].translation) / 2

    hold_rifle('Aerial Up')
    # Up air (5/3/34): he drives the bayonet straight overhead with both
    # hands, arching back, and kicks one boot up beside it.
    author('Aerial Up', swing(5, 3, 34,
        wind={'rifle_pitch': -40, 'rifle_lift': (-4, -14), 'lean': 18, 'foot_R': (12, -10, 22), 'foot_L': (-4, 16, 20)},
        strike={'rifle_pitch': 82, 'rifle_lift': (-10, 22), 'lean': -18, 'foot_R': (16, -10, 62), 'foot_L': (-8, 16, 24)},
        follow={'rifle_pitch': 60, 'rifle_lift': (-6, 14), 'lean': -10, 'foot_R': (14, -10, 46)},
        settle=(22, {'rifle_pitch': 15, 'rifle_lift': (0, 4)})), plant=False)
    # Neutral air (3/28/41): a level bayonet lunge with the legs split front
    # and back, held through the long active window.
    author('Aerial Neutral', swing(3, 28, 41,
        wind={'rifle_pitch': 40, 'rifle_lift': (-14, 6), 'lean': -10, 'foot_R': (6, -10, 30), 'foot_L': (-6, 16, 30)},
        strike={'rifle_pitch': -4, 'rifle_lift': (16, 4), 'lean': 12, 'foot_R': (34, -10, 26), 'foot_L': (-30, 16, 22)},
        follow={'rifle_pitch': 10, 'rifle_lift': (4, 4), 'lean': 4, 'foot_R': (18, -10, 28), 'foot_L': (-14, 16, 26)},
        wind_at=1, follow_at=35), plant=False)
    # Down air (7/3/38): both boots stamp down beside the rifle, driven
    # muzzle-first below him.
    author('Aerial Down', swing(7, 3, 38,
        wind={'rifle_pitch': 50, 'rifle_lift': (-6, 14), 'lean': -8, 'foot_R': (10, -10, 40), 'foot_L': (-6, 16, 40)},
        strike={'rifle_pitch': -88, 'rifle_lift': (-10, -16), 'lean': 16, 'foot_R': (8, -10, 2), 'foot_L': (-8, 16, 4)},
        follow={'rifle_pitch': -60, 'rifle_lift': (-6, -8), 'lean': 10, 'foot_R': (8, -10, 12), 'foot_L': (-8, 16, 14)},
        wind_at=4), plant=False)
    # Ground normals (#151's kit; first active frame, active frames, total).
    # Each holds the rifle as his ready stance does.
    hold_rifle('Stand Ready')
    # Jab (3/3/22): a two-handed shove of the rifle stock at chest height.
    author('Attack Jab', swing(3, 3, 22,
        wind={'rifle_lift': (-10, 2), 'lean': -6, 'step': (-3, 0)},
        strike={'rifle_lift': (22, 6), 'rifle_pitch': 6, 'lean': 14, 'step': (10, 0)},
        follow={'rifle_lift': (16, 4), 'rifle_pitch': 4, 'lean': 10, 'step': (8, 0)},
        settle=(14, {'rifle_lift': (4, 1), 'lean': 3, 'step': (2, 0)})))
    # Forward tilts (6/3/30): a lunging bayonet thrust, level, rising or low.
    for name, pitch, lift, lean, step in [('Forward Tilt', 0, (26, 4), 18, (16, -2)),
                                          ('Forward Tilt Up', 34, (18, 16), 4, (12, 0)),
                                          ('Forward Tilt Down', -30, (22, -10), 24, (16, -12))]:
        author(name, swing(6, 3, 30,
            wind={'rifle_lift': (-16, 2), 'rifle_pitch': pitch * .3, 'lean': -10, 'step': (-6, -3)},
            strike={'rifle_lift': lift, 'rifle_pitch': pitch, 'lean': lean, 'step': step},
            follow={'rifle_lift': (lift[0] * .7, lift[1] * .7), 'rifle_pitch': pitch * .8, 'lean': lean * .7, 'step': (step[0] * .8, step[1] * .7)},
            settle=(20, {'rifle_lift': (4, 1), 'lean': 3, 'step': (3, 0)})))
    # Up tilt (5/3/30): the rifle swings up from his hip in an arc overhead
    # and on behind him.
    author('Up Tilt', swing(5, 3, 30,
        wind={'rifle_lift': (-4, -6), 'rifle_pitch': -20, 'lean': 8, 'step': (0, -6)},
        strike={'rifle_lift': (6, 34), 'rifle_pitch': 80, 'lean': -6, 'step': (4, 6)},
        follow={'rifle_lift': (-14, 16), 'rifle_pitch': 150, 'lean': -16, 'step': (0, 2)},
        settle=(20, {'rifle_lift': (-2, 8), 'rifle_pitch': 30, 'lean': -4})))
    # Down tilt (6/3/31): he drops to a crouch and sweeps the bayonet along
    # the floor in front.
    author('Down Tilt', swing(6, 3, 31,
        wind={'rifle_lift': (-10, 4), 'rifle_pitch': 18, 'lean': 4, 'step': (-2, -8)},
        strike={'rifle_lift': (22, -14), 'rifle_pitch': -26, 'lean': 26, 'step': (8, -18)},
        follow={'rifle_lift': (16, -12), 'rifle_pitch': -18, 'lean': 20, 'step': (6, -16)},
        settle=(21, {'rifle_lift': (4, -2), 'lean': 6, 'step': (2, -4)})))
else:
    clips_path = SCENES['illidan'].parent / 'clips.json'
    clips = json.loads(clips_path.read_text())
    fps = scene.render.fps / scene.render.fps_base

    def illidan(name, keys):
        author(name, keys)
        entry = next(c for c in clips if c['name'] == name)
        entry['frames'] = max(keys)
        entry['seconds'] = max(keys) / fps
        entry['samples'] = sorted(keys)

    # Jab (4/2/21): a straight thrust of the right warglaive, point first.
    illidan('Attack Jab', swing(4, 2, 21,
        wind={'step': (-4, 0), 'lean': -8, 'hand_R': (0, -28, 98), 'aim_R': (-30, -28, 140)},
        strike={'step': (12, 0), 'lean': 16, 'hand_R': (66, -18, 86), 'aim_R': (170, -18, 80), 'foot_R': (50, -15, 22)},
        follow={'step': (8, 0), 'lean': 10, 'hand_R': (56, -18, 84), 'aim_R': (150, -18, 100), 'foot_R': (46, -15, 22)}))
    # Forward tilts (5/2/28): a lunging sweep of the right glaive, level,
    # rising overhead, or cutting down to the floor in front.
    for name, hand, tip, lean, step in [('Forward Tilt', (72, -18, 82), (190, -18, 76), 22, (20, -4)),
                                        ('Forward Tilt Up', (50, -18, 146), (110, -18, 240), -12, (12, 0)),
                                        ('Forward Tilt Down', (76, -18, 38), (150, -18, -10), 40, (26, -24))]:
        illidan(name, swing(5, 2, 28,
            wind={'step': (-6, -4), 'lean': -10, 'hand_R': (-34, -30, 100), 'aim_R': (-80, -30, 60), 'hand_L': (-10, 25, 90)},
            strike={'step': step, 'lean': lean, 'hand_R': hand, 'aim_R': tip, 'hand_L': (-46, 25, 84), 'foot_R': (34 + step[0], -15, 22)},
            follow={'step': (step[0] * .7, step[1] * .6), 'lean': lean * .6, 'hand_R': (hand[0] * .6, -18, hand[2] * .8 + 15),
                    'aim_R': (tip[0] * .6, -18, tip[2] * .5 + 40), 'foot_R': (34 + step[0] * .7, -15, 22)}))
    # Down tilt (5/2/28): a low crouch with both glaives scything along the floor, front and back.
    illidan('Down Tilt', swing(5, 2, 28,
        wind={'step': (0, -18), 'lean': 14, 'hand_R': (10, -30, 70), 'hand_L': (-10, 30, 70)},
        strike={'step': (6, -30), 'lean': 26, 'hand_R': (64, -20, 32), 'aim_R': (150, -20, 8),
                'hand_L': (-52, 22, 34), 'aim_L': (-150, 22, 10)},
        follow={'step': (4, -24), 'lean': 18, 'hand_R': (52, -20, 40), 'aim_R': (130, -20, 30), 'hand_L': (-44, 22, 40), 'aim_L': (-120, 22, 30)}))
    # Down smash (8/9/42): both glaives sweep out to either side at the floor,
    # the warglaives of Azzinoth thrown wide; the fire follows on them.
    down_wind = {'step': (0, -10), 'lean': -6, 'hand_R': (-6, -30, 128), 'aim_R': (20, -30, 190), 'hand_L': (6, 30, 128), 'aim_L': (-20, 30, 190)}
    down_strike = {'step': (0, -26), 'lean': 18, 'hand_R': (66, -24, 46), 'aim_R': (170, -24, 14),
                   'hand_L': (-62, 24, 46), 'aim_L': (-170, 24, 14), 'foot_R': (44, -18, 22), 'foot_L': (-40, 18, 23)}
    down_follow = {**down_strike, 'step': (0, -20), 'lean': 12, 'hand_R': (58, -24, 52), 'hand_L': (-56, 24, 52)}
    illidan('Down Smash', swing(8, 9, 42, wind=down_wind, strike=down_strike, follow=down_follow, wind_at=5))
    # A released charge plays from the strike; the charge holds the wind-up.
    author('Down Smash Release', {0: down_strike, 8: down_strike, 14: down_follow, 28: {}, 34: {}}, base_from='Down Smash')
    author('Down Smash Charge', {0: down_wind, 24: down_wind}, base_from='Down Smash')
    clips_path.write_text(json.dumps(clips, indent=2))

scene.frame_set(0)
bpy.ops.wm.save_as_mainfile(filepath=str(SCENES[fighter].with_suffix('.blend')))
exported = SCENES[fighter].with_suffix('.mdl')
result = bpy.ops.export.mdl_exporter(filepath=str(exported), use_actions=True)
if 'FINISHED' not in result or not exported.is_file():
    raise RuntimeError(f'{fighter} strike export failed: {result}')
print('STRIKES_EXPORTED', fighter, exported, exported.stat().st_size, flush=True)
