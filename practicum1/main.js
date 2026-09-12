/*
Practical Work in Computer Graphics - Lesson 1
Graphics Playground

Name : Anak Agung Putu Arda Nareswara
NRP  : 5025241074
Class: B

Challenge:
- Main: Drawing Playground (rect, line, circle, triangle)
- Motion: Moving objects (mouse follow + keyboard translation)
- A: Bouncing Object
- B: Follow Mouse
- C: Click to Change Color
- D: Keyboard Movement
- E: Mouse Coordinate
- Extra: Click to Create Circle, Trail Mode, Multiple Moving Objects
*/

var PALETTE = ["#4DF3FF", "#6BE4D2", "#76A8FF", "#70B2E6", "#D9E6F2"];
var GRID_LINE = "rgba(77, 243, 255, 0.07)";
var AXIS_LINE = "rgba(77, 243, 255, 0.18)";

function ctx2d(id) {
  var c = document.getElementById(id);
  return c ? c.getContext("2d") : null;
}

// Canvas-space coordinates from a pointer event (CSS scale-safe).
function point(canvas, e, W, H) {
  var r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
}

// Background coordinate grid + axis lines, plus a pixel ruler
// along the left (y) and bottom (x) edges with values every 64px.
function grid(ctx, W, H) {
  var x, y, rw = 15, rh = 15, step = 64;

  // Faint caption strips are drawn first so the grid and
  // axis lines stay visible on top of them.
  ctx.fillStyle = "rgba(4, 11, 24, 0.72)";
  ctx.fillRect(0, 0, rw, H);
  ctx.fillRect(0, H - rh, W, rh);

  ctx.fillStyle = "rgba(169, 191, 211, 0.8)";
  ctx.font = "9px 'DM Sans', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (x = 0; x <= W; x += step) {
    // Keep the label inside the canvas: pull "0" out of the corner
    // and any final value in from the right edge.
    ctx.fillText(x, Math.max(rw, Math.min(x, W - 14)), H - rh / 2 - 1);
  }
  for (y = 0; y <= H; y += step) {
    ctx.fillText(y, rw / 2 - 1, Math.max(rh, Math.min(y, H - 10)));
  }

  ctx.strokeStyle = GRID_LINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (x = 0; x <= W; x += 32) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
  for (y = 0; y <= H; y += 32) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
  ctx.stroke();
  ctx.strokeStyle = AXIS_LINE;
  ctx.beginPath();
  ctx.moveTo(0.5, H - 0.5); ctx.lineTo(W, H - 0.5);
  ctx.moveTo(0.5, H - 0.5); ctx.lineTo(0.5, 0.5);
  ctx.stroke();
}

// Small corner HUD box of live data.
function hud(ctx, rows) {
  var x = 8, y = 8, lh = 15, w = 0, i;
  ctx.font = "11px monospace";
  for (i = 0; i < rows.length; i++) {
    var tw = ctx.measureText(rows[i]).width;
    if (tw > w) w = tw;
  }
  w = Math.ceil(w) + 16;
  var h = rows.length * lh + 10;
  ctx.fillStyle = "rgba(4, 11, 24, 0.85)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(77, 243, 255, 0.3)";
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = "#A9BFD3";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  for (i = 0; i < rows.length; i++) ctx.fillText(rows[i], x + 8, y + 5 + i * lh);
}

// One row for the side-panel live data.
function row(k, v) {
  return "<div class='data-line'><span>" + k + "</span><b>" + v + "</b></div>";
}

