import { mat4, quat, vec3 } from '../../ts/node_modules/gl-matrix';
import { ModelRenderer, model as mdx, parseMDX, generateMDX } from '../../ts/scripts/clipNodes';
import { skinChunks } from '../../ts/scripts/mdxCodec';
import { tracks, onGlobalClock } from './original-clips';
import { isLegJoint } from './canonical-rig';

/** Match bodies use no camera; version 1800's camera record extends the old layout. */
export function parseHdBody(bytes: ArrayBuffer): mdx.Model {
    return parseMDX(skinChunks(bytes, false, true));
}

export function generateHdBody(model: mdx.Model): ArrayBuffer {
    return skinChunks(generateMDX(model), true, true);
}

export function checkBodySkin(model: mdx.Model) {
    const boneIds = new Set(model.Bones.map(bone => bone.ObjectId));
    let vertices = 0;
    for (const geoset of model.Geosets) {
        const skin = geoset.SkinWeights;
        if (skin === undefined || skin.length !== geoset.Vertices.length / 3 * 8) throw new Error('Definitive mesh has an incomplete skin');
        const matrices = new Set(geoset.Groups.flat());
        for (let vertex = 0; vertex < skin.length; vertex += 8) {
            let weight = 0;
            for (let influence = 0; influence < 4; influence++) {
                weight += skin[vertex + 4 + influence];
                if (skin[vertex + 4 + influence] === 0) continue;
                // SKIN IDs address node matrices directly, independently of matrix-group order.
                const id = skin[vertex + influence];
                if (!boneIds.has(id) || !matrices.has(id)) throw new Error('Definitive skin names an absent bone');
            }
            if (weight !== 255) throw new Error('Definitive skin weights do not sum to 255');
            vertices++;
        }
    }
    return { geosets: model.Geosets.length, vertices };
}


interface RenderState { frame: number; nodes: { matrix: mat4 }[]; geosetAlpha: number[] }
function evaluator(model: mdx.Model) {
    const renderer = new ModelRenderer(model);
    const state = Reflect.get(renderer, 'rendererData') as RenderState;
    const at = (sequence: number, frame: number) => {
        renderer.setSequence(sequence);
        state.frame = frame;
        renderer.update(0);
        return state.nodes.map(node => node && mat4.clone(node.matrix));
    };
    return Object.assign(at, { visibility: () => state.geosetAlpha });
}

function inverse(matrix: mat4): mat4 {
    const result = mat4.invert(mat4.create(), matrix);
    if (result === null) throw new Error('Singular retarget transform');
    return result;
}

function appendTransform(node: mdx.Node, matrix: mat4, frame: number): void {
    const rotation = mat4.getRotation(quat.create(), matrix);
    quat.normalize(rotation, rotation);
    const scaling = mat4.getScaling(vec3.create(), matrix);
    const pivot = node.PivotPoint;
    const translation = new Float32Array([0, 1, 2].map(axis => matrix[12 + axis] - pivot[axis]
        + matrix[axis] * pivot[0] + matrix[axis + 4] * pivot[1] + matrix[axis + 8] * pivot[2]));
    for (const [kind, vector] of [['Translation', translation], ['Rotation', rotation], ['Scaling', scaling]] as const) {
        node[kind] ??= { LineType: mdx.LineType.Linear, GlobalSeqId: null, Keys: [] };
        node[kind].Keys.push({ Frame: frame, Vector: new Float32Array(vector) });
    }
}

export interface RetargetSample { sequence: number; frame: number; expected: ReadonlyMap<number, mat4> }
export interface RetargetResult { model: mdx.Model; samples: RetargetSample[]; mapped: number; fit: number; props: readonly string[] }
export interface RetargetOptions {
    /** Classic geoset index → Definitive geoset index whose authored hide/show keys it takes. */
    readonly visibilityPairs?: readonly (readonly [number, number])[];
    /** Equal limb lengths don't establish a body's head height against the shared hurt capsules. */
    readonly fitScale?: number;
    /** A branch's fixed size about its root or a named anchor, including its attached skin. */
    readonly limbScales?: readonly (readonly [string, number, string?])[];
    /** The Definitive body stands where Classic stands, though its stock reference stance steps off the origin. */
    readonly alignRoot?: boolean;
    /** Definitive props parented to the body root that the hands carry: each hangs from its Classic parent's joint, as a parentless prop does. */
    readonly heldProps?: readonly string[];
    readonly stockRestJoints?: readonly string[];
}

