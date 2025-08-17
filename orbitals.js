import { getSatellites, sgp4 } from "./gp.js";
import { Cache } from "./cache.js";
import { rotateX, rotateZ } from "./tensor.js";
const canvas = document.getElementById('orbitals');
const gl = canvas.getContext('webgl2');
if (!gl)
    throw new Error('WebGL not supported');
const vertSrc = `#version 300 es
    in vec3 aPosition;

    uniform float uPointSize;
    uniform mat4 uProjection;

    void main() {
        gl_Position = uProjection * vec4(aPosition.xy, 0, 1.0);
        gl_PointSize = uPointSize; // pixels
    }`;
const fragSrc = `#version 300 es
    precision mediump float;
    
    uniform vec4 uColor;
    out vec4 outColor;

    void main() {
        outColor = uColor; 
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
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < points.length; i += 3) {
        const x = points[i];
        const y = points[i + 1];
        const z = points[i + 2];
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
    }
    return [minX, maxX, minY, maxY, minZ, minY];
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
function generateOrbitsVertices(satellites, numberOfSegments = 16) {
    const vertices = [];
    for (const satellite of satellites) {
        const a = satellite.a;
        const e = satellite.eccentricity;
        for (let k = 0; k <= numberOfSegments; k++) {
            const nu = 2 * Math.PI * k / numberOfSegments;
            const r = a * (1 - e * e) / (1 + e * Math.cos(nu));
            let pos = [r * Math.cos(nu), r * Math.sin(nu), 0];
            pos = rotateZ(satellite.argp, pos);
            pos = rotateX(satellite.inclination, pos);
            pos = rotateZ(satellite.raan, pos);
            vertices.push(...pos);
        }
    }
    ;
    return vertices;
}
function generateSatelliteVertices(satellites, t) {
    const vertices = [];
    for (const satellite of satellites) {
        const dt = (t - satellite.epoch) / 1000;
        const propagated = sgp4(satellite, dt);
        let pos = rotateZ(satellite.argp, propagated.position);
        pos = rotateX(satellite.inclination, pos);
        pos = rotateZ(satellite.raan, pos);
        vertices.push(...pos);
    }
    ;
    return vertices;
}
const orbitsVBO = gl.createBuffer();
const satVBO = gl.createBuffer();
gl.useProgram(program);
gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
const aPositionLoc = gl.getAttribLocation(program, 'aPosition');
const uPointSizeLoc = gl.getUniformLocation(program, 'uPointSize');
const uProjectionLoc = gl.getUniformLocation(program, 'uProjection');
const uColorLoc = gl.getUniformLocation(program, 'uColor');
gl.enableVertexAttribArray(aPositionLoc);
const px = (window.devicePixelRatio || 1) * 6.0;
gl.clearColor(0, 0, 0, 1);
let satellites = new Cache([], 0);
let orbitVertices;
const numberOfSegments = 256;
function frame(now) {
    if (satellites.invalid()) {
        getSatellites().then(s => {
            satellites = s;
            orbitVertices = generateOrbitsVertices(satellites.data, numberOfSegments);
            gl.bindBuffer(gl.ARRAY_BUFFER, orbitsVBO);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(orbitVertices), gl.STATIC_DRAW);
            const [minX, maxX, minY, maxY] = findBounds(orbitVertices);
            const projectionMatrix = orthoMatrix(minX, maxX, minY, maxY, -1, 1, 0.05);
            gl.uniformMatrix4fv(uProjectionLoc, false, projectionMatrix);
        });
    }
    const satVertices = generateSatelliteVertices(satellites.data, Date.now());
    gl.bindBuffer(gl.ARRAY_BUFFER, satVBO);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(satVertices), gl.DYNAMIC_DRAW);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindBuffer(gl.ARRAY_BUFFER, orbitsVBO);
    gl.vertexAttribPointer(aPositionLoc, 3, gl.FLOAT, false, 0, 0);
    gl.uniform4f(uColorLoc, 1.0, 1.0, 1.0, 0.1);
    let offset = 0;
    for (const satellite of satellites.data) {
        gl.drawArrays(gl.LINE_STRIP, offset, numberOfSegments + 1);
        offset += numberOfSegments + 1;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, satVBO);
    gl.vertexAttribPointer(aPositionLoc, 3, gl.FLOAT, false, 0, 0);
    gl.uniform1f(uPointSizeLoc, px);
    gl.uniform4f(uColorLoc, 0.0, 0.85, 1.0, 1.0);
    gl.drawArrays(gl.POINTS, 0, satellites.data.length);
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
