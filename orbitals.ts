import { getPoints } from "./gp.js";

const canvas = document.getElementById('orbitals') as HTMLCanvasElement;
const gl = canvas.getContext('webgl2') as WebGL2RenderingContext;
if (!gl) throw new Error('WebGL not supported');

const vertSrc = `#version 300 es
    in vec2 aPos;
    uniform float uPointSize; // in pixels
    void main() {
        gl_Position = vec4(aPos, 0.0, 1.0);
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

function compileShader(type: number, source: string): WebGLShader {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error('Shader compile failed: ' + gl.getShaderInfoLog(shader));
    }
    return shader;
}

function createProgram(vsSource: string, fsSource: string): WebGLProgram {
    const vs = compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error('Program link failed: ' + gl.getProgramInfoLog(prog));
    }
    return prog;
}

const program = createProgram(vertSrc, fragSrc);

const points = await getPoints();

function normalizePoints() {
      // Find the maximum magnitude among points
      let maxMag = 0;
      for (let i = 0; i < points.length; i++) {
        const x = points[i * 2];
        const y = points[i * 2 + 1];
        const mag = Math.sqrt(x*x + y*y);
        if (mag > maxMag) maxMag = mag;
      }

      if (maxMag < 1e-6) maxMag = 1e-6;

      // Normalize all points by the maximum magnitude
      for (let i = 0; i < points.length; i++) {
        points[i * 2] /= maxMag;
        points[i * 2 + 1] /= maxMag;
      }
}
normalizePoints();

const vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.useProgram(program);

const aPosLoc = gl.getAttribLocation(program, 'aPos');
const uPointSizeLoc = gl.getUniformLocation(program, 'uPointSize');

gl.enableVertexAttribArray(aPosLoc);
gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);

function resize() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = Math.floor(canvas.clientWidth * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
    }
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
}

window.addEventListener('resize', resize);
resize();

const px = (window.devicePixelRatio || 1) * 6.0;
function frame(now: number) {
    gl.bufferData(gl.ARRAY_BUFFER, points, gl.STATIC_DRAW);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(uPointSizeLoc, px);
    gl.drawArrays(gl.POINTS, 0, points.length/2);
    requestAnimationFrame(frame);

}
requestAnimationFrame(frame);
