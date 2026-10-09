export const character = 24;
export const stockPath = 'war3.w3mod:_de.w3mod:units\\nightelf\\Malfurion\\MalfurionNoStag.mdx';
// The stock body stands beside its stag (geosets 11 and 12); the approved fighter walks without it.
export const dropGeosets = [11, 12];
export const alignRoot = true;
// The stock arms are 33 units to Classic's 43.
export const limbScales = [['L_upr_arm_bind_jnt', 1.3], ['R_upr_arm_bind_jnt', 1.3]] as const;
export const classic = {
    root: 'Bone_RootArchDruid',
    pelvis: 'Bone_PelvisArchDruid',
    chest: 'Bone_ChestArchDruid',
    head: 'Bone_Head',
    'shoulder.L': 'Bone_Arm1_LArchDruid',
    'elbow.L': 'Bone_Arm2_LArchDruid',
    'wrist.L': 'Bone_Hand_LArchDruid',
    'hip.L': 'Bone_Leg1_LArchDruid',
    'knee.L': 'Bone_Leg2_LArchDruid',
    'ankle.L': 'Bone_Foot_LArchDruid',
    'shoulder.R': 'Bone_Arm1_RArchDruid',
    'elbow.R': 'Bone_Arm2_RArchDruid',
    'wrist.R': 'Bone_Hand_RArchDruid',
    'hip.R': 'Bone_Leg1_RArchDruid',
    'knee.R': 'Bone_Leg2_RArchDruid',
    'ankle.R': 'Bone_Foot_RArchDruid',
} as const;
export const pairs: readonly (readonly [string, string])[] = [
    ['root', 'bone_turret'],
    ['pelvis', 'pelvis_bind_jnt'],
    ['chest', 'spine_02_bind_jnt'],
    ['chest', 'bone_chest'],
    ['head', 'neck_bind_jnt'],
    ['head', 'bone_head'],
    ['shoulder.L', 'L_upr_arm_bind_jnt'],
    ['elbow.L', 'L_lwr_arm_bind_jnt'],
    ['wrist.L', 'bone_hand_left'],
    ['shoulder.R', 'R_upr_arm_bind_jnt'],
    ['elbow.R', 'R_lwr_arm_bind_jnt'],
    ['wrist.R', 'bone_hand_right'],
    ['Object16ArchDruid', 'weapon_bind_jnt'],
    ['hip.L', 'L_leg_01_bind_jnt'],
    ['knee.L', 'L_leg_02_bind_jnt'],
    ['ankle.L', 'bone_leg_left'],
    ['hip.R', 'R_leg_01_bind_jnt'],
    ['knee.R', 'R_leg_02_bind_jnt'],
    ['ankle.R', 'bone_leg_right'],
    ['hip.L', 'L_skirt_01_bind_jnt'],
    ['hip.R', 'R_skirt_01_bind_jnt'],
];
