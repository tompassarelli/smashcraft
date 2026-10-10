



import { f32 } from "wisp/src/sim/f32";
import { Character } from "../codes";

interface HeroBody {
  readonly weight: number;
  readonly run: number;

  readonly runSpeed?: number | undefined;
  readonly dashSpeed?: number | undefined;
  readonly dashRunFrame?: number | undefined;
  readonly air: number;
  readonly width: number;
  readonly height: number;

  readonly shield?: number | undefined;
}

const body = (weight: number, run: number, air: number, width: number, height: number): HeroBody => ({ weight, run, air, width, height });

const HERO_BODIES: { readonly [character: number]: HeroBody | undefined } = {
  [Character.anubarak]: { ...body(f32(1.28), f32(0.82), 0.75, f32(1.6), f32(1.35)), shield: f32(1.35), dashRunFrame: 16 },
  [Character.blademaster]: { ...body(f32(1.00), f32(1.08), f32(1.00), f32(1.00), f32(1.05)), runSpeed: f32(13.74), dashSpeed: f32(11.892) },
  [Character.mountainKing]: body(f32(1.12), f32(0.88), f32(0.82), f32(1.10), f32(0.85)),
  [Character.warden]: { ...body(f32(0.88), f32(1.14), f32(1.10), f32(0.90), f32(1.00)), runSpeed: 13.799999237060547, dashSpeed: 12.0 },
  [Character.lich]: body(f32(0.85), f32(0.90), f32(0.95), f32(0.90), f32(1.28)),
  [Character.forsakenPaladin]: body(f32(1.10), f32(0.92), f32(0.88), f32(1.08), f32(1.02)),
  [Character.dreadlord]: { ...body(f32(1.14), f32(1.10), f32(1.22), f32(1.10), f32(1.15)), runSpeed: f32(13.76), dashSpeed: f32(11.928) },
  [Character.shadowHunter]: body(f32(0.94), f32(1.04), f32(1.00), f32(0.92), f32(1.08)),

  [Character.pitLord]: { ...body(f32(1.28), f32(0.80), f32(0.75), f32(1.65), f32(1.35)), shield: f32(1.35), dashRunFrame: 16 },
  [Character.beastmaster]: body(f32(1.10), f32(0.97), f32(0.88), f32(1.15), f32(1.26)),
  [Character.chen]: body(f32(1.3733333333333333), f32(0.7272727272727273), f32(1.12), f32(1.18), f32(1.04)),
  [Character.kaelthas]: body(f32(1.0533333333333332), f32(1.025), 1.25, f32(0.96), f32(1.12)),
  [Character.lichKing]: body(f32(1.12), f32(0.84), f32(0.86), f32(1.12), f32(1.26)),
  [Character.thrall]: { ...body(f32(1.6933333333333334), f32(0.68), f32(0.75), 1.25, f32(1.15)), shield: f32(1.15), dashRunFrame: 16 },
  [Character.malfurion]: body(f32(94.0 / 75.0), f32(f32(10.8) / f32(13.2)), f32(0.95), 1.0, f32(1.1)),
  [Character.jaina]: body(f32(1.2), 0.5, f32(0.95), f32(0.9), f32(1.05)),
  [Character.sylvanas]: body(f32(96.0 / 75.0), f32(f32(1.828) / f32(2.2)), f32(0.935), f32(0.90), 1.0),
  [Character.cairne]: { ...body(f32(133.0 / 75.0), f32(f32(1.485) / f32(2.2)), f32(0.945), f32(1.75), f32(1.45)), shield: f32(1.45), dashRunFrame: 16 },
  [Character.peon]: body(f32(92.0 / 75.0), f32(f32(1.6) / f32(2.2)), f32(0.987), f32(0.88), f32(0.80)),
  [Character.medivh]: body(f32(0.90), f32(0.98), f32(1.20), f32(0.90), f32(1.10)),
  [Character.murloc]: { ...body(f32(0.94), f32(1.12), f32(1.06), f32(0.90), f32(0.72)), runSpeed: 13.79999828338623, dashSpeed: 11.999999046325684 },
  [Character.kobold]: { ...body(f32(0.90), f32(1.10), f32(1.02), f32(0.78), f32(0.66)), runSpeed: f32(13.78), dashSpeed: f32(11.95) },
  [Character.grom]: body(f32(1.16), f32(1.04), f32(0.92), f32(1.12), f32(1.10)),
  [Character.tinker]: body(f32(106.0 / 75.0), f32(f32(1.725) / f32(2.2)), f32(1.134), f32(1.12), f32(0.95)),
};


export function heroBody(character: number): HeroBody | undefined {
  return HERO_BODIES[character];
}
