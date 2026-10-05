/*
Practicum 5 - Textured and Lit Cube Playground (WebGL2, classic scripts)

Name : Anak Agung Putu Arda Nareswara
NRP  : 5025241074
Class: B

One cube with position plus normal plus UV. One lighting shader for every
canvas plus one flat shader for the ground grid. The stage owns the full
shared state. Each lab owns a frozen copy where only its challenge values
stay live. One shared loop drives all six canvases.
*/
(function () {
"use strict";

var DEG = Math.PI / 180;
var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var SPIN = REDUCED ? 0 : 1;

/* Cube centered on the local origin. 6 faces with 2 triangles each. */
var CUBE_POS = new Float32Array([
  -0.5, -0.5,  0.5,   0.5, -0.5,  0.5,   0.5,  0.5,  0.5,
  -0.5, -0.5,  0.5,   0.5,  0.5,  0.5,  -0.5,  0.5,  0.5,
   0.5, -0.5, -0.5,  -0.5, -0.5, -0.5,  -0.5,  0.5, -0.5,
   0.5, -0.5, -0.5,  -0.5,  0.5, -0.5,   0.5,  0.5, -0.5,
  -0.5, -0.5, -0.5,  -0.5, -0.5,  0.5,  -0.5,  0.5,  0.5,
  -0.5, -0.5, -0.5,  -0.5,  0.5,  0.5,  -0.5,  0.5, -0.5,
   0.5, -0.5,  0.5,   0.5, -0.5, -0.5,   0.5,  0.5, -0.5,
   0.5, -0.5,  0.5,   0.5,  0.5, -0.5,   0.5,  0.5,  0.5,
  -0.5,  0.5,  0.5,   0.5,  0.5,  0.5,   0.5,  0.5, -0.5,
  -0.5,  0.5,  0.5,   0.5,  0.5, -0.5,  -0.5,  0.5, -0.5,
  -0.5, -0.5, -0.5,   0.5, -0.5, -0.5,   0.5, -0.5,  0.5,
  -0.5, -0.5, -0.5,   0.5, -0.5,  0.5,  -0.5, -0.5,  0.5
]);

/* One normal per face. Sharp lighting edges come from this buffer. */
var FLAT_N = (function () {
  var dirs = [[0, 0, 1], [0, 0, -1], [-1, 0, 0], [1, 0, 0], [0, 1, 0], [0, -1, 0]];
  var out = new Float32Array(36 * 3);
  var f, v;
  for (f = 0; f < 6; f++) {
    for (v = 0; v < 6; v++) {
      out[(f * 6 + v) * 3] = dirs[f][0];
      out[(f * 6 + v) * 3 + 1] = dirs[f][1];
      out[(f * 6 + v) * 3 + 2] = dirs[f][2];
    }
  }
  return out;
})();

/* Smooth normals point from center to corner. Same shape but rounder light. */
function smoothNormals(pos) {
  var out = new Float32Array(pos.length);
  var i, x, y, z, len;
  for (i = 0; i < pos.length; i += 3) {
    x = pos[i];
    y = pos[i + 1];
    z = pos[i + 2];
    len = Math.hypot(x, y, z) || 1;
    out[i] = x / len;
    out[i + 1] = y / len;
    out[i + 2] = z / len;
  }
  return out;
}
var SMOOTH_N = smoothNormals(CUBE_POS);

/* Same UV quad on every face. Scale moves it outside zero to one for wrap tests. */
var CUBE_UV = (function () {
  var face = [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1];
  var out = [];
  var f;
  for (f = 0; f < 6; f++) out.push.apply(out, face);
  return new Float32Array(out);
})();

/* Fixed 9 by 9 ground at y minus 1. */
function buildGround() {
  var pos = [];
  var col = [];
  var dim = [0.10, 0.35, 0.42];
  var axe = [0.30, 0.80, 0.90];
  var i, t, k;
  for (i = -4; i <= 4; i++) {
    t = i * 0.5;
    pos.push(t, -1, -2, t, -1, 2);
    pos.push(-2, -1, t, 2, -1, t);
    for (k = 0; k < 4; k++) col.push(dim[0], dim[1], dim[2]);
  }
  pos.push(-2, -1, 0, 2, -1, 0, 0, -1, -2, 0, -1, 2);
  for (k = 0; k < 4; k++) col.push(axe[0], axe[1], axe[2]);
  return { pos: new Float32Array(pos), col: new Float32Array(col) };
}
var GROUND = buildGround();

/* Flat color shader for the grid. Lighting never touches background chrome. */
var GRID_VS = "#version 300 es\nin vec3 a_position;\nuniform mat4 u_model;\nuniform mat4 u_view;\nuniform mat4 u_projection;\nvoid main(){gl_Position=u_projection*u_view*u_model*vec4(a_position,1.0);}";
var GRID_FS = "#version 300 es\nprecision mediump float;\nuniform vec3 u_color;\nout vec4 outColor;\nvoid main(){outColor=vec4(u_color,1.0);}";

/* one shared state for the stage. Labs freeze copies, no per lab classes. */
var S = {
  rx: 20, ry: 30, paused: false,
  shading: "FLAT",
  filter: "LINEAR",
  mip: 0,
  wrap: 0,
  uv: 1.0,
  shine: 32.0,
  ambient: 0.18,
  light: [2.0, 2.0, 2.0],
  cam: [0.0, 1.4, 4.0],
  texSrc: "checker",
  photoReady: false,
  orbit: false, orbitAng: 0,
  useA: true, useD: true, useS: true,
  normalize: true, lighting: true, correctNM: true,
  nonUniform: false
};
var WRAPS = ["REPEAT", "CLAMP_TO_EDGE", "MIRRORED_REPEAT"];
var MIPS = ["OFF", "LINEAR_MIPMAP_LINEAR", "NEAREST_MIPMAP_NEAREST"];

/* Frozen lab copies. Only the challenge field of each stays live. */
function labState() {
  return {
    shading: "FLAT", filter: "LINEAR", mip: 0, wrap: 0, uv: 1.0,
    shine: 32.0, ambient: 0.18, light: [2.0, 2.0, 2.0],
    texSrc: "checker", useA: true, useD: true, useS: true,
    normalize: true, lighting: true, correctNM: true, nonUniform: false
  };
}
var labA = labState(); labA.texSrc = "photo";
var labD = labState();
var labE = labState(); labE.ang = 0; labE.orbit = false;
var labF = labState();
var labG = labState();

function row(k, v) {
  return "<div class='data-line'><span>" + k + "</span><b>" + v + "</b></div>";
}

function fmt(n, d) {
  return (n < 0 ? "-" : "") + Math.abs(n).toFixed(d);
}

function el(id) {
  return document.getElementById(id);
}

function on(id, fn) {
  var b = el(id);
  if (b) b.addEventListener("click", fn);
}

function mark(id, onOff) {
  var b = el(id);
  if (!b) return;
  if (onOff) b.classList.add("active");
  else b.classList.remove("active");
  b.setAttribute("aria-pressed", onOff ? "true" : "false");
}

function getShaderSource(id) {
  var s = el(id);
  if (!s) throw new Error("Shader block " + id + " missing.");
  return s.textContent.trim();
}

function compile(gl, type, src) {
  var s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    var info = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error("Shader compile failed. " + info);
  }
  return s;
}

function link(gl, vs, fs) {
  var p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error("Program link failed. " + gl.getProgramInfoLog(p));
  }
  return p;
}

