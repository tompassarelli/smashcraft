"""Render packaged MDX roundtrip geometry at aerial contact from the stage side."""
from pathlib import Path
import sys
import bpy, addon_utils
from mathutils import Vector, Matrix
assets=Path(__file__).resolve().parents[2]/'build/animation-assets'
sys.path.insert(0,str(Path(__file__).resolve().parent))
from aerials import AERIALS, ARCHER_AERIALS
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
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0,0,0))
    floor=bpy.context.object;floor.name='Preview floor at gameplay height';floor.scale=(250,80,0.5)
    floor_mat=bpy.data.materials.new('Preview stage');floor_mat.diffuse_color=(0.08,0.09,0.12,1)
    floor.data.materials.append(floor_mat)
    samples=[(kind,frame,'stage',f'{fighter}-aerial-{kind.lower()}') for kind,frame in [('Neutral',3),('Forward',5),('Back',3),('Up',5),('Down',7)]]
    samples += [('Knockdown',12,'stage',f'{fighter}-recovery-knockdown-12'),
                ('Get Up',0,'stage',f'{fighter}-recovery-getup-00'),
                ('Get Up',12,'stage',f'{fighter}-recovery-getup-12'),
                ('Get Up',30,'stage',f'{fighter}-recovery-getup-30'),
                ('Get Up Attack',16,'stage',f'{fighter}-recovery-getup-attack-16'),
                ('Get Up Attack',45,'stage',f'{fighter}-recovery-getup-attack-45')]
    down = next(item for item in (ARCHER_AERIALS if fighter == 'archer' else AERIALS) if item[0] == 'Down')
    _, down_startup, down_active, _ = down
    if fighter == 'archer':
        samples += [('Down',0,'stage','archer-dair-startup-stage'),
                    ('Down',down_startup,'stage','archer-dair-contact-stage'),
                    ('Down',down_startup+down_active-1,'stage','archer-dair-active-end-stage'),
                    ('Down',down_startup,'reverse','archer-dair-contact-reverse'),
                    ('Down',down_startup+down_active-1,'reverse','archer-dair-active-end-reverse')]
    samples += [('Spot Dodge',frame,'stage',f'{fighter}-spot-dodge-{frame:02d}') for frame in (0,5,15,22)]
    if fighter=='rifleman':
        samples += [('Back',frame,view,f'rifleman-backair-{view}-{frame:02d}') for view in ('stage','reverse') for frame in (0,3,6,7,18,24,32,37)]
    for kind,frame,view,filename in samples:
        action=bpy.data.actions['Aerial '+kind] if kind in {'Neutral','Forward','Back','Up','Down'} else bpy.data.actions[kind]
        for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
        rig.animation_data_create();rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
        for obj in (o for o in scene.objects if o.type=='MESH'):
            slot=next((s for s in action.slots if s.identifier[2:]==obj.name),None)
            if slot:obj.animation_data_create();obj.animation_data.action=action;obj.animation_data.action_slot=slot
        scene.frame_set(frame)
        camera.location.y=-350 if view=='stage' else 350
        camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
        for obj in (o for o in scene.objects if o.type=='MESH'):obj.hide_render=obj.get(obj.name,{}).get('visibility',1)<.5
        scene.render.filepath=str(assets/f'{filename}.png');bpy.ops.render.render(write_still=True)
