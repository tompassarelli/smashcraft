"""Blender boundary: keep Archer's complete held-bow pose in authored clips."""
import bpy
from mathutils import Matrix


def ready_pose(rig):
    action = bpy.data.actions['Stand Ready']
    rig.animation_data_create()
    rig.animation_data.action = action
    rig.animation_data.action_slot = action.slots[0]
    # Imported actions omit channels that are identity in the stock sequence.
    for bone in rig.pose.bones:
        bone.matrix_basis = Matrix.Identity(4)
    bpy.context.scene.frame_set(0)
    bpy.context.view_layer.update()
    base = {bone.name: bone.matrix_basis.copy() for bone in rig.pose.bones}
    base['Bone_Root'].translation = (0, 0, 0)
    return base


def key_pose(rig, frame):
    # The bow has its own rotation below the left hand. Key even unchanged
    # bones so a clip cannot fall back to its unheld reference orientation.
    for bone in rig.pose.bones:
        bone.rotation_mode = 'QUATERNION'
        bone.keyframe_insert('rotation_quaternion', frame=frame, group=bone.name)
        if bone.name != 'Bone_Root':
            bone.keyframe_insert('location', frame=frame, group=bone.name)
        bone.keyframe_insert('scale', frame=frame, group=bone.name)


def key_visibility(action, frame_end):
    for mesh in (obj for obj in bpy.context.scene.objects if obj.type == 'MESH'):
        groups = {mesh.vertex_groups[g.group].name
                  for vertex in mesh.data.vertices for g in vertex.groups if g.weight > 0}
        mesh.animation_data_create()
        mesh.animation_data.action = action
        mesh.animation_data.action_slot = action.slots.new('OBJECT', mesh.name)
        for frame in (0, frame_end):
            mesh[mesh.name]['visibility'] = 0.0 if groups <= {'Arrow', 'gutz00'} else 1.0
            mesh.keyframe_insert(data_path=f'["{mesh.name}"]["visibility"]', frame=frame)