// ============================================================
// MAIN TASK — drawing playground (drag to draw any primitive)
// ============================================================
(function () {
  var ctx = ctx2d("drawCanvas");
  if (!ctx) return;
  var canvas = ctx.canvas, W = 800, H = 500;

  var tool = "rect", color = PALETTE[0], stroke = 2, frame = 0;
  var shapes = [], pending = null, mouse = { x: -1, y: -1 };

  // Seed the canvas so it is never empty when the page opens.
  shapes = [
    { type: "rect", x: 120, y: 90, w: 64, h: 64, color: "#70B2E6", stroke: 2 },
    { type: "line", x1: 320, y1: 80, x2: 430, y2: 250, color: "#76A8FF", stroke: 3 },
    { type: "circle", x: 620, y: 130, r: 30, color: "#D9E6F2", stroke: 2 },
    { type: "triangle", ax: 170, ay: 350, bx: 170, by: 440, cx: 300, cy: 440, color: "#6BE4D2", stroke: 2 }
  ];

  // Turn a drag (start -> end) into one concrete shape.
  function make(a, b) {
    if (tool === "rect") return { type: "rect", x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y), color: color, stroke: stroke };
    if (tool === "line") return { type: "line", x1: a.x, y1: a.y, x2: b.x, y2: b.y, color: color, stroke: stroke };
    if (tool === "circle") return { type: "circle", x: a.x, y: a.y, r: Math.hypot(b.x - a.x, b.y - a.y), color: color, stroke: stroke };
    return { type: "triangle", ax: a.x, ay: a.y, bx: a.x, by: b.y, cx: b.x, cy: b.y, color: color, stroke: stroke };
  }

  // Draw one shape (or a dashed ghost while dragging).
  function paint(s, ghost) {
    ctx.save();
    if (!ghost) { ctx.fillStyle = s.color; ctx.globalAlpha = 0.45; }
    ctx.strokeStyle = ghost ? "#4DF3FF" : s.color;
    ctx.lineWidth = ghost ? 1 : s.stroke;
    ctx.setLineDash(ghost ? [5, 5] : []);
    ctx.beginPath();
    if (s.type === "rect") ctx.rect(s.x, s.y, s.w, s.h);
    else if (s.type === "circle") ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    else if (s.type === "line") { ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); }
    else { ctx.moveTo(s.ax, s.ay); ctx.lineTo(s.bx, s.by); ctx.lineTo(s.cx, s.cy); ctx.closePath(); }
    if (s.type !== "line" && !ghost) ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  canvas.addEventListener("pointerdown", function (e) {
    pending = { a: point(canvas, e, W, H) };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
  });
  canvas.addEventListener("pointermove", function (e) {
    mouse = point(canvas, e, W, H);
    if (pending) pending.b = mouse;
  });
  canvas.addEventListener("pointerup", function (e) {
    if (!pending) return;
    pending.b = point(canvas, e, W, H);
    var dx = pending.b.x - pending.a.x, dy = pending.b.y - pending.a.y;
    // A drag shorter than a few pixels is probably a misclick — skip it.
    if (Math.hypot(dx, dy) > 4) shapes.push(make(pending.a, pending.b));
    pending = null;
  });
  canvas.addEventListener("pointercancel", function () { pending = null; });

  var dataEl = document.getElementById("drawData");

  function draw() {
    ctx.clearRect(0, 0, W, H);
    grid(ctx, W, H);
    for (var i = 0; i < shapes.length; i++) paint(shapes[i]);
    if (pending) paint(make(pending.a, pending.b || pending.a), true);

    hud(ctx, [
      "frame " + frame,
      "tool " + tool,
      "color " + color,
      "stroke " + stroke,
      "shapes " + shapes.length
    ]);
    frame++;

    if (dataEl) dataEl.innerHTML =
      row("tool", tool) +
      row("color", color) +
      row("stroke", stroke) +
      row("shapes", shapes.length) +
      row("mouse", mouse.x < 0 ? "--" : Math.round(mouse.x) + ", " + Math.round(mouse.y));

    requestAnimationFrame(draw);
  }

  // Toolbar wiring.
  document.querySelectorAll(".tool-btn[data-tool]").forEach(function (b) {
    b.addEventListener("click", function () {
      tool = b.getAttribute("data-tool");
      document.querySelectorAll(".tool-btn[data-tool]").forEach(function (x) { x.classList.toggle("active", x === b); });
    });
  });
  document.querySelectorAll(".swatch").forEach(function (s) {
    s.addEventListener("click", function () {
      color = s.getAttribute("data-color");
      document.querySelectorAll(".swatch").forEach(function (x) { x.classList.toggle("active", x === s); });
    });
  });
  var strokeEl = document.getElementById("stroke"), strokeVal = document.getElementById("strokeVal");
  strokeEl.addEventListener("input", function () { stroke = +strokeEl.value; strokeVal.textContent = stroke; });
  document.getElementById("undo").addEventListener("click", function () { shapes.pop(); });
  document.getElementById("clear").addEventListener("click", function () { shapes.length = 0; });

  draw();
})();

