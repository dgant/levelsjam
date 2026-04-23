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
[x] Set the default Torch Flicker to 0.15
[x] Set the default Exposure to -4.5
[x] Changing the bloom kernel size has no effect
[x] SSAO still has no visible effect even where it should.
[x] Do N8AO/SSAO have a radius setting? Expose it if so (with units ideally)
[x] Debug panel should mention the units of DOF focus distance/focal length if possible
[x] Implement volumetric lighting like https://threejs.org/examples/webgpu_volume_lighting.html -- expose the fog/smoke amount as debug parameters (plus i assume there's internally a smoke noise frequency we can expose).
[x] Print the Git revision and revision timestamp up by the FPS counter
[x] Player collision is currently setting the player's velocity to zero, but only the velocity's component along the collision normal of the wall to the player should be set to zero (so you can slide along the edge of an obstacle without repeatedly stopping)
[x] Create a maze generator
  [x] The generator creates a random maze. A maze is a grid of cells, with walls in the edges between cells (and not in the cells themselves). A maze must meet all of the following constraints
    [x] Each exterior edge must be a wall except one, which is the maze opening
    [x] Each cell must have at least two open edges
    [x] Each cell must have two paths to the cell inside the opening that share no cells in common (besides the start and end cells)
    [x] Every unwalled edge must, if walled, violate one of these constraints (ie. it should not be possible to add a wall anywhere and still adhere to these constraints)
  [x] After finishing the maze, create a list of unlit cells. Then until the list is empty, remove a random cell with at least one wall, put a light in the cell (adjacent to one of its walls, chosen at random), then remove any cells within unbroken cardinal-direciton line of sight from the "unlit cells" list (ie. we expect the light will light these cells)
  [x] Persist each generated maze in a file. The generated mazes should be source controlled
  [x] Valid maze generation must always take under 100ms
  [x] The test suite must delete any non-passing mazes 
  [x] There must always be five valid mazes. Whenever there are fewer, generate more until there are enough
[x] Delete the existing sconces and random wall-sconce-light-flames
[x] On game load, instantiate one of the available legal mazes at random. Each of the maze's wall gets a .25m x 2m x 2m mesh with the wall material, with shadows and collision enabled. Then for each light, place the sconce-billboard-light assembly against that wall, on the side of the cell it's supposed to be lighting
[x] Reduce reflection probe size to 32x32
[x] Reflections must be captured during offline lightmapping, not during runtime
[x] On page load, the ellipsis animation is still very stuttery, almost as though the process which animates them is blocking on elements of the site loading. There must be minimal load on the main thread or whatever in any fashion that would interfere with smooth animation of the ellipses
[x] Capture shadow maps for the reflection probes and apply them during reflections
[x] Capture volumetric lightmaps for each probe. Replace the IBL lighting with volumetric lightmaps. Apply the shadow maps. In general this whole system should work the same as the reflection probes, and share locations and shadow maps and areas of influence, just for volumetric lightmapping instead of reflections
[x] The lightmap/IBL/reflection intensity checkboxes should be on the same line with the slider like SSR, Volumetric Fog, etc. are.
[x] In the debug settings (and code) replace references to the current lightmaps/IBL with "Surface Lightmap" and "Volumetric Lightmap" as appropriate (use your best judgment)
[x] Move "Show Reflection Probes" above Tone Mapper.
[x] Lens flares are completely invisible at max slider intensity (why is 0.02 the max?)
[x] SSR looks completely wrong. I think you should rip out whatever implementation you have and redo it from a canonical working example, while referencing the documentation.
[x] Volumetric fog looks completely wrong. Reimplement it starting from a canonical working example, while referencing the documentation. Use the probes as the light source for the fog
[x] Add separate tabs in the visual controls for each of the post process effects (SSAO, bloom, dof, flares, ssr, fog). Remove their settings from the default tab. For each tab, include all settings for that post process effect as sliders/checkboxes/dropdowns. Use your best judgment for what would constitute a nice UI for testing out the different values for these, and what ranges would let me use them as intended. Use our current defaults or otherwise reasonable defaults (the settings likely already have defaults you can take). Number each tab so I can choose it via hotkey with numbers 1-9. All settings should be applied immediately on being changed; you have had a habit of making sliders only take effect after disabling/enabling an effect, and you need to avoid that style and make the sliders work instantaneously.
[x] Change these default post process settings (in-game only; baking should not apply any post processing):
Bloom Enabled, 1.0
Bloom Kernel Huge
Bloom threshold 0.7
Bloom Smoothing 0.5
Bloom Resolution 0.25x
Lens Flares Enabled 0.1
Flare Opacity 1.0
Flare Size 0.05
Glare Size 0
Ghost Scale 0
Flare Shape 0.05
Animated off
Flare Anamorphic on
Extra Streaks off
Secondary Ghosts off
Star Burst off
Ambient Occlusion: N8AO
Ambient Occlusion Radius: 1m
Vignette: Enabled, 0.6
[x] Figure out why the reflection probes are black on 4 of 6 sides and fix them
[x] Debug shadow map probes should show a color that's clamp(0, 1, shadow depth / 10m)
[x] The volumetric lightmaps do not make any physical sense right now. The directions the debug probes show light coming from have no correlation with where lights actually are. There's one probe with a bright face pointing towards an outer wall of the maze where no light is coming. One probe with a black face facing a light. I suspect the angles are screwed up. You should test this with a decisive scenario that verifies that volumetric lightmaps capture light accurately from the correct directions, and then apply the light correctly, in the correct directions. Verify that lights are correctly occluded by geometry during volumetric lightmap capture, and that volumetric lightmaps are correctly occluded when applied to geometry
[x] Baked light should apply a physical inverse square falloff with no maximum distance
[x] The light provided by the torches is extremely red, almost monochromatic. Cut the saturation of the light color by 75% and tint it slightly more orange-red than just red. Make sure we are not double-tinting, in the sense of tinting both the baked light and then also tinting the lightmap when we apply it.
[x] New game rules. These supercede all previous player movement/collision rules. Update the spec accordingly.
Minotaur is a turn-based game that takes place on a grid with edges between cells. Game logic should be in a headless rules engine whose updates are published as updates in the 3D three.js world representation.

