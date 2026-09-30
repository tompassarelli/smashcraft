"""Blender boundary: bake in-place ledge poses on each fighter's own rig."""
from math import radians, sqrt
import bpy
from mathutils import Matrix, Quaternion, Vector


def author_ledges(rig, fighter):
    scene = bpy.context.scene
    ready = bpy.data.actions['Stand Ready']
    rig.animation_data.action = ready
    rig.animation_data.action_slot = ready.slots[0]
    for bone in rig.pose.bones:
        bone.matrix_basis = Matrix.Identity(4)
    scene.frame_set(0)
    bpy.context.view_layer.update()
    base = {b.name: b.matrix_basis.copy() for b in rig.pose.bones}
    world = {b.name: b.matrix.copy() for b in rig.pose.bones}
    side = 'L'
    upper, lower, hand = [rig.pose.bones[f'Bone_{part}_{side}'] for part in ('Arm1', 'Arm2', 'Hand')]
    shoulder = world[upper.name].translation
    length = (world[lower.name].translation-shoulder).length + (world[hand.name].translation-world[lower.name].translation).length
    chest_inverse = world['Bone_Chest'].inverted()

    def aim(bone, endpoint, target):
        origin = bone.matrix.translation.copy()
        rotation = (endpoint-origin).rotation_difference(target-origin).to_matrix().to_4x4()
        bone.matrix = Matrix.Translation(origin) @ rotation @ Matrix.Translation(-origin) @ bone.matrix
        bpy.context.view_layer.update()

    def pose(reach, pull, tuck):
        for name, matrix in base.items():
            rig.pose.bones[name].matrix_basis = matrix
        rig.pose.bones['Bone_Root'].location = (0, 0, 0)
        for name, angle in [('Bone_Chest', -8*reach-12*pull), ('Bone_Leg1_R', 12*reach+65*tuck), ('Bone_Leg2_R', -18*reach-95*tuck), ('Bone_Leg1_L', 8*reach+35*tuck), ('Bone_Leg2_L', -12*reach-65*tuck)]:
            rig.pose.bones[name].matrix_basis = base[name] @ Quaternion(Vector((0,0,1)), radians(angle)).to_matrix().to_4x4()
        bpy.context.view_layer.update()
        if fighter == 'Rifleman':
            # Rifle is an independent stock root; carry it with the torso and
            # its right-hand grip while the left hand supports the fighter.
            chest_delta = rig.pose.bones['Bone_Chest'].matrix @ chest_inverse
            rig.pose.bones['Rifle01'].matrix = chest_delta @ world['Rifle01']
            bpy.context.view_layer.update()
        start = upper.matrix.translation.copy()
        rest = hand.matrix.translation.copy()
        hanging = start + Vector((length*.30, 0, length*(.91-.50*pull)))
        target = rest.lerp(hanging, reach)
        elbow = lower.matrix.translation.copy()
        wrist = hand.matrix.translation.copy()
        a, b = (elbow-start).length, (wrist-elbow).length
        delta = target-start
        distance = min(max(delta.length, abs(a-b)+.01), a+b-.01)
        direction = delta.normalized()
        pole = Vector((-1, -.35 if side == 'R' else .35, 0))
        pole -= direction*pole.dot(direction)
        along = (a*a-b*b+distance*distance)/(2*distance)
        elbow_target = start+direction*along+pole.normalized()*sqrt(max(0,a*a-along*along))
        aim(upper, elbow, elbow_target)
        aim(lower, hand.matrix.translation.copy(), start+direction*distance)

    for name, keys, looping in [
        ('Ledge Hang', {0:(1,0,0), 24:(1,0,0)}, True),
        ('Ledge Climb', {0:(1,0,0), 6:(1,.35,.35), 14:(1,1,1), 22:(.6,1,.6), 30:(0,0,0)}, False),
    ]:
        action = bpy.data.actions.new(name)
        action.use_fake_user = True
        action['war3_non_looping'] = not looping
        rig.animation_data.action = action
        rig.animation_data.action_slot = action.slots.new('OBJECT', rig.name)
        previous = {}
        for frame in range(max(keys)+1):
            scene.frame_set(frame)
            left, right = max(k for k in keys if k <= frame), min(k for k in keys if k >= frame)
            t = 0 if left == right else (frame-left)/(right-left)
            pose(*(a*(1-t)+b*t for a,b in zip(keys[left], keys[right])))
            for bone in rig.pose.bones:
                bone.rotation_mode = 'QUATERNION'
                if bone.name in previous and previous[bone.name].dot(bone.rotation_quaternion) < 0:
                    bone.rotation_quaternion.negate()
                previous[bone.name] = bone.rotation_quaternion.copy()
                bone.keyframe_insert('rotation_quaternion', frame=frame, group=bone.name)
                if bone.name != 'Bone_Root':
                    bone.keyframe_insert('location', frame=frame, group=bone.name)
                bone.keyframe_insert('scale', frame=frame, group=bone.name)
        for mesh in (o for o in scene.objects if o.type == 'MESH'):
            groups = {mesh.vertex_groups[g.group].name for v in mesh.data.vertices for g in v.groups if g.weight > 0}
            mesh.animation_data_create()
            mesh.animation_data.action = action
            mesh.animation_data.action_slot = action.slots.new('OBJECT', mesh.name)
            for frame in (0,max(keys)):
                mesh[mesh.name]['visibility'] = 0.0 if groups <= {'shell','gutz00'} else 1.0
                mesh.keyframe_insert(data_path=f'["{mesh.name}"]["visibility"]', frame=frame)
        print('LEDGE_CLIP', fighter, name, max(keys), 'frames', 'looping', looping)
    scene.frame_set(0)