// ============================================================
// MOTION — mouse-follow square + keyboard circle + click color
// ============================================================
(function () {
  var ctx = ctx2d("motionCanvas");
  if (!ctx) return;
  var canvas = ctx.canvas, W = 800, H = 500, frame = 0;

  var square = { x: 200, y: 150, s: 40 }, ci = 0;
  var circle = { x: 560, y: 280, r: 20 }, keys = {};

  window.addEventListener("keydown", function (e) {
    keys[e.key.toLowerCase()] = true;
    if (e.key.indexOf("Arrow") === 0) e.preventDefault();
  });
  window.addEventListener("keyup", function (e) { keys[e.key.toLowerCase()] = false; });
  window.addEventListener("blur", function () { keys = {}; });

  canvas.addEventListener("pointermove", function (e) {
    var p = point(canvas, e, W, H);
    square.x = Math.max(0, Math.min(W - square.s, p.x - square.s / 2));
    square.y = Math.max(0, Math.min(H - square.s, p.y - square.s / 2));
  });
  canvas.addEventListener("click", function (e) {
    var p = point(canvas, e, W, H);
    if (p.x >= square.x && p.x <= square.x + square.s && p.y >= square.y && p.y <= square.y + square.s) {
      ci = (ci + 1) % PALETTE.length;
    }
  });

  function held() {
    var k = [];
    if (keys.w || keys.arrowup) k.push("up");
    if (keys.s || keys.arrowdown) k.push("down");
    if (keys.a || keys.arrowleft) k.push("left");
    if (keys.d || keys.arrowright) k.push("right");
    return k.length ? k.join("+") : "none";
  }

  var dataEl = document.getElementById("motionData");

  function draw() {
    var speed = 3;
    if (keys.w || keys.arrowup) circle.y -= speed;
    if (keys.s || keys.arrowdown) circle.y += speed;
    if (keys.a || keys.arrowleft) circle.x -= speed;
    if (keys.d || keys.arrowright) circle.x += speed;
    circle.x = Math.max(circle.r, Math.min(W - circle.r, circle.x));
    circle.y = Math.max(circle.r, Math.min(H - circle.r, circle.y));

    ctx.clearRect(0, 0, W, H);
    grid(ctx, W, H);

    ctx.fillStyle = PALETTE[ci];
    ctx.globalAlpha = 0.55;
    ctx.fillRect(square.x, square.y, square.s, square.s);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = PALETTE[ci];
    ctx.lineWidth = 2;
    ctx.strokeRect(square.x + 1, square.y + 1, square.s - 2, square.s - 2);

    ctx.fillStyle = "#081526";
    ctx.font = "bold 11px 'DM Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("click", square.x + square.s / 2, square.y + square.s / 2);

    ctx.fillStyle = "#D9E6F2";
    ctx.beginPath();
    ctx.arc(circle.x, circle.y, circle.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#D9E6F2";
    ctx.lineWidth = 2;
    ctx.stroke();

    hud(ctx, ["frame " + frame, "keys " + held()]);
    frame++;

    if (dataEl) dataEl.innerHTML =
      row("square", Math.round(square.x) + ", " + Math.round(square.y)) +
      row("square color", PALETTE[ci]) +
      row("circle", Math.round(circle.x) + ", " + Math.round(circle.y)) +
      row("keys held", held());

    requestAnimationFrame(draw);
  }

  draw();
})();

// ============================================================
// CHALLENGE A — bouncing dot
// ============================================================
(function () {
  var ctx = ctx2d("bounceCanvas");
  if (!ctx) return;
  var canvas = ctx.canvas, W = 500, H = 300, frame = 0;
  var x = 250, y = 150, r = 16, vx = 3, vy = 2.2;

  canvas.addEventListener("click", function (e) {
    var p = point(canvas, e, W, H);
    x = p.x; y = p.y;
  });

  var dataEl = document.getElementById("bounceData");

  function draw() {
    x += vx; y += vy;                              // position += velocity
    if (x - r < 0 || x + r > W) vx = -vx;         // boundary check flips
    if (y - r < 0 || y + r > H) vy = -vy;

    ctx.clearRect(0, 0, W, H);
    grid(ctx, W, H);
    ctx.fillStyle = "#4DF3FF";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#4DF3FF";
    ctx.lineWidth = 2;
    ctx.stroke();

    hud(ctx, ["frame " + frame, "pos " + Math.round(x) + ", " + Math.round(y), "vel " + vx.toFixed(1) + ", " + vy.toFixed(1)]);
    frame++;

    if (dataEl) dataEl.innerHTML =
      row("position", Math.round(x) + ", " + Math.round(y)) +
      row("velocity", vx.toFixed(1) + ", " + vy.toFixed(1)) +
      row("state", "flips at edges");

    requestAnimationFrame(draw);
  }

  draw();
})();

// ============================================================
// CHALLENGE B — follow the mouse
// ============================================================
(function () {
  var ctx = ctx2d("followCanvas");
  if (!ctx) return;
  var canvas = ctx.canvas, W = 500, H = 300, frame = 0;
  var cx = 250, cy = 150, r = 18;

  canvas.addEventListener("pointermove", function (e) {
    var p = point(canvas, e, W, H);
    cx = Math.max(r, Math.min(W - r, p.x));       // circle copies the mouse
    cy = Math.max(r, Math.min(H - r, p.y));
  });

  var dataEl = document.getElementById("followData");

  function draw() {
    ctx.clearRect(0, 0, W, H);
    grid(ctx, W, H);

    ctx.strokeStyle = "rgba(108, 228, 210, 0.35)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, cy); ctx.lineTo(cx, H);
    ctx.moveTo(cx, cy); ctx.lineTo(0, cy);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#6BE4D2";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#6BE4D2";
    ctx.lineWidth = 2;
    ctx.stroke();

    hud(ctx, ["frame " + frame, "mouse " + Math.round(cx) + ", " + Math.round(cy)]);
    frame++;

    if (dataEl) dataEl.innerHTML =
      row("mouse", Math.round(cx) + ", " + Math.round(cy)) +
      row("circle", Math.round(cx) + ", " + Math.round(cy));

    requestAnimationFrame(draw);
  }

  draw();
})();

// ============================================================
// CHALLENGE C — click to change color
// ============================================================
(function () {
  var ctx = ctx2d("colorCanvas");
  if (!ctx) return;
  var canvas = ctx.canvas, W = 500, H = 300, frame = 0;
  var x = 210, y = 110, s = 80, i = 0;

  canvas.addEventListener("click", function () { i = (i + 1) % PALETTE.length; });

  var dataEl = document.getElementById("colorData");

  function draw() {
    ctx.clearRect(0, 0, W, H);
    grid(ctx, W, H);

    ctx.fillStyle = PALETTE[i];
    ctx.globalAlpha = 0.55;
    ctx.fillRect(x, y, s, s);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = PALETTE[i];
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);

    ctx.fillStyle = "#081526";
    ctx.font = "bold 12px 'DM Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(PALETTE[i], x + s / 2, y + s / 2);

    hud(ctx, ["frame " + frame, "color " + PALETTE[i]]);
    frame++;

    if (dataEl) dataEl.innerHTML =
      row("color", PALETTE[i]) +
      row("clicks", i) +
      row("list", PALETTE.join(" · "));

    requestAnimationFrame(draw);
  }

  draw();
})();

