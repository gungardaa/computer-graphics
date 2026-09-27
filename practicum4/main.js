/*
Practicum 4 - Rotating 3D Cube Camera Playground (WebGL2, classic scripts)

Name : Anak Agung Putu Arda Nareswara
NRP  : 5025241074
Class: B

One cube shape lives in local space. Every canvas reuses that same shape
and only differs by model, view, and projection matrices, sent as
u_model, u_view, and u_projection. One shared loop drives all canvases.
*/
(function () {
"use strict";

var DEG = Math.PI / 180;
var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var SPIN = REDUCED ? 0 : 1; // frozen spin when reduced motion is set, full spin otherwise

/* Cube centered on the local origin. 6 faces, 2 triangles each, 36 vertices. */
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

/* One flat color per face, so orientation reads at a glance. */
var FACE_COL = [
  [0.0, 0.8, 1.0], // front cyan
  [0.2, 0.3, 1.0], // back blue
  [1.0, 0.5, 0.1], // left orange
  [0.2, 1.0, 0.4], // right green
  [1.0, 0.2, 0.8], // top magenta
  [1.0, 0.9, 0.1]  // bottom yellow
];
var CUBE_COL = (function () {
  var out = new Float32Array(36 * 3);
  var f, v;
  for (f = 0; f < 6; f++) {
    for (v = 0; v < 6; v++) {
      out[(f * 6 + v) * 3] = FACE_COL[f][0];
      out[(f * 6 + v) * 3 + 1] = FACE_COL[f][1];
      out[(f * 6 + v) * 3 + 2] = FACE_COL[f][2];
    }
  }
  return out;
})();

var CLIPS = [
  { near: 0.1, far: 100 },
  { near: 1.0, far: 20 },
  { near: 2.5, far: 8 }
];
var TARGETS = [[0, 0, 0], [1, 0, 0], [-1, 0, 0]];

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

/* One context per canvas. Static geometry uploaded once, never rewritten. */
function makeGL(id) {
  var canvas = el(id);
  if (!canvas) return null;
  var gl = canvas.getContext("webgl2");
  if (!gl) {
    canvas.parentNode.innerHTML = "<p style='padding:20px'>WebGL2 not available in this browser.</p>";
    return null;
  }
  var prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, getShaderSource("vertex-shader")));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, getShaderSource("fragment-shader")));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error("Program link failed. " + gl.getProgramInfoLog(prog));
  }
  gl.useProgram(prog);
  var vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  var ground = buildGround();
  var gb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, gb);
  gl.bufferData(gl.ARRAY_BUFFER, ground.pos, gl.STATIC_DRAW);
  var gc = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, gc);
  gl.bufferData(gl.ARRAY_BUFFER, ground.col, gl.STATIC_DRAW);
  var pbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, pbo);
  gl.bufferData(gl.ARRAY_BUFFER, CUBE_POS, gl.STATIC_DRAW);
  var locP = gl.getAttribLocation(prog, "a_position");
  gl.enableVertexAttribArray(locP);
  gl.vertexAttribPointer(locP, 3, gl.FLOAT, false, 0, 0);
  var cbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cbo);
  gl.bufferData(gl.ARRAY_BUFFER, CUBE_COL, gl.STATIC_DRAW);
  var locC = gl.getAttribLocation(prog, "a_color");
  gl.enableVertexAttribArray(locC);
  gl.vertexAttribPointer(locC, 3, gl.FLOAT, false, 0, 0);
  return {
    canvas: canvas, gl: gl,
    uM: gl.getUniformLocation(prog, "u_model"),
    uV: gl.getUniformLocation(prog, "u_view"),
    uP: gl.getUniformLocation(prog, "u_projection"),
    pb: pbo, cb: cbo, locP: locP, locC: locC,
    gb: gb, gc: gc, gCount: ground.pos.length / 3
  };
}

function modelMatrix(rxDeg, ryDeg) {
  var m = Mat4.identity();
  m = Mat4.multiply(m, Mat4.rotationX(rxDeg * DEG));
  m = Mat4.multiply(m, Mat4.rotationY(ryDeg * DEG));
  return m;
}

function perspFor(canvas, fov, near, far) {
  return Mat4.perspective(fov * DEG, canvas.width / canvas.height, near, far);
}