function makeBuf(gl, data) {
  var b = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return b;
}

/* Procedural checker so the page works with no download and no CORS risk. */
function makeChecker(gl) {
  var size = 64, cells = 8, cell = size / cells;
  var c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  var ctx = c.getContext("2d");
  var x, y;
  for (y = 0; y < cells; y++) {
    for (x = 0; x < cells; x++) {
      ctx.fillStyle = ((x + y) % 2 === 0) ? "#f8fafc" : "#0ea5e9";
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  var t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  gl.generateMipmap(gl.TEXTURE_2D);
  return t;
}

function minEnum(gl, st) {
  if (st.mip === 1) return gl.LINEAR_MIPMAP_LINEAR;
  if (st.mip === 2) return gl.NEAREST_MIPMAP_NEAREST;
  return st.filter === "NEAREST" ? gl.NEAREST : gl.LINEAR;
}

function magEnum(gl, st) {
  return st.filter === "NEAREST" ? gl.NEAREST : gl.LINEAR;
}

function wrapEnum(gl, st) {
  if (WRAPS[st.wrap] === "CLAMP_TO_EDGE") return gl.CLAMP_TO_EDGE;
  if (WRAPS[st.wrap] === "MIRRORED_REPEAT") return gl.MIRRORED_REPEAT;
  return gl.REPEAT;
}

/* Params live on the texture object so both sources get the same treatment. */
function applySampling(g) {
  var gl = g.gl, st = g.st;
  var list = [g.checker];
  if (g.photo) list.push(g.photo);
  var i;
  for (i = 0; i < list.length; i++) {
    gl.bindTexture(gl.TEXTURE_2D, list[i]);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minEnum(gl, st));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magEnum(gl, st));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapEnum(gl, st));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapEnum(gl, st));
  }
}

