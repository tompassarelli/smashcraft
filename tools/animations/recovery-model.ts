

import { model as mdx } from "war3-model";
import { ensure, onGlobalClock, tracks } from "./original-clips";


export function locomotionBaseModel(source: mdx.Model): mdx.Model | undefined {
  const first = source.Sequences.findIndex(s => s.Name === "Locomotion Walk");
  if (first < 0) return undefined;
  ensure(source.Sequences.slice(first).map(s => s.Name).join("/") === "Locomotion Walk/Locomotion Run/Locomotion Initial Dash Burst", "Locomotion must be a three-clip suffix");
  const model = structuredClone(source), cutoff = source.Sequences[first]?.Interval[0];
  ensure(cutoff !== undefined, "Locomotion suffix has no start");
  model.Sequences = model.Sequences.slice(0, first);
  tracks(model, track => { if (!onGlobalClock(track)) track.Keys = track.Keys.filter(k => k.Frame < cutoff); });
  return model;
}

export function wardenFanBaseModel(source: mdx.Model): mdx.Model | undefined {
  const first = source.Sequences.findIndex(s => s.Name.startsWith("Fan of Knives "));
  if (first < 0) return undefined;
  ensure(first > 0 && source.Sequences.slice(first).every(s => s.Name.startsWith("Fan of Knives ")), "Fan casts must be the sequence suffix");
  const cutoff = source.Sequences[first]?.Interval[0]; ensure(cutoff !== undefined, "Fan cast has no start");
  const model = structuredClone(source);
  model.Sequences = model.Sequences.slice(0, first);
  tracks(model, track => { if (!onGlobalClock(track)) track.Keys = track.Keys.filter(k => k.Frame < cutoff); });
  return model;
}


export function swordGestureBaseModel(source: mdx.Model): mdx.Model | undefined {
  const first = source.Sequences.findIndex(s => s.Name.startsWith("Sword Gesture "));
  if (first < 0) return undefined;
  ensure(first > 0 && source.Sequences.slice(first).every(s => s.Name.startsWith("Sword Gesture ")), "Sword gestures must be the sequence suffix");
  const cutoff = source.Sequences[first]?.Interval[0];
  ensure(cutoff !== undefined, "Sword gestures have no start");
  const model = structuredClone(source);
  model.Sequences = model.Sequences.slice(0, first);
  tracks(model, track => { if (!onGlobalClock(track)) track.Keys = track.Keys.filter(k => k.Frame < cutoff); });
  return model;
}

export function attackGestureBaseModel(source: mdx.Model): mdx.Model | undefined {
  const first = source.Sequences.findIndex(s => s.Name.startsWith("Attack Gesture "));
  if (first < 0) return undefined;
  ensure(first > 0 && source.Sequences.slice(first).every(s => s.Name.startsWith("Attack Gesture ")), "Attack gestures must be the sequence suffix");
  const helper = source.Helpers.find(n => n.Name === "Attack Gesture");
  ensure(helper && helper.ObjectId === source.Nodes.length - 1 && helper.Parent == null && helper.Flags === 0, "Attack gesture helper must be final ordinary root");
  const rotation = helper.Rotation, hop = helper.Translation;
  ensure(rotation && !onGlobalClock(rotation) && (!hop || !onGlobalClock(hop)) && !helper.Scaling, "Attack gesture parent must rotate and hop locally");
  for (const sequence of source.Sequences.slice(0, first)) for (const track of hop ? [rotation, hop] : [rotation]) {
    const keys = track.Keys.filter(k => k.Frame >= sequence.Interval[0] && k.Frame <= sequence.Interval[1]);
    ensure(keys.length >= 2 && keys[0]?.Frame === sequence.Interval[0] && keys.at(-1)?.Frame === sequence.Interval[1]
      && keys.every(k => k.Vector.every((v, i) => v === (track === rotation && i === 3 ? 1 : 0))), `${sequence.Name}: attack gesture changes the old parent`);
  }
  const cutoff = source.Sequences[first]?.Interval[0];
  ensure(cutoff !== undefined, "Attack gestures have no start");
  const model = structuredClone(source);
  model.Sequences = model.Sequences.slice(0, first);
  model.Helpers = model.Helpers.filter(n => n.ObjectId !== helper.ObjectId);
  model.Nodes = model.Nodes.filter(n => n.ObjectId !== helper.ObjectId);
  model.PivotPoints = model.PivotPoints.slice(0, helper.ObjectId);
  for (const node of model.Nodes) if (node.Parent === helper.ObjectId) node.Parent = null;
  tracks(model, track => { if (!onGlobalClock(track)) track.Keys = track.Keys.filter(k => k.Frame < cutoff); });
  return model;
}

