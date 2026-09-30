"""Ground Illidan's body without treating source hero glows as contact geometry."""
import bpy
from mathutils import Matrix

def ground_recovery(rig,action,frame_end):
 scene=bpy.context.scene;rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
 body=[bpy.data.objects[f'{i} HeroDemonHunter'] for i in (0,1,3,4,5)]
 for mesh in body:
  mesh.animation_data.action=action;mesh.animation_data.action_slot=next(s for s in action.slots if s.identifier[2:]==mesh.name)
 roots=[rig.pose.bones[n] for n in ('Bone_Chest','Bone_Pelvis')]
 error=0.
 for frame in range(frame_end+1):
  scene.frame_set(frame);bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
  def floor():
   return min((obj.evaluated_get(deps).matrix_world@v.co).z for obj in body for v in obj.evaluated_get(deps).data.vertices)
  offset=1.-floor()
  for bone in roots:bone.matrix=Matrix.Translation((0,0,offset))@bone.matrix
  bpy.context.view_layer.update();error=max(error,abs(floor()-1.))
  for bone in roots:bone.keyframe_insert('location',frame=frame,group=bone.name)
 assert error<.01,(action.name,error)
 print('ILLIDAN_GROUNDED',action.name,error,flush=True)