/* One context per canvas. Same programs and same buffers everywhere. */
function makeLit(id, st) {
  var canvas = el(id);
  if (!canvas) return null;
  var gl = canvas.getContext("webgl2");
  if (!gl) {
    canvas.parentNode.innerHTML = "<p style='padding:20px'>WebGL2 not available in this browser.</p>";
    return null;
  }
  gl.enable(gl.DEPTH_TEST);
  var prog = link(gl,
    compile(gl, gl.VERTEX_SHADER, getShaderSource("vertex-shader")),
    compile(gl, gl.FRAGMENT_SHADER, getShaderSource("fragment-shader")));
  var gridProg = link(gl,
    compile(gl, gl.VERTEX_SHADER, GRID_VS),
    compile(gl, gl.FRAGMENT_SHADER, GRID_FS));
  var g = {
    canvas: canvas, gl: gl, st: st, prog: prog,
    uM: gl.getUniformLocation(prog, "u_model"),
    uV: gl.getUniformLocation(prog, "u_view"),
    uP: gl.getUniformLocation(prog, "u_projection"),
    uN: gl.getUniformLocation(prog, "u_normalMatrix"),
    uUV: gl.getUniformLocation(prog, "u_uvScale"),
    uLP: gl.getUniformLocation(prog, "u_lightPosition"),
    uLC: gl.getUniformLocation(prog, "u_lightColor"),
    uCP: gl.getUniformLocation(prog, "u_cameraPosition"),
    uAmb: gl.getUniformLocation(prog, "u_ambientStrength"),
    uSh: gl.getUniformLocation(prog, "u_shininess"),
    uTx: gl.getUniformLocation(prog, "u_texture"),
    uUA: gl.getUniformLocation(prog, "u_useAmbient"),
    uUD: gl.getUniformLocation(prog, "u_useDiffuse"),
    uUS: gl.getUniformLocation(prog, "u_useSpecular"),
    uUN: gl.getUniformLocation(prog, "u_useNormalize"),
    uUL: gl.getUniformLocation(prog, "u_useLighting"),
    aP: gl.getAttribLocation(prog, "a_position"),
    aN: gl.getAttribLocation(prog, "a_normal"),
    aT: gl.getAttribLocation(prog, "a_texCoord"),
    gridProg: gridProg,
    gM: gl.getUniformLocation(gridProg, "u_model"),
    gV: gl.getUniformLocation(gridProg, "u_view"),
    gP: gl.getUniformLocation(gridProg, "u_projection"),
    gC: gl.getUniformLocation(gridProg, "u_color"),
    gA: gl.getAttribLocation(gridProg, "a_position"),
    pb: null, fb: null, sb: null, tb: null, gb: null, gcb: null,
    checker: null, photo: null
  };
  g.pb = makeBuf(gl, CUBE_POS);
  g.fb = makeBuf(gl, FLAT_N);
  g.sb = makeBuf(gl, SMOOTH_N);
  g.tb = makeBuf(gl, CUBE_UV);
  g.gb = makeBuf(gl, GROUND.pos);
  g.gcb = makeBuf(gl, GROUND.col);
  g.checker = makeChecker(gl);
  applySampling(g);
  return g;
}

function allGL() {
  return [stage.g, labAg.g, labDg.g, labEg.g, labFg.g, labGg.g];
}

/* One photo load feeds every context that exists. */
function uploadPhoto(g, img) {
  var gl = g.gl;
  if (!gl || g.photo) return;
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  g.photo = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, g.photo);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  applySampling(g);
}

