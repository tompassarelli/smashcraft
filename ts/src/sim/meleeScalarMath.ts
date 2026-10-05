// Melee's binary32 atan2/sin/cos approximations, ported from
// smashcraft:wurst/MeleeScalarMath.wurst. Coefficients come from
// smashcraft:docs/smash-melee-reference/retail-trig-coefficients.json. Every
// rounding boundary is part of the approximation, including range reduction.
import {
  addFloat32,
  divideFloat32,
  fusedMultiplyAddFloat32,
  multiplyFloat32,
  roundToFloat32,
  subtractFloat32,
  toInt,
} from "./binary32";

const PI = 3.1415927410125732;
const HALF_PI = 1.5707963705062866;

interface AtanSegment {
  offsetHigh: number;
  offsetLow: number;
  numeratorHigh: number;
  numeratorLow: number;
  angleHigh: number;
  angleLow: number;
}

function segment(
  offsetHigh: number,
  offsetLow: number,
  numeratorHigh: number,
  numeratorLow: number,
  angleHigh: number,
  angleLow: number,
): AtanSegment {
  return { offsetHigh, offsetLow, numeratorHigh, numeratorLow, angleHigh, angleLow };
}

const SEGMENTS: readonly AtanSegment[] = [
  segment(2.414212942123413, 0.0000005620000251838064, 6.828420162200928, 0.0000071350000325764995, 0.3926900029182434, 0.000009081698408408556),
  segment(1.4966057538986206, 0.0, 3.239828109741211, 0.0000008200000252145401, 0.5890486240386963, 0.000000023000000126671694),
  segment(1.0, 0.0, 2.0, 0.0, 0.7853981256484985, 0.0000000630000016599297),
  segment(0.6681786179542542, 0.0, 1.4464620351791382, 0.0000006299999881775875, 0.9817469716072083, 0.0000007040000014058023),
  segment(0.4142135679721832, 0.0, 1.1715729236602783, 0.0, 1.1780970096588135, 0.0000002499999993688107),
];
const SEGMENT_LIMITS = [0.534511148929596, 0.8206787705421448, 1.218503475189209, 1.870868444442749];

function segmentFor(magnitude: number): AtanSegment {
  let index = 0;
  while (index < SEGMENT_LIMITS.length && magnitude >= SEGMENT_LIMITS[index]!) index++;
  return SEGMENTS[index]!;
}

function atanPolynomial(residual: number): number {
  const square = multiplyFloat32(residual, residual);
  const cube = multiplyFloat32(square, residual);
  let coefficient = 0.04714243486523628;
  coefficient = fusedMultiplyAddFloat32(coefficient, square, -0.08459755778312683);
  coefficient = fusedMultiplyAddFloat32(coefficient, square, 0.11041180044412613);
  coefficient = fusedMultiplyAddFloat32(coefficient, square, -0.14281649887561798);
  coefficient = fusedMultiplyAddFloat32(coefficient, square, 0.1999988704919815);
  coefficient = fusedMultiplyAddFloat32(coefficient, square, -0.3333333134651184);
  return fusedMultiplyAddFloat32(coefficient, cube, residual);
}

function positiveAtan(magnitude: number): number {
  if (magnitude <= 0.4142135679721832) return atanPolynomial(magnitude);
  if (magnitude >= 2.4142136573791504) {
    return subtractFloat32(HALF_PI, atanPolynomial(divideFloat32(1.0, magnitude)));
  }
  const s = segmentFor(magnitude);
  const denominator = addFloat32(s.offsetHigh, addFloat32(magnitude, s.offsetLow));
  const inverse = divideFloat32(1.0, denominator);
  const high = fusedMultiplyAddFloat32(-inverse, s.numeratorHigh, s.offsetHigh);
  const low = fusedMultiplyAddFloat32(-inverse, s.numeratorLow, s.offsetLow);
  const residual = addFloat32(high, low);
  return addFloat32(addFloat32(atanPolynomial(residual), s.angleLow), s.angleHigh);
}

function hasNegativeSign(value: number): boolean {
  // The IEEE reciprocal distinguishes the zeros that choose atan2's quadrant.
  return value < 0 || (value === 0 && 1.0 / value < 0);
}