export function pitLordSpecialBaseModel(source: mdx.Model): mdx.Model | undefined {
  const first = source.Sequences.findIndex(s => s.Name === "Special Howl of Terror");
  if (first < 0) return undefined;
  ensure(source.Sequences.slice(first).every(s => s.Name.startsWith("Special ")), "Pit Lord specials must be the sequence suffix");
  const cutoff = source.Sequences[first]?.Interval[0];
  ensure(cutoff !== undefined, "Pit Lord specials have no start");
  const model = structuredClone(source);
  model.Sequences = model.Sequences.slice(0, first);
  tracks(model, track => { if (!onGlobalClock(track)) track.Keys = track.Keys.filter(k => k.Frame < cutoff); });
  return model;
}

export function pounceBaseModel(source: mdx.Model): mdx.Model | undefined {
  const first = source.Sequences.findIndex(s => s.Name.startsWith("Pounce "));
  if (first < 0) return undefined;
  ensure(first > 0 && source.Sequences.slice(first).every(s => s.Name.startsWith("Pounce ")), "Pounce clips must be the suffix");
  const helper = source.Helpers.find(n => n.Name === "Pounce Motion");
  ensure(helper && helper.ObjectId === source.Nodes.length - 1 && helper.Parent == null, "Pounce helper must be final root");
  const cutoff = source.Sequences[first]?.Interval[0]; ensure(cutoff !== undefined, "Pounce clip has no start");
  const model = structuredClone(source);
  model.Sequences = model.Sequences.slice(0, first);
  model.Helpers = model.Helpers.filter(n => n.ObjectId !== helper.ObjectId);
  model.Nodes = model.Nodes.filter(n => n.ObjectId !== helper.ObjectId);
  model.PivotPoints = model.PivotPoints.slice(0, helper.ObjectId);
  for (const node of model.Nodes) if (node.Parent === helper.ObjectId) node.Parent = null;
  tracks(model, track => { if (!onGlobalClock(track)) track.Keys = track.Keys.filter(k => k.Frame < cutoff); });
  return model;
}

export function jumpBaseModel(source: mdx.Model): mdx.Model | undefined {
  const first = source.Sequences.findIndex(s => s.Name.startsWith("Jump Motion "));
  if (first < 0) return undefined;
  ensure(first > 0 && source.Sequences.slice(first).every(s => s.Name.startsWith("Jump Motion ")), "Jump clips must be the sequence suffix");
  const helper = source.Helpers.find(n => n.Name === "Jump Motion");
  ensure(helper && helper.ObjectId === source.Nodes.length - 1 && helper.Parent == null, "Jump helper must be the final root");
  const cutoff = source.Sequences[first]?.Interval[0]; ensure(cutoff !== undefined, "Jump clip has no start");
  const model = structuredClone(source);
  model.Sequences = model.Sequences.slice(0, first);
  model.Helpers = model.Helpers.filter(n => n.ObjectId !== helper.ObjectId);
  model.Nodes = model.Nodes.filter(n => n.ObjectId !== helper.ObjectId);
  model.PivotPoints = model.PivotPoints.slice(0, helper.ObjectId);
  for (const node of model.Nodes) if (node.Parent === helper.ObjectId) node.Parent = null;
  tracks(model, track => { if (!onGlobalClock(track)) track.Keys = track.Keys.filter(k => k.Frame < cutoff); });
  return model;
}