function activeTex(g) {
  var st = g.st;
  if (st.texSrc === "photo" && g.photo) return g.photo;
  return g.checker;
}

function texName(st) {
  if (st.texSrc === "photo") return S.photoReady ? "photo" : "photo loading";
  return "checker";
}

/* Naive path takes the upper block straight. Correct path uses inverse transpose. */
function normalMat(model, st) {
  if (st.correctNM) return normalMatrixFromMat4(model);
  return new Float32Array([model[0], model[1], model[2], model[4], model[5], model[6], model[8], model[9], model[10]]);
}

function modelMatrixFor(rx, ry, nonUniform) {
  var sx = 1, sy = 1, sz = 1;
  if (nonUniform) { sx = 1.8; sy = 0.6; sz = 1.0; }
  var m = Mat4.identity();
  m = Mat4.multiply(m, Mat4.scaling(sx, sy, sz));
  m = Mat4.multiply(m, Mat4.rotationX(rx * DEG));
  m = Mat4.multiply(m, Mat4.rotationY(ry * DEG));
  return m;
}

function perspFor(canvas) {
  return Mat4.perspective(60 * DEG, canvas.width / canvas.height, 0.1, 100.0);
}

function bindAttr(gl, buf, loc, size) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
}

/* Background chrome only, drawn first so cubes always paint over it. */
function drawGround(g, view, proj) {
  var gl = g.gl;
  gl.useProgram(g.gridProg);
  bindAttr(gl, g.gb, g.gA, 3);
  gl.uniformMatrix4fv(g.gM, false, Mat4.identity());
  gl.uniformMatrix4fv(g.gV, false, view);
  gl.uniformMatrix4fv(g.gP, false, proj);
  gl.uniform3f(g.gC, 0.10, 0.35, 0.42);
  gl.drawArrays(gl.LINES, 0, 36);
  gl.uniform3f(g.gC, 0.30, 0.80, 0.90);
  gl.drawArrays(gl.LINES, 36, 4);
}

function drawLit(g, model, view, proj, camPos) {
  var gl = g.gl, st = g.st;
  gl.viewport(0, 0, g.canvas.width, g.canvas.height);
  gl.clearColor(0.025, 0.04, 0.08, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  drawGround(g, view, proj);
  gl.useProgram(g.prog);
  bindAttr(gl, g.pb, g.aP, 3);
  bindAttr(gl, st.shading === "FLAT" ? g.fb : g.sb, g.aN, 3);
  bindAttr(gl, g.tb, g.aT, 2);
  gl.uniformMatrix4fv(g.uM, false, model);
  gl.uniformMatrix4fv(g.uV, false, view);
  gl.uniformMatrix4fv(g.uP, false, proj);
  gl.uniformMatrix3fv(g.uN, false, normalMat(model, st));
  gl.uniform3fv(g.uLP, st.light);
  gl.uniform3f(g.uLC, 1.0, 1.0, 1.0);
  gl.uniform3fv(g.uCP, camPos);
  gl.uniform1f(g.uAmb, st.ambient);
  gl.uniform1f(g.uSh, st.shine);
  gl.uniform1f(g.uUV, st.uv);
  gl.uniform1f(g.uUA, st.useA ? 1.0 : 0.0);
  gl.uniform1f(g.uUD, st.useD ? 1.0 : 0.0);
  gl.uniform1f(g.uUS, st.useS ? 1.0 : 0.0);
  gl.uniform1f(g.uUN, st.normalize ? 1.0 : 0.0);
  gl.uniform1f(g.uUL, st.lighting ? 1.0 : 0.0);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, activeTex(g));
  gl.uniform1i(g.uTx, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 36);
}

function hudPos(p, d) {
  return "(" + fmt(p[0], d) + "," + fmt(p[1], d) + "," + fmt(p[2], d) + ")";
}

function flipShading() {
  S.shading = S.shading === "FLAT" ? "SMOOTH" : "FLAT";
}

function flipFilter() {
  S.filter = S.filter === "LINEAR" ? "NEAREST" : "LINEAR";
}

function flipWrap() {
  S.wrap = (S.wrap + 1) % WRAPS.length;
}

function flipTex() {
  S.texSrc = S.texSrc === "checker" ? "photo" : "checker";
  paintTexS();
}

