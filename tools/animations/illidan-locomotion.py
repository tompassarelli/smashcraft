"""Author walk, run and initial dash on Illidan's existing private Blender rig."""
import os, sys
sys.dont_write_bytecode = True
from pathlib import Path
from math import radians, sqrt, sin, cos, pi
import bpy, addon_utils
from mathutils import Matrix, Vector, Quaternion

source, destination = sys.argv[sys.argv.index('--') + 1:]
out = Path(destination)
out.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, os.environ.get('WC3_MDL_ADDON', '/home/tom/code/mdl-exporter4/worktrees/blender5'))
addon_utils.enable('export_mdl', default_set=True)
bpy.ops.wm.open_mainfile(filepath=source)
scene = bpy.context.scene
rig = next(o for o in scene.objects if o.type == 'ARMATURE')
ready = bpy.data.actions['Stand Ready']
rig.animation_data.action = ready
rig.animation_data.action_slot = next(s for s in ready.slots if s.identifier[2:] == rig.name)
scene.frame_set(0)
bpy.context.view_layer.update()
base = {b.name: b.matrix_basis.copy() for b in rig.pose.bones}
meshes = [o for o in scene.objects if o.type == 'MESH' and not o.particle_systems]
for mesh in meshes:
    slot = next((s for s in ready.slots if s.identifier[2:] == mesh.name), None)
    if slot:
        mesh.animation_data.action = ready
        mesh.animation_data.action_slot = slot
scene.frame_set(0)
bpy.context.view_layer.update()
visibility = {m.name: float(m.get(m.name, {}).get('visibility', 1)) for m in meshes}
visibility['Illidan Wings'] = 0
for action in list(bpy.data.actions):
    bpy.data.actions.remove(action)
scene.render.fps = 60

def rotate(name, degrees):
    bone = rig.pose.bones[name]
    matrix = bone.matrix.copy()
    pivot = matrix.translation
    bone.matrix = Matrix.Translation(pivot) @ Quaternion(Vector((0, 1, 0)), radians(degrees)).to_matrix().to_4x4() @ Matrix.Translation(-pivot) @ matrix
    bpy.context.view_layer.update()

def aim(bone, end, target):
    matrix = bone.matrix.copy()
    pivot = matrix.translation
    rotation = (end - pivot).rotation_difference(target - pivot)
    bone.matrix = Matrix.Translation(pivot) @ rotation.to_matrix().to_4x4() @ Matrix.Translation(-pivot) @ matrix
    bpy.context.view_layer.update()

def limb(side, kind, target, pole):
    parts = ('Arm1', 'Arm2', 'Hand') if kind == 'arm' else ('Leg1', 'Leg2', 'Foot')
    upper, lower, end = [rig.pose.bones[f'Bone_{part}_{side}'] for part in parts]
    pivot, elbow, wrist = upper.matrix.translation.copy(), lower.matrix.translation.copy(), end.matrix.translation.copy()
    a, b = (elbow - pivot).length, (wrist - elbow).length
    direction = target - pivot
    length = min(max(direction.length, abs(a - b) + .01), a + b - .01)
    axis = direction.normalized()
    bend = pole - pivot
    bend -= axis * bend.dot(axis)
    along = (a*a - b*b + length*length) / (2*length)
    joint = pivot + axis*along + bend.normalized()*sqrt(max(0, a*a - along*along))
    aim(upper, elbow, joint)
    aim(lower, end.matrix.translation.copy(), pivot + axis*length)

def foot(phase, span, lift, side):
    phase %= 1

    x = span*(1 - 4*phase) if phase < .5 else -span*cos((phase - .5)*2*pi)
    z = 23 + (lift*sin((phase - .5)*2*pi) if phase >= .5 else 0)
    return Vector((x, -15 if side == 'R' else 15, z))

def pose(kind, frame, frames):
    for name, matrix in base.items():
        rig.pose.bones[name].matrix_basis = matrix
    bpy.context.view_layer.update()
    phase = frame/frames
    running = kind != 'Walk'
    lean = 19 if running else 5
    crouch = 9 + 2*sin(phase*4*pi) if running else 3 + sin(phase*4*pi)
    if kind == 'Initial Dash Burst':
        lean = 10 + 17*sin(min(1, phase*2)*pi/2)
        crouch = 13 - 5*phase
        phase = .18 + phase*.32
    rotate('Bone_Chest', lean)
    for name in ('Bone_Chest', 'Bone_Pelvis'):
        rig.pose.bones[name].matrix = Matrix.Translation((0, 0, -crouch)) @ rig.pose.bones[name].matrix
    bpy.context.view_layer.update()
    for side, offset in [('R', 0), ('L', .5)]:
        p = phase + offset
        limb(side, 'leg', foot(p, 40 if running else 24, 36 if running else 12, side), Vector((80, -15 if side == 'R' else 15, 65)))
        swing = sin(p*2*pi)
        limb(side, 'arm', Vector((-20 + 15*swing if running else 8 + 9*swing, -28 if side == 'R' else 28, 82 + 5*swing)), Vector((-15, -70 if side == 'R' else 70, 90)))
    bpy.context.view_layer.update()

for kind, frames in [('Walk', 60), ('Run', 36), ('Initial Dash Burst', 10)]:
    action = bpy.data.actions.new('Locomotion ' + kind)
    action.use_fake_user = True
    action['war3_non_looping'] = kind == 'Initial Dash Burst'
    rig.animation_data.action = action
    rig.animation_data.action_slot = action.slots.new('OBJECT', rig.name)
    previous = {}
    for frame in range(frames + 1):
        scene.frame_set(frame)
        pose(kind, frame, frames)
        for bone in rig.pose.bones:
            bone.rotation_mode = 'QUATERNION'
            q = bone.rotation_quaternion.copy()
            if bone.name in previous and previous[bone.name].dot(q) < 0:
                q.negate()
                bone.rotation_quaternion = q
            previous[bone.name] = q.copy()
            for prop in ('rotation_quaternion', 'location', 'scale'):
                bone.keyframe_insert(prop, frame=frame, group=bone.name)
    for mesh in meshes:
        mesh.animation_data_create()
        mesh.animation_data.action = action
        mesh.animation_data.action_slot = action.slots.new('OBJECT', mesh.name)
        for frame in (0, frames):
            mesh[mesh.name]['visibility'] = visibility[mesh.name]
            mesh.keyframe_insert(data_path=f'["{mesh.name}"]["visibility"]', frame=frame)
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    for key in curve.keyframe_points:
                        key.interpolation = 'LINEAR'
    sys.path.insert(0, str(Path(__file__).parent))
    from importlib import import_module
    import_module('demonhunter-ground').ground_recovery(rig, action, frames)
    print('ILLIDAN_LOCOMOTION', kind, frames, flush=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'locomotion.blend'))
result = bpy.ops.export.mdl_exporter(filepath=str(out/'locomotion.mdl'), use_actions=True)
assert 'FINISHED' in result, result
