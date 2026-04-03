# How To Work On This Project

## Current State
The repository contains a runnable browser game prototype for GitHub Pages. The current build serves a three.js scene with immediate mouse-look, WASD movement, and hold-space vertical thrust.

## Local Setup
- Install Node.js 20 or newer.
- Install dependencies with `npm install`.
- Start the dev server with `npm run dev`.
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
- Verify the main page renders the 3D scene without console errors.
- Verify `W`, `A`, `S`, and `D` move the camera.
- Verify mouse movement changes view direction without a preliminary click.
- Verify holding `Space` applies upward thrust and releasing it stops the ascent.
- Verify the player starts 1 meter above the cube, lands on the cube top, and cannot fall through the lower ground plane.
- Verify ground contact is stable: the character should rest on collision instead of popping upward and falling again in a loop.
- Verify the water surface uses the official three.js `Water` implementation and animates as expected.
- Verify the water plane is 1 meter below the cube top and the seabed is 1 meter below the water.
- Verify horizontal speed, vertical speed, fall speed, acceleration, deceleration, and gravity match the documented targets.
- Verify mouse lock releases on escape-style modifier keys and re-engages on ordinary input.
- Verify the sun sits at a 30-degree elevation and the tone mapper is `AgXToneMapping`.
- Verify the requested postprocessing effects are present with their default settings.
- Verify the FPS counter appears in the top-right corner.
- Verify pressing backquote opens the visual controls panel.
- Verify the panel adjusts sun angle, sun intensity, and the enabled/intensity controls for Bloom, GodRays, DepthOfField, Lensflare, SSAO, and Vignette.
- Verify opening the panel releases mouse lock and clicking inside the panel does not relock the pointer.
- Benchmark startup time and test duration before handoff and treat regressions as blocking issues.
- Keep unit tests under 20 seconds and end-to-end tests under 1 minute.

## Deployment
- The project is intended for GitHub Pages hosting.
- The current GitHub Pages setup publishes directly from the repository root on `main`.
- Run `npm run build:pages` before pushing when the live site needs updated production assets.
- After deployment, open the published URL and confirm that the scene loads and responds to input.
