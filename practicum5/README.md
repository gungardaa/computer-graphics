# Practicum 5 - Textured and Lit Cube Playground

**Author:** Anak Agung Putu Arda Nareswara <br>
**NRP:** 5025241074 <br>
**Class:** B

This is my fifth assignment for Computer Graphics. Practicum 4 answered where
an object is. This one answers how its surface looks. A cube carries position
plus normal plus UV per vertex. The vertex shader transforms position and
normal and passes UV through. The fragment shader samples a texture and adds
ambient plus diffuse plus specular light. The page covers normals, flat and
smooth shading, the normal matrix, three part lighting, texture sampling,
filtering, wrapping, and interactive light control. It includes all ten
mandatory experiments and five challenges, each challenge on its own
live canvas.

Open `index.html` directly in any modern browser for the checker texture. The
photo texture needs a local server, see how to run below.

## The one idea that explains the whole page

Position tells where a surface is. Normal tells which way it faces. UV tells
which texel it reads. Light plus texture then decide the final color:

```
local vertex plus normal plus UV
  model plus normal matrix
    world position plus world normal
      view plus projection
        clip plus divide
          fragment
            texture sample times ambient plus diffuse plus specular
              pixels
```

The cube data never changes. Only the light, the camera, and the sampling
settings change. The frame loop rebuilds the model matrix from the spin
angles, the normal matrix from the model, and uploads every uniform before
each draw. That single rule drives the stage and all five labs.

## How the code is organised

- `math3d.js` is the Practicum 4 helper plus `normalMatrixFromMat4`, which
  returns the inverse transpose of the linear block. Column vector
  convention, column major storage, matching `uniformMatrix4fv` with
  transpose false.
- `main.js` holds one shared state object for the stage plus one frozen
  copy per lab where only the challenge values stay live. One shared
  `requestAnimationFrame` loop drives all six canvases, so every cube
  spins in sync.
- `makeLit()` builds one WebGL2 context per canvas with one lighting
  program, one flat color program for the ground grid, and static buffers
  for position and flat normals and smooth normals and UV, plus a
  procedural checker texture. Geometry uploads once and is never
  rewritten.
- A dim 9 by 9 ground grid with two brighter axes sits under every cube
  as background chrome, the Practicum 4 idea moved under lit surfaces. It
  draws first with a lighting free program so the lines keep their own
  color, and it is never counted as an object.
- Shaders live in `index.html` inside `x-shader` script tags, the same
  pattern as Practicums 2 through 4, so GLSL reads as GLSL.
- The photo loads once from `assets/texture.webp` and uploads into every
  live context on arrival. Until then each canvas falls back to the
  checker.

The vertex shader moves all three streams into place:

```glsl
v_worldPosition = worldPosition.xyz;
v_normal = u_normalMatrix * a_normal;
v_texCoord = a_texCoord * u_uvScale;
gl_Position = u_projection * u_view * worldPosition;
```

The fragment shader normalizes the interpolated normal, samples the texture
for the base color, and adds the three light terms:

```glsl
vec3 N = normalize(v_normal);
vec3 L = normalize(u_lightPosition - v_worldPosition);
vec3 V = normalize(u_cameraPosition - v_worldPosition);
float diff = max(dot(N, L), 0.0);
vec3 R = reflect(-L, N);
float spec = pow(max(dot(R, V), 0.0), u_shininess);
```

## The main stage

The stage canvas is 800 by 500. One cube spins at 20 degrees per second on X
and 35 on Y from a home pose of 20 and 30 degrees. The camera starts at
(0, 1.4, 4) looking at the origin. Projection is perspective with FOV 60,
near 0.1, and far 100. Depth test is always on.

Keyboard input follows two patterns. Continuous motion is state based. Arrow
keys slide the light on X and Y, W and S dolly it on Z, I and J and K and L
move the camera, U and O dolly the camera, A and Z change ambient, brackets
change UV scale between 0.25 and 5, and minus and plus change shininess
between 2 and 128. A held key map is read every frame with delta time
clamped at 0.05 seconds. Discrete actions are event based. F flips shading,
T flips filtering, G flips wrapping, V flips texture, M flips mipmap, N
flips scale, B flips the normal matrix path, Y flips orbit, 1 and 2 and 3
flip light parts, 0 flips lighting, X flips normalize, R resets, and Space
pauses.

Nine drag sliders mirror the same nine values both ways: ambient,
shininess, UV scale, light X and Y and Z, and camera X and Y and Z.
Dragging a slider writes the shared state, and every frame the state
writes back to the sliders, so keys and drags never disagree. Four
dropdowns cover shading, filtering, wrapping, and mipmap with the same
two way sync. Two morphing buttons name their live stage values,
Texture On or Off for photo or checker, and Orbit On or Off. The slider
and dropdown pattern follows Practicum 2.