function flipMip() {
  S.mip = (S.mip + 1) % MIPS.length;
}

function refreshAllSampling() {
  var list = allGL(), i;
  for (i = 0; i < list.length; i++) {
    if (list[i]) applySampling(list[i]);
  }
}

function toggleOrbit() {
  S.orbit = !S.orbit;
  if (S.orbit) S.orbitAng = Math.atan2(S.light[2], S.light[0]);
  paintOrbitS();
}

function paintTexS() {
  paintText("btnTexModeS", "Texture: " + (S.texSrc === "photo" ? "On" : "Off"), S.texSrc === "photo");
}

function paintOrbitS() {
  paintText("btnOrbitModeS", "Orbit: " + (S.orbit ? "On" : "Off"), S.orbit);
}

function paintSelect(id, value) {
  var s = el(id);
  if (s) s.value = value;
}

function syncSelects() {
  paintSelect("selShading", S.shading);
  paintSelect("selFilter", S.filter);
  paintSelect("selWrap", String(S.wrap));
  paintSelect("selMipS", String(S.mip));
  paintTexS();
  paintOrbitS();
}

function toggleComp(which) {
  if (which === 0) S.useA = !S.useA;
  if (which === 1) S.useD = !S.useD;
  if (which === 2) S.useS = !S.useS;
}

function toggleScale() {
  S.nonUniform = !S.nonUniform;
}

function toggleNM() {
  S.correctNM = !S.correctNM;
}

/* One painter per morphing button. The label always names the live value. */
function paintText(id, text, isOn) {
  var b = el(id);
  if (!b) return;
  b.textContent = text;
  mark(id, isOn);
}

function paintTex() {
  paintText("btnTexMode", "Texture: " + (labA.texSrc === "photo" ? "Photo" : "Checker"), labA.texSrc === "photo");
}

function paintScale() {
  paintText("btnScaleMode", "Scale: " + (labD.nonUniform ? "Stretched" : "Uniform"), labD.nonUniform);
}

function paintNM() {
  paintText("btnMatrixMode", "Matrix: " + (labD.correctNM ? "Correct" : "Naive"), !labD.correctNM);
}

function paintOrbitE() {
  paintText("btnOrbitMode", "Orbit: " + (labE.orbit ? "On" : "Off"), labE.orbit);
}

function paintMip() {
  var sel = el("selMip");
  if (sel) sel.value = String(labG.mip);
}

function resetAll() {
  S.rx = 20;
  S.ry = 30;
  S.shading = "FLAT";
  S.filter = "LINEAR";
  S.mip = 0;
  S.wrap = 0;
  S.uv = 1.0;
  S.shine = 32.0;
  S.ambient = 0.18;
  S.light = [2.0, 2.0, 2.0];
  S.cam = [0.0, 1.4, 4.0];
  S.texSrc = "checker";
  S.orbit = false;
  S.useA = true;
  S.useD = true;
  S.useS = true;
  S.normalize = true;
  S.lighting = true;
  S.correctNM = true;
  S.nonUniform = false;
  S.paused = false;
  labA.texSrc = "checker";
  labD.nonUniform = false;
  labD.correctNM = true;
  labE.ang = 0;
  labE.orbit = false;
  labE.light = [2.0, 2.0, 2.0];
  labF.useA = true;
  labF.useD = true;
  labF.useS = true;
  labG.filter = "LINEAR";
  labG.mip = 0;
mark("btnPause", false);
paintTexS();
paintOrbitS();
  paintTex();
  paintScale();
  paintNM();
  paintOrbitE();
  paintMip();
  mark("btnAmbTgl", true);
  mark("btnDifTgl", true);
  mark("btnSpcTgl", true);
  refreshAllSampling();
}

/* ================= contexts ================= */

var stage = { g: makeLit("glMain", S) };
var labAg = { g: makeLit("glA", labA) };
var labDg = { g: makeLit("glScale", labD) };
var labEg = { g: makeLit("glE", labE) };
var labFg = { g: makeLit("glF", labF) };
var labGg = { g: makeLit("glMip", labG) };

