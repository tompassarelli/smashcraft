"""Keep authored recovery poses in contact with the stage without moving the unit root."""

import bpy
from mathutils import Matrix, Vector


def ground_recovery(rig, action, frame_end, floor_z=1.0):
    scene = bpy.context.scene
    rig.animation_data.action = action
    rig.animation_data.action_slot = action.slots[0]
    for mesh in (obj for obj in scene.objects if obj.type == "MESH"):
        slot = next((s for s in action.slots if s.identifier[2:] == mesh.name), None)
        if slot:
            mesh.animation_data_create()
            mesh.animation_data.action = action
            mesh.animation_data.action_slot = slot

    root = rig.pose.bones["Bone_Root"]
    root_rest_inverse = rig.data.bones["Bone_Root"].matrix_local.inverted()
    body_roots = [b for b in rig.pose.bones if b.bone.parent == rig.data.bones["Bone_Root"]]
    accessory_roots = [b for b in rig.pose.bones if b.bone.parent is None and b.name != "Bone_Root"]
    meshes = [obj for obj in scene.objects if obj.type == "MESH"]

    def lowest_visible_vertex_z():
        depsgraph = bpy.context.evaluated_depsgraph_get()
        minimum = None
        for obj in meshes:
            if obj.get(obj.name, {}).get("visibility", 1.0) < 0.5:
                continue
            evaluated = obj.evaluated_get(depsgraph)
            mesh = evaluated.to_mesh()
            try:
                for vertex in mesh.vertices:
                    z = (evaluated.matrix_world @ vertex.co).z
                    minimum = z if minimum is None else min(minimum, z)
            finally:
                evaluated.to_mesh_clear()
        if minimum is None:
            raise RuntimeError(f"{action.name} has no visible geometry")
        return minimum

    maximum_ground_error = 0.0
    for frame in range(frame_end + 1):
        scene.frame_set(frame)
        bpy.context.view_layer.update()




        root_delta = root.matrix @ root_rest_inverse
        for bone in accessory_roots:
            bone.matrix = root_delta @ bone.matrix
        bpy.context.view_layer.update()

        offset_z = floor_z - lowest_visible_vertex_z()
        shift = Matrix.Translation(Vector((0.0, 0.0, offset_z)))
        for bone in body_roots + accessory_roots:
            bone.matrix = shift @ bone.matrix
        bpy.context.view_layer.update()

        actual_floor_z = lowest_visible_vertex_z()
        error = abs(actual_floor_z - floor_z)
        maximum_ground_error = max(maximum_ground_error, error)
        if error > 0.1:
            raise RuntimeError(
                f"{action.name} frame {frame}: visible geometry missed floor by {error:.3f}"
            )



        for bone in rig.pose.bones:
            bone.rotation_mode = "QUATERNION"
            bone.keyframe_insert("rotation_quaternion", frame=frame, group=bone.name)
            if bone.name != "Bone_Root":
                bone.keyframe_insert("location", frame=frame, group=bone.name)
            bone.keyframe_insert("scale", frame=frame, group=bone.name)

        if root.location.length > 1e-5:
            raise RuntimeError(f"{action.name} frame {frame}: Bone_Root moved")

    print("GROUNDED_RECOVERY", action.name, frame_end, f"max_floor_error={maximum_ground_error:.4f}")
