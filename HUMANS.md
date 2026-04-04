# How To Work On This Project

## Current State
The repository contains a runnable browser game prototype for GitHub Pages. The current build serves a three.js scene with immediate mouse-look, WASD movement, hold-space vertical thrust, a same-origin `three-atmosphere` sky setup, atmosphere-derived sun color shared across lighting and water highlights, a sky-derived environment map for PBR reflections, and a backquote visual-controls panel with sun and tone-mapper controls.

## Local Setup
- Install Node.js 20 or newer.
- Install dependencies with `npm install`.
- Start the dev server with `npm run dev`.
- Start one reusable headless Vite instance with `npm run dev:bg`.
- Check that background instance with `npm run dev:bg:status`.
- Stop that background instance with `npm run dev:bg:stop`.
- Open the local URL printed by the dev server.
- For agent work, prefer one long-lived headless Vite instance instead of repeatedly opening new visible windows.

## Build
- Create a production build with `npm run build`.
- Verify the root-published production build with `npm run preview`.
- Refresh the legacy GitHub Pages publishable files with `npm run build:pages`.

## Testing
- Run the production build before handoff.
- Run `npm run test:unit` to verify player spawn and collision math.
- Run `npm run test:smoke` to exercise the built page through Playwright.
- Run `npm run test:smoke:runner` when `npm run build:pages` has already prepared the root-published bundle.
- Verify the main page renders the 3D scene without console errors.
- Verify `W`, `A`, `S`, and `D` move the camera.
- Verify mouse movement changes view direction without a preliminary click.
- Verify holding `Space` applies upward thrust and releasing it stops the ascent.
- Verify the player starts 1 meter above the cube, lands on the cube top, and cannot fall through the lower ground plane.
- Verify ground contact is stable: the character should rest on collision instead of popping upward and falling again in a loop.
- Verify the water surface uses the official three.js `Water` implementation and animates as expected.
- Verify the water plane is 1 meter below the cube top and the seabed is 1 meter below the water.
- Verify horizontal speed, vertical speed, fall speed, acceleration, deceleration, and gravity match the documented targets.
- Verify horizontal motion follows the current camera-relative input direction and that directly opposing input decelerates rather than accelerates through the turn.
- Verify mouse lock releases on escape-style modifier keys and re-engages on ordinary input.
- Verify the sun sits at a 30-degree elevation and the tone mapper is `AgXToneMapping`.
- Verify the visual controls panel exposes the tone-mapper selector and that the default sun intensity is `10` with a `0-100` slider range.
- Verify the direct sun color warms and cools with sun angle instead of staying flat white in the water highlights.
- Verify specular reflections on the cube, seabed, and water respond to a sky-derived environment that matches the visible atmosphere.
- Verify only the atmospheric sun disk is visible in the rendered scene while god rays remain functional.
- Verify the atmosphere textures load from local `textures/atmosphere/*.exr` assets instead of `media.githubusercontent.com`.
- Verify changing sun intensity does not rewrite renderer exposure; the `canvas[data-renderer-exposure]` value should remain at the configured exposure baseline.
- Verify the requested postprocessing effects are present with their default settings.
- Verify the FPS counter appears in the top-right corner.
- Verify pressing backquote opens the visual controls panel.
- Verify the panel adjusts sun angle, sun intensity, and the enabled/intensity controls for Bloom, GodRays, DepthOfField, Lensflare, SSAO, and Vignette.
- Verify opening the panel releases mouse lock and clicking inside the panel does not relock the pointer.
- Benchmark startup with `npm run bench:startup` and test duration with `npm run bench:tests` before handoff.
- Treat duration regressions as blocking issues.
- Keep `npm run test:unit` under 20 seconds.
- Keep the prepared smoke runner `npm run test:smoke:runner` under 1 minute after a single `npm run build:pages`.
- Latest measured benchmark on April 4, 2026: `node scripts/benchmark-startup.cjs` reached the first bright rendered frame in about `489.3ms` against the background Vite server after adding the sky-derived PMREM environment map.
- Latest measured benchmark on April 4, 2026: `node scripts/benchmark-tests.cjs` completed `npm run test:unit` in about `904ms` and `npm run test:smoke:runner` in about `57.0s` after one prepared build.

## Deployment
- The project is intended for GitHub Pages hosting.
- The current GitHub Pages setup publishes directly from the repository root on `main`.
- Run `npm run build:pages` before pushing when the live site needs updated production assets.
- After deployment, open the published URL and confirm that the scene loads and responds to input.
