export type vector3 = [number, number, number];
export type matrix3 = [vector3, vector3, vector3];

export function multiply(m: matrix3, v: vector3): vector3 {
  const [x, y, z] = v;
  return [
    m[0][0] * x + m[0][1] * y + m[0][2] * z,
    m[1][0] * x + m[1][1] * y + m[1][2] * z,
    m[2][0] * x + m[2][1] * y + m[2][2] * z
  ];
}