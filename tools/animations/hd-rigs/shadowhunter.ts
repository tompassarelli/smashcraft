export const character = 9;
export const fighter = 'ShadowHunter';
export const stockPath = 'war3.w3mod:_de.w3mod:units\\orc\\HeroShadowHunter\\HeroShadowHunter.mdx';
// Leg-only fitting otherwise leaves the hands and glaive below Classic's floor while the feet stay planted (#362).
export const limbScales = [['arm_L0_0_jnt', 0.635], ['arm_R0_0_jnt', 0.745]] as const;
export const pairs: readonly (readonly [string, string])[] = [
    ['Bone_Pelvis', 'spine_C0_0_jnt'], ['Bone_Chest', 'spine_C0_1_jnt'],
    ['Bone_Chest', 'bone_chest'], ['Bone_Head', 'bone_head'],
    ['Bone_Head', 'neck_C0_0_jnt'], ['Bone_face', 'ffx_mouth_C0_jaw_jnt'],
    ['Beard1', 'beard_C0_0_jnt'], ['Beard03', 'beard_C0_1_jnt'], ['Beard04', 'beard_C0_2_jnt'],
    ['Object11', 'Wep01_R0_0_jnt'], ['Bone_Chest', 'back_weapon_root_C0_0_jnt'],
    ['Object02', 'skull_C0_0_jnt'], ['Object02', 'skull_L0_0_jnt'], ['Object02', 'skull_R0_0_jnt'],
    ['Bone_Arm1_L', 'arm_L0_0_jnt'],
    ['Bone_Arm1_L', 'arm_L0_1_jnt'], ['Bone_Arm2_L', 'arm_L0_2_jnt'],
    ['Bone_Arm2_L', 'arm_L0_3_jnt'], ['Bone_Hand_L', 'arm_L0_end_jnt'],
    ['Bone_Arm1_R', 'arm_R0_0_jnt'],
    ['Bone_Arm1_R', 'arm_R0_1_jnt'], ['Bone_Arm2_R', 'arm_R0_2_jnt'],
    ['Bone_Arm2_R', 'arm_R0_3_jnt'], ['Bone_Hand_R', 'arm_R0_end_jnt'],
    ['Bone_Leg1_L', 'leg_L0_0_jnt'], ['Bone_Leg1_L', 'leg_L0_1_jnt'],
    ['Bone_Leg2_L', 'leg_L0_2_jnt'], ['Bone_Leg2_L', 'leg_L0_3_jnt'],
    ['Bone_Foot_L', 'leg_L0_end_jnt'], ['Bone_Foot_L', 'foot_L0_0_jnt'],
    ['Bone_Leg1_R', 'leg_R0_0_jnt'], ['Bone_Leg1_R', 'leg_R0_1_jnt'],
    ['Bone_Leg2_R', 'leg_R0_2_jnt'], ['Bone_Leg2_R', 'leg_R0_3_jnt'],
    ['Bone_Foot_R', 'leg_R0_end_jnt'], ['Bone_Foot_R', 'foot_R0_0_jnt'],
];
