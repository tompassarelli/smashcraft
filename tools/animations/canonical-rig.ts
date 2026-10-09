import { model as mdx } from '../../ts/scripts/clipNodes';
import type { RetargetOptions } from './hd-retarget';

const SIDES = ['L', 'R'] as const;
const LIMB = ['clavicle', 'shoulder', 'elbow', 'wrist', 'hip', 'knee', 'ankle', 'toe'] as const;

/** The neutral humanoid rig every fighter's motion is stored on (smashcraft:docs/design/hd-fighters.md, #366). */
export const HUMANOID_JOINTS = [
    'root', 'pelvis', 'chest', 'neck', 'head',
    ...SIDES.flatMap(side => LIMB.map(joint => `${joint}.${side}` as const)),
    'weapon', 'weapon.L',
] as const;
export type HumanoidJoint = (typeof HUMANOID_JOINTS)[number];
const HUMANOID = new Set<string>(HUMANOID_JOINTS);

export const isLegJoint = (name: string) => /^(hip|knee|ankle|toe)\.[LR]$/.test(name);

/**
 * One fighter's two body mappings onto the rig. A rig module exports these fields and nothing else:
 * no move, sequence or frame appears in it, so every move reaches both bodies through the same mapping.
 */
export interface FighterRig extends RetargetOptions {
    readonly character: number;
    readonly stockPath?: string;
    /** Classic skeleton → rig: the Classic node that carries each humanoid joint. */
    readonly classic: Readonly<Partial<Record<HumanoidJoint, string>>>;
    /** Rig → Definitive skeleton: a humanoid joint, or one of the fighter's own secondary joints, and the Definitive bone it drives. */
    readonly pairs: readonly (readonly [string, string])[];
}
export const RIG_FIELDS: ReadonlySet<string> = new Set(['character', 'fighter', 'stockPath', 'classic', 'pairs', 'fitScale', 'limbScales', 'visibilityPairs']);

function renamed(model: mdx.Model, names: ReadonlyMap<string, string>): mdx.Model {
    const copy = structuredClone(model);
    for (const node of copy.Nodes) if (node !== undefined && names.has(node.Name)) node.Name = names.get(node.Name)!;
    return copy;
}

function classicNames(model: mdx.Model, rig: FighterRig): Map<string, string> {
    const names = new Map<string, string>();
    const present = new Set(model.Nodes.flatMap(node => node === undefined ? [] : [node.Name]));
    for (const [joint, node] of Object.entries(rig.classic)) {
        if (!HUMANOID.has(joint)) throw new Error(`${joint} is not a humanoid rig joint`);
        if (node === undefined || !present.has(node)) throw new Error(`Classic skeleton has no ${node} for ${joint}`);
        if (names.has(node)) throw new Error(`Classic ${node} carries two rig joints`);
        if (model.Nodes.filter(item => item?.Name === node).length !== 1) throw new Error(`Classic ${node} names more than one node`);
        names.set(node, joint);
    }
    for (const name of present) if (HUMANOID.has(name) && !names.has(name)) throw new Error(`Classic node ${name} shadows a rig joint`);
    return names;
}

/**
 * A fighter's canonical motion: its authored moves on the rig. Humanoid joints take their rig names, the fighter's
 * other animated nodes are its own secondary joints, and the mesh is the reference silhouette the bodies plant and
 * fit against. Today's Classic animations are its first source.
 */
export function canonicalMotion(authored: mdx.Model, rig: FighterRig): mdx.Model {
    return renamed(authored, classicNames(authored, rig));
}

/** The Classic skeleton driven by canonical motion: the Classic mapping applied in reverse. */
export function classicSkeleton(motion: mdx.Model, rig: FighterRig): mdx.Model {
    return renamed(motion, new Map(Object.entries(rig.classic).map(([joint, node]) => [joint, node!])));
}
