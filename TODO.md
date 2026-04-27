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
[x] Revise the controls: W/up is forward, S/down is backward, A/left turns left, D/right turns right. Allow arrow keys for the drone controls as well. Swap Q/E for drone controls
[x] Tilt the normal camera angle five degrees down from horizontal.
[x] New default volumetric fog settings: Enabled, 1.0 intensity, 12m distance, noise frequency 10m, noise strength 1.0, lighting strength 1.0
[x] Fog height falloff should be denominated (and implemented) in meters per 50% dip in fog intensity, and the slider should range from 0.01m to 8m
[x] Any non-zero amount of bloom instantly results in color banding, even when the threshold is so high that no bloom should be occurring. I suspect enabling bloom is forcing all scene colors to go through a reduced color depth bottleneck. Fix it.
[x] If the player attempts to move into something that would block their movement (like a wall, but not a monster), animate them moving 50% of the way towards it and back into place, with a sinusoidal motion, animated over 250ms, but do not cause a turn to elapse; the player gets to keep trying to make a legal move.
[x] The FPS drops are *undoubtedly* due to the character model complexity. I can turn my camera towards the minotaur and watch the FPS drop from 144 to 20, then go back to silky 144fps when I look away. Simplify the minotaur to 10k triangles using an automated, principled approach that you would deem a wise choice for simpifying a detailed a character model. Replace the spider with pbr_jumping_spider_monster.zip (and add credit "PBR Jumping Spider Monster" (https://skfb.ly/6QVNq) by Toast is licensed under Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/))
[x] The werewolf model is scaled too small and positioned too low, clipping into the floor. Revisit the requirements, inspect the dimensions of the werewolf, adn re-scale and re-position it so it fits the required size and sits on the floor instead of clipping through it
[x] The volumetric lightmaps look correct and appear to be applied correctly. But the rgbe surface lightmap still shows the frac() style banding. When applying the surface lightmaps in 003, even with surface lightmaps at 4x and exposure at -8, all the walls are solid black (while the sconces are blown out). I suspect the walls are not receiving the lightmaps at all, and the surface lightmaps are still getting their upper bits cropped or frac()ed or something. Fix both.
[x] Double-clicking a debug setting name should reset just that setting, not the whole tab
[x] Lens Flare Opacity to 0.1
[x] Lens Flare size to 0.01
[x] Lens Flare shape to 0.03
[x] Bloom to 0.65
[x] Bloom  threshold to 0.5
[x] Fog Height 50% to 0.5m
[x] On failed move, move the camera 25% of the way toward the destination instead of 50%
[x] Make the principled changes you recommended to properly occlude volumetric lightmaps when sampling them for both surface lighting and fog lighting. Do not ever use the environment light for volumetric fog. In fact don't use an environment light at all except when baking.
[x] Do not fade out the intro screen until the basic textures are loaded
[x] Load lightmaps in order of ascending distance from the player's position
[x] Anywhere we have fallback logic for the asbence of lightmaps, fall back to black, never an environment light. The environment light should not be used in-game for anything ever; it is only for use during baking
[x] New maze element: Gates. After creating the layout of the maze, insert four gates at random open edges. Before the player moves, lower each raised gate adjacent to the player as long as there is no monster on the other side of the gate. After the player moves, raise all gates that are not already raised. Monsters can not move through a raised gate and treat it as a wall for movement, but not for vision of the player. Depict the gate via the model in metal_gate.zip, flipped upside down, scaled proportionally to fit the full 2mx2m of a cell. When opening gates, if any need to be opened, animate them going from underground (top just below the ground) to above ground (bottom flush with the ground) over 250ms, and vice versa for gates closing. Also replace the gate model's excessively large PBR textures with 512x512 versions and ensure the gate materials use those and do not load the giant textures it ships with
[x] New maze element: Sword. Generate each maze with a sword in a random unoccupied cell. The sword uses the bronze_sword_mycean.zip model and should be proportionally scaled to be 1m long. The sword mesh starts out with its tip down, a few centimeters below the ground. When the player enters a cell with the sword, if the player is not currently holding a sword, the player picks up the sword. Depict a picked-up sword by removing the model from the ground and attaching it to the player, positioning it in a way that looks (in first person)  like the sword is being held by the player, such that the handle is roughly 1m below and 0.5m to the right of the camera and 0.25m behind the camera, and the tip is one sword-length away pointed towards the point that is 2m in front of the player. If the player would intersect a monster and die, instead the monster dies and the sword is removed. Animate this with the death fade animation, except fade to white instead of black, and when the screen reaches white remove the first-person sword mesh
[x] New maze elephant: Trophy. Position the trophy at an unoccupied tile furthest fron the entrance by path distance. Like the sword, the trophy is represented by mesh on the ground (head_of_a_bull.zip), scaled proportionally to be 0.5m tall, and the player can pick it up by moving into its cell. A picked up trophy is positioned alongside the player, like the sword, except in the left hand, and pointed up instead of forward
[x] As a general policy, it is important to optimize for server startup and game startup, so ensure that any calculations that should be done offline (like maze generation, file publishing, any manipulation of model or texture files) is done offline. Don't go crazy with it; just use a principled approach and good judgment to review each step of server/app startup and strive to do it offline instead.
[x] Whenever the minotaur moves, initiate a mild screen shake effect that scales in intensity inversely with the minotaur's distance, that lasts for 1s
[x] A necessary step in the maze validation process should be ensuring that the maze is beatable. To beat a maze, the player must acquire the trophy and then exit the maze holding it. Design an agent which plays the game according to the same rules as the player (with monsters moving in between turns the same way, etc.) and which attempts to solve the maze, having access only to information that would be visible to the player, ie. only seeing the contents of cells that would be visible by line of sight to the player. The agent can use heuristics as good as you deem fit. A map should be solvable with no more than 4N moves, where N is the fastest possible route, ignoring monsters, from the player's initial position, to the trophy position. Record the agent's successful path.
[x] If a map fails validation, create a new one until the output is a valid maze
[x] Monitor and benchmark performance of the maze creation process. Mazes should take no longer than 5s to create and validate; if they take longer, optimize the process
[x] Add a debug tab called "Solution" with a "Replay solution" button which resets the maze state, then disables the player's game controls, and takes over the player's character by replaying  the pre-recorded successful path from the validation agent. The goal is to let the player see what a successful solution looks like
[x] Ensure we have a general capability to load, unload, and reset mazes on demand, including purging their assets (like lightmaps and meshes) from memory. Loading and unloading are each two-step processes: First we load the data for a maze (including assets that need to be loaded to the GPU), and then we instantiate its geometry and game objects in-game, and then we can unload that geometry and game objects, and then lastly unload the data for the maze. The goal is to be able to create a full game by loading and unloading just the maps we need to render at any time, while pre-loading maps we may soon need and then actually instantiating them as needed. A successful test of this capability would be the loading and instantiation and uninstantiation and unloading and re-loading and re-instantiation and and re-uninstantiating and re-unloading of multiple mazes, interleaved.
[x] Monitor our high water RAM and VRAM usage so I can ask questions about it
[x] Scale up the minotaur model by 1.5x
[x] Fog noise: The noise should also be sampled along a time dimension, with a Fog Noise Period slider from 0-10s, defaulting to 5s
[x] Lens Flares: Find a way to support up to 5 simultaneous lens flares. Apply them additively
[x] Would it be more performant and reduce burden on sampler limitations for each maze's volumetric lightmaps to be atlassed together? If so, or if it's not clear either way, do it.
[x] When you run npm run dev the first thing it does is... process/copy some maze files? Surely this is something that can be done during maze generation instead, to speed up server startup time, right?
[x] A crucial smoke/performance test would be to load the page, do "Replay solution", then watch the solution play all the way out until the player successfully exits the maze, and watch it maintain our target fps (currently 144) the whole time (on GPU), with no cheating or hacks. Accept an average FPS that's at least 85% of the target and if less, optimize until hitting it or at least figure out and document exactly where the time is going and why.
[x] The intro screen must not fade out until all general assets are loaded, and all surface and volumetric lightmaps within 12m of the player's starting position have loaded.
[x] The intro screen ellipsis animation should go from . to .. to ... to [blank] but I think it just oscillates between .. and ...
[x] Volumetric lightmaps are being applied to fog but not at all to surfaces. The probes look correct.  But even with volumetric lightmap influence at 4x and exposure at -20, everything is completely black. Reflection probesare also not being applied to surfaces whatsoever
[x] The monster meshes with reduced triangle counts have a ton of holes in their topology now. You can see through them. Re-apply the tasteful reduction of triangles, but preserve the continuous surfaces so that UVs and normals remain similar and the mesh does not gain any new holes
[x] The interpolated volumetric lightmaps, as applied to volumetric fog, is discontinuous in cells adjacent to the edge of the maze, having hard seams that go directly through the probe locations. Find a principled way to interpolate light maps and their shadows that avoids this discontinuity.
[x] Fog Noise Period doesn't seem to do anything. There is no change in the fog over time
[x] Position the sword mesh upside down
[x] With reflection debug probes enabled, only the eight probes nearest the start position are visible. Several of the shadow map and volumetric lightmap probes are missing, especially the ones furthest from the start position. Given that volumetric lighting and reflections are both not working, i suspect these are all connected somehow. SOmewhat tangentially, consider (with freedom to choose either way) atlassing the reflection probes like we do the volumetric lightmaps and shadow maps
[x] Revert all changes you made to the torch billboard texture and loading. They look terrible now and we don't need to save the 4MB that badly
[x] Increasing the lens flares intensity brightens the entire scene even when no lens flares are visible. I think in achieving multiple lens flares you are incorrectly compositing them. When I said I want the multiple lens flares to be additive, I want the flare contributions to be additive to one another, not for the lens flare pass to add the scene's previous color to itself multiple times which I presume is what's happening.
[x] The gates are working correctly mechanically in the rules simulation, but are not animating correctly.
  All gate state changes must be animated. The gate animation can happen in parallel with other animation
  SOme examples of how this works:
  Suppose every cell on the map is surrounded by gates.
  The player starts their intitial turn. There are no monsters here. Before the player moves, all gates surrounding the player should be open. Any gates that were closed, should become open (in the game state), and thus any gates that were closed and are now open, should animate as open  (sliding down below the ground).
  The player moves. Except for the gate between the previous cell and the current cell, all gates that were adjacent to them before should now be closed. Since they were previously open, they must now animate to closed (sliding up from underground)
  Two examples of how t his is NOT currently working:
  - Player moves into a cell with gates. There are no monsters nearby. The gate still appears to be closed, even though the player can move through it
  - Player is in a cell with gates. The gates erroneously appear to be closed. The player takes a step backwards. During the player's movement, the gates vanish, then suddenly reappear when the player arrives.
 These are a lot of words but don't overcomplicate it: Player moves cause gates to open and close, and these state changes must be animated by gates sliding up and down. That's all.
 [x] The sword and trophy each vanish after the player picks it up. I do not know if it is invisible, shrunken, or simply placed somewhere nonsensical. REview the rules about how to position the sword and trophy while the player is holding it and enforce it.
 [x] The minotaur is currently unable to follow the player around corners. It seems like once the player rounds a corner, the minotaur goes to sleep, even if it has line-of-sight of the player
 [x] When a minotaur or werewolf is awake, it should always be facing the player, including during either of their movement animations`
 [x] "Replay solution" should reset the whole maze before replaying the solution
 [x] Add a Vignette tab to the debug window, move the vignette controls there, and add Vignette Noise Period and Vignette Noise Intensity (and apply them) and a Exposure Noise Intensity. Default the intensities to zero for now. The idea is to create a nervous flickering effect
 [x] Double the monster screen shake intensity
 [x] Apply DOF before bloom and after the billboard pass
[x] Add a camera FOV slider to the debug controls, going up to 120
[x] The camera fade when slaying a monster should be 125ms in, 125ms out. And right now it fades to white, then jumps to black and fades back to the camera view. That jump to black shouldn't exist; it should just fade white and back
[x] Let's clamp down on our sampler counts. As a rule, let's say our PBR materials must use multichannel ORM (Occlusion, Roughness, Metalness) textures. Enforce this as a rule for all materials going forward including materials imported from models. At development time, when preparing models for use in the game, combine their textures and ensure the textures are no larger than 1k each. Each maze should attempt to have only one volumetric lightmap atlas, one surface lightmap atlas, and one reflection atlas. We are only applying an environment map during bake time, so do not employ it for materials during runtime.
[x] Vignette noise should be sampled every frame from a continuous noise source. Right now it jumps every second or so
. The intensity should be additive on the base vignetting on base intensity + [0, 1] * noise intensity
[x] There are still very strong hard seams in volumetric lighting along the axes of the probes; on each side of the probe the lighting completely changes. The volumetric lighting needs to be continuous.
[x] Split the volumetric lightmap slider in two: Dynamic Volumetric which affects non-lightmapped objects, and Static Volumetric which affects lightmapped objects. By default, Dynamic Volumetric is enabled at 1.0, and Static is default disabled at 1.0
[x] Divide torch point light brightness by 5 (and re-b``ake)
[x] Torch billboards should blend additively, adding to the background scene color rather than replacing it.
[x] Monsters should move by sliding over 250ms, just like how the player slides.
[x] Don't buffer commands repeatedly when a key is held; require a keyup before accepting another keydown
[x] Limit the number of buffered commands to 10
[x] Increase the spider's size by 1.5x. Make sure they are positioned such that their bottom point, post-scaling and rotation, is on the floor and their legs, which are lifted up by their rotation, are up against the wall.
[x] Animation on killing monster: Fade in/out of a (0.5, 0, 0) red instead of white, 125ms in and 375ms out
[x] Animation on being killed by monster: Fade in/out of black, 125ms in and 1s out
[x] Kill/being killed animations: Apply them before vignette (so vignette is added on top of them)
[x] When gates lower for the player, they never appear to raise again. Both in rules and in animation, gates the player is not adjacent to should be closed
[x] The maze solving agent should not be allowed to move backwards, only forwards. This should have no impact on the agent's ability to solve the maze (since turning is free) but will result in much more watchable solution replays (watching the agent walk backwards the whole way is confusing
[x] If the player buffers one or more turn commands after a move command, and before any other forwards/backwards commands, start animating the turns immediately. If a player commands a right turn while a left turn is animating, or vice versa, immediately reverse the turning direction towards the subsequent turn. The player should wind up facing where they were going to face anyway; the goal is to make the turning more immediately responsive
[x] When generating a maze, begin the torch placement process by placing a torch on each cell with pickup item (sword, trophy)
[x] ALL PBR models should be using combined ORM textures. Right now the gates aren't and possibly others. Dissect the GLTFs or other models however you need; there is no reason we need to use the original data format if it's inconvenient
[x] Add a debug flag for an unlit mode that replaces all lighting with a 1.0 ambient light in all directions
[x] Gates are disappearing when Dynamic Volumetric is enabled (presumably sampler count). They should 
[x] The point lights are casting some inappropriate shadows as captured by surface lightmapping. They are correctly casting shadows on their own wall (though I suspect the billboards are also casting a shadow; make sure they're not), but then the shadow that the sconce should cast on the floor is instead being cast on the floor of the cell behind the point light. The point light is also casting a small circular shadow on the middle of the parallel wall one cell behind its wall , and a large circular shadow on perpendicular walls of the cell behind its wall. In general it is darkening -- but seemingly not lighting? the whole cell behind the wall it's on, like the whole shadowmap is being applied flipped 180 degrees
[x] The new camera rotation logic is discontinuous; if you move and then turn during the move, the camera turns once, jumps back to forward, then turns again, as if the rotation is applied twice
[x] The sword and trophy, once picked up, are still not visible from the player's perspective. Review the ruels about positioning them
[x] Increase camera FOV to 80
[x] Divide the light strength by 10
[x] Instead of using the probe shadow map system, volumetric lightmaps should be interpolated such that probes separated by a wall from the evaluated position contribute zero weight. So for a cell that is surrounded by walls, that cell's volumetric lightmap would apply at a 1.0 to all points inside the wall. For two cells that are connected but otherwise surrounded by walls, the contribution would go linearly from 100% A at the center of cell A to 100% at the center of cell B.
[x] Delete the probe shadow map system
[x] On wall meshes, scale the UV of the short sides so the texel size matches the square faces, and lightmap them
[x] Wherever two walls of a maze meet at an obtuse corner (ie. 270 degree corner) and there are no other walls at that intersection, put a square wall mesh in the corner where they would meet, filling in the space between them to create one neat 90 degree corner. Asw ith the short-side wall meshes, scale the UVs here so the wall material continues neatly and proportionally from the adjacent walls. Lightmap these
[x] For each side of each gate, at the corner between cells, add a cylinder mesh to represent half the doorway, Make it the same height as the walls, with radius 0.0625m, its bottom face flush with the floor. Use the same material as walls, scale its UVs so its texel density matches the walls. Include it in lightmapping.
[x] Double check if the spider pathing makes sense. The spider follows the same movement rules as other monsters, but once awake the direction it chooses to move is always following its preferred wall. So a left-wall spider will always turn and move left if possible, otherwise straight, otherwise turn and move right, otherwise turn and go backwards, and vice-versa for a right-wall spider
[x] Create a collection of 1k images to use as decals of wall paintings. These will go on the 2m x 2m wall faces. They should be in the style of Minoan frescoes, look badly worn/chipped/water damaged but still legible, and have worn, uneven edges with transparent backgrounds, such that when placed on a wall do not just have a hard edge at the end of a wall. They should be in faded color, and should share a consistent style. The paintings should depict:
  [x] Teenagers being being tossed in the labyrinth
  [x] Teenagers cowering before a fearsome minotaur
  [x] A young man holding a severed minotaur's head in front of a broad bowl on an altar, with an unlit torch above it; then, in a successive frame, the same scene, but the young man has placed the minotaur's head in the bowl, and the torch is lit with a blue flame
  [x] The same young man slaying a minotaur with a Greek sword
  [x] Multiple scenes of the same young man being hunted by a wolf
  [x] The young man escaping a minotaur that is trapped behind a grid-shaped metal gate
  [x] The same young man sitting atop a throne on a high platform, a sword held upwards in his hand, a pile of minotaur skulls at his feet, and a courtly audience looking up at him
[x] During maze generation, place a random painting decal on 1/5th of the wall faces. These should be rendered during baking, especially so they are captured in reflections
[x] Default fog noise frequency: 0.25m 
[x] Default fog noise period: .75s
[x] Default fog height: .4m
[x] Default fog intensity: 0.4
[x] Fog ambient color: #2c2c68
[x] Fog intensity 0.75
[x] Vignette noise intensity is still causing vignette to be updated only every second or so. The noise function and its application should be continuous, every frame
[x] Once again, the "Replay solution" button must reset the character and maze state, because obviously replaying a solution from any other state is going to fail
[x] Level loading
  We are going to start loading and unloading levels (the general category which includes mazes) dynamically during runtime. The important considerations are minimizing concurrent VRAM usage by unloading unused baked data, maximizing FPS by not drawing areas the player can't see, and ensuring that we do this smoothly so that players never observe evidence of the process happening: they should never see levels popping in, and should not notice any performance stutters while loading or unloading levels. The state of the levels should not be lost; for example, the positions of monsters and objects from each level should be preserved even if a level is unloaded and reloaded.
  I will provide a plain English specification for levels and the levels that connect to them in LEVELS.md. You should use this English specification to populate a data formatted specification of the maze, to be used by the maze baking process. You will need to find a way to smartly fit and orient the levels such that you can infer their relative positions and orientations from the spec, while ensuring that the exits of levels line up with the exits of adjacent levels, and that levels are correctly oriented to achieve this. The maze's orientation should be known and used at baking time such that we can add a directional light (moonlight) later
  Each time the player enters or is teleported to a level, load that level, and all levels adjacent to it, while unloading all other levels. When jumping levels, fade the camera to black, then un-fade it only once the level has been loaded.
[x] Pressing escape opens up a modal menu that displays the names of the levels in order. Clicking on a level name loads that level, resets its state, then teleports the player to its entrance. Pressing escape while the menu is open closes it.
[x] The Entrance and Chamber 1 levels don't seem to exist? When I choose to teleport them, the game teleports me to one of the numbered maze levels
[x] When the game begins, the player should begin in Entrance
[x] The new corner wall tiles are double the width and length they should be. One of the corners is correctly placed, but the others are too far away, causing the wall piece to overlap the walls and z-fight
[x] The new corner wall tiles are extremely bright, receiving too much light from surface lightmapping somehow
[x] The decals should be lit, receiving light the same way as the walls they're on
[x] My intent was for you to generate the wall paintings with one of OpenAI's excellent text-to-images models, like ChatGPT Images 2.0 which was just released. Please replace them with images generated with that. OpenAI key is in .env
[x] Sword and trophy are now appearing reasonably correctly attached to player model. Flip the orientation of the held sword (the handle is where the tip should be and vice versa), and pull it back behind the camera just a bit so it fits entirely within the player's cell (so it won't clip through walls). Move the trophy so that its screen position is further down and to the left.
[x] Don't place decals on walls with lights
[x] During maze generation, monsters should be rotated to face a cell they can legally move into (if one exists). Prefer the cell with the shortest path to the entrance. Spiders should be turned to face the next cell they would move into while following their wall
[x] The game currently prohibits players from leaving levels, as if the entrance has an invisible wall. There should be no such prohibition.
[x] Rename "Volumetric Connectivity" to "Volumetric Occlusion"
[x] The static/dynamic volumetric lighting are both surprisingly bright. Even at 0.05x intensity it contributes more light than the surface lightmaps do. This has been true for a while now; it's not new. I'm not opposed to just multiplying it as needed to get a desirable result, but it would be nice to know exactly why the intensity scale is so different. Investigate and let me know what you find out
[x] The intro screen ellipsis animation appears to be going "" ".." "..." and skipping "." It should have all four states, in order. Double the animation speed.
[x] Decals are upside-down
[x] Sconces are hard black, not appearing to receive any light at all
[x] Implement precomputed visibility, whereby for each cell in a maze we determine at generation or bake time which other cells could be visible from some point in that cell (treating walls as occluders), and only render geometry that passes the visibility check. Always render Minotaurs that are within 5 tiles of the player (because they are tall and visible over walls). Add a toggle for using precomputed visibility in the debug settings. This is a critical system for performance and good player experience so think carefully about how to do this well.
[x] Some rules to enforce:
  [x] Levels should only spawn floor meshes for their own cells. Do not spawn any other floor meshes
  [x] The outer faces of each level do not need lightmapping, because we do not expect they will ever be visible to players, and thus we should omit them to save on VRAM/download time
  [x] Level adjacencies exist in a directed acyclic graph starting with Entrance. Each level adjacency must be represented by a single cell passageway, belonging to the destination level, open to the previous level on one side, open to the next level on the opposite side, with a wall on each of the adjacent sides. Each level's player starting position (besides Entrance) must be this cell, facing into the destination level
  [x] A level's cells must never overlap with another level's cells. And each level's walls must not be shared with any other level's walls. If this happens it is an error in the level design that must be corrected in the level design. Use good judgment in resolving these. If it is due to a long hallway like Chamber 1 connecting to multiple mazes, the hallway probably should be longer to neatly fit the mazes.
[x] The precalculated visibility does not appear to be working at all. Inside Chamber 1, every single tile of the four adjacent levels is simultaneously visible. Toggling Precomputed Visibilty has no effect. 
[x] Precomputed visibility: Because precomputed visibility is only a cell->cells mapping inside a single level, we need a way to ensure that cells in levels adjacent to the current level are rendered if necessary. To achieve this: If the player's current cell's precomputed visibility has one of the level's entrances/exits flagged as visible, also render the cells that are precalculated-visible from the adjacent level's entrance. For example, if level A and level B are connected, and the player is in A, and the cell of A that is adjacent to B is visible, also render all cells visible from the cell that is B's side of the A-B connection. 
[x] Do whichever will produce the best performance: The floor of a level should be a single quad and always rendered any time that level would be rendered; or, each cell's floor is a single 2x2 quad centered in the cell and is included in precomputed visibiltiy
[x] Minotaurs should be rendered EITHER if their cell is included in precomputed visibility OR if within 5 cells of the player
[x] Right now there's a large noticeable stutter and visual glitching at the moment the player moves between rooms. This should not happen; any work that would need to be done should be done well in advance. This might entail, on game start, queuing that work up asynchronously so it's ready when players need it. Think about the work that needs to be done and figure out a way for it to be done before it's needed so players can move back and forth between levels seamlessly.

[x] Current bugs:
  [x] Sometimes held pickups will randomly appear attached to the player then disappear. This suggests a design flaw, as there is nothing in the game whose correct implementation should even accidentally result in this
  [x] "the ideal long- term architecture is per-level resident lighting/probe data so even lighting bindings do not need to churn at boundary crossing" Whenever you think something is the ideal long-term architecture, it's also the ideal short-term architecture because it will reduce the time we waste on bugs, and you should just go do it immediately. Go do this one immediately.
  [x] The floors of maze 1-4 are not rendering correctly. The floor pieces do not appear aligned to the cell grid as they should be. So many cells have 1/4 to 3/4 of the floor present, and 1/4 to 3/4 missing. This is probably due to precomputed visibility, because disabling precomputed visibility makes all the floors appear.
  [x] The lightmaps of levels adjacent to the current level are not reliably working. From Chamber 1, maze-001 is totally unlit until the player actually walks in, and likewise the werewolf of maze-003.
  [x] Enter level -> Click "Replay solution" -> It replays -> Walk back into level -> Solution automatically replays again. Once replaying a solution is done, it should not begin again just due to re-entering the level
  [x] The intro screen sometimes terminates before everything's ready to render. Shader compilation, perhaps? VRAM memory loading? You figure it out, because the result is the player seeing a screwed-up view with things popping in. It's immersion breaking and confusion. The loading screen must not end unless absolutely everything is already ready to render.
[x] Before each monster moves, if it's going to move, it should turn to face the direction it will move in. If turning is required, it should be animated over 250ms. The actual move should have the monster mesh slide from the origin to destination tile over 250ms. Then, before the player's turn, each monster should, if it's awake, turn (animated) to face the next direction it would move if it were to move right now.
[x] I walk into maze-005, and walk over the sword to pick it up, and the mesh disappears from the floor but no sword appears to be picked up. Fix that
[x] Revert the previous changes related to player turn commands executing simultaneously with move commands. Moves and turns should be separate and distinct
[x] Remove the cylindrical meshes associated with gates
[x] Shrink the gate mesh proportionally so that instead of being fully 2m wide, it's the width between two parallel walls (ie. 2m - however thick we made the walls)
[x] When a gate lowers, lower it 1.5m (so it should be sticking partway out of the ground)
[x] Make the base tint of the minotaur #2b2130 instead of the current 0.5
[x] Start a new game. Move forward three times. After we watch the animation of the third move, in which we slide into the entrance of the next room, the camera suddenly jumps back to the previous tile, then jumps back to the current tile. This is incredibly disorienting and jarring and we need to fix it. The most likely culprit is that the player has moved across a level transition, but there is no good reason for the player's position or camera position to be involved in this transition. If I had to guess, the implementation of crossing levels is done by moving the player in world space (which would be bad) instead of just spawning the levels where they need to go to be correctly connected to one another.
[x] The volumetric lightmap sampling appears to still be discontinuous, which must be fixed. I'm standing in Chamber 1, in the center, at the row where maze-002 and maze-005's entrances are, and both the fog and static volumetric lightmaps have hard seams along the cell axes (ie. the seams are not between cells, but right down the middle).