const rotationOf = (matrix: mat4) => quat.normalize(quat.create(), mat4.getRotation(quat.create(), matrix));
const pivotOf = (matrix: mat4, pivot: ArrayLike<number>) => vec3.transformMat4(vec3.create(), pivot as vec3, matrix);
/** The rotation turning direction `from` onto `to`, with no turn about either. */
function swing(from: vec3, to: vec3): quat {
    const a = vec3.normalize(vec3.create(), from), b = vec3.normalize(vec3.create(), to);
    return quat.rotationTo(quat.create(), a, b);
}
/** p + turn about p applied to `matrix`: the pose `matrix` moved rigidly so its pivot lands on `to`. */
function turnedAbout(matrix: mat4, from: vec3, turn: quat, to: vec3): mat4 {
    const result = mat4.fromTranslation(mat4.create(), to);
    mat4.multiply(result, result, mat4.fromQuat(mat4.create(), turn));
    mat4.translate(result, result, vec3.negate(vec3.create(), from));
    return mat4.multiply(result, result, matrix);
}

/** The vertices joints carry: Classic vertices bound only (or, `partly`, at all) to `owner` and its unmapped descendants, or Definitive vertices whose heaviest bone is one of `owner` or their unmapped descendants. With no `mapped` joints, only `owner` itself counts. */
function ownedVertices(rig: mdx.Model, owner: number | readonly number[], mapped: ReadonlyMap<number, unknown>, partly = false) {
    const roots = new Set(typeof owner === 'number' ? [owner] : owner);
    const owns = (id: number) => {
        if (mapped.size === 0) return roots.has(id);
        for (let node: number | null | undefined = id; node != null; node = rig.Nodes[node]?.Parent) {
            if (roots.has(node)) return true;
            if (mapped.has(node)) return false;
        }
        return false;
    };
    const vertices: { geoset: number; vertex: number }[] = [];
    for (const [geoset, mesh] of rig.Geosets.entries()) {
        for (let vertex = 0; vertex < mesh.Vertices.length / 3; vertex++) {
            if (mesh.SkinWeights !== undefined) {
                let best = -1, weight = 0;
                for (let k = 0; k < 4; k++) if (mesh.SkinWeights[vertex * 8 + 4 + k] > weight) { weight = mesh.SkinWeights[vertex * 8 + 4 + k]; best = mesh.SkinWeights[vertex * 8 + k]; }
                if (best >= 0 && owns(best)) vertices.push({ geoset, vertex });
            } else if (partly ? (mesh.Groups[mesh.VertexGroup[vertex]] ?? []).some(owns) : (mesh.Groups[mesh.VertexGroup[vertex]] ?? []).every(owns)) vertices.push({ geoset, vertex });
        }
    }
    return vertices;
}

/** A vertex of `rig` posed by the node matrices `world` gives. */
function skinned(rig: mdx.Model, world: (id: number) => mat4, geoset: number, vertex: number): vec3 {
    const mesh = rig.Geosets[geoset], at = vec3.fromValues(mesh.Vertices[vertex * 3], mesh.Vertices[vertex * 3 + 1], mesh.Vertices[vertex * 3 + 2]);
    const out = vec3.create(), part = vec3.create();
    if (mesh.SkinWeights !== undefined) {
        for (let k = 0; k < 4; k++) { const weight = mesh.SkinWeights[vertex * 8 + 4 + k]; if (weight > 0) vec3.scaleAndAdd(out, out, vec3.transformMat4(part, at, world(mesh.SkinWeights[vertex * 8 + k])), weight / 255); }
    } else {
        const ids = mesh.Groups[mesh.VertexGroup[vertex]];
        for (const id of ids) vec3.scaleAndAdd(out, out, vec3.transformMat4(part, at, world(id)), 1 / ids.length);
    }
    return out;
}

/** The long axis of a prop's posed vertices, when they form an elongated shape: twice the variance along it as across it. */
function propAxis(rig: mdx.Model, pose: readonly mat4[], vertices: readonly { geoset: number; vertex: number }[]): vec3 | undefined {
    if (vertices.length < 12) return undefined;
    const points = vertices.map(({ geoset, vertex }) => skinned(rig, id => pose[id], geoset, vertex));
    const mean = points.reduce((sum, point) => vec3.scaleAndAdd(sum, sum, point, 1 / points.length), vec3.create());
    const covariance = [0, 1, 2].map(row => [0, 1, 2].map(column => points.reduce((sum, point) => sum + (point[row] - mean[row]) * (point[column] - mean[column]), 0) / points.length));
    let axis = vec3.fromValues(1, 1, 1);
    for (let iteration = 0; iteration < 64; iteration++) {
        const next = vec3.fromValues(...[0, 1, 2].map(row => covariance[row][0] * axis[0] + covariance[row][1] * axis[1] + covariance[row][2] * axis[2]) as [number, number, number]);
        if (vec3.length(next) < 1e-9) return undefined;
        axis = vec3.normalize(next, next);
    }
    const first = [0, 1, 2].reduce((sum, row) => sum + axis[row] * (covariance[row][0] * axis[0] + covariance[row][1] * axis[1] + covariance[row][2] * axis[2]), 0);
    const across = covariance[0][0] + covariance[1][1] + covariance[2][2] - first;
    return first >= 2 * Math.max(across, 1e-9) ? axis : undefined;
}

