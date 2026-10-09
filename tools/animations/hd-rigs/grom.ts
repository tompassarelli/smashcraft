export const character = 22;
export const stockPath = 'war3.w3mod:_de.w3mod:units\\orc\\Hellscream\\Hellscream.mdx';
export const classic = {
    root: 'Bone_Root',
    pelvis: 'Bone_Pelvis',
    chest: 'Bone_Chest',
    head: 'Bone_Head',
    'shoulder.L': 'Bone_Arm1_L',
    'elbow.L': 'Bone_Arm2_L',
    'wrist.L': 'Bone_Hand_L',
    'hip.L': 'Bone_Leg1_L',
    'knee.L': 'Bone_Leg2_L',
    'ankle.L': 'Bone_Foot_L',
    'shoulder.R': 'Bone_Arm1_R',
    'elbow.R': 'Bone_Arm2_R',
    'wrist.R': 'Bone_Hand_R',
    'hip.R': 'Bone_Leg1_R',
    'knee.R': 'Bone_Leg2_R',
    'ankle.R': 'Bone_Foot_R',
    weapon: 'Bone_Sword',
} as const;
export const pairs: readonly (readonly [string, string])[] = [
    ['root', 'bone_turret'], ['chest', 'bone_chest'], ['pelvis', 'pelvis_bind_jnt'],
    ['head', 'bone_head'],
    ['shoulder.L', 'L_upr_arm_bind_jnt'], ['elbow.L', 'L_lwr_arm_bind_jnt'], ['wrist.L', 'bone_hand_left'],
    ['shoulder.R', 'R_upr_arm_bind_jnt'], ['elbow.R', 'R_lwr_arm_bind_jnt'], ['wrist.R', 'bone_hand_right'],
    ['hip.L', 'L_leg_01_bind_jnt'], ['knee.L', 'L_leg_02_bind_jnt'], ['ankle.L', 'bone_leg_left'],
    ['hip.R', 'R_leg_01_bind_jnt'], ['knee.R', 'R_leg_02_bind_jnt'], ['ankle.R', 'bone_leg_right'],
    ['weapon', 'weapon_bind_jnt'], ['axe', 'weapon_stretch_bind_jnt'],
    ['Banner', 'flag_01_bind_jnt'], ['flag03', 'flag_02_bind_jnt'], ['flag02', 'flag_03_bind_jnt'], ['flag01', 'flag_04_bind_jnt'],
    ['Bone_Ponytai01', 'hair_tail_01_bind_jnt'], ['Bone_Ponytail', 'hair_tail_02_bind_jnt'],
];