(function loadPhoto() {
  var img = new Image();
  img.src = "assets/texture.webp";
  img.onload = function () {
    S.photoReady = true;
    var list = allGL(), i;
    for (i = 0; i < list.length; i++) {
      if (list[i]) uploadPhoto(list[i], img);
    }
  };
  img.onerror = function () {
    S.photoReady = false;
    if (S.texSrc === "photo") S.texSrc = "checker";
    if (labA.texSrc === "photo") labA.texSrc = "checker";
  };
})();

/* ================= input ================= */

var keys = {};
window.addEventListener("keydown", function (e) {
  var k = e.key.toLowerCase();
  keys[k] = true;
  if (e.key.indexOf("Arrow") === 0 || k === " ") e.preventDefault();
  if (e.repeat) return;
  if (k === "f") flipShading();
  else if (k === "t") { flipFilter(); refreshAllSampling(); }
  else if (k === "g") { flipWrap(); refreshAllSampling(); }
  else if (k === "v") flipTex();
  else if (k === "m") { flipMip(); refreshAllSampling(); }
  else if (k === "n") toggleScale();
  else if (k === "b") toggleNM();
  else if (k === "x") { S.normalize = !S.normalize; }
  else if (k === "0") { S.lighting = !S.lighting; }
  else if (k === "1") toggleComp(0);
  else if (k === "2") toggleComp(1);
  else if (k === "3") toggleComp(2);
  else if (k === "y") toggleOrbit();
  else if (k === "r") resetAll();
  else if (k === " ") { S.paused = !S.paused; mark("btnPause", S.paused); }
});
window.addEventListener("keyup", function (e) {
  keys[e.key.toLowerCase()] = false;
});

function moveCam(cam, dt, cs) {
  if (keys.j) cam[0] -= cs * dt;
  if (keys.l) cam[0] += cs * dt;
  if (keys.i) cam[1] += cs * dt;
  if (keys.k) cam[1] -= cs * dt;
  if (keys.u) cam[2] -= cs * dt;
  if (keys.o) cam[2] += cs * dt;
}

function updateState(dt) {
  if (S.paused) return;
  S.rx += 20.0 * SPIN * dt;
  S.ry += 35.0 * SPIN * dt;
  var ls = 2.0;
  if (S.orbit) {
    S.orbitAng += 0.7 * dt;
    S.light[0] = Math.cos(S.orbitAng) * 3.0;
    S.light[2] = Math.sin(S.orbitAng) * 3.0;
  } else {
    if (keys.arrowleft) S.light[0] -= ls * dt;
    if (keys.arrowright) S.light[0] += ls * dt;
    if (keys.arrowup) S.light[1] += ls * dt;
    if (keys.arrowdown) S.light[1] -= ls * dt;
    if (keys.w) S.light[2] -= ls * dt;
    if (keys.s) S.light[2] += ls * dt;
  }
  moveCam(S.cam, dt, 2.0);
  if (labE.orbit) {
    labE.ang += 0.7 * dt;
    labE.light[0] = Math.cos(labE.ang) * 3.0;
    labE.light[2] = Math.sin(labE.ang) * 3.0;
  }
  var us = 1.5;
  if (keys["["]) S.uv -= us * dt;
  if (keys["]"]) S.uv += us * dt;
  S.uv = Math.max(0.25, Math.min(5.0, S.uv));
  var ss = 50.0;
  if (keys["-"] || keys._) S.shine -= ss * dt;
  if (keys["+"] || keys["="]) S.shine += ss * dt;
  S.shine = Math.max(2.0, Math.min(128.0, S.shine));
  var as = 0.6;
  if (keys.a) S.ambient += as * dt;
  if (keys.z) S.ambient -= as * dt;
  S.ambient = Math.max(0.0, Math.min(1.0, S.ambient));
}

/* ================= sliders ================= */

function bindSlider(id, valId, get, set, format) {
  var input = el(id), val = el(valId);
  if (!input) return;
  input.addEventListener("input", function () {
    set(parseFloat(input.value));
  });
  syncers.push(function () {
    var v = get();
    input.value = v;
    if (val) val.textContent = format(v);
  });
}
var syncers = [];