## Shading types

Flat shading reads the face normal buffer, so each face keeps one direction
and lighting edges stay sharp. Smooth shading reads the center to corner
buffer, so normals blend across each face and the cube glows like a rounded
form. Geometry is identical in both modes. Only the normal buffer changes.

## Texture used

Two sources share one sampler. The checker is drawn in code on a 64 pixel
canvas with 8 cells in near white and sky blue, so the page works with no
download. The photo is the local file `assets/texture.webp`, loaded through
an image element from the same folder. V swaps the stage source at any time.

## Filtering available

NEAREST snaps to the closest texel and looks sharp but blocky. LINEAR
blends neighbors and looks smooth. The mipmap overlay adds
LINEAR_MIPMAP_LINEAR and NEAREST_MIPMAP_NEAREST, which blend pyramid levels
by distance and calm shimmer on far surfaces. T flips the base filter. M
steps the mipmap overlay. Min filter carries the mode while mag filter stays
plain.

## Wrapping available

REPEAT tiles the pattern. CLAMP_TO_EDGE stretches the border texel.
MIRRORED_REPEAT mirrors every other tile. G cycles the three modes. UV
scale pushes coordinates past the zero to one box so the difference shows.
At scale 3 each face holds three tiles per side.

## Defaults

Default ambient strength is 0.18. Default shininess is 32. Default shading
is flat. Default filter is linear with no mipmap overlay. Default wrap is
repeat at UV scale 1. Default light is white at (2, 2, 2).

## Challenges

Five challenges are implemented, each on its own live canvas with a
frozen scene where only the challenge values stay live. Lab controls never
touch the stage. Keys never touch the labs.

- A. Image texture. One button names the live lab source and flips it.
  The lab locks to the photo once loaded and falls back to the checker
  before that. V flips only the stage source.
- B. Scale and normal matrix. One Scale button names the live lab mode and
  flips it, and one Matrix button does the same for its path. Both drive
  only the lab cube, and N and B keys drive only the stage. Stretch is
  1.8 by 0.6 by 1.0.
- C. Light orbit. One Orbit button names the live lab state and flips it,
  running a circular path of radius 3 on the lab light only, with its own
  angle. Y drives only the stage orbit.
- D. Lighting components toggle. The three buttons cut ambient, diffuse,
  and specular on the lab cube only, each showing its own active state.
  Keys 1 and 2 and 3 drive only the stage.
- E. Mipmap filtering. A dropdown steps the lab min filter only. T and M
  drive only the stage. The lab parks its camera far back at z 6.2 so the
  modes show clearly.

## Mandatory experiments

The ten trials live inside the stage and the labs, the same layout as
earlier practicums, with no separate section.

- E1. Normalization. X drops `normalize` from the stage fragment path.
  Edges shade unevenly without it. Restore after the trial.
- E2. Flat versus smooth. F swaps the normal buffer only. Faces turn from
  crisp plates into a blended glow.
- E3. Ambient strength. Drag the Amb slider through 0 and 0.15 and 0.4.
  Shadow sides lift without gaining direction.
- E4. Diffuse dot product. Arrows fly the stage light until a face burns
  near one and fades near zero of the dot product.
- E5. Specular. Drag the Shine slider through 8 and 32 and 128. The
  highlight shrinks from a soft pool into a sharp spark.
- E6. View direction. Park the stage light and drag Cam X or hold IJKL.
  The shine walks even though the lamp never moves.
- E7. NEAREST versus LINEAR. T flips the filter at high UV scale on stage
  and the Lab E dropdown flips its own filter at distance. Blocks melt into
  ramps.
- E8. Wrapping. UV scale 3 plus G shows repeat, clamp, and mirror at the
  tile borders on the stage.
- E9. Normal matrix. N stretches the stage cube and the lab B buttons
  stretch their own. B compares correct inverse transpose against the
  naive block on each. Naive faces skew.
- E10. Texture without lighting. 0 shows raw texels on the stage.
  Lighting back on adds depth and direction.

## Understanding questions

### What does the normal do in lighting?

It hands the shader the surface direction so light can strike each face at
its own angle. Without it every face would shade the same.

### What is the difference between a face normal and a vertex normal?

A face normal gives one direction to the whole face, which keeps edges
hard. A vertex normal gives each corner its own direction, which blends
light across the face.

### What is the difference between flat shading and smooth shading?

