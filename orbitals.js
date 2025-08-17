import { getElements, sgp } from "./gp.js";
const canvas = document.getElementById('orbitals');
const gl = canvas.getContext('webgl2');
if (!gl)
    throw new Error('WebGL not supported');
const vertSrc = `#version 300 es
    in vec3 aPosition;

    uniform float uPointSize; // in pixels
    uniform mat4 uProjection;

    void main() {
        gl_Position = uProjection * vec4(aPosition.xy, 0, 1.0);
        gl_PointSize = uPointSize; // pixels
    }`;
const fragSrc = `#version 300 es
    precision mediump float;
    out vec4 outColor;

    void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float d = dot(p, p);
        if (d > 1.0) discard;
        outColor = vec4(0.2, 0.85, 1.0, 1.0);
    }`;
function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error('Shader compile failed: ' + gl.getShaderInfoLog(shader));
    }
    return shader;
}
function createProgram(vsSource, fsSource) {
    const vs = compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error('Program link failed: ' + gl.getProgramInfoLog(prog));
    }
    return prog;
}
const program = createProgram(vertSrc, fragSrc);
function findBounds(points) {
    const aspect = canvas.width / canvas.height;
    let [minX, maxX, minY, maxY] = [Infinity, -Infinity, Infinity, -Infinity];
    for (const [x, y] of points) {
        if (x < minX)
            minX = x;
        if (x > maxX)
            maxX = x;
        if (y < minY)
            minY = y;
        if (y > maxY)
            maxY = y;
    }
    return [minX, minY, maxX, maxY];
}
function orthoMatrix(left, right, bottom, top, near, far, padding) {
    const rl = right - left || 1;
    const tb = top - bottom || 1;
    const fn = far - near || 2;
    const paddedMinX = left - rl * padding;
    const paddedMaxX = right + rl * padding;
    const paddedMinY = bottom - tb * padding;
    const paddedMaxY = top + tb * padding;
    const rlPadded = paddedMaxX - paddedMinX;
    const tbPadded = paddedMaxY - paddedMinY;
    return new Float32Array([
        2 / rlPadded, 0, 0, 0,
        0, 2 / tbPadded, 0, 0,
        0, 0, -2 / fn, 0,
        -(paddedMaxX + paddedMinX) / rlPadded, -(paddedMaxY + paddedMinY) / tbPadded, -(far + near) / fn, 1
    ]);
}
const vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.useProgram(program);
const aPositionLoc = gl.getAttribLocation(program, 'aPosition');
const uPointSizeLoc = gl.getUniformLocation(program, 'uPointSize');
const uProjectionLoc = gl.getUniformLocation(program, 'uProjection');
gl.enableVertexAttribArray(aPositionLoc);
gl.vertexAttribPointer(aPositionLoc, 3, gl.FLOAT, false, 0, 0);
const px = (window.devicePixelRatio || 1) * 6.0;
gl.uniform1f(uPointSizeLoc, px);
gl.clearColor(0, 0, 0, 1);
function resize() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = Math.floor(canvas.clientWidth * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
    }
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
}
window.addEventListener('resize', resize);
resize();
let elements = await getElements();
function frame(now) {
    if (elements.invalid()) {
        getElements().then(c => elements = c);
    }
    const t = Date.now();
    const positions = elements.data.map(e => sgp(e, (t - (new Date(e.EPOCH).getTime())) / 1000).position);
    const [minX, minY, maxX, maxY] = findBounds(positions);
    const projectionMatrix = orthoMatrix(minX, maxX, minY, maxY, -1, 1, 0.05);
    const points = new Float32Array(positions.flat());
    gl.bufferData(gl.ARRAY_BUFFER, points, gl.DYNAMIC_DRAW);
    gl.uniformMatrix4fv(uProjectionLoc, false, projectionMatrix);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, points.length / 3);
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
