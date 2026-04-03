# Jam 2026 Specification

## Purpose
The project delivers a browser-based three.js game for GitHub Pages. The initial public experience is a lightweight, instantly accessible scene that establishes the visual direction and player controls for the jam entry.

## Platform And Deployment
- The project runs in a web browser without login or signup.
- The project is deployed to GitHub Pages.
- The public site loads directly from the hosted page without a separate launcher or install step.

## Current Scope
- The scene contains a 10m x 10m cube with a grass texture on its visible surfaces.
- The scene contains an infinite water plane positioned 1m below the cube surface.
- The scene contains an infinite ground plane below the water plane with a separate ground texture.
- The cube and the plane below the water participate in collision.
- The player spawns 1 meter above the top of the cube.
- The character collision volume is a capsule that is 1.75m tall and 0.25m in radius.
- The character comes to rest on ground contact instead of bouncing or entering a jump loop.
- The scene uses `@takram/three-atmosphere` for atmospheric rendering.
- The scene uses the library's light-source lighting pattern with `SkyLight`, `SunLight`, and `AerialPerspective` as the reference atmosphere setup.
- The scene uses lighting and exposure values that keep the cube, water, and terrain readable on first load.
- Texture links that point to ShareTextures are treated as downloadable PBR packs rather than preview images.
- The cube and the lower ground plane use extracted PBR texture packs with tiling that assumes 1 meter by 1 meter world scale unless the source specifies a different implied scale.
- The water plane uses the official three.js `Water` implementation from the examples/docs.
- The player can move with first-person WASD controls.
- The player can look around with mouse look controls.
- Holding `Space` applies vertical thrust in a jetpack-like motion.
- The initial scene contains no speculative HUD copy, branding caption, or click-to-enter gate.

## Player Experience
- The camera starts in a playable 3D view with immediate control.
- Movement feels continuous and responsive rather than tile-based or turn-based.
- Mouse look changes camera orientation directly.
- Jetpack thrust adds upward motion while `Space` remains held and stops when `Space` is released.
- The game responds to movement and look input without requiring any preliminary button click.
- Ground contact resolves the character to a resting state instead of repeatedly lifting and dropping the collision volume.

## Visual Requirements
- The cube reads as the central landmark in the scene.
- The water plane extends beyond the visible area so it reads as infinite.
- The ground plane extends beyond the visible area so it reads as infinite.
- Atmosphere and lighting combine to produce a sky-backed outdoor scene.
- The sky and lighting avoid a black first frame by using a known-good atmosphere configuration from the library's documented light-source example pattern.
- Collision keeps the cube solid and keeps the plane below the water as an active surface boundary.
- The water surface uses the official three.js `Water` material and animation path rather than a generic translucent plane.
- The page avoids a blocking loading screen.

## Animation And Motion
- Camera rotation responds smoothly to pointer movement.
- Movement responds continuously to key state changes.
- Vertical thrust is sustained while the key is held, not toggled.

## Performance Requirements
- The page becomes interactive quickly on load.
- The scene uses browser-friendly asset sizes and avoids unnecessary blocking work.
- The frame rate remains stable during ordinary movement and camera motion.

## Testing Expectations
- A production build succeeds before a change is considered complete.
- The public page is verified after deployment.
- The controls are checked in the browser for movement, looking, and thrust behavior.
- Visual layout changes are reviewed in the rendered scene, not only in source code.
- Collision behavior is checked in the browser for resting contact on the ground and stable interaction with the cube.
