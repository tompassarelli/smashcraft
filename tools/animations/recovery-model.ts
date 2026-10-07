// The recovery postprocessor is additive: remove its clips and identity
// parent to recover the exact input model for cache comparison/regeneration.
import { model as mdx } from "war3-model";
import { ensure, onGlobalClock, tracks } from "./original-clips";

/** Removing the additive damage suffix must reproduce its exact input bytes. */
export function damageBaseModel(source: mdx.Model): mdx.Model | undefined {
  const first = source.Sequences.findIndex(s => s.Name.startsWith("Damage Grid "));
  if (first < 0) return undefined;
  ensure(first > 0 && source.Sequences.slice(first).every(s => s.Name.startsWith("Damage Grid ")), "Damage grid must be a sequence suffix");
  const cutoff = source.Sequences[first]?.Interval[0];
  ensure(cutoff !== undefined, "Damage grid has no start");
  const model = structuredClone(source);
  model.Sequences = model.Sequences.slice(0, first);
  tracks(model, track => { if (!onGlobalClock(track)) track.Keys = track.Keys.filter(k => k.Frame < cutoff); });
  return model;
}

export function recoveryBaseModel(source: mdx.Model): mdx.Model | undefined {
  const helper = source.Helpers.find(n => n.Name === "Recovery Motion");
  if (!helper) return undefined;
  const first = source.Sequences.findIndex(s => s.Name.startsWith("Recovery "));
  ensure(first > 0 && source.Sequences.slice(first).every(s => s.Name.startsWith("Recovery ")),
    "Recovery clips must be a suffix of the input sequences");
  ensure(helper.ObjectId === source.Nodes.length - 1 && helper.Parent == null && helper.Flags === 0,
    "Recovery helper must be the final, ordinary root node");
  const originals = source.Sequences.slice(0, first);
  for (const [track, identity] of [[helper.Rotation, [0, 0, 0, 1]], [helper.Translation, [0, 0, 0]], [helper.Scaling, [1, 1, 1]]] as const) {
    ensure(track && !onGlobalClock(track), "Recovery helper must use the sequence clock");
    for (const sequence of originals) {
      const keys = track.Keys.filter(k => k.Frame >= sequence.Interval[0] && k.Frame <= sequence.Interval[1]);
      ensure(keys.length >= 2 && keys[0]?.Frame === sequence.Interval[0] && keys.at(-1)?.Frame === sequence.Interval[1]
        && keys.every(k => identity.every((v, i) => k.Vector[i] === v)),
        `${sequence.Name}: recovery parent changes an existing sequence`);
    }
  }
  const model = structuredClone(source);
  const cutoff = source.Sequences[first]?.Interval[0];
  ensure(cutoff !== undefined, "Recovery suffix has no start");
  model.Sequences = model.Sequences.slice(0, first);
  model.Helpers = model.Helpers.filter(n => n.ObjectId !== helper.ObjectId);
  model.Nodes = model.Nodes.filter(n => n.ObjectId !== helper.ObjectId);
  model.PivotPoints = model.PivotPoints.slice(0, helper.ObjectId);
  for (const node of model.Nodes) if (node.Parent === helper.ObjectId) node.Parent = null;
  tracks(model, track => { if (!onGlobalClock(track)) track.Keys = track.Keys.filter(k => k.Frame < cutoff); });
  return model;
}
