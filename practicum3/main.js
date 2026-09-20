/*
Practicum 3 — Interactive Transformation Playground (WebGL2, classic scripts)

Name : Anak Agung Putu Arda Nareswara
NRP  : 5025241074
Class: B

One triangle shape lives in local space. Every object on screen reuses
that same shape and only differs by its model matrix, sent as u_matrix.
*/
(function () {
"use strict";

var DEG = Math.PI / 180;
var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Shared triangle in local space, origin at (0, 0). */
var TRI = new Float32Array([-0.18, -0.15, 0.18, -0.15, 0.00, 0.22]);
var CENTER_X = new Float32Array([-1, 0, 1, 0]);
var CENTER_Y = new Float32Array([0, -1, 0, 1]);
var EDGE_BOT = new Float32Array([-1, -1, 1, -1]);
var EDGE_LEFT = new Float32Array([-1, -1, -1, 1]);
var DOOR = new Float32Array([
  -0.25, -0.17, 0.25, -0.17, 0.25, 0.17,
  -0.25, -0.17, 0.25, 0.17, -0.25, 0.17
]);

var CYAN = [0.30, 0.95, 1.00, 1.0];
var ORANGE = [1.00, 0.55, 0.10, 1.0];
var MINT = [0.42, 0.89, 0.82, 1.0];
var SKY = [0.44, 0.70, 0.90, 1.0];
var WHITE = [0.85, 0.90, 0.95, 1.0];
var GRID = [0.30, 0.95, 1.00, 0.07];
var AXC = [0.30, 0.95, 1.00, 0.18];

function row(k, v) {
  return "<div class='data-line'><span>" + k + "</span><b>" + v + "</b></div>";
}

function fmt(n, d) {
  return (n < 0 ? "-" : "") + Math.abs(n).toFixed(d);
}

function getShaderSource(id) {
  var el = document.getElementById(id);
  if (!el) throw new Error("Shader block " + id + " missing.");
  return el.textContent.trim();
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

/* One context per canvas. Single VBO re-uploaded per draw. */
function makeGL(id) {
  var canvas = document.getElementById(id);
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
  var vbo = gl.createBuffer();
  var loc = gl.getAttribLocation(prog, "a_position");
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  if (id === "glMain") addCenterRulers(canvas.parentNode);
  else addRulers(canvas.parentNode, canvas.width, canvas.height);
  return {
    canvas: canvas, gl: gl, vbo: vbo,
    uM: gl.getUniformLocation(prog, "u_matrix"),
    uC: gl.getUniformLocation(prog, "u_color")
  };
}

function drawTris(g, matrix, color, verts) {
  var gl = g.gl;
  gl.bindBuffer(gl.ARRAY_BUFFER, g.vbo);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
  gl.uniformMatrix3fv(g.uM, false, matrix);
  gl.uniform4fv(g.uC, color);
  gl.drawArrays(gl.TRIANGLES, 0, verts.length / 2);
}

function drawLines(g, matrix, color, verts) {
  var gl = g.gl;
  gl.bindBuffer(gl.ARRAY_BUFFER, g.vbo);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
  gl.uniformMatrix3fv(g.uM, false, matrix);
  gl.uniform4fv(g.uC, color);
  gl.drawArrays(gl.LINES, 0, verts.length / 2);
}

function drawLoop(g, matrix, color, verts) {
  var gl = g.gl;
  gl.bindBuffer(gl.ARRAY_BUFFER, g.vbo);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
  gl.uniformMatrix3fv(g.uM, false, matrix);
  gl.uniform4fv(g.uC, color);
  gl.drawArrays(gl.LINE_LOOP, 0, verts.length / 2);
}

/* Translucent fill plus full alpha outline, same color. */
function fillOf(c) {
  return [c[0], c[1], c[2], 0.5];
}

function shape(g, matrix, color, verts) {
  drawTris(g, matrix, fillOf(color), verts);
  drawLoop(g, matrix, color, verts);
}

function drawPivot(g, matrix, color) {
  drawPointAt(g, matrix, color, 0, 0);
}

function drawPointAt(g, matrix, color, x, y) {
  var gl = g.gl;
  gl.bindBuffer(gl.ARRAY_BUFFER, g.vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([x, y]), gl.DYNAMIC_DRAW);
  gl.uniformMatrix3fv(g.uM, false, matrix);
  gl.uniform4fv(g.uC, color);
  gl.drawArrays(gl.POINTS, 0, 1);
}

/* Grid tiled every 32px, mapped to NDC. Built once per canvas. */
function buildGrid(W, H) {
  var pts = [], x, y;
  var stepX = W / Math.max(1, Math.round(W / 32));
  var stepY = H / Math.max(1, Math.round(H / 32));
  for (x = 0; x <= W + 0.001; x += stepX) {
    var nx = x / W * 2 - 1;
    pts.push(nx, -1, nx, 1);
  }
  for (y = 0; y <= H + 0.001; y += stepY) {
    var ny = 1 - y / H * 2;
    pts.push(-1, ny, 1, ny);
  }
  return new Float32Array(pts);
}

/* Stage center axes as 3px quad strips. WebGL lines cap at 1px. */
function axisQuads(W, H) {
  var hx = 3 / W, hy = 3 / H;
  return {
    h: new Float32Array([-1, -hy, 1, -hy, 1, hy, -1, -hy, 1, hy, -1, hy]),
    v: new Float32Array([-hx, -1, hx, -1, hx, 1, -hx, -1, hx, 1, -hx, 1])
  };
}

function drawAxes(g) {
  if (!g.grid) g.grid = buildGrid(g.canvas.width, g.canvas.height);
  var id = Mat3.identity();
  drawLines(g, id, GRID, g.grid);
  drawLines(g, id, AXC, CENTER_X);
  drawLines(g, id, AXC, CENTER_Y);
  drawLines(g, id, AXC, EDGE_BOT);
  drawLines(g, id, AXC, EDGE_LEFT);
}

function drawStageAxes(g) {
  if (!g.grid) g.grid = buildGrid(g.canvas.width, g.canvas.height);
  if (!g.thick) g.thick = axisQuads(g.canvas.width, g.canvas.height);
  var id = Mat3.identity();
  drawLines(g, id, GRID, g.grid);
  drawTris(g, id, AXC, g.thick.h);
  drawTris(g, id, AXC, g.thick.v);
}

/* Center axis numbers for the stage. Percent positioned so they track resize. */
function addCenterRulers(wrap) {
  var i, s;
  function label(v) { return v === 0 ? "0" : v.toFixed(1); }
  var midx = document.createElement("div");
  midx.className = "gl-midx";
  var xs = [-1, -0.5, 0, 0.5, 1];
  for (i = 0; i < xs.length; i++) {
    var raw = (xs[i] + 1) / 2 * 100;
    s = document.createElement("span");
    s.style.left = raw.toFixed(2) + "%";
    if (raw <= 0) s.style.transform = "translate(0,-50%)";
    if (raw >= 100) s.style.transform = "translate(-100%,-50%)";
    s.textContent = label(xs[i]);
    midx.appendChild(s);
  }
  var midy = document.createElement("div");
  midy.className = "gl-midy";
  var ys = [-1, -0.5, 0.5, 1];
  for (i = 0; i < ys.length; i++) {
    var rawY = (1 - (ys[i] + 1) / 2) * 100;
    s = document.createElement("span");
    s.style.top = rawY.toFixed(2) + "%";
    if (rawY <= 0) s.style.transform = "translate(-50%,0)";
    if (rawY >= 100) s.style.transform = "translate(-50%,-100%)";
    s.textContent = label(ys[i]);
    midy.appendChild(s);
  }
  wrap.appendChild(midx);
  wrap.appendChild(midy);
}

/* NDC ruler numbers as DOM overlay. */
function addRulers(wrap, W, H) {
  var i, s;
  function label(v) { return v === 0 ? "0" : v.toFixed(1); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  var left = document.createElement("div");
  left.className = "gl-ruler-left";
  var ys = [-0.5, 0, 0.5, 1];
  for (i = 0; i < ys.length; i++) {
    s = document.createElement("span");
    s.style.top = clamp((1 - (ys[i] + 1) / 2) * H / (H - 15) * 100, 5, 95).toFixed(2) + "%";
    s.textContent = label(ys[i]);
    left.appendChild(s);
  }
  var bot = document.createElement("div");
  bot.className = "gl-ruler-bottom";
  var xs = [-0.5, 0, 0.5, 1];
  for (i = 0; i < xs.length; i++) {
    var raw = (xs[i] + 1) / 2 * 100;
    s = document.createElement("span");
    s.style.left = clamp(raw, 4, 96).toFixed(2) + "%";
    if (raw > 96) s.style.transform = "translate(-100%,-50%)";
    s.textContent = label(xs[i]);
    bot.appendChild(s);
  }
  var corner = document.createElement("span");
  corner.style.left = "0%";
  corner.style.transform = "translate(0,-50%)";
  corner.textContent = "-1.0";
  bot.appendChild(corner);
  wrap.appendChild(left);
  wrap.appendChild(bot);
}

function clear(g) {
  var gl = g.gl;
  gl.viewport(0, 0, g.canvas.width, g.canvas.height);
  gl.clearColor(0.016, 0.043, 0.090, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);
}

/* Compose helpers. multiply(a, b) is a times b, so nesting order is explicit. */
function trs(t) {
  var T = Mat3.translation(t.x, t.y);
  var R = Mat3.rotation(t.rotation * DEG);
  var S = Mat3.scaling(t.scaleX, t.scaleY);
  return Mat3.multiply(T, Mat3.multiply(R, S));
}

function rtOrder(t) {
  var T = Mat3.translation(t.x, t.y);
  var R = Mat3.rotation(t.rotation * DEG);
  return Mat3.multiply(R, T);
}

function applyM(m, x, y) {
  return {
    x: m[0] * x + m[3] * y + m[6],
    y: m[1] * x + m[4] * y + m[7]
  };
}

function pixelToNdc(canvas, e) {
  var r = canvas.getBoundingClientRect();
  var x = (e.clientX - r.left) * (canvas.width / r.width);
  var y = (e.clientY - r.top) * (canvas.height / r.height);
  return { x: (x / canvas.width) * 2 - 1, y: 1 - (y / canvas.height) * 2 };
}

function clampObj(o) {
  o.x = Math.max(-0.8, Math.min(0.8, o.x));
  o.y = Math.max(-0.75, Math.min(0.75, o.y));
  o.scaleX = Math.max(0.2, Math.min(2.5, o.scaleX));
  o.scaleY = Math.max(0.2, Math.min(2.5, o.scaleY));
}

/* ================= MAIN STAGE ================= */
var stage = (function () {
  var g = makeGL("glMain");
  if (!g) return null;

  var HOME = { x: -0.35, y: 0.0, rotation: 0.0, scaleX: 1.0, scaleY: 1.0 };
  var PRESETS = [
    { x: -0.40, y: 0.20, rotation: 0, scaleX: 1.0, scaleY: 1.0 },
    { x: 0.00, y: 0.00, rotation: 45, scaleX: 1.5, scaleY: 1.5 },
    { x: 0.30, y: -0.20, rotation: 90, scaleX: 1.8, scaleY: 0.6 }
  ];

  var A = { x: HOME.x, y: HOME.y, rotation: HOME.rotation, scaleX: HOME.scaleX, scaleY: HOME.scaleY };
  var useAltOrder = false;
  var paused = false;
  var keys = {};
  var MOVE = 0.65, TURN = 100.0, GROW = 0.8;

  var hud = document.getElementById("mainHud");
  var data = document.getElementById("mainData");
  var telePos = document.getElementById("telePos");
  var teleRot = document.getElementById("teleRot");
  var teleScale = document.getElementById("teleScale");
  var teleOrder = document.getElementById("teleOrder");
  var matrixData = document.getElementById("dataMatrix");
  var orderBtn = document.getElementById("orderBtn");
  var pauseBtn = document.getElementById("pauseBtn");

  function wrapAngle() {
    A.rotation = ((A.rotation % 360) + 360) % 360;
  }

  function reset() {
    A.x = HOME.x; A.y = HOME.y;
    A.rotation = HOME.rotation;
    A.scaleX = HOME.scaleX; A.scaleY = HOME.scaleY;
    wrapAngle();
  }

  function preset(i) {
    var p = PRESETS[i];
    A.x = p.x; A.y = p.y;
    A.rotation = p.rotation;
    A.scaleX = p.scaleX; A.scaleY = p.scaleY;
  }

  function flipOrder() {
    useAltOrder = !useAltOrder;
    wrapAngle();
    orderBtn.classList.toggle("active", useAltOrder);
  }

  function togglePause() {
    paused = !paused;
    pauseBtn.classList.toggle("active", paused);
    pauseBtn.textContent = paused ? "Resume" : "Pause";
  }

  function modelA() {
    return useAltOrder
      ? Mat3.multiply(rtOrder(A), Mat3.scaling(A.scaleX, A.scaleY))
      : trs(A);
  }

  function discrete(k) {
    if (k === "r") reset();
    else if (k === "t") flipOrder();
    else if (k === " ") togglePause();
    else if (k === "1") preset(0);
    else if (k === "2") preset(1);
    else if (k === "3") preset(2);
    else if (k === "m") {
      var m = modelA();
      if (window.console && console.table) {
        console.table(Array.from(m));
        console.table({
          row0: [m[0], m[3], m[6]],
          row1: [m[1], m[4], m[7]],
          row2: [m[2], m[5], m[8]]
        });
      }
    }
  }

  window.addEventListener("keydown", function (e) {
    var k = e.key.toLowerCase();
    keys[k] = true;
    if (e.key.indexOf("Arrow") === 0 || e.key === " ") e.preventDefault();
    if (!e.repeat) discrete(k);
  });
  window.addEventListener("keyup", function (e) { keys[e.key.toLowerCase()] = false; });
  window.addEventListener("blur", function () { keys = {}; });

/* Space doubles as pause, so never leave a button focused. */
  document.addEventListener("click", function (e) {
    if (e.target && e.target.tagName === "BUTTON") e.target.blur();
  });

  document.getElementById("resetBtn").addEventListener("click", reset);
  orderBtn.addEventListener("click", flipOrder);
  pauseBtn.addEventListener("click", togglePause);
  document.getElementById("preset1").addEventListener("click", function () { preset(0); });
  document.getElementById("preset2").addEventListener("click", function () { preset(1); });
  document.getElementById("preset3").addEventListener("click", function () { preset(2); });

  g.canvas.addEventListener("click", function (e) {
    var n = pixelToNdc(g.canvas, e);
    A.x = Math.max(-0.8, Math.min(0.8, n.x));
    A.y = Math.max(-0.75, Math.min(0.75, n.y));
  });

  function update(dt) {
    if (keys["arrowleft"] || keys["a"]) A.x -= MOVE * dt;
    if (keys["arrowright"] || keys["d"]) A.x += MOVE * dt;
    if (keys["arrowup"] || keys["w"]) A.y += MOVE * dt;
    if (keys["arrowdown"] || keys["s"]) A.y -= MOVE * dt;
    if (keys["q"]) A.rotation -= TURN * dt;
    if (keys["e"]) A.rotation += TURN * dt;
    if (keys["+"] || keys["="]) { A.scaleX += GROW * dt; A.scaleY += GROW * dt; }
    if (keys["-"] || keys["_"]) { A.scaleX -= GROW * dt; A.scaleY -= GROW * dt; }
    if (keys["z"]) A.scaleX -= GROW * dt;
    if (keys["x"]) A.scaleX += GROW * dt;
    if (keys["c"]) A.scaleY -= GROW * dt;
    if (keys["v"]) A.scaleY += GROW * dt;
    clampObj(A);
  }

  function autoB(seconds) {
    var s = 1.0 + Math.sin(seconds * 2.0) * 0.25;
    return trs({ x: 0.42, y: 0.0, rotation: seconds * 70.0, scaleX: s, scaleY: s });
  }

  function text(mA) {
    var ord = useAltOrder ? "R x T" : "T x R x S";
    var pos = "(" + fmt(A.x, 2) + ", " + fmt(A.y, 2) + ")";
    if (useAltOrder) {
      var w = applyM(mA, 0, 0);
      pos += " to (" + fmt(w.x, 2) + ", " + fmt(w.y, 2) + ")";
    }
    return "A " + pos + " " +
      fmt(A.rotation, 0) + "deg (" +
      fmt(A.scaleX, 2) + ", " + fmt(A.scaleY, 2) + ") " + ord;
  }

  var last = 0, frozen = REDUCED ? 0.6 : 0;

  function frame(time) {
    var seconds = time * 0.001;
    var dt = Math.min((time - last) * 0.001 || 0, 0.05);
    last = time;
    var t = paused ? frozen : seconds;
    if (!paused) { update(dt); frozen = seconds; }

    clear(g);
    drawStageAxes(g);
    var mA = modelA();
    var mB = autoB(REDUCED ? 0.6 : t);
    shape(g, mA, CYAN, TRI);
    drawPivot(g, mA, WHITE);
    shape(g, mB, ORANGE, TRI);
    drawPivot(g, mB, WHITE);

    var label = text(mA) + (paused ? " paused" : "");
    hud.textContent = label;
    telePos.innerHTML = "(" + fmt(A.x, 2) + ", " + fmt(A.y, 2) + ")";
    if (useAltOrder) {
      var world = applyM(mA, 0, 0);
      telePos.innerHTML += "<br>(" + fmt(world.x, 2) + ", " + fmt(world.y, 2) + ")";
    }
    teleRot.textContent = fmt(A.rotation, 1) + " deg";
    teleScale.textContent = "(" + fmt(A.scaleX, 2) + ", " + fmt(A.scaleY, 2) + ")";
    teleOrder.textContent = useAltOrder ? "R x T" : "T x R x S";
    data.innerHTML =
      row("Position", "(" + fmt(A.x, 2) + ", " + fmt(A.y, 2) + ")") +
      (useAltOrder
        ? row("World", "(" + fmt(world.x, 2) + ", " + fmt(world.y, 2) + ")")
        : "") +
      row("Rotation", fmt(A.rotation, 1) + " deg") +
      row("Scale", "(" + fmt(A.scaleX, 2) + ", " + fmt(A.scaleY, 2) + ")") +
      row("Order", useAltOrder ? "R x T" : "T x R x S") +
      row("State", paused ? "paused" : "live");
    if (matrixData) {
      matrixData.innerHTML =
        row("Col 0", fmt(mA[0], 3) + "  " + fmt(mA[1], 3) + "  " + fmt(mA[2], 3)) +
        row("Col 1", fmt(mA[3], 3) + "  " + fmt(mA[4], 3) + "  " + fmt(mA[5], 3)) +
        row("Col 2", fmt(mA[6], 3) + "  " + fmt(mA[7], 3) + "  " + fmt(mA[8], 3)) +
        row("Tip", "press M for console table");
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return { getA: function () { return A; } };
})();

/* ================= LAB A — ORDER ================= */
(function () {
  var g = makeGL("glOrder");
  if (!g) return;
  var hud = document.getElementById("hudOrder");
  var data = document.getElementById("dataOrder");

  function frame(time) {
    var t = REDUCED ? 0.6 : time * 0.001;
    var p = { x: 0.45, y: 0.0, rotation: t * 35.0, scaleX: 1.3, scaleY: 0.7 };
    var left = trs({ x: -0.45, y: 0.0, rotation: t * 35.0, scaleX: 1.3, scaleY: 0.7 });
    var right = Mat3.multiply(rtOrder(p), Mat3.scaling(p.scaleX, p.scaleY));
    var pw = applyM(right, 0, 0);

    clear(g);
    drawAxes(g);
    shape(g, left, CYAN, TRI);
    drawPivot(g, left, WHITE);
    shape(g, right, ORANGE, TRI);
    drawPivot(g, right, WHITE);

    hud.textContent = "left spins " + fmt(t * 35.0, 0) + "deg, right orbits";
    data.innerHTML =
      row("Angle", fmt(t * 35.0, 0) + " deg") +
      row("Left pivot", "(-0.45, 0.00) spins") +
      row("Right pivot", "(" + fmt(pw.x, 2) + ", " + fmt(pw.y, 2) + ") travels");
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

/* ================= LAB B — DOOR ================= */
(function () {
  var g = makeGL("glDoor");
  if (!g) return;
  var hud = document.getElementById("hudDoor");
  var data = document.getElementById("dataDoor");
  var HINGE = { x: -0.25, y: 0.0 };

  function frame(time) {
    var t = REDUCED ? 0.6 : time * 0.001;
    var ang = 55 + Math.sin(t * 1.4) * 55;
    var base = Mat3.translation(-0.15, 0.0);
    var toH = Mat3.translation(HINGE.x, HINGE.y);
    var back = Mat3.translation(-HINGE.x, -HINGE.y);
    var m = Mat3.multiply(base, Mat3.multiply(toH, Mat3.multiply(Mat3.rotation(ang * DEG), back)));
    var hw = applyM(m, HINGE.x, HINGE.y);

    clear(g);
    drawAxes(g);
    shape(g, m, SKY, DOOR);
    drawLines(g, m, WHITE, new Float32Array([-0.25, -0.17, -0.25, 0.17]));
    drawPointAt(g, m, MINT, HINGE.x, HINGE.y);

    hud.textContent = "hinge (" + fmt(hw.x, 2) + ", " + fmt(hw.y, 2) + ") " + fmt(ang, 0) + "deg";
    data.innerHTML =
      row("Swing", fmt(ang, 1) + " deg") +
      row("Hinge", "(" + fmt(hw.x, 2) + ", " + fmt(hw.y, 2) + ")") +
      row("Pivot", "edge, not middle");
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

/* ================= LAB C — FAMILY + ORBIT ================= */
(function () {
  var g = makeGL("glFamily");
  if (!g) return;
  var hud = document.getElementById("hudFamily");
  var data = document.getElementById("dataFamily");

  function frame(time) {
    var t = REDUCED ? 0.6 : time * 0.001;

    var sunS = 0.55 + Math.sin(t * 2.0) * 0.08;
    var sun = trs({ x: 0, y: 0.05, rotation: 0, scaleX: sunS, scaleY: sunS });

    var parent = trs({ x: 0.45 * Math.sin(t * 0.5), y: -0.35, rotation: Math.sin(t * 0.8) * 20, scaleX: 1.0, scaleY: 1.0 });
    var childLocal = trs({ x: 0.20, y: 0.14, rotation: t * 120.0, scaleX: 0.45, scaleY: 0.45 });
    var child = Mat3.multiply(parent, childLocal);
    var cw = applyM(child, 0, 0);

    var orb = Mat3.multiply(
      Mat3.rotation(t * 50.0 * DEG),
      Mat3.multiply(
        Mat3.translation(0.0, 0.05),
        Mat3.multiply(Mat3.translation(0.62, 0.0), Mat3.rotation(t * 90.0 * DEG))
      )
    );
    var ow = applyM(orb, 0, 0);

    clear(g);
    drawAxes(g);
    shape(g, sun, ORANGE, TRI);
    shape(g, parent, CYAN, TRI);
    drawPivot(g, parent, WHITE);
    shape(g, child, MINT, TRI);
    drawPivot(g, child, WHITE);
    shape(g, orb, SKY, TRI);
    drawPivot(g, orb, WHITE);

    hud.textContent = "child (" + fmt(cw.x, 2) + ", " + fmt(cw.y, 2) + ") orbiter (" + fmt(ow.x, 2) + ", " + fmt(ow.y, 2) + ")";
    data.innerHTML =
      row("Child world", "(" + fmt(cw.x, 2) + ", " + fmt(cw.y, 2) + ")") +
      row("Orbiter", "(" + fmt(ow.x, 2) + ", " + fmt(ow.y, 2) + ")") +
      row("Sun", "breathes, never moves");
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

})();
