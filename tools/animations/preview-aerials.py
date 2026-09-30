"""Render packaged MDX roundtrip geometry at aerial contact from the stage side."""
from pathlib import Path
import sys
import bpy, addon_utils
from mathutils import Vector, Matrix
assets=Path(__file__).resolve().parents[2]/'build/animation-assets'
sys.path.insert(0,'/home/tom/code/mdl-exporter4/worktrees/blender5')
addon_utils.enable('export_mdl',default_set=True)
p=bpy.context.preferences.addons['export_mdl'].preferences
p.resourceFolder=str(assets/'textures');p.textureExtension='png'
for fighter in ['archer','rifleman']:
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    for action in list(bpy.data.actions):bpy.data.actions.remove(action)
    getattr(bpy.ops,'import').mdl_exporter(filepath=str(assets/f'{fighter}-aerial-roundtrip.mdl'))
    scene=bpy.context.scene
    rig=next(o for o in scene.objects if o.type=='ARMATURE')
    scene.render.engine='BLENDER_WORKBENCH'
    scene.display.shading.light='STUDIO';scene.display.shading.color_type='MATERIAL'
    scene.render.resolution_x=320;scene.render.resolution_y=320;scene.render.resolution_percentage=100
    target=Vector((0,0,65));bpy.ops.object.camera_add(location=(0,-350,65));camera=bpy.context.object
    camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=175;scene.camera=camera
    for kind,frame in [('Neutral',3),('Forward',5),('Back',6),('Up',5),('Down',7)]:
        action=bpy.data.actions['Aerial '+kind]
        for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
        rig.animation_data_create();rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
        for obj in (o for o in scene.objects if o.type=='MESH'):
            slot=next((s for s in action.slots if s.identifier[2:]==obj.name),None)
            if slot:obj.animation_data_create();obj.animation_data.action=action;obj.animation_data.action_slot=slot
        scene.frame_set(frame)
        for obj in (o for o in scene.objects if o.type=='MESH'):obj.hide_render=obj.get(obj.name,{}).get('visibility',1)<.5
        scene.render.filepath=str(assets/f'{fighter}-aerial-{kind.lower()}.png');bpy.ops.render.render(write_still=True)