/**
 * Retargets authored Classic motion onto the stock Definitive skeleton (#362). Each mapped Definitive
 * joint takes its Classic joint's turn from the Classic Stand reference, after its rest direction is
 * swung onto the Classic rest direction; positions come from the Definitive skeleton's own bone lengths,
 * so limbs keep their length and joints stay joined. The whole-body helper above the mapped skeleton
 * (authored flips, squashes, drills, jumps) applies to the Definitive body unchanged. No Classic node is
 * copied: the body keeps the stock Definitive node count.
 */
export function retargetHd(source: mdx.Model, hd: mdx.Model, pairs: readonly (readonly [string, string])[], sequences: readonly mdx.Sequence[], options: RetargetOptions = {}): RetargetResult {
    return transferMotion(source, hd, registerRig(source, hd, pairs, options), sequences, options);
}

/**
 * The fixed per-fighter registration of a source rig onto a target skeleton: which target joints follow which
 * source joints, each joint's rest alignment, the size fit and the ground height. It is data about the two rest
 * poses only; `transferMotion` applies it to any motion of the source rig.
 */
export function registerRig(source: mdx.Model, hd: mdx.Model, pairs: readonly (readonly [string, string])[], options: RetargetOptions = {}) {
    const model = hd;
    const referenceSequence = (rig: mdx.Model) => {
        const ready = rig.Sequences.findIndex(sequence => /^Stand Ready(?:\s+\d+)?$/.test(sequence.Name));
        return ready >= 0 ? ready : rig.Sequences.findIndex(sequence => /^Stand(?:\s*-?\s*\d+)?$/.test(sequence.Name));
    };
    const sourceStand = referenceSequence(source);
    const hdStand = referenceSequence(hd);
    if (sourceStand < 0 || hdStand < 0) throw new Error('Retarget needs a Stand reference in both rigs');
    const sourceAt = evaluator(source), hdAt = evaluator(hd);
    const sourceReference = sourceAt(sourceStand, source.Sequences[sourceStand].Interval[0]);
    const hdReference = hdAt(hdStand, hd.Sequences[hdStand].Interval[0]);
    const correspondence = new Map<number, number>();
    const group = new Map<number, number[]>();
    for (const [classic, definitive] of pairs) {
        const from = source.Nodes.find(node => node?.Name === classic);
        const to = model.Bones.find(node => node.Name === definitive);
        if (from === undefined || to === undefined) throw new Error(`Unmapped required joint ${classic} → ${definitive}`);
        if (correspondence.has(to.ObjectId)) throw new Error(`Repeated Definitive target ${definitive}`);
        correspondence.set(to.ObjectId, from.ObjectId);
        group.set(from.ObjectId, [...group.get(from.ObjectId) ?? [], to.ObjectId]);
    }
    const classicAncestor = (id: number): number | undefined => {
        for (let parent = source.Nodes[id]?.Parent; parent != null; parent = source.Nodes[parent]?.Parent) if (group.has(parent)) return parent;
        return undefined;
    };
    const depth = (nodes: readonly (mdx.Node | undefined)[], id: number) => { let count = 0; for (let parent = nodes[id]?.Parent; parent != null; parent = nodes[parent]?.Parent) count++; return count; };
    // The whole-body frame: the Classic node above the topmost mapped joint. Authored helpers there move the whole body.
    const top = [...group.keys()].reduce((best, id) => depth(source.Nodes, id) < depth(source.Nodes, best) ? id : best);
    const bodyNode = source.Nodes[top]?.Parent ?? null;
    const bodyAt = (pose: readonly mat4[]) => bodyNode === null ? mat4.create() : pose[bodyNode];
    const body0 = bodyAt(sourceReference);
    const classicRest = new Map([...group.keys()].map(id => [id, pivotOf(sourceReference[id], source.Nodes[id].PivotPoint)]));
    const hdRest = (id: number) => pivotOf(hdReference[id], model.Nodes[id].PivotPoint);
    const head = (id: number) => group.get(id)![0];
    const children = new Map<number, number[]>();
    for (const id of group.keys()) { const parent = classicAncestor(id); if (parent !== undefined) children.set(parent, [...children.get(parent) ?? [], id]); }
    const heights = [...classicRest.values()].map(point => point[2]);
    const floorBand = Math.min(...heights) + 0.2 * (Math.max(...heights) - Math.min(...heights));
    const floorJoints = [...group.keys()].filter(id => classicRest.get(id)![2] <= floorBand);
    // Proportion: Definitive over Classic length of the legs (each foot up to the joint its legs share), or of every
    // mapped limb on a rig with no feet. The size fit undoes it, so planted feet stay planted and the body fills the
    // shared hurt capsules (#362).
    const length = (pairs: Iterable<readonly [number, number]>) => {
        let hdLength = 0, classicLength = 0;
        for (const [parent, child] of pairs) {
            hdLength += vec3.distance(hdRest(head(parent)), hdRest(head(child)));
            classicLength += vec3.distance(classicRest.get(parent)!, classicRest.get(child)!);
        }
        return classicLength > 1e-6 && hdLength > 1e-6 ? hdLength / classicLength : undefined;
    };
    const legs: [number, number][] = [];
    for (const [foot] of group) {
        if (classicRest.get(foot)![2] > floorBand || (children.get(foot)?.length ?? 0) > 0) continue;
        for (let joint = foot, parent = classicAncestor(joint); parent !== undefined && (children.get(parent)?.length ?? 0) < 2; joint = parent, parent = classicAncestor(joint)) legs.push([parent, joint]);
    }
    const limbs = [...children].flatMap(([parent, list]) => list.map(child => [parent, child] as const));
    const proportion = length(legs) ?? length(limbs) ?? 1;
    const fit = (options.fitScale ?? 1) / proportion;
    if (!Number.isFinite(fit) || fit <= 0) throw new Error('Retarget size fit must be positive and finite');
    const centroid = (points: vec3[]) => points.reduce((sum, point) => vec3.scaleAndAdd(sum, sum, point, 1 / points.length), vec3.create());
    // Rest alignment per Classic joint: swing the Definitive rest direction onto the Classic one.
    const alignment = new Map<number, quat>();
    const aimed = new Map<number, number[]>();
    const props: string[] = [];
    const ordered = [...group.keys()].sort((a, b) => depth(source.Nodes, a) - depth(source.Nodes, b));
    const minimum = 0.05 * (Math.max(...heights) - Math.min(...heights));
    for (const id of ordered) {
        const list = children.get(id) ?? [];
        const classicDirection = list.length === 0 ? undefined : vec3.sub(vec3.create(), centroid(list.map(child => classicRest.get(child)!)), classicRest.get(id)!);
        const hdDirection = list.length === 0 ? undefined : vec3.sub(vec3.create(), centroid(list.map(child => hdRest(head(child)))), hdRest(head(id)));
        const parent = classicAncestor(id);
        if (classicDirection !== undefined && hdDirection !== undefined && vec3.length(classicDirection) >= minimum && vec3.length(hdDirection) >= minimum) {
            alignment.set(id, swing(hdDirection, classicDirection));
            aimed.set(id, list);
        }
        // A foot keeps its own flat stance; a hand or head keeps its rest angle to its limb.
        else if (classicRest.get(id)![2] <= floorBand || parent === undefined) alignment.set(id, quat.create());
        else alignment.set(id, quat.clone(alignment.get(parent)!));
        if (options.stockRestJoints?.includes(source.Nodes[id].Name)) alignment.set(id, quat.create());
        // A long rigid prop (a weapon, staff or gun) points along its Classic counterpart: its strike direction is the move.
        if (aimed.has(id) || classicRest.get(id)![2] <= floorBand) continue;
        const classicAxis = propAxis(source, sourceReference, ownedVertices(source, id, group));
        const hdAxis = propAxis(model, hdReference, ownedVertices(model, group.get(id)!, correspondence));
        if (classicAxis !== undefined && hdAxis !== undefined) {
            props.push(source.Nodes[id].Name);
            const current = vec3.transformQuat(vec3.create(), hdAxis, alignment.get(id)!);
            if (vec3.dot(current, classicAxis) < 0) vec3.negate(classicAxis, classicAxis);
            alignment.set(id, quat.multiply(quat.create(), swing(current, classicAxis), alignment.get(id)!));
        }
    }
    // Definitive hierarchy: a parentless mapped joint hangs from the joint mapped to its Classic parent.
    const descends = (id: number, ancestor: number) => { for (let parent = model.Nodes[id]?.Parent; parent != null; parent = model.Nodes[parent]?.Parent) if (parent === ancestor) return true; return false; };
    const logicalParent = new Map<number, number | null>();
    for (const node of model.Nodes) {
        if (node === undefined) continue;
        if (node.Parent != null && !options.heldProps?.includes(node.Name)) { logicalParent.set(node.ObjectId, node.Parent); continue; }
        const classic = correspondence.get(node.ObjectId);
        const ancestor = classic === undefined ? undefined : classicAncestor(classic);
        const last = ancestor === undefined ? undefined : group.get(ancestor)!.at(-1)!;
        logicalParent.set(node.ObjectId, last === undefined || descends(last, node.ObjectId) ? null : last);
    }
    const order: number[] = [];
    const visited = new Set<number>();
    const visit = (id: number) => { if (visited.has(id)) return; visited.add(id); const parent = logicalParent.get(id); if (parent != null) visit(parent); order.push(id); };
    for (const node of model.Nodes) if (node !== undefined) visit(node.ObjectId);
    const limbScales = (options.limbScales ?? []).map(([name, scale, anchorName]) => {
        const root = model.Bones.find(bone => bone.Name === name);
        if (root === undefined) throw new Error(`Unmapped size-fit limb ${name}`);
        const anchor = anchorName === undefined ? root : model.Bones.find(bone => bone.Name === anchorName);
        if (anchor === undefined) throw new Error(`Unknown size-fit anchor ${anchorName}`);
        if (!Number.isFinite(scale) || scale <= 0) throw new Error(`Invalid size fit for ${name}`);
        const ids = order.filter(id => {
            for (let ancestor: number | null | undefined = id; ancestor != null; ancestor = logicalParent.get(ancestor)) if (ancestor === root.ObjectId) return true;
            return false;
        });
        return { root: root.ObjectId, anchor: anchor.ObjectId, scale, ids };
    });
    const fittedRoots = new Set(limbScales.map(({ root }) => root));
    // Mapped joints drop the stock stance's slight squash and stretch, so every keyed joint is rigid and keys exactly.
    const rigidReference = new Map([...correspondence.keys()].map(id => {
        const rest = hdRest(id), pivot = model.Nodes[id].PivotPoint;
        const matrix = mat4.fromRotationTranslation(mat4.create(), rotationOf(hdReference[id]), rest);
        return [id, mat4.translate(matrix, matrix, [-pivot[0], -pivot[1], -pivot[2]])] as const;
    }));
    // A joint on the way to a mapped joint (a twist joint) keeps its stock offset without the stance's squash:
    // a squashed parent would shear its turned child, and a node keys no shear.
    const onPath = new Set<number>();
    for (const id of correspondence.keys()) for (let parent = logicalParent.get(id); parent != null; parent = logicalParent.get(parent)) if (!correspondence.has(parent)) onPath.add(parent);
    for (const id of fittedRoots) onPath.add(id);
    const constantLocal = new Map<number, mat4>();
    const referenceWorld = new Map<number, mat4>();
    for (const id of order) {
        const parent = logicalParent.get(id) ?? null;
        if (correspondence.has(id)) { referenceWorld.set(id, rigidReference.get(id)!); continue; }
        if (parent === null) { referenceWorld.set(id, hdReference[id]); continue; }
        let local = mat4.multiply(mat4.create(), inverse(hdReference[parent]), hdReference[id]);
        if (onPath.has(id)) {
            const pivot = model.Nodes[id].PivotPoint;
            const rigid = mat4.fromRotationTranslation(mat4.create(), rotationOf(local), pivotOf(local, pivot));
            local = mat4.translate(rigid, rigid, [-pivot[0], -pivot[1], -pivot[2]]);
        }
        constantLocal.set(id, local);
        referenceWorld.set(id, mat4.multiply(mat4.create(), referenceWorld.get(parent)!, local));
    }
    const drawnVertices = (rig: mdx.Model, vertices: ReturnType<typeof ownedVertices>) => {
        const used = rig.Geosets.map(mesh => rig.Materials[mesh.MaterialID]?.Layers.some(layer => Number(layer.FilterMode) <= 2) ? new Set(mesh.Faces) : new Set<number>());
        return vertices.filter(({ geoset, vertex }) => used[geoset].has(vertex));
    };
    const classicLegs = [...group.keys()].filter(id => isLegJoint(source.Nodes[id].Name) || /leg|foot|ankle|shin|toe|paw/i.test(source.Nodes[id].Name)
        || group.get(id)!.some(target => /leg|foot|ankle|toe|paw|mount_bone_hand/i.test(model.Nodes[target].Name)));
    const targetLegs = classicLegs.flatMap(id => group.get(id)!);
    const classicBody = drawnVertices(source, ownedVertices(source, [...group.keys()], group, true));
    const targetBody = drawnVertices(model, ownedVertices(model, [...correspondence.keys()], correspondence));
    const classicSoles = classicLegs.length === 0 ? classicBody : drawnVertices(source, ownedVertices(source, classicLegs, group, true));
    const soles = targetLegs.length === 0 ? targetBody : drawnVertices(model, ownedVertices(model, targetLegs, correspondence));
    const legSupport = classicLegs.length > 0 && classicSoles.length > 0 && soles.length > 0;
    const targetVisibility = [...hdAt.visibility()];
    const visible = (rig: mdx.Model, geoset: number) => {
        if (rig === source) return (sourceAt.visibility()[geoset] ?? 1) > 0;
        const from = options.visibilityPairs?.find(([, target]) => target === geoset)?.[0];
        return (from === undefined ? targetVisibility[geoset] ?? 1 : sourceAt.visibility()[from] ?? 1) > 0;
    };
    const lowestOf = (rig: mdx.Model, world: (id: number) => mat4, vertices: readonly { geoset: number; vertex: number }[]) =>
        vertices.reduce((low, { geoset, vertex }) => visible(rig, geoset) ? Math.min(low, skinned(rig, world, geoset, vertex)[2]) : low, Infinity);
    const supportHeight = (rig: mdx.Model, world: (id: number) => mat4, vertices: typeof soles) => {
        const low = lowestOf(rig, world, vertices);
        return Number.isFinite(low) ? low : lowestOf(rig, world, rig === source ? classicBody : targetBody);
    };
    const topRest = hdRest(head(top)), classicTop = classicRest.get(top)!;
    const rootShift = options.alignRoot ? mat4.fromTranslation(mat4.create(), [classicTop[0] / fit - topRest[0], classicTop[1] / fit - topRest[1], 0]) : undefined;
    const pose = (classic: readonly mat4[], ground: number, plant?: number) => {
        const frame = mat4.multiply(mat4.create(), body0, inverse(bodyAt(classic)));
        const world = new Map<number, mat4>();
        for (const id of order) {
            const parent = logicalParent.get(id) ?? null, from = correspondence.get(id), rest = hdRest(id);
            const anchored = parent === null ? undefined : pivotOf(mat4.multiply(mat4.create(), world.get(parent)!, inverse(referenceWorld.get(parent)!)), rest);
            if (from === undefined) {
                world.set(id, parent === null ? mat4.clone(hdReference[id]) : mat4.multiply(mat4.create(), world.get(parent)!, constantLocal.get(id)!));
                continue;
            }
            const local = mat4.multiply(mat4.create(), frame, classic[from]);
            let turn = quat.multiply(quat.create(), rotationOf(local), quat.invert(quat.create(), rotationOf(sourceReference[from])));
            // Aim: Classic rigs also bend limbs by moving joints, so the limb points where its Classic child joint now is.
            const aim = aimed.get(from);
            if (aim !== undefined) {
                const now = vec3.sub(vec3.create(), centroid(aim.map(child => pivotOf(mat4.multiply(mat4.create(), frame, classic[child]), source.Nodes[child].PivotPoint))), pivotOf(local, source.Nodes[from].PivotPoint));
                const predicted = vec3.transformQuat(vec3.create(), vec3.sub(vec3.create(), centroid(aim.map(child => classicRest.get(child)!)), classicRest.get(from)!), turn);
                if (vec3.length(now) > 1e-6) turn = quat.multiply(quat.create(), swing(predicted, now), turn);
            }
            turn = quat.multiply(quat.create(), turn, alignment.get(from)!);
            const at = anchored ?? vec3.add(vec3.create(), vec3.scaleAndAdd(vec3.create(), rest, vec3.sub(vec3.create(), pivotOf(local, source.Nodes[from].PivotPoint), classicRest.get(from)!), proportion), [0, 0, ground]);
            world.set(id, turnedAbout(rigidReference.get(id)!, rest, turn, at));
        }
        if (rootShift !== undefined) for (const [id, matrix] of world) world.set(id, mat4.multiply(mat4.create(), rootShift, matrix));
        for (const { anchor, scale, ids } of limbScales) {
            const pivot = pivotOf(world.get(anchor)!, model.Nodes[anchor].PivotPoint);
            const sizing = mat4.fromTranslation(mat4.create(), pivot);
            mat4.scale(sizing, sizing, [scale, scale, scale]);
            mat4.translate(sizing, sizing, vec3.negate(vec3.create(), pivot));
            for (const id of ids) world.set(id, mat4.multiply(mat4.create(), sizing, world.get(id)!));
        }
        if (plant !== undefined && !legSupport) {
            const classicLowest = supportHeight(source, id => mat4.multiply(mat4.create(), frame, classic[id]), classicSoles);
            const hdLowest = supportHeight(model, id => world.get(id)!, soles);
            if (Number.isFinite(classicLowest + hdLowest)) {
                const lift = mat4.fromTranslation(mat4.create(), [0, 0, (classicLowest + plant) / fit - hdLowest]);
                for (const [id, matrix] of world) world.set(id, mat4.multiply(matrix, lift, matrix));
            }
        }
        // Fixed size fit: the Definitive limbs draw at the Classic limbs' length, so the body fills the shared hurt capsules
        // and its strikes reach the shared hit regions (#362).
        const toBody = mat4.scale(mat4.create(), mat4.multiply(mat4.create(), bodyAt(classic), inverse(body0)), [fit, fit, fit]);
        for (const [id, matrix] of world) world.set(id, mat4.multiply(matrix, toBody, matrix));
        // Match visible support after the authored body turn; a hanging weapon or the stock rest height must not lift the feet.
        if (plant !== undefined && legSupport) {
            const classicLowest = supportHeight(source, id => classic[id], classicSoles);
            const hdLowest = supportHeight(model, id => world.get(id)!, soles);
            if (Number.isFinite(classicLowest + hdLowest)) {
                const lift = mat4.fromTranslation(mat4.create(), [0, 0, classicLowest + plant - hdLowest]);
                for (const [id, matrix] of world) world.set(id, mat4.multiply(matrix, lift, matrix));
            }
        }
        return world;
    };
    // Ground registration: the aligned rest stance stands its soles where the stock stance does.
    const aligned = pose(sourceReference, 0);
    const stockFloor = supportHeight(model, id => hdReference[id], soles), alignedFloor = supportHeight(model, id => aligned.get(id)!, soles);
    const ground = Number.isFinite(stockFloor + alignedFloor) ? (stockFloor - alignedFloor) / fit : 0;
    const standing = pose(sourceReference, ground);
    const targetFloor = supportHeight(model, id => standing.get(id)!, soles), classicFloor = supportHeight(source, id => sourceReference[id], classicSoles);
    const plant = Number.isFinite(targetFloor + classicFloor) ? legSupport || options.alignRoot ? 0 : targetFloor - classicFloor : undefined;
    return { sourceStand, hdStand, sourceAt, sourceReference, hdReference, correspondence, fittedRoots, logicalParent, alignment, aimed, props, proportion, fit, ground, plant, bodyNode, bodyAt, constantLocal, pose };
}
export type RigRegistration = ReturnType<typeof registerRig>;

