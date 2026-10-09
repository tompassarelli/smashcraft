export const character = 25;
export const stockPath = 'war3.w3mod:_de.w3mod:units\\creeps\\Medivh\\Medivh.mdx';
export const pairs: readonly (readonly [string, string])[] = [
    ['Bone_Root', 'bone_turret'], ['Bone_Chest', 'bone_chest'], ['Bone_Pelvis', 'pelvis_bind_jnt'], ['Bone_Head', 'bone_head'],
    ['Bone_Arm1_L', 'L_upr_arm_bind_jnt'], ['Bone_Arm2_L', 'L_lwr_arm_bind_jnt'], ['Bone_Hand_L', 'bone_hand_left'],
    ['Bone_Arm1_R', 'R_upr_arm_bind_jnt'], ['Bone_Arm2_R', 'R_lwr_arm_bind_jnt'], ['Bone_Hand_R', 'bone_hand_right'],
    ['Bone_Leg1_L', 'L_leg_01_bind_jnt'], ['Bone_Leg2_L', 'L_leg_02_bind_jnt'], ['Bone_Foot_L', 'bone_leg_left'],
    ['Bone_Leg1_R', 'R_leg_01_bind_jnt'], ['Bone_Leg2_R', 'R_leg_02_bind_jnt'], ['Bone_Foot_R', 'bone_leg_right'],
    ['Staff', 'weapon_bind_jnt'],
    ['Cape', 'L_cape_A_01_bind_jnt'], ['Mesh12', 'L_cape_A_02_bind_jnt'], ['Mesh11', 'L_cape_A_03_bind_jnt'],
    ['Mesh19', 'M_cape_A_01_bind_jnt'], ['Mesh20', 'M_cape_A_02_bind_jnt'], ['Mesh21', 'M_cape_A_03_bind_jnt'],
    ['Mesh16', 'R_cape_A_01_bind_jnt'], ['Mesh17', 'R_cape_A_02_bind_jnt'], ['Mesh18', 'R_cape_A_03_bind_jnt'],
    ['Mesh13', 'R_cape_B_01_bind_jnt'], ['Mesh14', 'R_cape_B_02_bind_jnt'], ['Mesh15', 'R_cape_B_03_bind_jnt'],
    ['Front Cape', 'R_cape_C_01_bind_jnt'], ['Front Cape A', 'R_cape_C_02_bind_jnt'],
    ['Bone00', 'raven_spine_01_bind_jnt'], ['Bone02', 'bone_chest_alternate'], ['Bone03', 'bone_head_alternate'],
    ['Bone11', 'raven_L_upr_arm_bind_jnt'], ['Bone12', 'raven_L_lwr_arm_bind_jnt'], ['Bone13', 'bone_hand_left_alternate'], ['Bone14', 'raven_L_wing_A_01_bind_jnt'],
    ['Bone15', 'raven_R_upr_arm_bind_jnt'], ['Bone16', 'raven_R_lwr_arm_bind_jnt'], ['Bone17', 'bone_hand_right_alternate'], ['Bone18', 'raven_R_wing_A_01_bind_jnt'],
    ['Bone20', 'raven_pelvis_bind_jnt'], ['Bone21', 'raven_tail_bind_jnt'],
];

// Classic geoset 0 is the staff-bearing human; geoset 1 is the raven.
// Every Definitive LOD of each form follows that form's authored fade.
export const visibilityPairs: readonly (readonly [number, number])[] = [
    [0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5],
    [1, 6], [1, 7],
    [0, 8], [0, 9], [0, 10], [0, 11], [0, 12], [0, 13],
    [0, 14], [0, 15], [0, 16], [0, 17], [0, 18], [0, 19],
    [0, 20], [0, 21], [0, 22], [0, 23], [0, 24], [0, 25],
    [1, 26], [1, 27], [1, 28], [1, 29], [1, 30], [1, 31],
];
export const fitScale = 0.75;
