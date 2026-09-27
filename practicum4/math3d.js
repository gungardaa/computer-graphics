/*
Practicum 4 - 3D math helpers (WebGL2, classic scripts)

Name : Anak Agung Putu Arda Nareswara
NRP  : 5025241074
Class: B

Global Vec3 and Mat4. Column-vector convention, column-major storage,
matching uniformMatrix4fv with transpose false. Same convention on
every canvas, so lookAt and projection never flip silently.
*/

(function () {
"use strict";

var Vec3 = {
  subtract: function (a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  },

  cross: function (a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ];
  },

  normalize: function (v) {
    var len = Math.hypot(v[0], v[1], v[2]);
    if (len < 0.000001) return [0, 0, 0];
    return [v[0] / len, v[1] / len, v[2] / len];
  },

  dot: function (a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }
};

var Mat4 = {
  identity: function () {
    return new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]);
  },

  translation: function (tx, ty, tz) {
    return new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      tx, ty, tz, 1
    ]);
  },

  rotationX: function (rad) {
    var c = Math.cos(rad);
    var s = Math.sin(rad);
    return new Float32Array([
      1, 0, 0, 0,
      0, c, s, 0,
      0, -s, c, 0,
      0, 0, 0, 1
    ]);
  },

  rotationY: function (rad) {
    var c = Math.cos(rad);
    var s = Math.sin(rad);
    return new Float32Array([
      c, 0, -s, 0,
      0, 1, 0, 0,
      s, 0, c, 0,
      0, 0, 0, 1
    ]);
  },

  scaling: function (sx, sy, sz) {
    return new Float32Array([
      sx, 0, 0, 0,
      0, sy, 0, 0,
      0, 0, sz, 0,
      0, 0, 0, 1
    ]);
  },

  multiply: function (a, b) {
    var out = new Float32Array(16);
    var r, c, i, sum;
    for (r = 0; r < 4; r++) {
      for (c = 0; c < 4; c++) {
        sum = 0;
        for (i = 0; i < 4; i++) sum += b[i * 4 + c] * a[r * 4 + i];
        out[r * 4 + c] = sum;
      }
    }
    return out;
  },

  lookAt: function (position, target, up) {
    var forward = Vec3.normalize(Vec3.subtract(target, position));
    var right = Vec3.normalize(Vec3.cross(forward, up));
    var cup = Vec3.cross(right, forward);
    return new Float32Array([
      right[0], cup[0], -forward[0], 0,
      right[1], cup[1], -forward[1], 0,
      right[2], cup[2], -forward[2], 0,
      -Vec3.dot(right, position),
      -Vec3.dot(cup, position),
      Vec3.dot(forward, position),
      1
    ]);
  },

  perspective: function (fovRad, aspect, near, far) {
    var f = 1.0 / Math.tan(fovRad / 2);
    var ri = 1.0 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (near + far) * ri, -1,
      0, 0, 2 * near * far * ri, 0
    ]);
  },

  orthographic: function (left, right, bottom, top, near, far) {
    return new Float32Array([
      2 / (right - left), 0, 0, 0,
      0, 2 / (top - bottom), 0, 0,
      0, 0, -2 / (far - near), 0,
      -(right + left) / (right - left),
      -(top + bottom) / (top - bottom),
      -(far + near) / (far - near),
      1
    ]);
  }
};

window.Vec3 = Vec3;
window.Mat4 = Mat4;

})();