/** Bakes `sequences` of the source rig's motion onto a copy of the target body through `registration`. */
export function transferMotion(source: mdx.Model, hd: mdx.Model, registration: RigRegistration, sequences: readonly mdx.Sequence[], options: RetargetOptions = {}): RetargetResult {
    const model = structuredClone(hd);
    const { hdStand, sourceAt, hdReference, correspondence, fittedRoots, logicalParent, fit, ground, plant, bodyNode, bodyAt, constantLocal, pose } = registration;
    const mappedIds = [...new Set([...correspondence.keys(), ...fittedRoots])];
    const keyed = new Set(model.Bones.filter(bone => correspondence.has(bone.ObjectId) || fittedRoots.has(bone.ObjectId) || bone.Parent == null).map(bone => bone.ObjectId));
    const hdBones = [...model.Bones];
    for (const node of hdBones) { delete node.Translation; delete node.Rotation; delete node.Scaling; }
    const globalOffset = model.GlobalSequences.length;
    model.GlobalSequences.push(...source.GlobalSequences);
    // Only the whole-body helper chain is copied, so a squash under a flip stays exact (a node keys no shear).
    const copied = new Map<number, number>();
    const copyBody = (id: number): number => {
        const existing = copied.get(id);
        if (existing !== undefined) return existing;
        const original = source.Nodes[id];
        const parent = original.Parent == null ? null : copyBody(original.Parent);
        const ObjectId = model.Nodes.length;
        const node: mdx.Bone = {
            Name: `Body ${original.Name}`, ObjectId, Parent: parent, Flags: original.Flags,
            PivotPoint: new Float32Array(original.PivotPoint), GeosetId: null, GeosetAnimId: null,
        };
        for (const kind of ['Translation', 'Rotation', 'Scaling'] as const) {
            const track = original[kind];
            if (track === undefined) continue;
            node[kind] = structuredClone(track);
            if (onGlobalClock(track)) node[kind].GlobalSeqId = track.GlobalSeqId! + globalOffset;
        }
        model.Bones.push(node); model.Nodes.push(node); model.PivotPoints.push(node.PivotPoint);
        copied.set(id, ObjectId);
        return ObjectId;
    };
    const bodyParent = bodyNode === null ? null : copyBody(bodyNode);
    const roots = model.Bones.filter(bone => bone.Parent == null && !copied.has(bone.ObjectId) && ![...copied.values()].includes(bone.ObjectId));
    // A parentless mapped joint (Definitive wrists, ankles, weapons) joins its limb, so it interpolates with it.
    // A node keys translation, rotation and scale, never shear: a limb parent whose stock scale would shear the joint isn't used.
    const keyable = (matrix: mat4) => {
        const rebuilt = mat4.fromRotationTranslationScale(mat4.create(), mat4.getRotation(quat.create(), matrix), mat4.getTranslation(vec3.create(), matrix), mat4.getScaling(vec3.create(), matrix));
        return matrix.every((value, index) => Math.abs(value - rebuilt[index]) < 1e-4 * Math.max(1, Math.abs(value)));
    };
    for (const bone of roots) {
        const limb = correspondence.has(bone.ObjectId) ? logicalParent.get(bone.ObjectId) : null;
        bone.Parent = limb != null && keyable(mat4.multiply(mat4.create(), inverse(hdReference[limb]), hdReference[bone.ObjectId])) ? limb : bodyParent;
    }
    const samples: RetargetSample[] = [];
    for (const sequence of sequences) {
        const index = source.Sequences.indexOf(sequence), [start, end] = sequence.Interval;
        const frames = new Set<number>([start, end]);
        tracks(source, track => { if (!onGlobalClock(track)) for (const key of track.Keys) if (key.Frame >= start && key.Frame <= end) frames.add(key.Frame); });
        for (const frame of [...frames].sort((a, b) => a - b)) {
            const classic = sourceAt(index, frame);
            const world = pose(classic, ground, plant);
            const bodyWorld = bodyNode === null ? undefined : bodyAt(classic);
            for (const bone of hdBones) {
                const id = bone.ObjectId;
                if (!keyed.has(id)) { if (frame === start || frame === end) appendTransform(bone, constantLocal.get(id)!, frame); continue; }
                const parentWorld = bone.Parent === bodyParent ? bodyWorld : world.get(bone.Parent!)!;
                appendTransform(bone, parentWorld === undefined ? world.get(id)! : mat4.multiply(mat4.create(), inverse(parentWorld), world.get(id)!), frame);
            }
            samples.push({ sequence: index, frame, expected: new Map(mappedIds.map(id => [id, world.get(id)!])) });
        }
    }
    model.Sequences = structuredClone(source.Sequences);
    // Extra HD facial/cloth materials hold their stock Stand values through authored intervals.
    tracks(model, (track, path) => {
        if (path.startsWith('.Bones.') || onGlobalClock(track)) return;
        const first = track.Keys.find(key => key.Frame >= hd.Sequences[hdStand].Interval[0] && key.Frame <= hd.Sequences[hdStand].Interval[1]) ?? track.Keys[0];
        if (first === undefined) throw new Error(`Empty HD track ${path}`);
        track.LineType = mdx.LineType.DontInterp;
        track.Keys = sequences.flatMap(sequence => [...sequence.Interval].map(Frame => ({ Frame, Vector: new Float32Array(first.Vector) })));
    });
    for (const [classic, definitive] of options.visibilityPairs ?? []) {
        if (source.Geosets[classic] === undefined || model.Geosets[definitive] === undefined) throw new Error(`Missing visibility mesh ${classic} → ${definitive}`);
        const alpha = source.GeosetAnims.find(animation => animation.GeosetId === classic)?.Alpha ?? 1;
        let animation = model.GeosetAnims.find(animation => animation.GeosetId === definitive);
        if (animation === undefined) {
            animation = { GeosetId: definitive, Flags: 0, Alpha: 1, Color: new Float32Array([1, 1, 1]) };
            model.GeosetAnims.push(animation);
        }
        animation.Alpha = structuredClone(alpha);
        if (typeof animation.Alpha !== 'number' && onGlobalClock(animation.Alpha)) animation.Alpha.GlobalSeqId = animation.Alpha.GlobalSeqId! + globalOffset;
    }
    // Authored sequence indices stay stable even when their intervals are out of order.
    tracks(model, track => track.Keys.sort((left, right) => left.Frame - right.Frame));
    return { model, samples, mapped: correspondence.size, fit, props: registration.props };
}

