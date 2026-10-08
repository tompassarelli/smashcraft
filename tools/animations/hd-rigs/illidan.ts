export const character = 2;
export const stock = 'war3.w3mod:_de.w3mod:units\\nightelf\\herodemonhunter\\herodemonhunter.mdx';
// DE weapons are independent root children; both need their authored blade transform.
export const pairs: readonly (readonly [string, string])[] = [
    ['Attack Gesture', 'root'], ['Bone_Pelvis', 'Pelvis'], ['Bone_Root', 'Spine1'],
    ['Bone_Chest', 'bone_chest'], ['Bone_Head', 'bone_head'],
    ['Bone_Arm1_L', 'Shoulder_L'], ['Bone_Arm2_L', 'Elbow_L'], ['Bone_Hand_L', 'Wrist_L'],
    ['Bone_Arm1_R', 'Shoulder_R'], ['Bone_Arm2_R', 'Elbow_R'], ['Bone_Hand_R', 'Wrist_R'],
    ['Bone_Leg1_L', 'Hip_L'], ['Bone_Leg2_L', 'Knee_L'], ['Bone_Foot_L', 'Ankle_L'],
    ['Bone_Leg1_R', 'Hip_R'], ['Bone_Leg2_R', 'Knee_R'], ['Bone_Foot_R', 'Ankle_R'],
    ['stand_blade_L', 'Weapon_L'], ['blade_base', 'Weapon_R'],
];
