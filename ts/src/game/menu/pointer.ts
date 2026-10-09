





export function pointerX(pixelX: number, width: number, height: number): number {
  return ((pixelX - (width - (height * 4) / 3) / 2) * 0.6000000238418579) / height;
}


export function pointerY(pixelY: number, height: number): number {
  return 0.6000000238418579 - (pixelY * 0.6000000238418579) / height;
}