/** Degrees `actual` is turned from `expected` in world space. */
export function rotationError(expected: mat4, actual: mat4): number {
    // A registration stretch leaves the pose matrix sheared, and a quaternion read off a sheared matrix can
    // jump tens of degrees for a fraction-of-a-degree turn; actual * expected^-1 cancels the shared stretch.
    const turn = quat.normalize(quat.create(), mat4.getRotation(quat.create(), mat4.multiply(mat4.create(), actual, inverse(expected))));
    return 2 * Math.acos(Math.min(1, Math.abs(turn[3]))) * 180 / Math.PI;
}

export function checkRetarget(result: RetargetResult, bytes = generateHdBody(result.model)) {
    const model = parseHdBody(bytes), at = evaluator(model);
    let units = 0, degrees = 0, worst = '';
    for (const sample of result.samples) {
        const actual = at(sample.sequence, sample.frame);
        for (const [id, expected] of sample.expected) {
            const pivot = model.Nodes[id].PivotPoint;
            const distance = vec3.distance(vec3.transformMat4(vec3.create(), pivot, expected), vec3.transformMat4(vec3.create(), pivot, actual[id]));
            const angle = rotationError(expected, actual[id]);
            if (!Number.isFinite(distance + angle)) throw new Error('Non-finite HD pose');
            if (distance > units || angle > degrees) worst = `${model.Sequences[sample.sequence].Name}/${model.Nodes[id].Name}@${sample.frame}`;
            units = Math.max(units, distance); degrees = Math.max(degrees, angle);
        }
    }
    tracks(model, (track, path) => { if (track.Keys.length === 0) throw new Error(`Empty HD track ${path}`); });
    return { units, degrees, worst, samples: result.samples.length, bytes: bytes.byteLength };
}
