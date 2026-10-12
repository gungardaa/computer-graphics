# Practicum 6 - Three.js Mini 3D Scene

**Author** Anak Agung Putu Arda Nareswara
**NRP** 5025241074
**Class** B

Web https://ardanareswara-computer-graphics.vercel.app

This is my sixth assignment for Computer Graphics. Meetings 2 through 5 built
3D by hand with buffers plus shaders plus matrices. This page keeps every idea
and hands the heavy lifting to Three.js as a thin layer above WebGL. The Main
Stage holds one Lambert cube plus one Phong sphere plus one Lambert ground
under one Ambient plus one Directional light with a full shadow chain and a
delta driven loop. All eleven trials run inside the stage toolbar and all eight
challenges run as separate live labs below it.

Run the lab from this folder with the commands below. A static host serves the
built preview while dev serves the source directly.

```sh
npm install
npm run dev
```

Build the static preview with the command below.

```sh
npm run build
```

## Scene description

Background sits at deep navy `0x0b1020`. PerspectiveCamera opens at 60 degrees
with near `0.1` and far `100` from seat `4 3 6` aimed at `0 0.5 0` through
`lookAt`. The cube rides at `-1.2 0.6 0` and spins on two axes. The sphere
rests at `1.4 0.75 0` and bobs on a sine wave while turning slowly. The ground
plane spans `10 by 10` and catches every shadow.

## Geometry list

- BoxGeometry `1 1 1` for the cube
- SphereGeometry `0.7` with Low `8 6` plus Med `32 16` plus High `64 32`
- PlaneGeometry `10 10` rotated flat for the ground
- CylinderGeometry plus ConeGeometry plus TorusGeometry in Challenge A

## Material list

- MeshBasicMaterial in cyan for the no light path
- MeshLambertMaterial in cyan for diffuse surfaces
- MeshPhongMaterial in blue with shininess `60` for the highlight path
- MeshNormalMaterial for the orientation paint trial

## Light list

- AmbientLight in white at `0.35` for flat base lift
- DirectionalLight in white at `2.0` from `3 5 2` for aimed shading

## Shadow setup

Four links must all hold or no shadow draws. Renderer map flag on plus light
cast on plus mesh cast on for both cube and sphere plus ground catch on. Shadow
camera spans `-5 5 5 -5` with near `0.5` and far `20`. Map size defaults to
`1024` and Challenge E compares `512` against `1024` against `2048`.

## Animation made

Cube turns at `0.8` radians per second on Y plus `0.35` on X. Sphere turns at
`0.5` on Y and floats at base `0.75` with sine swing `0.15` at rate `2`.
Challenge D orbits its light on a circle of radius `4`. All motion scales with
delta clamped at `0.05` so speed reads per second on any display.

## Challenges done

All eight are live with one canvas each.

- A. Extra geometry with cylinder plus cone plus torus spaced apart
- B. Material gallery with one sphere shape under four materials in a row
- C. Orthographic camera with P flip plus resize safe frustum
- D. Light orbit with cosine plus sine path and a marker dot
- E. Shadow quality switch across three map sizes
- F. Scene readout with camera seat plus object count plus triangle count
  plus FPS plus live materials
- G. Pause toggle on Space with one boolean flag
- H. Cube drive on arrows plus twist on Q plus E with delta timing

## Keyboard controls

Keys act only on the focused canvas so labs never fight. Click or Tab arms a
canvas first.

- Space pauses the Main Stage and Lab G
- P flips Lab C across perspective and ortho
- Arrows glide the Lab H cube on the ground plane
- Q plus E twist the Lab H cube left and right

## Trial notes

- T1. Three calls map one to one onto hand WebGL twins in the map table
- T2. High segments smooth the rim while vertex count climbs fast
- T3. Basic stays bright with lights off while Lambert falls dark
- T4. Normal paint follows surface direction with no light at all
- T5. Phong adds a tight spark where Lambert holds only soft falloff
- T6. Sliders move pose with no buffer edit since the matrix rebuilds
- T7. Dir presets swing aimed burn while ambient lifts every face flat
- T8. Each shadow link kills shadows alone when flipped off
- T9. FOV `35` narrows the view while `90` bends the edges wide
- T10. Proj fix off plus window resize stretches the image on purpose
- T11. Fixed step judders across displays while delta stays calm

## Debugging notes

- Dark object. Check that lights are on and that the material is not Basic
  when testing light response
- No shadow. Walk the four links in order from map flag to ground catch
- Stretched image. Confirm aspect update plus matrix update plus size call
- Photo style black texture. Not used here since all color is procedural
- Jerky spin. Confirm delta path is active and clamp still caps at `0.05`

## Understanding in brief

Three.js sits directly above WebGL and above the GPU. It is called high level
because one call replaces a full chain of buffer plus shader plus matrix plus
dispatch work. Buffers and shaders never vanish since BufferGeometry still
holds position plus normal plus uv and materials still compile shader code
behind each mesh. Scene gathers every object while camera plus renderer turn
that graph into pixels through the canvas element. PerspectiveCamera reads FOV
as view width plus aspect as frame shape plus near and far as depth bounds
while `lookAt` aims the view axis. Geometry stores shape data and material
stores shading code and mesh joins both for placement through position plus
rotation plus scale which collapse into the model matrix each frame.
AmbientLight lifts all faces with no direction while DirectionalLight aims
from one seat so Lambert and Phong must have light yet Basic and Normal never
do. Shadows need the full four link chain since the map must exist plus the
light must cast plus the mesh must throw plus the ground must catch. The loop
draws through requestAnimationFrame for display sync while delta keeps speed
honest per second and the resize trio keeps the frame undistorted.

## Analysis in brief

- A. One Mesh line replaces a long hand written chain yet the same GPU work
  still runs underneath in hidden form
- B. Basic skips light math in its shader while Lambert centers on it so one
  glows alone and one needs a lamp
- C. More segments mean more triangles so the rim smooths while memory and
  raster cost climb with it
- D. Pose writes never touch vertices since they only feed the model matrix
  which the renderer rebuilds per frame
- E. Shadows need map plus caster plus receiver agreement so one light alone
  can never draw them
- F. Skipping the aspect matrix leaves stale projection so the image skews
  even when the canvas size looks right

## Reflection

Hand WebGL taught me where every byte lives while Three.js taught me how fast
a scene appears once that labor hides. The Mesh join helped most since shape
plus shading snap together in one line. Seeing position counts behind smooth
spheres linked geometry to raw vertex data for good. Material pairs showed how
shaders decide the light response. The shadow chain bit me once when the map
flag sat off while everything else looked right. Delta time calmed motion
across my two displays at once. My main bug was a stale projection after
resize which the matrix call fixed in one line.

## Where each requirement is met

Stage plus eight labs cover the full minimum set. Scene plus background plus
PerspectiveCamera with seat and `lookAt` plus antialiased renderer with capped
pixel ratio open the page. Box plus Sphere plus Plane plus two lit materials
across three meshes carry position plus rotation plus scale. Ambient plus
Directional with the four link shadow chain light the set. The loop runs on
requestAnimationFrame with THREE.Clock delta while resize refreshes aspect
plus matrix plus size. HUD and telemetry report every frame with zero console
errors in normal use.
