export const character = 4;
export const stock = 'war3.w3mod:_de.w3mod:units\\human\\heromountainking\\heromountainking.mdx';
// The stock torso and head are larger relative to the legs than Classic's shared body (#362).
export const fitScale = 0.65;
// The axe and hammer are separate root bones in DE, rather than hand children.
export const pairs: readonly (readonly [string, string])[] = [
    ['Bone_Pelvis', 'spine_C0_0_jnt'], ['Bone_Chest', 'spine_C0_1_jnt'],
    ['Bone_Chest', 'bone_chest'], ['Bone_Head', 'bone_head'],
    ['Bone_Arm1_L', 'arm_L0_0_jnt'], ['Bone_Arm2_L', 'arm_L0_2_jnt'], ['Bone_Hand_L', 'arm_L0_end_jnt'],
    ['Bone_Arm1_R', 'arm_R0_0_jnt'], ['Bone_Arm2_R', 'arm_R0_2_jnt'], ['Bone_Hand_R', 'arm_R0_end_jnt'],
    ['Bone_Leg1_L', 'leg_L0_0_jnt'], ['Bone_Leg2_L', 'leg_L0_2_jnt'], ['Bone_Foot_L', 'leg_L0_end_jnt'],
    ['Bone_Leg1_R', 'leg_R0_0_jnt'], ['Bone_Leg2_R', 'leg_R0_2_jnt'], ['Bone_Foot_R', 'leg_R0_end_jnt'],
    ['1Cylinder03', 'Wep01_L0_0_jnt'], ['1Cylinder04', 'Wep01_R0_0_jnt'],
];