bindSlider("sAmb", "sAmbVal", function () { return S.ambient; }, function (v) { S.ambient = v; }, function (v) { return v.toFixed(2); });
bindSlider("sShine", "sShineVal", function () { return S.shine; }, function (v) { S.shine = v; }, function (v) { return v.toFixed(0); });
bindSlider("sUV", "sUVVal", function () { return S.uv; }, function (v) { S.uv = v; }, function (v) { return v.toFixed(2); });
bindSlider("sLX", "sLXVal", function () { return S.light[0]; }, function (v) { S.light[0] = v; }, function (v) { return v.toFixed(2); });
bindSlider("sLY", "sLYVal", function () { return S.light[1]; }, function (v) { S.light[1] = v; }, function (v) { return v.toFixed(2); });
bindSlider("sLZ", "sLZVal", function () { return S.light[2]; }, function (v) { S.light[2] = v; }, function (v) { return v.toFixed(2); });
bindSlider("sCX", "sCXVal", function () { return S.cam[0]; }, function (v) { S.cam[0] = v; }, function (v) { return v.toFixed(2); });
bindSlider("sCY", "sCYVal", function () { return S.cam[1]; }, function (v) { S.cam[1] = v; }, function (v) { return v.toFixed(2); });
bindSlider("sCZ", "sCZVal", function () { return S.cam[2]; }, function (v) { S.cam[2] = v; }, function (v) { return v.toFixed(2); });

/* ================= draw ================= */

function drawStage() {
  var g = stage.g;
  if (!g) return;
  var model = modelMatrixFor(S.rx, S.ry, S.nonUniform);
  var view = Mat4.lookAt(S.cam, [0, 0, 0], [0, 1, 0]);
  var proj = perspFor(g.canvas);
  drawLit(g, model, view, proj, S.cam);
  var i;
  for (i = 0; i < syncers.length; i++) syncers[i]();
  syncSelects();
  el("hudMain").textContent = S.shading + " " + texName(S) + " " + S.filter +
    " " + WRAPS[S.wrap] + " uv" + fmt(S.uv, 2) + " sh" + fmt(S.shine, 0);
  el("teleShade").textContent = S.shading;
  el("teleTex").textContent = texName(S) + " " + S.filter;
  el("teleLight").textContent = hudPos(S.light, 2);
  el("teleCam").textContent = hudPos(S.cam, 2);
  el("dataMain").innerHTML =
    row("shading", S.shading) +
    row("texture", texName(S)) +
    row("filter", S.filter + " mip " + MIPS[S.mip]) +
    row("wrap", WRAPS[S.wrap]) +
    row("uv scale", fmt(S.uv, 2)) +
    row("ambient", fmt(S.ambient, 2)) +
    row("shininess", fmt(S.shine, 1)) +
    row("light", hudPos(S.light, 2)) +
    row("camera", hudPos(S.cam, 2)) +
    row("orbit", S.orbit ? "ON" : "OFF") +
    row("parts A D S", (S.useA ? "on" : "off") + " " + (S.useD ? "on" : "off") + " " + (S.useS ? "on" : "off")) +
    row("normalize", S.normalize ? "ON" : "OFF") +
    row("lighting", S.lighting ? "ON" : "OFF");
}

function labModel() {
  return modelMatrixFor(S.rx, S.ry, false);
}

function drawLabA() {
  var g = labAg.g;
  if (!g) return;
  var cam = [0, 1.2, 3.8];
  var view = Mat4.lookAt(cam, [0, 0, 0], [0, 1, 0]);
  var proj = perspFor(g.canvas);
  drawLit(g, labModel(), view, proj, cam);
  el("hudA").textContent = texName(labA) + " fixed light";
  el("texStatus").innerHTML =
    row("lab source", texName(labA)) +
    row("stage source", texName(S)) +
    row("file", "assets/texture.webp");
}

function drawLabD() {
  var g = labDg.g;
  if (!g) return;
  var model = modelMatrixFor(S.rx, S.ry, labD.nonUniform);
  var cam = [0, 1.0, 3.6];
  var view = Mat4.lookAt(cam, [0, 0, 0], [0, 1, 0]);
  var proj = perspFor(g.canvas);
  drawLit(g, model, view, proj, cam);
  el("hudScale").textContent = (labD.nonUniform ? "stretch" : "uniform") +
    " " + (labD.correctNM ? "correct" : "naive");
  el("dataScale").innerHTML =
    row("scale", labD.nonUniform ? "1.8 0.6 1.0" : "1.0 1.0 1.0") +
    row("matrix", labD.correctNM ? "correct" : "naive") +
    row("toggle", "N scale B matrix");
}