// ============================================================
// CHALLENGE D — keyboard movement (state-based input)
// ============================================================
(function () {
  var ctx = ctx2d("keyCanvas");
  if (!ctx) return;
  var canvas = ctx.canvas, W = 500, H = 300, frame = 0;
  var x = 230, y = 130, s = 40, keys = {};

  window.addEventListener("keydown", function (e) {
    keys[e.key.toLowerCase()] = true;
    if (e.key.indexOf("Arrow") === 0) e.preventDefault();
  });
  window.addEventListener("keyup", function (e) { keys[e.key.toLowerCase()] = false; });
  window.addEventListener("blur", function () { keys = {}; });

  function held() {
    var k = [];
    if (keys.w || keys.arrowup) k.push("up");
    if (keys.s || keys.arrowdown) k.push("down");
    if (keys.a || keys.arrowleft) k.push("left");
    if (keys.d || keys.arrowright) k.push("right");
    return k.length ? k.join("+") : "none";
  }

  var dataEl = document.getElementById("keyData");

  function draw() {
    var speed = 4;
    if (keys.w || keys.arrowup) y -= speed;       // read held keys each frame
    if (keys.s || keys.arrowdown) y += speed;
    if (keys.a || keys.arrowleft) x -= speed;
    if (keys.d || keys.arrowright) x += speed;
    x = Math.max(0, Math.min(W - s, x));
    y = Math.max(0, Math.min(H - s, y));

    ctx.clearRect(0, 0, W, H);
    grid(ctx, W, H);
    ctx.fillStyle = "#76A8FF";
    ctx.globalAlpha = 0.55;
    ctx.fillRect(x, y, s, s);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#76A8FF";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);

    hud(ctx, ["frame " + frame, "keys " + held()]);
    frame++;

    if (dataEl) dataEl.innerHTML =
      row("square", Math.round(x) + ", " + Math.round(y)) +
      row("keys held", held()) +
      row("mode", "state-based");

    requestAnimationFrame(draw);
  }

  draw();
})();