Cells may contain any number of items and one character, which may be a player or a monster. Players and monsters can move between grid cells that do not have an obstacle (like a wall) between them. Each turn the player moves, then each active monster moves according to that monster's movement rules.

Player controls:
W or up: Move one cell forward in the current camera direction
D or down: Move one cell backward in the current camera direction
A/S or left/right: Rotate the camera 90 degrees in the specified direction. Rotating does not consume a turn.

Animate player and character movement. Each player move or camera rotation should take 250ms. After the player moves, other characters movement animates simultaneously, and their moves also take 250ms. Buffer the player's inputs and consume the next available input whenever it's the player's turn to move. For example, if the player presses W, then before the animation to move finishes, presses A and W, the player should complete their turn, then on their next turn, rotate left 90 degrees and move forward one space in that direction

The player does not have a 3D model. Each other character has a 3D model in public/models:
Werewolf: awil_werewolf.zip -- should be scaled proportionally to fit inside a 1.6m cube and positioned with its bottom center at the bottom-center of its tile
Spider: dopepopes_zkumonga.zip -- should be scaled proportionally to fit inside a 1.4m cube, and (depending on if it's a left-wall or right-wall following spider), rotated 45 degrees and positioned such that it with one side of its base along the wall it's following and the other side along the floor. The goal is to display the spider walking along the left or right wall as appropriate. I'll probably need to correct your initial placement but give it a good try
Minotaur: minotaur.zip -- should be scaled proportionally to fit inside a 1.8m cube and positioned with its bottom 25cm below the bottom-center of its tile

If the player would attempt to move into a cell with a monster, or vice versa, this kills the player, which is implemented by fading to black as the movement animates, then resetting all state of the current maze, putting the player back at their position and direction at the last checkpoint (currently the entrance position fof the maze), then fading back in over two seconds.

After the player moves, each monster moves. They should move in the same order each turn. Monsters can see in any straight line of cells uninterrupted by walls. Each monster begins asleep. If the monster is asleep, and sees the player, it wakes up, which allows it to move on the following turn.
Minotaur: Each of the minotaur's turns, if the minotaur can see the player, it records the direction towards the player. If the minotaur is awake, it attempts to move in the last-recorded direction. If it can not move due to hitting a wall or gate, it goes to sleep.
Spider: Each spider can be either a left-wall or a right-wall spider. Each turn, if the spider is awake, it moves one cell following the (left or right) wall.
Werewolf: On each turn where the werewolf is awake, and if it did not move on the previous turn, it takes one step along the current shortest legal path towards the player. If there are two or more potential cells that would be equally short, it prefers whichever cell would be next along its previous path. If there is no such cell, it prefers moving in the same d irection it was moving in before if that leads to one of the potential cells. Otherwise, it chooses arbitrarily.

Whenever a monster would move, rotate its model to face the direction of its upcoming move (250ms, only if needed), then animate its movement, then turn it to face the direction it would move if it were its turn to move again (250ms, only if needed)

Regenerate the mazes, and give each one randomly placed minotaur, wolf, spider (on different tiles).
[x] Pressing 1 detaches the camera from the player and allows you to move freely with WASD/mouselook controls, with no collisions, with Q to go up and E to go down
[x] Add a credits modal which appears when you press C and closes when you press any key. It should feature a centered header "Credits" followed by a the following (with more to be added later):
  [x] "Minotaur" (https://skfb.ly/6TK77) by yanbelmont is licensed under Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/).
  [x] "Dopepope's zKUMONGA" (https://skfb.ly/pIBZW) by AllThingsSaurus is licensed under Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/).
  [x] "AWIL Werewolf" (https://skfb.ly/orBtB) by Spinnee is licensed under Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/).
  [x] "Head of a Bull" (https://skfb.ly/6TOXX) by Kirk Hiatt is licensed under Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/).
  [x] "Metal Gate" (https://skfb.ly/oK7QR) by i bull your wife is licensed under Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/).
  [x] "Bronze Sword Mycean" (https://skfb.ly/6RZxG) by Ryoce is licensed under Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/).
[x] Set FOG_EXTINCTION_SCALE to 1.0
[x] Set the Fog Lighting Strength slider range to 0 - 2.0
[x] I would expect SSR to only apply reflections to reflective surfaces, with some appropriate respect for specularity/metalness/roughness, but instead it seemt to apply to EVERYTHING, even the sky. Figure out how this is supposed to be correctly applied, referencing both a canonical example, the documentation, and the source code, and then do it.
[x] Bloom has very nasty banding. See if there's a principled elegant fix to this. Keep it simple, if so.
[x] Right now lens flares are always impossible to see even with jacked-up settings. So revert the lens flare changes from the last batch of changes, and start again. We want to ensure that lights behind walls or monsters are not candidates for lens flares. Billboards and sconces should be ignored and not ray-tested.