Flat shading reads face normals, so the cube keeps crisp plates. Smooth
shading interpolates vertex normals, so the same cube glows like a rounded
form. The geometry never changes, only the normal buffer does.

### Why must normals be normalized?

Interpolation and transforms change vector length along the way. Dot
products only read angles correctly from unit vectors, so the shader
restores length one before use.

### Why must normals follow the transform?

The cube rotates and scales every frame. A normal baked at load would keep
pointing at the old pose within seconds while the surface moves on.

### Why is the plain model matrix not always enough for normals?

The model matrix can stretch axes unevenly. That tilt drags normals away
from square with the surface, and lighting built on them leans with it.

### What does the normal matrix do?

It rebuilds a normal-only transform as the inverse transpose of the linear
block. Normals stay square with the surface under any scale.

### What is inverse transpose, conceptually?

Invert the 3 by 3 block, then transpose it. The operation undoes the
stretching so perpendicular stays perpendicular.

### What does ambient lighting do?

It lifts faces the lamp never reaches with one flat term. Shadow sides stay
readable instead of falling to black.

### Why is simple ambient not global illumination?

It is a single number with no bounce, no occlusion, and no light transport.
Real global illumination tracks light moving between surfaces, which this
term never attempts.

### What does diffuse lighting do?

It gives aimed light that fades as the surface turns away. That falloff is
what reads as form and direction on the cube.

### What does dot(N,L) mean?

For unit vectors it is the cosine between the surface normal and the light
direction. Near one means facing the lamp, near zero means edge on, below
zero means lit from behind.

### Why use max(dot(N,L),0)?

Negative light has no physical meaning on a face turned away. The max call
clamps it to zero so the face falls back to ambient.

### What does the light direction do?

It points from the surface toward the lamp. Diffuse and the reflection
vector both build on it.

### What does the view direction do?

It points from the surface toward the camera. Only the specular term reads
it, which is why moving the camera moves the shine alone.

### What does the reflection direction do?

It reflects the light direction across the normal. It marks where a perfect
mirror would throw the lamp toward the eye.

### What does specular lighting do?

It adds the shiny highlight where reflected light meets the eye. That spot
is what makes a surface read as glossy rather than chalky.

### How does shininess act?

Low values spread a wide soft glow and high values squeeze it into a small
sharp spark. It sets focus, not a physical roughness.

### What is the simple Phong reflection model?

Ambient plus diffuse plus specular summed over a texture base color, all
computed per fragment. It is an old cheap approximation and it shows form
well enough to learn on.

### What is the difference between per-vertex and per-fragment lighting?

Per-vertex lighting shades the corners and blends colors, which smears
small highlights. Per-fragment lighting shades every pixel from
interpolated normals, so highlights stay tight. This page uses
per-fragment.

### What does the UV coordinate do?

It picks which texel each fragment reads. That lookup is what maps the flat
image onto the 3D surface.

### What does the texture sampler do?

It is the shader handle for the bound texture. It carries the image plus
its filter and wrap settings into the fragment shader.

### What is texture sampling?

Looking up texel color at the interpolated UV. Filtering steps in whenever
the texel grid and the pixel grid disagree.

### What is the difference between a pixel and a texel?

A pixel is a screen dot and a texel is a texture dot. One rarely maps to
exactly one of the other, which is why filtering exists at all.

### What is the difference between NEAREST and LINEAR?

NEAREST takes the closest texel, sharp and blocky. LINEAR blends
neighbors, smooth at the cost of crispness.

### What does wrapping do?

It decides what happens past the zero to one box: tile the pattern,
stretch the border, or mirror every other tile.

### What is the difference between REPEAT and CLAMP_TO_EDGE?

REPEAT tiles the pattern across the border. CLAMP_TO_EDGE stretches the
border texel into a smear.

### Why does UV scale help show wrapping?

Inside zero to one every mode looks the same because no border is ever
crossed. Scale 3 pushes UV out to 3, so the border behavior finally shows.

### Why can a texture serve as base color?

A texture is per-fragment color data. It slots in wherever a flat base
color would go, carrying detail no geometry could afford.

### How do lighting and texture combine?

Sample the texture for base color, scale it by ambient plus diffuse, and
add specular on top. Detail comes from the image and depth comes from the
light.

## Analysis questions

### A, same geometry with face normals changed to smooth normals

Shading reads normals, not positions. New normals mean new dot products per
fragment, so the same triangles light differently. That is the whole
demonstration: style lives in the normal buffer.

### B, dot(N,L) equals 1

Normal and light direction coincide exactly. The face stares straight into
the lamp, which is maximum diffuse by definition.

