"""Check original motion/geometry preservation and authored pose claims."""
from pathlib import Path
import bpy, hashlib, json
project=Path(__file__).resolve().parents[2];out=project/'build/illidan-animation'
def snapshot():
 actions={}
 for a in bpy.data.actions:
  curves=[]
  for layer in a.layers:
   for strip in layer.strips:
    for bag in strip.channelbags:
     slot=next(s for s in a.slots if s.handle==bag.slot_handle)
     if slot.identifier[2:]=='Illidan Wings':continue
     for c in bag.fcurves:curves.append((slot.identifier,c.data_path,c.array_index,[(tuple(k.co),k.interpolation,tuple(k.handle_left),tuple(k.handle_right)) for k in c.keyframe_points]))
  actions[a.name]=hashlib.sha256(repr(curves).encode()).hexdigest()
 geometry={o.name:([(tuple(v.co),[(g.group,g.weight) for g in v.groups]) for v in o.data.vertices],[tuple(p.vertices) for p in o.data.polygons]) for o in bpy.context.scene.objects if o.type=='MESH' and o.name!='Illidan Wings'}
 return actions,geometry,bpy.context.scene.render.fps
bpy.ops.wm.open_mainfile(filepath=str(project/'build/illidan-assets/demonhunter.blend'));stock,geometry,fps=snapshot()
bpy.ops.wm.open_mainfile(filepath=str(out/'demonhunter-fighter.blend'));authored,newgeo,newfps=snapshot()
assert geometry==newgeo,'Original geometry changed'
assert fps==newfps,'Original action timebase changed'
for name,digest in stock.items():assert authored[name]==digest,('Original action changed',name)
r=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');wing=bpy.data.objects['Illidan Wings']
for clip in json.loads((out/'clips.json').read_text()):
 a=bpy.data.actions[clip['name']];r.animation_data.action=a;r.animation_data.action_slot=a.slots[0]
 wing.animation_data.action=a;wing.animation_data.action_slot=next(s for s in a.slots if s.identifier[2:]==wing.name)
 for frame in [0,clip['frames']//2,clip['frames']]:
  bpy.context.scene.frame_set(frame)
  assert r.pose.bones['Bone_Root'].location.length<.001,('Root displacement',a.name,frame)
  visible=wing[wing.name]['visibility']
  if not a.name.startswith('Special Up'):assert visible==0,('Wing visible outside ascent',a.name)
 bpy.context.scene.frame_set(clip['frames']);assert wing[wing.name]['visibility']==0,('Wing interruption endpoint',a.name)
print('ILLIDAN_SCENE_PASS',len(stock),'stock actions exactly preserved;',len(geometry),'source geosets exactly preserved;',len(authored)-len(stock),'authored actions;',fps,'FPS')