function drawLabE() {
  var g = labEg.g;
  if (!g) return;
  var cam = [0, 1.2, 3.8];
  var view = Mat4.lookAt(cam, [0, 0, 0], [0, 1, 0]);
  var proj = perspFor(g.canvas);
  drawLit(g, labModel(), view, proj, cam);
  el("hudE").textContent = (labE.orbit ? "orbit " : "parked ") + hudPos(labE.light, 1);
  el("orbitStatus").innerHTML =
    row("orbit", labE.orbit ? "ON" : "OFF") +
    row("lab light", hudPos(labE.light, 2));
}

function drawLabF() {
  var g = labFg.g;
  if (!g) return;
  var cam = [0, 1.2, 3.8];
  var view = Mat4.lookAt(cam, [0, 0, 0], [0, 1, 0]);
  var proj = perspFor(g.canvas);
  drawLit(g, labModel(), view, proj, cam);
  el("hudF").textContent = (labF.useA ? "A" : "-") + (labF.useD ? "D" : "-") + (labF.useS ? "S" : "-");
  el("compStatus").innerHTML =
    row("ambient 1", labF.useA ? "ON" : "OFF") +
    row("diffuse 2", labF.useD ? "ON" : "OFF") +
    row("specular 3", labF.useS ? "ON" : "OFF");
}

function drawLabG() {
  var g = labGg.g;
  if (!g) return;
  var cam = [0, 0.6, 6.2];
  var view = Mat4.lookAt(cam, [0, 0, 0], [0, 1, 0]);
  var proj = perspFor(g.canvas);
  drawLit(g, labModel(), view, proj, cam);
  el("hudMip").textContent = labG.filter + " mip " + MIPS[labG.mip];
  el("dataMip").innerHTML =
    row("filter", labG.filter) +
    row("mipmap", MIPS[labG.mip]) +
    row("camera z", "6.2 far view");
}

/* ================= buttons ================= */

function bindSelect(id, set) {
  var s = el(id);
  if (s) s.addEventListener("change", function () { set(s.value); });
}

bindSelect("selShading", function (v) { S.shading = v; });
bindSelect("selFilter", function (v) { S.filter = v; refreshAllSampling(); });
bindSelect("selWrap", function (v) { S.wrap = parseInt(v, 10) || 0; refreshAllSampling(); });
bindSelect("selMipS", function (v) { S.mip = parseInt(v, 10) || 0; refreshAllSampling(); });
on("btnTexModeS", flipTex);
on("btnOrbitModeS", toggleOrbit);
on("btnPause", function () { S.paused = !S.paused; mark("btnPause", S.paused); });
on("btnReset", resetAll);
on("btnTexMode", function () { labA.texSrc = labA.texSrc === "checker" ? "photo" : "checker"; paintTex(); });
on("btnScaleMode", function () { labD.nonUniform = !labD.nonUniform; paintScale(); });
on("btnMatrixMode", function () { labD.correctNM = !labD.correctNM; paintNM(); });
on("btnOrbitMode", function () { labE.orbit = !labE.orbit; paintOrbitE(); });
on("btnAmbTgl", function () { labF.useA = !labF.useA; mark("btnAmbTgl", labF.useA); });
on("btnDifTgl", function () { labF.useD = !labF.useD; mark("btnDifTgl", labF.useD); });
on("btnSpcTgl", function () { labF.useS = !labF.useS; mark("btnSpcTgl", labF.useS); });
var selMip = el("selMip");
if (selMip) selMip.addEventListener("change", function () {
  labG.mip = parseInt(selMip.value, 10) || 0;
  refreshAllSampling();
});
mark("btnAmbTgl", true);
mark("btnDifTgl", true);
mark("btnSpcTgl", true);
mark("btnPause", false);
paintTex();
paintScale();
paintNM();
paintOrbitE();
paintMip();

/* ================= shared loop ================= */

var lastTime = 0;
function frame(time) {
  var dt = Math.min((time - lastTime) * 0.001 || 0, 0.05);
  lastTime = time;
  updateState(dt);
  drawStage();
  drawLabA();
  drawLabD();
  drawLabE();
  drawLabF();
  drawLabG();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

})();
