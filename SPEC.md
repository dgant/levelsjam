# Jam 2026 Specification

## Purpose
- The project delivers a browser-based three.js game for GitHub Pages.
- The public experience opens directly into a playable first-person 3D scene.
- The initial playable slice establishes movement, environmental art direction, and exterior lighting for the jam entry.

## Platform And Deployment
- The project runs in a web browser without login or signup.
- The project is deployed to GitHub Pages.
- The public site loads directly from the hosted page without a separate launcher or install step.

## Current Scope
- The scene uses image-based lighting from the Poly Haven `overcast_soil` environment.
- The scene does not use `@takram/three-atmosphere`.
- The scene does not use the three.js `Water` helper.
- The scene does not use a directional sunlight source.
- The scene contains a large upward-facing ground plane centered at the origin.
- The ground plane uses the extracted ShareTextures `puddle-ground` PBR pack rather than preview imagery.
- The scene contains exactly 10 walls.
- Each wall measures 2 meters tall by 4 meters long by 0.5 meters wide.
- Each wall has its base at `Y = 0`.
- Each wall is placed at a deterministic pseudo-random position within `-10m` to `+10m` on the world X and Z axes.
- Each wall uses the extracted ShareTextures `stone-wall-29` PBR pack rather than preview imagery.
- Each wall has a metal wall sconce attached to it.
- Each wall sconce uses the extracted ShareTextures `metal-13` PBR pack.
- Each wall sconce uses the established three-part fixture geometry: a circular wall plate, a short central arm, and a forward-facing tapered cup.
- Each wall sconce is positioned with its center one sconce radius outside the wall face.
- Each wall sconce remains visibly readable against the wall and under the torch it supports.
- Each wall sconce supports a camera-facing torch billboard above it.
- Each torch billboard and torch point light are positioned one sconce radius outside the wall face with the sconce.
- Each torch billboard sits directly on top of the sconce rather than floating above it.
- Each torch billboard is 0.5 meters square.
- Each torch billboard uses the linked source flipbook asset rather than a procedurally generated placeholder.
- Each torch billboard uses the local committed `CampFire_l_nosmoke_front_Loop_01_4K_6x6.png` atlas copied from the linked source asset.
- Each torch billboard uses a 6x6 fire flipbook atlas.
- Each torch billboard animation plays eight times faster than the previous 4-second loop.
- Each torch billboard uses an unlit material.
- Each torch billboard brightness is scaled from a 1500 candela torch baseline.
- Each torch billboard samples the linked atlas so the visible flame fills the specified quad and sits on the sconce instead of floating above it due to transparent frame padding.
- Each torch has a shadow-casting point light located at the billboard center.
- Each torch brightness uses `mix(1, noise, flickering) * intensity`.
- Each torch brightness uses one user-adjustable intensity multiplier and one user-adjustable flicker amount slider.
- Each torch point light intensity derives from the shared torch brightness value and a 1500 candela torch baseline.
- Each torch billboard brightness derives from the same shared torch brightness value as the point light.
- Each torch point light distance remains fixed at 10 meters.
- Each torch point light flickers at twice the previous speed.
- Each torch point light uses a warm fire-appropriate color.
- Torch shadows are enabled within a fixed 40 meter radius of the camera.
- Torch shadows within that radius reuse static shadow maps while the lights and occluders remain stationary.
- The player collides with the ground plane and the walls.
- The character collision volume is a capsule that is 1.75 meters tall and 0.25 meters in radius.
- The player spawns 1 meter above the ground plane.
- The camera eye height remains derived from the character capsule.
- The initial camera angle is horizontal.
- The player reaches a horizontal top speed of 20 mph.
- The player reaches a vertical top speed of 5 mph.
- The player reaches a maximum fall speed of 40 mph.
- The player accelerates to horizontal top speed over a travel distance of 2 meters.
- The player decelerates from horizontal top speed to zero over a travel distance of 0.5 meters.
- Gravity applies at 1g.
- Jetpack thrust applies at 1.25g so the net upward acceleration is 0.25g while `Space` is held.
- Horizontal movement magnitude is stored as a scalar rather than a persistent world-space vector.
- Horizontal movement is applied in the current camera-relative input direction.
- Movement input that opposes current horizontal motion uses the deceleration rate instead of the acceleration rate.
- The scene uses `postprocessing` Bloom.
- The scene uses `postprocessing` Depth of Field.
- The scene uses `n8ao` instead of the previous SSAO effect.
- The scene includes screen-space reflections.
- The scene does not use God Rays.
- Bloom, Depth of Field, Lens Flares, and SSR default to disabled.
- The debug panel exposure control defaults to `0.0`.
- The debug panel exposes an IBL intensity multiplier across a wide enough range to rebalance the HDRI against the torches without relying on physically calibrated EV semantics.
- The debug panel exposes a torch candela multiplier across a wide enough range to rebalance the torches against the HDRI without relying on physically calibrated EV semantics.
- The debug panel lens flare control adjusts the effect using the lens flare opacity parameter rather than an arbitrary color-gain multiplier.
- The debug panel exposes an ambient-occlusion mode dropdown with working `Off`, `N8AO`, and `SSAO` modes.
- The debug panel exposes one shared ambient-occlusion intensity slider for the selected AO mode.
- The debug panel exposes Depth of Field `focusDistance`, `focalLength`, and `bokehScale`.
- The debug panel exposes Bloom `kernelSize`.
- The debug panel does not expose obsolete atmosphere or sun-direction controls.
- The page shows an FPS counter in the top-right corner.