function orthoFor(canvas, near, far) {
  var aspect = canvas.width / canvas.height;
  var size = 2.0;
  return Mat4.orthographic(-size * aspect, size * aspect, -size, size, near, far);
}

function clearAll(g) {
  var gl = g.gl;
  gl.viewport(0, 0, g.canvas.width, g.canvas.height);
  gl.clearColor(0.03, 0.05, 0.10, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}

function setDepth(g, enabled) {
  if (enabled) g.gl.enable(g.gl.DEPTH_TEST);
  else g.gl.disable(g.gl.DEPTH_TEST);
}

function drawOne(g, model, view, proj) {
  var gl = g.gl;
  gl.bindBuffer(gl.ARRAY_BUFFER, g.pb);
  gl.vertexAttribPointer(g.locP, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, g.cb);
  gl.vertexAttribPointer(g.locC, 3, gl.FLOAT, false, 0, 0);
  gl.uniformMatrix4fv(g.uM, false, model);
  gl.uniformMatrix4fv(g.uV, false, view);
  gl.uniformMatrix4fv(g.uP, false, proj);
  gl.drawArrays(gl.TRIANGLES, 0, 36);
}

/* fixed 9 by 9 ground at y -1, sized for this small scene. Grow the range or add fog if the scene ever outgrows it. */
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

/* Background chrome only, drawn first so cubes always paint over it. Never counted as an object. */
function drawGround(g, view, proj) {
  var gl = g.gl;
  gl.bindBuffer(gl.ARRAY_BUFFER, g.gb);
  gl.vertexAttribPointer(g.locP, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, g.gc);
  gl.vertexAttribPointer(g.locC, 3, gl.FLOAT, false, 0, 0);
  gl.uniformMatrix4fv(g.uM, false, Mat4.identity());
  gl.uniformMatrix4fv(g.uV, false, view);
  gl.uniformMatrix4fv(g.uP, false, proj);
  gl.drawArrays(gl.LINES, 0, g.gCount);
}

function hudPos(p) {
  return "(" + fmt(p[0], 1) + "," + fmt(p[1], 1) + "," + fmt(p[2], 1) + ")";
}

/* Shared spin, so every cube on the page turns together. */
var spin = { rx: 20, ry: 30 };

function stepSpin(dt) {
  spin.rx += 25 * SPIN * dt;
  spin.ry += 40 * SPIN * dt;
}

/* ================= MAIN STAGE ================= */

var stage = {
  g: makeGL("glMain"),
  cam: { pos: [0, 1.5, 4], tgt: 0, up: [0, 1, 0] },
  proj: { mode: "perspective", fov: 60, clip: 0 },
  depth: true,
  paused: false,
  orbit: false,
  orbitAng: 0,
  orbitR: 4
};

function stageTarget() {
  return TARGETS[stage.cam.tgt];
}

function stageProj(canvas) {
  var c = CLIPS[stage.proj.clip];
  if (stage.proj.mode === "perspective") return perspFor(canvas, stage.proj.fov, c.near, c.far);
  return orthoFor(canvas, c.near, c.far);
}

function resetStage() {
  stage.cam.pos = [0, 1.5, 4];
  stage.cam.tgt = 0;
  stage.cam.up = [0, 1, 0];
  stage.proj.mode = "perspective";
  stage.proj.fov = 60;
  stage.proj.clip = 0;
  stage.depth = true;
  stage.orbit = false;
  stage.paused = false;
  mark("orbitBtn", false);
  mark("pauseBtn", false);
}

var keys = {};
window.addEventListener("keydown", function (e) {
  var k = e.key.toLowerCase();
  keys[k] = true;
  if (e.key.indexOf("Arrow") === 0 || k === " " || k === "pageup" || k === "pagedown") e.preventDefault();
  if (e.repeat) return;
  if (k === "p") {
    stage.proj.mode = stage.proj.mode === "perspective" ? "orthographic" : "perspective";
  } else if (k === "n") {
    stage.proj.clip = (stage.proj.clip + 1) % CLIPS.length;
  } else if (k === "d") {
    stage.depth = !stage.depth;
    mark("depthBtn", stage.depth);
  } else if (k === "r") {
    resetStage();
  } else if (k === "o") {
    stage.orbit = !stage.orbit;
    if (stage.orbit) {
      stage.orbitR = Math.hypot(stage.cam.pos[0], stage.cam.pos[2]) || 4;
      stage.orbitAng = Math.atan2(stage.cam.pos[2], stage.cam.pos[0]);
    }
    mark("orbitBtn", stage.orbit);
  } else if (k === "t") {
    stage.cam.tgt = (stage.cam.tgt + 1) % TARGETS.length;
  } else if (k === "1") {
    stage.proj.fov = 35;
  } else if (k === "2") {
    stage.proj.fov = 60;
  } else if (k === "3") {
    stage.proj.fov = 90;
  } else if (k === "m") {
    logStage();
  } else if (k === " ") {
    stage.paused = !stage.paused;
    mark("pauseBtn", stage.paused);
  }
});
window.addEventListener("keyup", function (e) {
  keys[e.key.toLowerCase()] = false;
});

function logStage() {
  if (!stage.g) return;
  var model = modelMatrix(spin.rx, spin.ry);
  var view = Mat4.lookAt(stage.cam.pos, stageTarget(), stage.cam.up);
  var proj = stageProj(stage.g.canvas);
  console.log("model", Array.prototype.slice.call(model));
  console.log("view", Array.prototype.slice.call(view));
  console.log("projection", Array.prototype.slice.call(proj));
  console.table([["m0", "m1", "m2", "m3"],
    [fmt(model[0], 3), fmt(model[4], 3), fmt(model[8], 3), fmt(model[12], 3)],
    [fmt(model[1], 3), fmt(model[5], 3), fmt(model[9], 3), fmt(model[13], 3)],
    [fmt(model[2], 3), fmt(model[6], 3), fmt(model[10], 3), fmt(model[14], 3)]]);
}

function updateStage(dt) {
  if (stage.paused) return;
  stepSpin(dt);
  var sp = 2.0;
  var p = stage.cam.pos;
  if (stage.orbit) {
    stage.orbitAng += 0.6 * dt;
    p[0] = Math.cos(stage.orbitAng) * stage.orbitR;
    p[2] = Math.sin(stage.orbitAng) * stage.orbitR;
  } else {
    if (keys.arrowleft) p[0] -= sp * dt;
    if (keys.arrowright) p[0] += sp * dt;
    if (keys.arrowup) p[1] += sp * dt;
    if (keys.arrowdown) p[1] -= sp * dt;
    if (keys.w) p[2] -= sp * dt;
    if (keys.s) p[2] += sp * dt;
  }
  if (keys.pageup) p[1] += sp * dt;
  if (keys.pagedown) p[1] -= sp * dt;
  var fs = 35.0;
  if (keys["["]) stage.proj.fov -= fs * dt;
  if (keys["]"]) stage.proj.fov += fs * dt;
  stage.proj.fov = Math.max(30, Math.min(100, stage.proj.fov));
}

function drawStage() {
  var g = stage.g;
  if (!g) return;
  setDepth(g, stage.depth);
  clearAll(g);
  var model = modelMatrix(spin.rx, spin.ry);
  var view = Mat4.lookAt(stage.cam.pos, stageTarget(), stage.cam.up);
  var proj = stageProj(g.canvas);
  drawGround(g, view, proj);
  drawOne(g, model, view, proj);
  var c = CLIPS[stage.proj.clip];
  var short = stage.proj.mode === "perspective" ? "persp" : "ortho";
  el("hudMain").textContent = short + " f" + fmt(stage.proj.fov, 0) + " " +
    hudPos(stage.cam.pos) + " n" + c.near + " f" + c.far + (stage.depth ? " dON" : " dOFF");
  el("teleCam").textContent = hudPos(stage.cam.pos);
  el("teleProj").textContent = stage.proj.mode;
  el("teleFov").textContent = fmt(stage.proj.fov, 1) + " deg";
  el("teleDepth").textContent = stage.depth ? "ON" : "OFF";
  el("dataMain").innerHTML =
    row("camera", hudPos(stage.cam.pos)) +
    row("target", hudPos(stageTarget())) +
    row("projection", stage.proj.mode) +
    row("fov", fmt(stage.proj.fov, 1) + " deg") +
    row("near / far", c.near + " / " + c.far) +
    row("depth", stage.depth ? "ON" : "OFF") +
    row("orbit", stage.orbit ? "ON" : "OFF") +
    row("draw count", "36");
}

on("projBtn", function () {
  stage.proj.mode = stage.proj.mode === "perspective" ? "orthographic" : "perspective";
});
on("depthBtn", function () {
  stage.depth = !stage.depth;
  mark("depthBtn", stage.depth);
});
on("clipBtn", function () {
  stage.proj.clip = (stage.proj.clip + 1) % CLIPS.length;
});
on("orbitBtn", function () {
  stage.orbit = !stage.orbit;
  if (stage.orbit) {
    stage.orbitR = Math.hypot(stage.cam.pos[0], stage.cam.pos[2]) || 4;
    stage.orbitAng = Math.atan2(stage.cam.pos[2], stage.cam.pos[0]);
  }
  mark("orbitBtn", stage.orbit);
});
on("tgtBtn", function () {
  stage.cam.tgt = (stage.cam.tgt + 1) % TARGETS.length;
});
on("pauseBtn", function () {
  stage.paused = !stage.paused;
  mark("pauseBtn", stage.paused);
});
on("resetBtn", resetStage);
on("fov1", function () { stage.proj.fov = 35; });
on("fov2", function () { stage.proj.fov = 60; });
on("fov3", function () { stage.proj.fov = 90; });
mark("depthBtn", true);

/* ================= LAB A camera seats ================= */

var labCam = {
  g: makeGL("glCam"),
  seat: 0,
  seats: [[0, 0, 4], [2, 0, 4], [0, 2, 4]],
  names: ["A", "B", "C"]
};

function drawLabCam() {
  var g = labCam.g;
  if (!g) return;
  setDepth(g, true);
  clearAll(g);
  var pos = labCam.seats[labCam.seat];
  var camView = Mat4.lookAt(pos, [0, 0, 0], [0, 1, 0]);
  var camProj = perspFor(g.canvas, 60, 0.1, 100);
  drawGround(g, camView, camProj);
  drawOne(g, modelMatrix(spin.rx, spin.ry), camView, camProj);
  el("hudCam").textContent = "seat " + labCam.names[labCam.seat] + " " + hudPos(pos);
  el("dataCam").innerHTML =
    row("seat", labCam.names[labCam.seat] + " " + hudPos(pos)) +
    row("target", "(0.0,0.0,0.0)") +
    row("world moves", "no") +
    row("view changes", "yes");
}

on("camA", function () { labCam.seat = 0; });
on("camB", function () { labCam.seat = 1; });
on("camC", function () { labCam.seat = 2; });

/* ================= LAB B target plus up ================= */

var labTgt = {
  g: makeGL("glTarget"),
  tgt: 0,
  upTilted: false
};

function drawLabTgt() {
  var g = labTgt.g;
  if (!g) return;
  setDepth(g, true);
  clearAll(g);
  var up = labTgt.upTilted ? [0.7, 1, 0] : [0, 1, 0];
  var t = TARGETS[labTgt.tgt];
  var tgtView = Mat4.lookAt([0, 1.5, 4], t, up);
  var tgtProj = perspFor(g.canvas, 60, 0.1, 100);
  drawGround(g, tgtView, tgtProj);
  drawOne(g, modelMatrix(spin.rx, spin.ry), tgtView, tgtProj);
  el("hudTarget").textContent = "tgt " + hudPos(t) + (labTgt.upTilted ? " tilted" : " straight");
  el("dataTarget").innerHTML =
    row("target", hudPos(t)) +
    row("up", labTgt.upTilted ? "(0.7,1.0,0.0)" : "(0.0,1.0,0.0)") +
    row("gaze", labTgt.tgt === 0 ? "centered" : (labTgt.tgt === 1 ? "pulled right" : "pulled left"));
}

on("tgt0", function () { labTgt.tgt = 0; });
on("tgtL", function () { labTgt.tgt = 2; });
on("tgtR", function () { labTgt.tgt = 1; });
on("upBtn", function () {
  labTgt.upTilted = !labTgt.upTilted;
  mark("upBtn", labTgt.upTilted);
});

/* ================= LAB C split projection ================= */

var labSplit = { g: makeGL("glSplit") };

function drawLabSplit() {
  var g = labSplit.g;
  if (!g) return;
  var gl = g.gl;
  var w = g.canvas.width;
  var h = g.canvas.height;
  var half = Math.floor(w / 2);
  setDepth(g, true);
  gl.viewport(0, 0, w, h);
  gl.clearColor(0.03, 0.05, 0.10, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  var model = modelMatrix(spin.rx, spin.ry);
  var view = Mat4.lookAt([0, 1.5, 4], [0, 0, 0], [0, 1, 0]);
  var aspect = half / h;
  var persp = Mat4.perspective(60 * DEG, aspect, 0.1, 100);
  var ortho = Mat4.orthographic(-2 * aspect, 2 * aspect, -2, 2, 0.1, 100);
  gl.viewport(0, 0, half, h);
  drawGround(g, view, persp);
  drawOne(g, model, view, persp);
  gl.viewport(half, 0, w - half, h);
  drawGround(g, view, ortho);
  drawOne(g, model, view, ortho);
  el("hudSplit").textContent = "left persp, right ortho";
  el("dataSplit").innerHTML =
    row("left", "perspective f60") +
    row("right", "orthographic box 2") +
    row("shared", "model plus camera");
}

/* ================= LAB D depth trio ================= */

var labDepth = {
  g: makeGL("glDepth"),
  depth: true,
  clip: 0
};

function drawLabDepth() {
  var g = labDepth.g;
  if (!g) return;
  setDepth(g, labDepth.depth);
  clearAll(g);
  var view = Mat4.lookAt([0, 1.5, 4.5], [0, 0, 0], [0, 1, 0]);
  var c = CLIPS[labDepth.clip];
  var proj = perspFor(g.canvas, 60, c.near, c.far);
  var base = modelMatrix(spin.rx, spin.ry);
  var zs = [0, -1.5, 1.5];
  var i, m;
  drawGround(g, view, proj);
  for (i = 0; i < 3; i++) {
    m = Mat4.multiply(Mat4.translation(0, 0, zs[i]), base);
    drawOne(g, m, view, proj);
  }
  el("hudDepth").textContent = (labDepth.depth ? "dON" : "dOFF") + " n" + c.near + " f" + c.far;
  el("dataDepth").innerHTML =
    row("cubes", "z 0, -1.5, +1.5") +
    row("depth", labDepth.depth ? "ON" : "OFF") +
    row("near / far", c.near + " / " + c.far);
}

on("depthLabBtn", function () {
  labDepth.depth = !labDepth.depth;
  mark("depthLabBtn", labDepth.depth);
});
on("clipLabBtn", function () {
  labDepth.clip = (labDepth.clip + 1) % CLIPS.length;
});
mark("depthLabBtn", true);

/* ================= LAB E fov plus aspect ================= */

var labFov = {
  g: makeGL("glFov"),
  fov: 60,
  wide: true
};

function drawLabFov() {
  var g = labFov.g;
  if (!g) return;
  setDepth(g, true);
  clearAll(g);
  var fovView = Mat4.lookAt([0, 1.5, 4], [0, 0, 0], [0, 1, 0]);
  var fovProj = perspFor(g.canvas, labFov.fov, 0.1, 100);
  drawGround(g, fovView, fovProj);
  drawOne(g, modelMatrix(spin.rx, spin.ry), fovView, fovProj);
  var aspect = g.canvas.width / g.canvas.height;
  el("hudFov").textContent = "f" + labFov.fov + " aspect " + fmt(aspect, 2);
  el("dataFov").innerHTML =
    row("fov", labFov.fov + " deg") +
    row("canvas", g.canvas.width + " x " + g.canvas.height) +
    row("aspect", fmt(aspect, 3));
}

function setLabFov(v) {
  labFov.fov = v;
}

on("labFov35", function () { setLabFov(35); });
on("labFov60", function () { setLabFov(60); });
on("labFov90", function () { setLabFov(90); });
on("aspectBtn", function () {
  var c = labFov.g && labFov.g.canvas;
  if (!c) return;
  labFov.wide = !labFov.wide;
  /* Resizing resets GL state, so the context is rebuilt on the new size. */
  if (labFov.wide) { c.width = 520; c.height = 320; }
  else { c.width = 360; c.height = 360; }
  labFov.g = makeGL("glFov");
  mark("aspectBtn", !labFov.wide);
});

/* ================= shared loop ================= */

var lastTime = 0;
function frame(time) {
  var dt = Math.min((time - lastTime) * 0.001 || 0, 0.05);
  lastTime = time;
  updateStage(dt);
  drawStage();
  drawLabCam();
  drawLabTgt();
  drawLabSplit();
  drawLabDepth();
  drawLabFov();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

})();
