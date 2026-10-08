export const character = 3;
export const stock = 'war3.w3mod:_de.w3mod:units\\orc\\heroblademaster\\heroblademaster.mdx';
// The local root carries authored flips; the pelvis and sword have independent motion.
export const pairs: readonly (readonly [string, string])[] = [
    ['Recovery Motion', 'local_C0_0_jnt'], ['Bone_Pelvis', 'spine_C0_0_jnt'], ['Bone_Root', 'spine_C0_1_jnt'],
    ['Bone_Chest', 'bone_chest'], ['Bone_Head', 'bone_head'],
    ['Bone_Arm1_L', 'arm_L0_0_jnt'], ['Bone_Arm2_L', 'arm_L0_2_jnt'], ['Bone_Hand_L', 'arm_L0_end_jnt'],
    ['Bone_Arm1_R', 'arm_R0_0_jnt'], ['Bone_Arm2_R', 'arm_R0_2_jnt'], ['Bone_Hand_R', 'arm_R0_end_jnt'],
    ['Bone_Leg1_L', 'leg_L0_0_jnt'], ['Bone_Leg2_L', 'leg_L0_2_jnt'], ['Bone_Foot_L', 'leg_L0_end_jnt'],
    ['Bone_Leg1_R', 'leg_R0_0_jnt'], ['Bone_Leg2_R', 'leg_R0_2_jnt'], ['Bone_Foot_R', 'leg_R0_end_jnt'],
    ['Sword', 'Wep01_R0_0_jnt'],
];
