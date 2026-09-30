"""Render authored Illidan startup, contact and recovery from both stage sides."""
from pathlib import Path
import bpy,json,sys
from mathutils import Vector
project=Path(__file__).resolve().parents[2];out=project/'build/illidan-animation'
bpy.ops.wm.open_mainfile(filepath=str(out/'demonhunter-fighter.blend'))
scene=bpy.context.scene;rig=next(o for o in scene.objects if o.type=='ARMATURE')
scene.render.engine='BLENDER_EEVEE';scene.eevee.taa_render_samples=8
scene.world.color=(.3,.3,.3);scene.view_settings.view_transform='Standard'
scene.render.resolution_x=320;scene.render.resolution_y=320;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
bpy.ops.object.camera_add(location=(0,-420,85));camera=bpy.context.object;camera.data.type='ORTHO';camera.data.ortho_scale=220;scene.camera=camera
bpy.ops.object.light_add(type='AREA',location=(100,-180,250));bpy.context.object.data.energy=3500;bpy.context.object.data.size=250
samples={'Attack Jab':(1,4,24),'Forward Tilt':(2,5,22),'Forward Tilt Up':(2,5,22),'Forward Tilt Down':(2,5,22),'Up Tilt':(2,6,24),'Down Tilt':(2,5,22),'Forward Smash':(2,6,30),'Up Smash':(3,8,36),'Down Smash':(3,8,36),'Dash Attack':(1,4,26),'Aerial Neutral':(1,3,35),'Aerial Forward':(2,5,25),'Aerial Back':(1,3,31),'Aerial Up':(2,5,28),'Aerial Down':(3,7,32),'Special Neutral':(3,8,27),'Special Side':(1,6,18),'Special Up':(2,11,24),'Special Down':(1,4,21),'Damage Ground':(0,8,20),'Damage Air':(0,8,24),'Knockdown':(0,6,12),'Get Up Attack':(3,16,39),'Throw Up':(0,8,20)}
if '--only' in sys.argv:
 names=sys.argv[sys.argv.index('--only')+1].split(',');samples={n:samples[n] for n in names}
for name,frames in samples.items():
 a=bpy.data.actions[name];rig.animation_data.action=a;rig.animation_data.action_slot=a.slots[0]
 for m in (o for o in scene.objects if o.type=='MESH'):
  slot=next((s for s in a.slots if s.identifier[2:]==m.name),None)
  if slot:m.animation_data_create();m.animation_data.action=a;m.animation_data.action_slot=slot
 for side in ('stage','reverse'):
  camera.location=(0,-420 if side=='stage' else 420,85);camera.rotation_euler=(Vector((0,0,85))-camera.location).to_track_quat('-Z','Y').to_euler()
  for f in frames:
   scene.frame_set(f)
   for m in (o for o in scene.objects if o.type=='MESH'):m.hide_render=float(m.get(m.name,{}).get('visibility',1))<.5
   scene.render.filepath=str(out/(name.lower().replace(' ','-')+f'-{f:02d}-{side}.png'));bpy.ops.render.render(write_still=True)
print('ILLIDAN_PREVIEWS_DONE',flush=True)
