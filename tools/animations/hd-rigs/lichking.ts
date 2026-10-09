export const character = 12;
export const stockPath = 'war3.w3mod:_de.w3mod:Units\\Undead\\EvilArthas\\UndeadArthas.mdx';
// No stock Definitive Lich King is a fighter body, so Definitive draws Death Knight Arthas with Frostmourne, without his horse.
export const dropGeosets = [7, 8, 29, 30, 31, 32, 33, 34];
// Stock Arthas carries Frostmourne in his left hand; the Lich King strikes with his right, so the stock body is mirrored
// and its L_ bones carry the Classic right side.
export const mirror = true;
export const alignRoot = true;
export const classic = {
    root: 'Root',
    pelvis: 'Stomach',
    chest: 'Chest',
    head: 'Head',
    'shoulder.L': 'Lshoulder',
    'elbow.L': 'Lelbow',
    'wrist.L': 'Lhand',
    'hip.L': 'Lhip',
    'knee.L': 'Lknee',
    'ankle.L': 'Lfoot',
    'shoulder.R': 'RShoulder',
    'elbow.R': 'Relbow',
    'wrist.R': 'Rhand',
    'hip.R': 'Rhip',
    'knee.R': 'Rknee',
    'ankle.R': 'Rfoot',
    weapon: 'Weapon',
} as const;
export const pairs: readonly (readonly [string, string])[] = [
    ['root', 'bone_turret'],
    ['pelvis', 'pelvis_bind_jnt'],
    ['pelvis', 'spine_02_bind_jnt'],
    ['chest', 'bone_chest'],
    ['head', 'neck_bind_jnt'],
    ['head', 'bone_head'],
    ['shoulder.L', 'R_upr_arm_bind_jnt'],
    ['elbow.L', 'R_lwr_arm_bind_jnt'],
    ['wrist.L', 'bone_hand_right'],
    ['shoulder.R', 'L_upr_arm_bind_jnt'],
    ['elbow.R', 'L_lwr_arm_bind_jnt'],
    ['wrist.R', 'bone_hand_left'],
    ['weapon', 'weapon_bind_jnt'],
    ['hip.L', 'R_leg_01_bind_jnt'],
    ['knee.L', 'R_leg_02_bind_jnt'],
    ['ankle.L', 'bone_leg_right'],
    ['hip.R', 'L_leg_01_bind_jnt'],
    ['knee.R', 'L_leg_02_bind_jnt'],
    ['ankle.R', 'bone_leg_left'],
];
