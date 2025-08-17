export function rotateZ(angle, v) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const R = [[c, -s, 0],
        [s, c, 0],
        [0, 0, 1]];
    return multiply(R, v);
}
export function rotateX(angle, v) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const R = [[1, 0, 0],
        [0, c, -s],
        [0, s, c]];
    return multiply(R, v);
}
export function multiply(m, v) {
    const [x, y, z] = v;
    return [
        m[0][0] * x + m[0][1] * y + m[0][2] * z,
        m[1][0] * x + m[1][1] * y + m[1][2] * z,
        m[2][0] * x + m[2][1] * y + m[2][2] * z
    ];
}