### C, the highlight moves while the camera moves and the light stays put

Specular also depends on the view vector through dot(R,V). A moved camera
means a moved V, so the highlight walks while diffuse stays put. The stage
Cam X slider shows this with the light parked.

### D, texture adds detail without adding triangles

Detail lives in the image, and one quad can carry thousands of texels.
Triangles only place the surface, so painting stays cheap while the surface
looks rich.

### E, non-uniform scaling is the key case for normal transforms

Uniform scale keeps normals square even through the plain matrix, which
hides the bug. Non-uniform scale tilts them, and that tilt is exactly
where inverse transpose proves itself. Lab B runs both paths side by side.

## Experiment notes

### E1, normalize on versus off

Without `normalize` the edges and stretched faces dull unevenly because the
dot products read drifted lengths. Restored, brightness evens out again.

### E2, flat versus smooth on F

Flat keeps six crisp plates with hard lighting edges. Smooth melts them
into one blended glow. The vertex positions never move between the two.

### E3, ambient across 0 then 0.15 then 0.4

At 0 the shadow sides fall fully black. At 0.4 they wash milky and flat. At
the 0.18 default they stay readable without stealing the scene.

### E4, dot product by flying the light

Arrows swing one face from full burn down to its ambient floor. Alignment
reads directly off brightness with no numbers needed.

### E5, shininess across 8 then 32 then 128

At 8 the highlight pools wide and soft. At 128 it needles down to a spark.
The slider makes the trend continuous between those stops.

### E6, camera walk with a parked light

Dragging Cam X slides the shine across faces while diffuse never moves.
View direction owns the highlight alone.

### E7, NEAREST versus LINEAR

At UV scale 3 NEAREST shows hard texel blocks and LINEAR melts them into
ramps. The Lab E far view calms further under mipmap modes.

### E8, wrapping at UV scale 3

G cycles tiling, then a stretched border smear, then mirrored tiles. Below
scale 1 the same key seems to do nothing, which is the lesson: no crossed
border means no visible wrapping.

### E9, correct versus naive normal matrix

Stretched with N, the naive path skews brightness across the long faces
while the correct path stays calm. Uniform scale hides the difference
entirely.

### E10, raw texture versus lit texture

With lighting cut the stage shows flat checker and photo texels with no
depth. Lighting back on restores direction, shadow sides, and the shine.

## Where each requirement is met

The stage plus five lab canvases cover the full minimum set. Position,
normal, and UV attributes ride three buffers. Face normals and smooth
normals swap on F. Normals normalize per fragment with an X bypass for the
trial. The normal matrix ships every draw with a B bypass for comparison.
Ambient, diffuse with dot product, and specular with view plus reflection
plus shininess combine over the texture sample. Point light position moves
on arrows plus W and S. NEAREST and LINEAR flip on T. All three wrap modes
cycle on G. The cube spins on its own. Toggles are event based. HUD and
telemetry update each frame. No console errors appear in normal use.

## Running it

Checker mode runs from a double click on `index.html`. The photo needs a
local server from the practicum folder so the image path resolves:

```
python -m http.server 8000
```

Then open `http://localhost:8000/`. If the photo fails to load, the stage
keeps the checker and the status line reports the fallback.

## Debugging notes

- Fully dark object. Check that normals normalize, that the light sits
  clear of the surface, that diffuse clamps with max, that ambient stays
  above zero, and that the sampler points at unit zero.
- Black texture. Check that the texture uploaded, that TEXTURE0 is active,
  that the UV buffer binds with size 2, and that generateMipmap ran after
  upload.
- Flipped photo. The uploader sets flip Y for the image only. The checker
  is symmetric so it needs no flip.
- Missing specular. Check camera position, light position, and a mid range
  shininess near 16 to 32 before pushing higher.
- Wrapping looks unchanged. UV scale must pass 1 first, since the zero to
  one box shows no borders.
- Flat and smooth look equal. The active normal buffer must rebind before
  each draw call, which `drawLit` does every frame.

## Reflection

Flat shading keeps every face honest and readable, which suits a cube with
hard edges. Smooth shading bends the same faces into a soft glow without
moving one vertex, which taught me that normals carry style apart from
shape. The dot product was the clearest term, since flying the light maps
brightness straight onto alignment. Shininess surprised me most, since one
number rescales a wide pool into a needle point. Filtering clicked once I
zoomed close, where NEAREST blocks and LINEAR ramps finally part ways. My
main bug was a missing mipmap regenerate after the photo upload, which left
the photo black until the upload path matched the checker path.