// ============================================================
// CHALLENGE E — real-time mouse coordinate
// ============================================================
(function () {
  var ctx = ctx2d("coordCanvas");
  if (!ctx) return;
  var canvas = ctx.canvas, W = 500, H = 300, frame = 0;
  var mx = 250, my = 150;

  canvas.addEventListener("pointermove", function (e) {
    var p = point(canvas, e, W, H);
    mx = p.x; my = p.y;
  });

  var dataEl = document.getElementById("coordData");

  function draw() {
    ctx.clearRect(0, 0, W, H);
    grid(ctx, W, H);

    ctx.strokeStyle = "rgba(112, 178, 230, 0.35)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(mx, 0); ctx.lineTo(mx, H);
    ctx.moveTo(0, my); ctx.lineTo(W, my);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#70B2E6";
    ctx.beginPath();
    ctx.arc(mx, my, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#D9E6F2";
    ctx.font = "bold 24px 'Space Grotesk', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("(" + Math.round(mx) + ", " + Math.round(my) + ")", W / 2, 40);

    hud(ctx, ["frame " + frame, "x " + Math.round(mx), "y " + Math.round(my)]);
    frame++;

    if (dataEl) dataEl.innerHTML =
      row("x", Math.round(mx)) +
      row("y", Math.round(my)) +
      row("origin", "0, 0");

    requestAnimationFrame(draw);
  }

  draw();
})();

// ============================================================
// EXTRA — click to create circles
// ============================================================
(function () {
  var ctx = ctx2d("createCanvas");
  if (!ctx) return;
  var canvas = ctx.canvas, W = 460, H = 260, frame = 0;
  var circles = [];

  canvas.addEventListener("click", function (e) {
    var p = point(canvas, e, W, H);
    circles.push({ x: p.x, y: p.y, r: 20, color: PALETTE[circles.length % PALETTE.length] });
  });

  var dataEl = document.getElementById("createData");

  function draw() {
    ctx.clearRect(0, 0, W, H);
    grid(ctx, W, H);

    for (var i = 0; i < circles.length; i++) {
      var c = circles[i];
      ctx.fillStyle = c.color;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = c.color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    hud(ctx, ["frame " + frame, "circles " + circles.length]);
    frame++;

    if (dataEl) dataEl.innerHTML =
      row("circles", circles.length) +
      row("each one", "its own x, y, radius, color");

    requestAnimationFrame(draw);
  }

  draw();
})();

// ============================================================
// EXTRA — trail mode (skip clearing to leave a mark)
// ============================================================
(function () {
  var ctx = ctx2d("trailCanvas");
  if (!ctx) return;
  var canvas = ctx.canvas, W = 460, H = 260, frame = 0;
  var x = 60, y = H / 2, r = 10, vx = 2.5, vy = 1.4, trail = false;
  var trailPoints = [], maxTrail = 60;

  window.addEventListener("keydown", function (e) {
    if (e.code === "Space") { e.preventDefault(); trail = !trail; if (!trail) trailPoints.length = 0; }
  });

  var dataEl = document.getElementById("trailData");

  function banner() {
    ctx.fillStyle = "rgba(4, 11, 24, 0.9)";
    ctx.fillRect(0, H - 22, W, 22);
    ctx.fillStyle = "#A9BFD3";
    ctx.font = "12px 'DM Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("spacebar: trail " + (trail ? "on" : "off"), W / 2, H - 11);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    grid(ctx, W, H);

    x += vx; y += vy;
    if (x - r < 0 || x + r > W) vx = -vx;
    if (y - r < 0 || y + r > H) vy = -vy;

    if (trail) {
      trailPoints.push({ x: x, y: y });
      if (trailPoints.length > maxTrail) trailPoints.shift();
    }

    // Draw transparent trail dots (older = more transparent)
    for (var i = 0; i < trailPoints.length; i++) {
      var t = trailPoints[i];
      var alpha = (i + 1) / trailPoints.length * 0.5;
      ctx.fillStyle = "rgba(107, 228, 210, " + alpha + ")";
      ctx.beginPath();
      ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Current ball (fully opaque)
    ctx.fillStyle = "#6BE4D2";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#6BE4D2";
    ctx.lineWidth = 2;
    ctx.stroke();

    banner();
    hud(ctx, ["frame " + frame, "pos " + Math.round(x) + ", " + Math.round(y)]);
    frame++;

    if (dataEl) dataEl.innerHTML =
      row("trail", trail ? "on" : "off") +
      row("position", Math.round(x) + ", " + Math.round(y)) +
      row("trick", "transparent fading trail");

    requestAnimationFrame(draw);
  }

  draw();
})();

// ============================================================
// EXTRA — multiple moving objects (own data each)
// ============================================================
(function () {
  var ctx = ctx2d("multiCanvas");
  if (!ctx) return;
  var W = 460, H = 260, frame = 0;

  var objects = [
    { x: 50, y: 60, vx: 2, vy: 0, r: 12, color: "#4DF3FF" },
    { x: 120, y: 150, vx: 0, vy: 1.5, r: 16, color: "#6BE4D2" },
    { x: 250, y: 40, vx: 1.8, vy: 1, r: 10, color: "#76A8FF" },
    { x: 380, y: 180, vx: -1.5, vy: 2, r: 14, color: "#70B2E6" }
  ];

  var dataEl = document.getElementById("multiData");

  function draw() {
    ctx.clearRect(0, 0, W, H);
    grid(ctx, W, H);

    for (var i = 0; i < objects.length; i++) {
      var o = objects[i];
      o.x += o.vx; o.y += o.vy;
      if (o.x - o.r < 0 || o.x + o.r > W) o.vx = -o.vx;
      if (o.y - o.r < 0 || o.y + o.r > H) o.vy = -o.vy;

      ctx.fillStyle = o.color;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = o.color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    hud(ctx, ["frame " + frame, "objects " + objects.length]);
    frame++;

    if (dataEl) {
      var lines = "";
      for (var j = 0; j < objects.length; j++) {
        lines += row("obj " + (j + 1), objects[j].color + " · " + objects[j].vx.toFixed(1) + ", " + objects[j].vy.toFixed(1));
      }
      dataEl.innerHTML = lines;
    }

    requestAnimationFrame(draw);
  }

  draw();
})();