export function downAirBaseModel(source: mdx.Model): mdx.Model | undefined {
  const first = source.Sequences.findIndex(s => s.Name.startsWith("Down Air "));

  if (first <= 0 || !source.Sequences.slice(first).every(s => s.Name.startsWith("Down Air "))) return undefined;
  const cutoff = source.Sequences[first]?.Interval[0];
  ensure(cutoff !== undefined, "Down air has no start");
  const model = structuredClone(source);
  model.Sequences = model.Sequences.slice(0, first);
  tracks(model, track => { if (!onGlobalClock(track)) track.Keys = track.Keys.filter(k => k.Frame < cutoff); });
  return model;
}


export function drillBaseModel(source: mdx.Model): mdx.Model | undefined {
  const helper = source.Helpers.find(n => n.Name === "Drill Motion");
  if (!helper) return undefined;
  const first = source.Sequences.findIndex(s => s.Name === "Drill Down Air");
  ensure(first > 0 && first === source.Sequences.length - 1, "Drill must be the final sequence");
  ensure(helper.ObjectId === source.Nodes.length - 1 && helper.Parent == null && helper.Flags === 0,
    "Drill helper must be the final ordinary root");
  const rotation = helper.Rotation;
  ensure(rotation && !onGlobalClock(rotation) && !helper.Translation && !helper.Scaling, "Drill parent must only rotate locally");
  for (const sequence of source.Sequences.slice(0, first)) {
    const from = sequence.Interval[0], to = sequence.Interval[1];
    ensure(from !== undefined && to !== undefined, `${sequence.Name}: missing interval`);
    const keys = rotation.Keys.filter(k => k.Frame >= from && k.Frame <= to);
    ensure(keys.length === 2 && keys[0]?.Frame === from && keys[1]?.Frame === to
      && keys.every(k => k.Vector.every((v, i) => v === (i === 3 ? 1 : 0))), `${sequence.Name}: drill changes the old parent`);
  }
  const cutoff = source.Sequences[first]?.Interval[0];
  ensure(cutoff !== undefined, "Drill has no start");
  const model = structuredClone(source);
  model.Sequences = model.Sequences.slice(0, first);
  model.Helpers = model.Helpers.filter(n => n.ObjectId !== helper.ObjectId);
  model.Nodes = model.Nodes.filter(n => n.ObjectId !== helper.ObjectId);
  model.PivotPoints = model.PivotPoints.slice(0, helper.ObjectId);
  for (const node of model.Nodes) if (node.Parent === helper.ObjectId) node.Parent = null;
  tracks(model, track => { if (!onGlobalClock(track)) track.Keys = track.Keys.filter(k => k.Frame < cutoff); });
  return model;
}


export function grabBaseModel(source: mdx.Model): mdx.Model | undefined {
  const first = source.Sequences.findIndex(s => s.Name.startsWith("Paired Grab "));
  if (first < 0) return undefined;
  ensure(first > 0 && source.Sequences.slice(first).every(s => s.Name.startsWith("Paired Grab ")), "Paired grabs must be a sequence suffix");
  const cutoff = source.Sequences[first]?.Interval[0];
  ensure(cutoff !== undefined, "Paired grabs have no start");
  const model = structuredClone(source);
  model.Sequences = model.Sequences.slice(0, first);
  tracks(model, track => { if (!onGlobalClock(track)) track.Keys = track.Keys.filter(k => k.Frame < cutoff); });
  return model;
}


export const APPENDED_STRIKES = ["Forward Smash", "Up Smash", "Down Smash"];

export function appendedStrikeBaseModel(source: mdx.Model): mdx.Model | undefined {
  let first = source.Sequences.length;
  while (first > 0 && APPENDED_STRIKES.includes(source.Sequences[first - 1]!.Name)) first--;
  if (first === source.Sequences.length || first === 0) return undefined;
  const cutoff = source.Sequences[first]!.Interval[0];
  const model = structuredClone(source);
  model.Sequences = model.Sequences.slice(0, first);
  tracks(model, track => { if (!onGlobalClock(track)) track.Keys = track.Keys.filter(k => k.Frame < cutoff); });
  return model;
}

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
