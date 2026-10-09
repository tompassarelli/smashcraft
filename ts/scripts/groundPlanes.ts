
import { model as mdx } from "war3-model";

// Warcraft draws team-glow and selection planes even at zero geoset alpha (#346).




export function groundPlaneGeosets(model: mdx.Model): number[] {
  return model.Geosets.flatMap((geoset, index) => {
    const vertices = geoset.Vertices;

    if (vertices.length === 0 || vertices.length > 16 * 3) return [];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    vertices.forEach((value, offset) => {
      if (offset % 3 === 0) { minX = Math.min(minX, value); maxX = Math.max(maxX, value); }
      else if (offset % 3 === 1) { minY = Math.min(minY, value); maxY = Math.max(maxY, value); }
      else { minZ = Math.min(minZ, value); maxZ = Math.max(maxZ, value); }
    });
    return maxX - minX >= 150 && maxY - minY >= 150 && maxZ - minZ <= 30 && minZ <= 40 ? [index] : [];
  });
}


export function removeGeosets(model: mdx.Model, removed: ReadonlySet<number>): void {
  const geosetIds = new Map<number, number>(), animationIds = new Map<number, number>();
  model.Geosets.forEach((_, index) => { if (!removed.has(index)) geosetIds.set(index, geosetIds.size); });
  model.GeosetAnims.forEach((animation, index) => { if (!removed.has(animation.GeosetId)) animationIds.set(index, animationIds.size); });
  model.Geosets = model.Geosets.filter((_, index) => geosetIds.has(index));
  model.GeosetAnims = model.GeosetAnims.filter((_, index) => animationIds.has(index));
  for (const animation of model.GeosetAnims) animation.GeosetId = geosetIds.get(animation.GeosetId) ?? animation.GeosetId;
  for (const bone of model.Bones) {

    const references: { GeosetId?: number | null; GeosetAnimId?: number | null } = bone;
    if (typeof references.GeosetId === "number" && references.GeosetId >= 0) references.GeosetId = geosetIds.get(references.GeosetId) ?? null;
    if (typeof references.GeosetAnimId === "number" && references.GeosetAnimId >= 0) references.GeosetAnimId = animationIds.get(references.GeosetAnimId) ?? null;
  }
}
