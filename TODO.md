[x] Check off tasks like this when done
[x] Set up GitHub pages for this project at https://dgant.github.io/levelsjam . Use gh and the GitHub credentials in .env. Get a placeholder index.html up and verify it's there.
[x] Create a three.js application using WebGL. Create an initial scene with a 10mx10m cube, using https://www.sharetextures.com/textures/ground/grass_1, an infinite plane of water 1m below its surface, and an infinite plane of https://www.sharetextures.com/textures/ground/ground_14 below that. Use @takram/three-atmosphere and set up basic lighting
[x] Set up first person WASD + mouselook controls. Hold space to add vertical thrust like a jetpack. 
[x] Remove the "Atmospheric flight scaffold" text. Remove "CURSOR / LEVELS.IO JAM". Remove "WebGL ready". Remove "Click to enter"; the game should work without having to click any buttons first. These are all things I didn't ask for, and your instructions are not to add speculative features. Please update your instructions to prevent this kind of error in the future.
[x] The screen is black. Is the default lighting (and potentially exposure?) set up correctly? Find a three-atmosphere example and start from there for known-good parameters.
[x] The player's initial position should be 1 meter above the top of the cube
[x] The cube and the plane below the water should have collision
[x] When I link to a texture source like ShareTextures, I am not telling you to download and use the preview image. It is a page with a link to a PBR texture pack zip, which you should download, extract, and load as a three.js standard PBR material. Go fix the two current materials. Check if the textures have an implied world scale, assume 1mx1m if not implied otherwise, then tile the meshes appropriately
[x] When the character collides with the ground, instead of coming to rest, the character jumps up to a point above the ground and resumes falling in a loop. The character should come to rest on collision with the ground. Assume a 1.75m tall, 0.25m radius capsule for the character.
[x] Use actual three.js water for the water plane: https://threejs.org/docs/#Water
[x] The water plane should be 1m below the top of the cube
[x] The seabed plane should be 1m below the water plane
[x] Player max velocity in the horizontal plane should be 20mph
[x] Player max velocity in the vertical plane should be 5mph
[x] Player max fall speed should be 40mph
[x] Player deceleration should be enough to from top speed to zero within 2m (do the math to get the actual deceleration/frame required)
[x] Player acceleration should be enough to reach top speed after running 8m (do the math to get the actual acceleration/frame required)
[x] Force of gravity should be 1g
[x] Jetpack force should be 1.25g (or net 0.25g after gravity)
[x] Escape, alt, ctrl, command, windows keys should unlock mouse from screen. Any other keypress or mouse click should lock mouse to screen
[x] Put sun at 30 degrees from horizontal.
[x] Switch to AgXToneMapping
[x] Enable Bloom, GodRays, DepthOfField, Lensflare, SSAO, Vignette with default settings
[x] Add an FPS counter to the top right of the screen
[x] pressing ` should open controls for adjusting the main parameters for each of our lighting and visual effects. directional light angle and intensity, on/off switch and intensity for each post processing effect
[] Find a way for you to run a single instance of Vite headlessly in the background instead of repeatedly opening windows, sometimes multiple, that block my screen (this is my desktop computer!)
[] Quadruple deceleration
[] Quadruple acceleration
