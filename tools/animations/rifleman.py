"""Blender boundary: author Rifleman's held-weapon melee and movement clips."""
import os
from pathlib import Path
import sys
from math import radians, sqrt
import bpy
from mathutils import Matrix, Quaternion, Vector
import addon_utils

project = Path(__file__).resolve().parents[2]
assets = project / 'build/animation-assets'
sys.path.insert(0, os.environ.get('WC3_MDL_ADDON', '/home/tom/code/mdl-exporter4/worktrees/blender5'))
addon_utils.enable('export_mdl', default_set=True)
prefs = bpy.context.preferences.addons['export_mdl'].preferences
prefs.resourceFolder = str(assets / 'textures')
prefs.textureExtension = 'png'
bpy.ops.wm.open_mainfile(filepath=str(assets / 'rifleman.blend'))
scene = bpy.context.scene
scene.render.fps = 24
scene.render.fps_base = 1
rig = next(o for o in scene.objects if o.type == 'ARMATURE')
rig.animation_data_create()
ready = bpy.data.actions['Stand Ready']
rig.animation_data.action = ready
rig.animation_data.action_slot = ready.slots[0]
scene.frame_set(0)
bpy.context.view_layer.update()
base = {b.name: b.matrix_basis.copy() for b in rig.pose.bones}
world = {b.name: b.matrix.copy() for b in rig.pose.bones}
required = ['Bone_Root', 'Bone_Pelvis', 'Bone_Chest', 'Rifle01'] + [f'Bone_{part}_{side}' for part in ('Arm1', 'Arm2', 'Hand', 'Leg1', 'Leg2') for side in ('L', 'R')]
assert all(n in base for n in required), 'Rifleman skeleton differs from authored rig'
assert rig.data.bones['Rifle01'].parent is None
# Rifle01 is a separate root in the stock model. Keep its hierarchy unchanged:
# bake its chest-relative pose and solve both arms to its original grip points.
chest_inverse = world['Bone_Chest'].inverted()
weapon_relative = chest_inverse @ world['Rifle01']
grips = {s: world['Rifle01'].inverted() @ world[f'Bone_Hand_{s}'].translation for s in ('L', 'R')}
center = sum((world[f'Bone_Hand_{s}'].translation for s in ('L', 'R')), Vector()) / 2
center_relative = chest_inverse @ center
poles = {s: chest_inverse @ world[f'Bone_Arm2_{s}'].translation for s in ('L', 'R')}


def rotation(axis, degrees):
    return Quaternion(Vector(axis), radians(degrees)).to_matrix().to_4x4()


def turn(name, degrees):
    # Inspected Rifleman body basis: local Z points along game -Y.
    rig.pose.bones[name].matrix_basis = base[name] @ rotation((0, 0, 1), degrees)


def aim_bone(name, endpoint, target):
    bone = rig.pose.bones[name]
    old = endpoint - bone.matrix.translation
    new = target - bone.matrix.translation
    m = bone.matrix.copy()
    q = old.rotation_difference(new)
    bone.matrix = Matrix.Translation(m.translation) @ q.to_matrix().to_4x4() @ Matrix.Translation(-m.translation) @ m
    bpy.context.view_layer.update()


def grip_arm(side, target, pole):
    upper, lower, hand = [rig.pose.bones[f'Bone_{part}_{side}'] for part in ('Arm1', 'Arm2', 'Hand')]
    shoulder = upper.matrix.translation.copy()
    elbow = lower.matrix.translation.copy()
    wrist = hand.matrix.translation.copy()
    a, b = (elbow - shoulder).length, (wrist - elbow).length
    delta = target - shoulder
    distance = min(max(delta.length, abs(a-b)+0.01), a+b-0.01)
    direction = delta.normalized()
    across = pole - shoulder
    across -= direction * across.dot(direction)
    if across.length < 0.001:
        across = direction.cross(Vector((0, 0, 1)))
    along = (a*a - b*b + distance*distance) / (2*distance)
    elbow_target = shoulder + direction*along + across.normalized()*sqrt(max(0, a*a-along*along))
    aim_bone(upper.name, elbow, elbow_target)
    aim_bone(lower.name, hand.matrix.translation.copy(), shoulder + direction*distance)


def pose(tuck=0, spin=0, lean=0, strike=0, elevation=0, crouch=0):
    for name, matrix in base.items():
        rig.pose.bones[name].matrix_basis = matrix
    # Root displacement belongs entirely to simulation, including aerial clips.
    turn('Bone_Root', spin)
    rig.pose.bones['Bone_Root'].location = (0, 0, 0)
    turn('Bone_Chest', lean)
    for side in ('L', 'R'):
        turn(f'Bone_Leg1_{side}', 62*tuck)
        turn(f'Bone_Leg2_{side}', -100*tuck)
    rig.pose.bones['Bone_Pelvis'].location += Vector((0, -12*crouch, 0))
    bpy.context.view_layer.update()
    chest = rig.pose.bones['Bone_Chest'].matrix.copy()
    pivot = chest @ center_relative
    # Swing the butt forward around the two-hand grip, with separate pitch for
    # the up/down strikes. No firing or shell-ejection action is reused.
    swing = rotation((0, 0, 1), 145*strike) @ rotation((0, 1, 0), elevation*abs(strike))
    local_swing = chest.to_3x3().to_4x4() @ world['Bone_Chest'].to_3x3().inverted().to_4x4()
    swing = local_swing @ swing @ local_swing.inverted()
    weapon = Matrix.Translation(pivot) @ swing @ Matrix.Translation(-pivot) @ chest @ weapon_relative
    rig.pose.bones['Rifle01'].matrix = weapon
    bpy.context.view_layer.update()
    for side in ('L', 'R'):
        grip_arm(side, weapon @ grips[side], chest @ poles[side])
    # Restore hand orientation relative to the weapon after the arm solve.
    for side in ('L', 'R'):
        hand = rig.pose.bones[f'Bone_Hand_{side}']
        hand.matrix = weapon @ world['Rifle01'].inverted() @ world[hand.name]
    bpy.context.view_layer.update()


