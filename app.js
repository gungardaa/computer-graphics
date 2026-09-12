/*
Practical Work in Computer Graphics - Lesson 1
Graphics Playground

Name : Anak Agung Putu Arda Nareswara
NRP  : 5025241074
Class: B

Home page hero: an interactive dot grid.
Each dot is displaced by the mouse position, so the
grid behaves like a coordinate system that responds
to input.
*/

(function () {
  var canvas = document.getElementById("heroCanvas");
  if (!canvas) return;

  var ctx = canvas.getContext("2d");

  // Track the pointer so dots can react to it.
  var pointer = { x: 0, y: 0, active: false };

  function sizeCanvas() {
    // Match the canvas to the hero's display size, keeping
    // the drawing sharp on high-DPI screens.
    var rect = canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    canvas._w = rect.width;
    canvas._h = rect.height;
  }

  // Pointer events on the whole window, since the hero
  // takes the full viewport. Coordinates are kept relative
  // to the hero canvas so the grid lines up with the cursor.
  window.addEventListener("pointermove", function (e) {
    var rect = canvas.getBoundingClientRect();
    var px = e.clientX - rect.left;
    var py = e.clientY - rect.top;
    pointer.x = px;
    pointer.y = py;
    pointer.active = px >= 0 && px <= rect.width && py >= 0 && py <= rect.height;
  });
  window.addEventListener("pointerleave", function () {
    pointer.active = false;
  });
  window.addEventListener("resize", sizeCanvas);

  function draw() {
    var w = canvas._w || 0;
    var h = canvas._h || 0;
    ctx.clearRect(0, 0, w, h);

    // Spacing between dots in the grid.
    var gap = 26;
    var influence = 150; // how far the mouse reaches
    var maxOffset = 14;  // how far a dot can be pushed

    ctx.fillStyle = "#4DF3FF";
    ctx.globalAlpha = 0.5;

    for (var x = gap / 2; x < w; x += gap) {
      for (var y = gap / 2; y < h; y += gap) {
        var baseX = x;
        var baseY = y;

        if (pointer.active) {
          var dx = pointer.x - baseX;
          var dy = pointer.y - baseY;
          var dist = Math.hypot(dx, dy);

          if (dist < influence) {
            // Push the dot away from the pointer, strongest
            // when it is closest.
            var force = (1 - dist / influence) * maxOffset;
            var norm = dist || 1;
            baseX += (dx / norm) * force;
            baseY += (dy / norm) * force;
          }
        }

        ctx.beginPath();
        ctx.arc(baseX, baseY, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;

    // Keep drawing so the grid stays updated. The only motion
    // here comes from the user's own pointer input.
    requestAnimationFrame(draw);
  }

  sizeCanvas();
  draw();
})();
