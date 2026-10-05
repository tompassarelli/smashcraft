"""Preview both held fighters at the canonical simulation tether (model scale one)."""
from pathlib import Path
import json
import math
import os
import re
import sys

import bpy
from mathutils import Matrix, Vector

project = Path(__file__).resolve().parents[2]
assets = project / 'build/animation-assets'
sys.path.insert(0, str(project / 'tools/animations'))
from grab_animations import timing

source = (project / 'ts/src/game/sim/moves.ts').read_text()
distance = float(re.search(r'^export const GRAB_HOLD_DISTANCE = ([\d.]+);$', source, re.M)[1])
tag = os.environ.get('PAIR_TAG', 'current')
frames = [('hold', 'Grab Hold', 'Grabbed', 0),
          ('windup', 'Pummel', 'Victim Pummel', timing('GRAB_PUMMEL')[0] // 2),
          ('contact', 'Pummel', 'Victim Pummel', timing('GRAB_PUMMEL')[0] - 1)]
for holder, victim in [('archer', 'rifleman'), ('rifleman', 'archer')]:
    for label, holder_clip, victim_clip, frame in frames:
        geometry = []
        for index, (fighter, clip) in enumerate([(holder, holder_clip), (victim, victim_clip)]):
            bpy.ops.wm.open_mainfile(filepath=str(assets / f'{fighter}-fighter.blend'))
            scene = bpy.context.scene
            rig = next(obj for obj in scene.objects if obj.type == 'ARMATURE')
            action = bpy.data.actions[clip]
            for bone in rig.pose.bones:
                bone.matrix_basis = Matrix.Identity(4)
            rig.animation_data.action = action
            rig.animation_data.action_slot = action.slots[0]
            meshes = [obj for obj in scene.objects if obj.type == 'MESH']
            for mesh in meshes:
                slot = next((s for s in action.slots if s.identifier[2:] == mesh.name), None)
                if slot:
                    mesh.animation_data_create()
                    mesh.animation_data.action = action
                    mesh.animation_data.action_slot = slot
            scene.frame_set(frame)
            bpy.context.view_layer.update()
            transform = (Matrix.Identity(4) if index == 0 else
                         Matrix.Translation(Vector((distance, 0, 0))) @ Matrix.Rotation(math.pi, 4, 'Z'))
            points = {bone.name: tuple(round(value, 2) for value in transform @ bone.matrix.translation)
                      for bone in rig.pose.bones if bone.name in
                      ['Bone_Chest', 'Bone_Head', 'Bone_Pelvis', 'Bone_Hand_L', 'Bone_Hand_R', 'Hand Right Ref ']}
            print('PAIR_POINTS', holder, label, index, json.dumps(points))
            for mesh in meshes:
                if mesh.get(mesh.name, {}).get('visibility', 1) < .5:
                    continue
                evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
                data = evaluated.to_mesh()
                vertices = [tuple(transform @ mesh.matrix_world @ vertex.co) for vertex in data.vertices]
                geometry.append((vertices, [tuple(polygon.vertices) for polygon in data.polygons], index))
                evaluated.to_mesh_clear()
        bpy.ops.wm.read_factory_settings(use_empty=True)
        scene = bpy.context.scene
        for vertices, faces, index in geometry:
            data = bpy.data.meshes.new('skin')
            data.from_pydata(vertices, [], faces)
            data.update()
            obj = bpy.data.objects.new('skin', data)
            scene.collection.objects.link(obj)
            obj.color = (.25, .5, .9, 1) if index == 0 else (.95, .35, .2, 1)
        scene.render.engine = 'BLENDER_WORKBENCH'
        scene.display.shading.light = 'STUDIO'
        scene.display.shading.color_type = 'OBJECT'
        scene.world = bpy.data.worlds.new('World')
        scene.world.color = (.15, .15, .15)
        scene.render.resolution_x = 600
        scene.render.resolution_y = 450
        scene.render.resolution_percentage = 100
        bpy.ops.object.camera_add(location=(distance / 2, -350, 65))
        camera = bpy.context.object
        camera.data.type = 'ORTHO'
        camera.data.ortho_scale = 180
        scene.camera = camera
        for side in ['stage', 'reverse']:
            camera.location.y = -350 if side == 'stage' else 350
            camera.rotation_euler = (Vector((distance / 2, 0, 65)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
            scene.render.filepath = str(assets / f'pair-{tag}-{holder}-{label}-{side}.png')
            bpy.ops.render.render(write_still=True)
