# Jam 2026 Specification

## Purpose
The project delivers a browser-based three.js game for GitHub Pages. The initial public experience is a lightweight, instantly accessible scene that establishes the visual direction and player controls for the jam entry.

## Platform And Deployment
- The project runs in a web browser without login or signup.
- The project is deployed to GitHub Pages.
- The public site loads directly from the hosted page without a separate launcher or install step.

## Current Scope
- The scene contains a 10m x 10m cube with a grass texture on its visible surfaces.
- The scene contains an infinite water plane positioned 1m below the top of the cube.
- The scene contains an infinite ground plane positioned 1m below the water plane with a separate ground texture.
- The cube and the plane below the water participate in collision.
- The player spawns 1 meter above the top of the cube.
- The character collision volume is a capsule that is 1.75m tall and 0.25m in radius.
- The character comes to rest on ground contact instead of bouncing or entering a jump loop.
- The player reaches a horizontal top speed of 20 mph.
- The player reaches a vertical top speed of 5 mph.
- The player reaches a maximum fall speed of 40 mph.
- The player accelerates to horizontal top speed over a travel distance of 2 meters.
- The player decelerates from horizontal top speed to zero over a travel distance of 0.5 meters.
- Gravity applies at 1g.
- Jetpack thrust applies at 1.25g so the net upward acceleration is 0.25g while `Space` is held.
- The scene uses `@takram/three-atmosphere` for atmospheric rendering.
- The scene uses the library's light-source lighting pattern with `SkyLight`, `SunLight`, and `AerialPerspective` as the reference atmosphere setup.
- The atmosphere precomputed texture assets are served from the project's own hosted assets rather than fetched from a remote third-party origin.
- The scene uses lighting and exposure values that keep the cube, water, and terrain readable on first load.
- Texture links that point to ShareTextures are treated as downloadable PBR packs rather than preview images.
- The cube and the lower ground plane use extracted PBR texture packs with tiling that assumes 1 meter by 1 meter world scale unless the source specifies a different implied scale.
- The water plane uses the official three.js `Water` implementation from the examples/docs.
- The sun is positioned 30 degrees above the horizon line.
- The atmosphere sun direction is driven by the same canonical sun direction as the scene lights, water highlights, sun mesh, and post-processing source objects.
- The atmosphere-facing sun direction is expressed in the coordinate space expected by `@takram/three-atmosphere`.
- The scene uses a single canonical sun direction expressed in ECEF coordinates, and all world-space sun-dependent systems derive from that shared source.
- The scene exposes a sun rotation slider.
- The visual controls panel exposes a tone-mapper selector that changes the final composited image rather than only updating internal renderer state.
- The renderer exposes direct sun illuminance in lux as the primary sun-brightness control.
- The direct sun illuminance control defaults to a calibrated clear-day baseline and is converted to stable internal renderer scales through an explicit calibration layer.
- The direct sun illuminance control drives the direct sun light, sky fill, atmosphere solar irradiance scale, water sun highlight, and the god-rays source brightness through that shared calibration layer.
- The renderer exposes camera exposure in EV100 units as the primary exposure control.
- Exposure calibration uses an EV100 scale where a one-stop increase halves renderer exposure and a one-stop decrease doubles renderer exposure.
- The scene exposes a sky light multiplier control that scales the calibrated sky-fill contribution relative to the calibrated direct-sun baseline.
- The renderer uses `AgXToneMapping`.
- The scene enables Bloom, GodRays, DepthOfField, Lensflare, SSAO, and Vignette with default settings.
- The UI shows an FPS counter in the top-right corner.
- Pressing backquote opens and closes a visual controls panel during play.
- The visual controls panel exposes the sun elevation angle and direct sun illuminance in lux.
- The visual controls panel exposes the sun rotation angle, exposure EV100, sky light multiplier, and the active tone mapper.
- The visual controls panel exposes enabled and intensity controls for Bloom, GodRays, DepthOfField, Lensflare, SSAO, and Vignette.
- The player can move with first-person WASD controls.
- The player can look around with mouse look controls.
- Holding `Space` applies vertical thrust in a jetpack-like motion.
- Pressing `Escape`, `Alt`, `Control`, `Meta`, or the Windows key releases mouse lock.
- Pressing backquote is reserved for the visual controls panel and does not restore mouse lock.
- Any other non-reserved key press or mouse click on the scene restores mouse lock while playing.
- The initial scene contains no speculative HUD copy, branding caption, or click-to-enter gate.