def author(name, keys):
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    action['war3_non_looping'] = True
    slot = action.slots.new('OBJECT', rig.name)
    rig.animation_data.action = action
    rig.animation_data.action_slot = slot
    frames = sorted(keys)
    # Bake the foreign rig constraint solve; game playback needs no constraints.
    previous = {}
    for frame in range(frames[-1]+1):
        scene.frame_set(frame)
        left = max(k for k in frames if k <= frame)
        right = min(k for k in frames if k >= frame)
        t = 0 if left == right else (frame-left)/(right-left)
        params = {key: keys[left].get(key, 0)*(1-t)+keys[right].get(key, 0)*t for key in set(keys[left])|set(keys[right])}
        pose(**params)
        for bone in rig.pose.bones:
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
    # Authored non-firing clips keep the body visible and shell/gore hidden.
    # Store these on each mesh's imported visibility channel, not model bytes.
    for mesh in (o for o in scene.objects if o.type == 'MESH'):
        groups = {mesh.vertex_groups[g.group].name for v in mesh.data.vertices for g in v.groups if g.weight > 0}
        visible = 0.0 if groups <= {'shell', 'gutz00'} else 1.0
        mesh.animation_data_create()
        mesh.animation_data.action = action
        mesh.animation_data.action_slot = action.slots.new('OBJECT', mesh.name)
        for frame in (0, frames[-1]):
            mesh[mesh.name]['visibility'] = visible
            mesh.keyframe_insert(data_path=f'["{mesh.name}"]["visibility"]', frame=frame)
    scene.frame_set(0)
    print('RIFLEMAN_CLIP' , name, frames[-1], 'frames')


author('Attack Jab', {0:{}, 2:{'strike':-.12}, 4:{'strike':.65,'lean':-7}, 7:{'strike':.65,'lean':-7}, 14:{'strike':.2}, 22:{}, 36:{}})
for name, elevation in [('Forward Tilt',0), ('Forward Tilt Up',35), ('Forward Tilt Down',-35)]:
    author(name, {0:{}, 2:{'strike':-.2}, 5:{'strike':1,'elevation':elevation,'lean':-10}, 7:{'strike':1,'elevation':elevation,'lean':-10}, 14:{'strike':.45,'elevation':elevation}, 23:{}, 28:{}})
rolls = {0:(0,0), 2:(-8,.55), 4:(-35,1), 8:(-95,1), 12:(-180,1), 16:(-265,1), 23:(-360,.65), 31:(-360,0)}
for name, sign in [('Roll Forward',1), ('Roll Backward',-1)]:
    author(name, {f:{'spin':angle*sign,'tuck':tuck,'lean':-12*tuck} for f,(angle,tuck) in rolls.items()})
author('Jump', {0:{}, 3:{'tuck':.5}, 8:{'tuck':1,'lean':-8}, 14:{'tuck':.85}, 20:{'tuck':.3}, 24:{}})
author('Double Jump', {0:{}, 3:{'spin':-28,'tuck':.8}, 7:{'spin':-85,'tuck':1}, 12:{'spin':-170,'tuck':1}, 17:{'spin':-250,'tuck':1}, 22:{'spin':-320,'tuck':.9}, 30:{'spin':-360}})
author('Spot Dodge', {0:{}, 2:{'tuck':.25,'crouch':.4}, 5:{'tuck':.7,'crouch':1,'lean':-25}, 15:{'tuck':.7,'crouch':1,'lean':-25}, 19:{'tuck':.3,'crouch':.5}, 23:{}})
prone = {'spin':90,'tuck':.6}
author('Knockdown', {0:{}, 3:{'spin':28,'tuck':.3}, 7:prone, 12:prone})
author('Get Up', {0:prone, 5:prone, 12:{'spin':65,'tuck':.8}, 20:{'spin':30,'tuck':.45}, 26:{'spin':8,'tuck':.15}, 30:{}})
author('Get Up Attack', {0:prone, 5:{**prone,'strike':-.2}, 10:{'spin':70,'tuck':.8,'strike':-.3}, 16:{'spin':45,'tuck':.65,'strike':1}, 18:{'spin':35,'tuck':.5,'strike':1}, 25:{'spin':15,'tuck':.3,'strike':.4}, 38:{}, 45:{}})
scene.frame_set(0)
bpy.ops.wm.save_as_mainfile(filepath=str(assets / 'rifleman-fighter.blend'))
result = bpy.ops.export.mdl_exporter(filepath=str(assets / 'rifleman-fighter.mdl'), use_actions=True)
assert 'FINISHED' in result, result
print('RIFLEMAN_FIGHTER_EXPORTED', assets / 'rifleman-fighter.mdl')
