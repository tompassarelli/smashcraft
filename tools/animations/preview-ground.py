"""Preview authored ground contact silhouettes from both gameplay sides."""
from pathlib import Path
import os
import sys
import bpy
from mathutils import Matrix, Vector

assets = Path(__file__).resolve().parents[2] / 'build/animation-assets'
sys.path.insert(0, str(Path(__file__).resolve().parent))
for fighter in ('archer', 'rifleman'):
    if os.environ.get('WC3_PREVIEW_FIGHTER', fighter) != fighter:
        continue
    bpy.ops.wm.open_mainfile(filepath=str(assets / f'{fighter}-fighter.blend'))
    scene = bpy.context.scene
    rig = next(o for o in scene.objects if o.type == 'ARMATURE')
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'MATERIAL'
    scene.render.resolution_x = 320
    scene.render.resolution_y = 320
    scene.render.resolution_percentage = 100
    target = Vector((5, 0, 60))
    bpy.ops.object.camera_add(location=(5, -350, 60))
    camera = bpy.context.object
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = 145
    scene.camera = camera
    textured = os.environ.get('WC3_TEXTURE_PREVIEW') == '1'
    if textured:
        scene.render.engine = 'CYCLES'
        scene.cycles.samples = 8
        scene.world.color = (.3, .3, .3)
        bpy.ops.object.light_add(type='SUN', location=(0, -200, 200))
        bpy.context.object.rotation_euler = (.4, -.5, -.5)
        bpy.context.object.data.energy = 3
    samples = [('Attack Jab', 0), ('Attack Jab', 4), ('Attack Jab', 12),
               ('Forward Tilt', 5), ('Up Tilt', 6), ('Down Tilt', 5)]
    if os.environ.get('WC3_PREVIEW_GRAB') == '1':
        samples = [('Grab', 5), ('Grab Hold', 0), ('Grabbed', 0)]
    if os.environ.get('WC3_PREVIEW_THROWS') == '1':
        from grab_animations import timing
        samples = [(name, timing(action)[0] - 1) for name, action in
                   [('Pummel', 'GRAB_PUMMEL'), ('Throw Forward', 'THROW_FORWARD'),
                    ('Throw Back', 'THROW_BACK'), ('Throw Up', 'THROW_UP'),
                    ('Throw Down', 'THROW_DOWN')]]
    for name, frame in samples:
        action = bpy.data.actions[name]
        for bone in rig.pose.bones:
            bone.matrix_basis = Matrix.Identity(4)
        rig.animation_data.action = action
        rig.animation_data.action_slot = action.slots[0]
        for mesh in (o for o in scene.objects if o.type == 'MESH'):
            slot = next((s for s in action.slots if s.identifier[2:] == mesh.name), None)
            if slot:
                mesh.animation_data_create()
                mesh.animation_data.action = action
                mesh.animation_data.action_slot = slot
        scene.frame_set(frame)
        for mesh in (o for o in scene.objects if o.type == 'MESH'):
            mesh.hide_render = mesh.get(mesh.name, {}).get('visibility', 1) < .5
        for side in ('stage', 'reverse'):
            camera.location.y = -350 if side == 'stage' else 350
            camera.rotation_euler = (target-camera.location).to_track_quat('-Z', 'Y').to_euler()
            suffix = '-textured' if textured else ''
            scene.render.filepath = str(assets / f'{fighter}-ground-{name.replace(" ", "-")}-{frame}-{side}{suffix}.png')
            bpy.ops.render.render(write_still=True)
