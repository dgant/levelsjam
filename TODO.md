[x] Check off tasks like this when done
[x] Set up GitHub pages for this project at https://dgant.github.io/levelsjam . Use gh and the GitHub credentials in .env. Get a placeholder index.html up and verify it's there.
[x] Create a three.js application using WebGL. Create an initial scene with a 10mx10m cube, using https://www.sharetextures.com/textures/ground/grass_1, an infinite plane of water 1m below its surface, and an infinite plane of https://www.sharetextures.com/textures/ground/ground_14 below that. Use @takram/three-atmosphere and set up basic lighting
[x] Set up first person WASD + mouselook controls. Hold space to add vertical thrust like a jetpack.
[x] Remove the "Atmospheric flight scaffold" text. Remove "CURSOR / LEVELS.IO JAM". Remove "WebGL ready". Remove "Click to enter"; the game should work without having to click any buttons first. These are all things I didn't ask for, and your instructions are not to add speculative features. Please update your instructions to prevent this kind of error in the future.
[x] The screen is black. Is the default lighting (and potentially exposure?) set up correctly? Find a three-atmosphere example and start from there for known-good parameters.
[x] The player's initial position should be 1 meter above the top of the cube
[x] The cube and the plane below the water should have collision
[x] When I link to a texture source like ShareTextures, I am not telling you to download and use the preview image. It is a page with a link to a PBR texture pack ip, which you should download, extract, and load as a three.js standard PBR material. Go fix the two current materials. Check if the textures have an implied world scale, assume 1mx1m if not implied otherwise, then tile the meshes appropriately
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
- The items below remain unchecked until the implementation lands and the docs can be verified against code.
[x] Find a way for you to run a single instance of Vite headlessly in the background instead of repeatedly opening windows, sometimes multiple, that block my screen (this is my desktop computer!)
[x] Quadruple deceleration
[x] Quadruple acceleration
[x] Benchmark startup time and figure out why it takes so long for the viewport to be active
[x] Benchmark test duration and instruct yourself to investigate any time it regresses. You are responsible for keeping test duration fast. Unit tests should be under 20 seconds and e2e tests should be under a minute.
[x] The atmosphere sun info should be driven by the actual sun
[x] Add a sun rotation slider too
[x] Add a sky light intensity slider and default the sky light value to the same
[x] 10x the water and seafloor size
[x] Follow your suggestions for improving load time of the EXRs
[x] Add tonemapper selector to the ` view
[x] The sun elevation and rotation controls are reversed; elevation controls rotation and vice versa
[x] Set the default sun intensity to 10 and the slider range 0-100
[x] Convert the proxy sun mesh to support god rays but otherwise not affect the appearance of the scene, so only three-atmosphere's sun is visible
[x] Make the player's horizontal velocity scalar and apply it in the direction of their camera
[x] Treat any component of the player's movement input that's going against their velocity as *deceleration*. So if you hold W while facing the direction directly opposite your velocity, the movement should be applied via the deceleration rate rather than the acceleration rate.

[x] Remove three-atmosphere. Remove the water and directional light. Instead use a cubemap texture as a skybox, IBL source, and environment map for reflections. Use https://polyhaven.com/a/overcast_soil to start with.
[x] Add a loading screen: Centered h1: "MINOTAUR". Centered h2 below that: "Entering the labyrinth..." with the number of dots rotating between 1, 2, 3, 1, 2, 3... changing every .25 second. When all assets are loaded, fade out the text and fade in the viewport over 2 seconds.
[x] Set the initial camera angle to be horizontal

[x] Replace the scene. The new scene:
  [x] A large upward-facing plane at (0, 0, 0) using the PBR textures from https://www.sharetextures.com/textures/ground/puddle-ground. 
  [x] Get the cubemap texture from https://polyhaven.com/a/overcast_soil and use it as a skybox, IBL source, and environment map for reflections.
  [x] 10 randomly placed walls, 2m tall by 4m long by 0.5m wide, using the PBR textures from https://www.sharetextures.com/textures/wall/stone-wall-29. The walls should all have their bottoms at Y=0 , and be placed at a random XY location within +/- 10m of the origin in the X and Z dimensions. Player should collide with these walls
    [x] Each wall also has a wall sconce, formed by adding a hemisphere with .25m radius (a sphere with the top half cut off), using the PBR textures from https://www.sharetextures.com/textures/metal/metal-13
    [x] Sitting on top of the wall sconce is a camera-facing billboard, .125m square, showing this 6x6 flipbook in a 4-second loop. The flipbook is unlit, at 1500 candelas
    [x] Positioned at the center of the billboard is a shadow-casting point light, with intensity = (0.5 + 0.5 * noise)  * 1500 candelas, with distance (0.5 + 0.5 * noise) * 10m. Use an appropriate color temperature for a sconce fire.
  [x] In the debug view, remove any obsolete controls, and add multipliers for IBL intensity and torch candelas
[x] Remove GodRays
[x] Replace SSAO with n8ao
[x] Replace Bloom with postprocessing Bloom
[x] Replace DOF with postprocessing DOF
[x] Include SSR
[x] Disable Bloom, DOF, LensFlares by default
[x] "Entering the labyrinth" should keep a consistent total width while animating so the text doesn't slide around
[x] Enable shadows within a fixed radius of 40m
[x] Double the speed of the light flickering
[x] Enabling SSR makes the HDRI skybox extremely bright. I am confused why SSR would even affect the skybox
[x] 8x the fire animation speed.
[x] The fire billboards are positioned well above the sconce instead of right on top of it.
[x] 4x the size of the fire billboard
[x] Set a neutral do-nothing exposure to be 0.0 and make the slider go +/- 20 stops from there
[x] Give the torches a brightness of mix(1, noise, flickering) * intensity where intensity and flickering are sliders
[x] None of the sconces are visible, though they are casting shadows
[x] SSR dosn't appear to be doing anything. Fix it.
[x] N8AO doesn't appear to be doing anything. Fix it.
[x] Add a dropdown to choose between the working AO modes that are easily available in the current stack, including N8AO and SSAO, and an intensity slider. Make sure to actually connect these and verify that they are working
[x] To save space in the settings menu, put each value, label, and slider on the same line, in that order
[] Set the default Torch Flicker to 0.15
[] Set the default Exposure to -4.5
[] Changing the bloom kernel size has no effect
[] SSAO still has no visible effect even where it should.
[] Do N8AO/SSAO have a radius setting? Expose it if so (with units ideally)
[] Debug panel should mention the units of DOF focus distance/focal length if possible
[] Implement volumetric lighting like https://threejs.org/examples/webgpu_volume_lighting.html -- expose the fog/smoke amount as debug parameters (plus i assume there's internally a smoke noise frequency we can expose).
[] Print the Git revision and revision timestamp up by the FPS counter
[] Player collision is currently setting the player's velocity to zero, but only the velocity's component along the collision normal of the wall to the player should be set to zero (so you can slide along the edge of an obstacle without repeatedly stopping)
[] Create a maze generator
  [] The generator creates a random maze. A maze is a grid of cells, with walls in the edges between cells (and not in the cells themselves). A maze must meet all of the following constraints
    [] Each exterior edge must be a wall except one, which is the maze opening
    [] Each cell must have at least two open edges
    [] Each cell must have two paths to the cell inside the opening that share no cells in common (besides the start and end cells)
    [] Every unwalled edge must, if walled, violate one of these constraints (ie. it should not be possible to add a wall anywhere and still adhere to these constraints)
  [] After finishing the maze, create a list of unlit cells. Then until the list is empty, remove a random cell with at least one wall, put a light in the cell (adjacent to one of its walls, chosen at random), then remove any cells within unbroken cardinal-direciton line of sight from the "unlit cells" list (ie. we expect the light will light these cells)
  [] Persist each generated maze in a file. The generated mazes should be source controlled
  [] Valid maze generation must always take under 100ms
  [] The test suite must delete any non-passing mazes 
  [] There must always be five valid mazes. Whenever there are fewer, generate more until there are enough
[] Delete the existing sconces and random wall-sconce-light-flames
[] On game load, instantiate one of the available legal mazes at random. Each of the maze's wall gets a .25m x 2m x 2m mesh with the wall material, with shadows and collision enabled. Then for each light, place the sconce-billboard-light assembly against that wall, on the side of the cell it's supposed to be lighting