/** Finite binary32 vector angle; zero vectors use the vertical zero's sign. */
export function meleeAtan2(y: number, x: number): number {
  const horizontal = roundToFloat32(x);
  const vertical = roundToFloat32(y);
  if (horizontal === 0) return hasNegativeSign(vertical) ? -HALF_PI : HALF_PI;
  const ratio = divideFloat32(vertical, horizontal);
  let angle = positiveAtan(Math.abs(ratio));
  if (hasNegativeSign(ratio)) angle = -angle;
  if (horizontal < 0) {
    return hasNegativeSign(vertical) ? subtractFloat32(angle, PI) : addFloat32(angle, PI);
  }
  return angle;
}

function quadrantIndex(angle: number): number {
  const scaled = multiplyFloat32(angle, 0.6366197466850281);
  return angle < 0 ? toInt(subtractFloat32(scaled, 0.5)) : toInt(addFloat32(scaled, 0.5));
}

function normalizedResidual(angle: number, quadrant: number): number {
  let residual = subtractFloat32(angle, multiplyFloat32(2.0, quadrant));
  residual = fusedMultiplyAddFloat32(0.25, angle, residual);
  residual = fusedMultiplyAddFloat32(0.0232393741607666, angle, residual);
  residual = fusedMultiplyAddFloat32(0.00000017055572243407369, angle, residual);
  return fusedMultiplyAddFloat32(0.000000000018673649432310313, angle, residual);
}

function quadrantSine(quadrant: number): number {
  return quadrant === 1 ? 1.0 : quadrant === -1 ? -1.0 : 0.0;
}

function quadrantCosine(quadrant: number): number {
  return quadrant === 0 ? 1.0 : quadrant === 2 || quadrant === -2 ? -1.0 : 0.0;
}

function evenPolynomial(square: number): number {
  let coefficient = 0.00000352876168108196;
  coefficient = fusedMultiplyAddFloat32(coefficient, square, -0.0003259365039411932);
  coefficient = fusedMultiplyAddFloat32(coefficient, square, 0.015854323282837868);
  coefficient = fusedMultiplyAddFloat32(coefficient, square, -0.3084251284599304);
  return fusedMultiplyAddFloat32(coefficient, square, 1.0);
}

function oddPolynomial(square: number): number {
  let coefficient = 0.00000030897470537638583;
  coefficient = fusedMultiplyAddFloat32(coefficient, square, -0.0000365723499271553);
  coefficient = fusedMultiplyAddFloat32(coefficient, square, 0.002490393118932843);
  coefficient = fusedMultiplyAddFloat32(coefficient, square, -0.08074551075696945);
  return fusedMultiplyAddFloat32(coefficient, square, 0.7853981852531433);
}

/** Binary32 sine for finite angles in [-float32(pi), float32(pi)]. */
export function meleeSin(angle: number): number {
  const input = roundToFloat32(angle);
  const quadrant = quadrantIndex(input);
  const residual = normalizedResidual(input, quadrant);
  const sine = quadrantSine(quadrant);
  const cosine = quadrantCosine(quadrant);
  if (Math.abs(residual) < 0.0003452669770922512) {
    return fusedMultiplyAddFloat32(multiplyFloat32(cosine, residual), 0.7853981852531433, sine);
  }
  const square = multiplyFloat32(residual, residual);
  if (sine !== 0) return multiplyFloat32(sine, evenPolynomial(square));
  return roundToFloat32(cosine * residual * oddPolynomial(square));
}

/** Binary32 cosine for finite angles in [-float32(pi), float32(pi)]. */
export function meleeCos(angle: number): number {
  const input = roundToFloat32(angle);
  const quadrant = quadrantIndex(input);
  const residual = normalizedResidual(input, quadrant);
  const sine = quadrantSine(quadrant);
  const cosine = quadrantCosine(quadrant);
  if (Math.abs(residual) < 0.0003452669770922512) {
    return fusedMultiplyAddFloat32(-residual, sine, cosine);
  }
  const square = multiplyFloat32(residual, residual);
  if (cosine !== 0) return multiplyFloat32(cosine, evenPolynomial(square));
  return roundToFloat32(-sine * residual * oddPolynomial(square));
}