## Player Experience
- The camera starts in a playable 3D view with immediate control.
- Movement feels continuous and responsive rather than tile-based or turn-based.
- Mouse look changes camera orientation directly.
- Pressing backquote reveals a live visual tuning panel without a rebuild or page refresh.
- Jetpack thrust adds upward motion while `Space` remains held and stops when `Space` is released.
- Horizontal motion feels capped and responsive rather than indefinitely accelerating.
- Horizontal movement magnitude is stored as a scalar rather than a persistent world-space vector.
- Horizontal movement is applied in the current camera-relative input direction.
- Movement input that opposes current horizontal motion uses the deceleration rate instead of the acceleration rate.
- Vertical motion feels capped and responsive rather than indefinitely accelerating.
- Ground contact resolves the character to a resting state instead of repeatedly lifting and dropping the collision volume.
- The game responds to movement and look input without requiring any preliminary button click.
- Mouse lock behavior is available during play for relative look input.

## Visual Requirements
- The cube reads as the central landmark in the scene.
- The water plane extends beyond the visible area so it reads as infinite.
- The ground plane extends beyond the visible area so it reads as infinite.
- Atmosphere and lighting combine to produce a sky-backed outdoor scene.
- The sky and lighting avoid a black first frame by using a known-good atmosphere configuration from the library's documented light-source example pattern.
- Direct sun color for scene lighting is derived from the atmosphere model's transmittance rather than a manually authored white sun color.
- Atmosphere solar brightness is scaled from the same calibrated direct-sun illuminance input used for direct lighting.
- Water highlights derive their sun color from the same atmosphere-derived direct sun color used by the directional light.
- Diffuse sky lighting derives from the same atmosphere state and world position as the visible sky.
- The scene provides a sky-derived environment map for specular reflections so PBR materials can reflect lighting that is directionally consistent with the visible sky.
- The final image brightness is determined by the combination of calibrated scene lighting and EV100-controlled camera exposure rather than by hidden exposure multipliers on the sun control.
- Collision keeps the cube solid and keeps the plane below the water as an active surface boundary.
- The water surface uses the official three.js `Water` material and animation path rather than a generic translucent plane.
- The water and seabed remain separated by 1 meter.
- The water and seabed use a footprint that is 10x the baseline scene size.
- The sun direction matches a 30-degree-elevation outdoor lighting setup.
- The atmospheric sun disk remains the only visible sun disk in the beauty image.
- The god-rays source object supports the post-process effect without adding a second visible sun to the scene.
- The lens flare effect produces visible flare artifacts when enabled and the sun is on-screen.
- Highlight values remain available before tone mapping so bloom can respond proportionally to bright sources.
- The page shows an FPS counter in the top-right corner during play.
- The page avoids a blocking loading screen.

## Animation And Motion
- Camera rotation responds smoothly to pointer movement.
- Movement responds continuously to key state changes.
- Vertical thrust is sustained while the key is held, not toggled.
- Mouse lock unlocks on escape-style modifier keys and relocks on normal interaction.
- Opening the visual controls panel releases mouse lock so the panel can be adjusted.

## Performance Requirements
- The page becomes interactive quickly on load.
- The scene uses browser-friendly asset sizes and avoids unnecessary blocking work.
- The frame rate remains stable during ordinary movement and camera motion.
- The project documents startup-time and test-duration benchmarks and treats regressions in those measurements as actionable.

## Testing Expectations
- A production build succeeds before a change is considered complete.
- The public page is verified after deployment.
- The controls are checked in the browser for movement, looking, and thrust behavior.
- Visual layout changes are reviewed in the rendered scene, not only in source code.
- Collision behavior is checked in the browser for resting contact on the ground and stable interaction with the cube.
- The backquote shortcut is checked in the browser and verified to open the visual controls panel.
- The visual controls panel is checked in the browser and verified to expose the tone-mapper selector and corrected sun elevation and rotation controls.
