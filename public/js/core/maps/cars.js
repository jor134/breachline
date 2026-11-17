// Parked cars: the ten from "Generic passenger car pack" (models/car/pack.glb, built by tools/car_pack.py). Sizes in metres
// (length, width, height) as the model has them, so a car's collision box fits it. A map lists its spots as [x, z, turn]
// (turn 0 = nose toward +z); park() gives each spot a car, starting `seed` cars into the list so maps differ.
export const CAR_KINDS = { compact: [3.26, 1.61, 1.32], coupe: [4.24, 1.88, 1.28], hatch: [3.96, 1.74, 1.35], minivan: [4.61, 1.87, 1.76], offroad: [3.94, 1.96, 1.57],
  pickup: [5.18, 2.07, 1.70], sedan: [4.36, 1.94, 1.34], sport: [3.91, 1.77, 1.04], suv: [4.61, 2.07, 1.73], wagon: [4.38, 1.95, 1.38] };
const ORDER = ['sedan', 'suv', 'hatch', 'wagon', 'pickup', 'compact', 'minivan', 'coupe', 'offroad', 'sport'];
export const park = (spots, seed = 0, only = ORDER) => spots.map(([x, z, turn], i) => ({ x, z, turn, kind: only[(i * 3 + seed) % only.length] }));
// the car's collision box (length along x when it is turned sideways)
export function carBox(c) {
  const [l, w, h] = CAR_KINDS[c.kind], side = Math.abs(Math.sin(c.turn)) > 0.7, hx = (side ? l : w) / 2, hz = (side ? w : l) / 2;
  return { x0: c.x - hx, x1: c.x + hx, z0: c.z - hz, z1: c.z + hz, h };
}