## Loading And Startup
- The page shows a centered loading overlay before the scene becomes visible.
- The loading overlay shows an `h1` with the text `MINOTAUR`.
- The loading overlay shows an `h2` with the text `Entering the labyrinth...`.
- The loading overlay animates the trailing dots on the subtitle through `1`, `2`, `3`, `1`, `2`, `3` at 0.25 second intervals.
- The loading subtitle keeps a consistent total width while the trailing dots animate.
- The loading overlay remains visible until the scene assets have loaded.
- Once the scene assets have loaded, the loading text fades out over 2 seconds.
- Once the scene assets have loaded, the viewport fades in over the same 2 second interval.

## Player Experience
- The camera starts in a playable 3D view with immediate control.
- Movement feels continuous and responsive rather than tile-based or turn-based.
- Mouse look changes camera orientation directly.
- Holding `Space` applies vertical thrust in a jetpack-like motion.
- The character comes to rest on ground contact instead of bouncing or entering a jump loop.
- Horizontal motion feels capped and responsive rather than indefinitely accelerating.
- Vertical motion feels capped and responsive rather than indefinitely accelerating.
- The player can move with first-person WASD controls.
- The player can look around with mouse look controls.
- Pressing `Escape`, `Alt`, `Control`, `Meta`, or the Windows key releases mouse lock.
- Pressing backquote opens and closes the debug controls panel during play.
- Pressing backquote is reserved for the debug controls panel and does not restore mouse lock.
- Mouse lock is only requested from an explicit click on the scene canvas.
- The game responds to movement and look input without requiring any preliminary button click.

## Visual Requirements
- The environment map from `overcast_soil` provides the visible skybox.
- The environment map from `overcast_soil` provides image-based lighting.
- The environment map from `overcast_soil` provides specular reflection data for reflective materials.
- The environment map from `overcast_soil` is treated as canonically authored intensity at an IBL multiplier of `1`.
- The visible skybox and the environment lighting use the same calibrated HDRI intensity path.
- The ground, walls, and sconces use extracted PBR texture packs with tiling based on a 1 meter world scale unless a source specifies otherwise.
- The metal wall sconce uses the linked `metal-13` PBR channels in their correct material slots.
- Reflective and semi-reflective materials read from the shared environment consistently.
- The torch billboards face the camera continuously.
- The torch billboards animate smoothly through the flipbook loop without lighting artifacts from scene lights.
- The torch billboards are excluded from screen-space reflections.
- Screen-space reflections apply only to the scene's PBR materials rather than to unlit or transparent billboard materials.
- Torch point lights and torch billboards read as a matched fire source rather than independent unrelated elements.
- The scene reads as an overcast exterior space lit primarily by environment light and torches.
- Exposure acts as a neutral stop-offset presentation control with `0.0` meaning no extra gain.
- IBL intensity and torch candela controls are the primary balancing controls between the HDRI and torches.
- Positive exposure values darken the rendered image by stops and negative values brighten it by stops.
- Enabling SSR from the debug panel does not halt rendering or introduce runtime errors.
- Enabling SSR produces a visible reflection change on reflective scene surfaces.
- Enabling SSR does not brighten the visible HDRI skybox independently of the reflected surfaces.
- Selecting `N8AO` or `SSAO` produces a visible ambient-occlusion change around contact areas.
- Enabling lens flares produces a visible flare around visible torches.
- The page does not show speculative branding captions, launcher buttons, or click-to-enter copy.

## Debug Controls
- The debug controls panel can be opened and closed with backquote.
- The debug controls panel exposes exposure.
- The debug controls panel exposes the active tone mapper.
- The debug controls panel exposes the IBL intensity multiplier.
- The debug controls panel exposes the torch candela multiplier.
- The debug controls panel exposes the torch flicker amount.
- The debug controls panel exposes ambient-occlusion mode and intensity.
- The debug controls panel exposes enabled and intensity controls for Bloom, Depth of Field, Lens Flares, SSR, and Vignette.
- The debug controls panel lays out each control row on one line in value-label-control order.
- The debug controls panel does not expose controls for removed effects or removed atmosphere systems.

## Performance Requirements
- The page becomes interactive quickly on load.
- Startup avoids remote third-party lighting assets during play by serving required scene textures from the project.
- The frame rate remains stable during ordinary movement and camera motion.
- The default scene configuration must benchmark at or above 120 frames per second in the project's automated browser performance test.
- The project documents startup-time and test-duration benchmarks and treats regressions in those measurements as actionable.

## Testing Expectations
- A production build succeeds before a change is considered complete.
- The public page is verified after deployment.
- The controls are checked in the browser for movement, looking, and thrust behavior.
- Visual layout changes are reviewed in the rendered scene, not only in source code.
- Collision behavior is checked in the browser for stable contact with the ground plane and the walls.
- The loading overlay is checked in the browser and verified to animate and then fade away after asset load.
- The backquote shortcut is checked in the browser and verified to open the debug controls panel.
- The debug controls panel is checked in the browser and verified to expose the new IBL and torch controls while omitting removed atmosphere controls.
- The automated browser performance test is run and passes at or above 120 frames per second before a change is considered complete.
