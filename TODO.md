[x] Check off tasks like this when done
[x] Set up GitHub pages for this project at https://dgant.github.io/levelsjam . Use gh and the GitHub credentials in .env. Get a placeholder index.html up and verify it's there.
[x] Create a three.js application using WebGL. Create an initial scene with a 10mx10m cube, using https://www.sharetextures.com/textures/ground/grass_1, an infinite plane of water 1m below its surface, and an infinite plane of https://www.sharetextures.com/textures/ground/ground_14 below that. Use @takram/three-atmosphere and set up basic lighting
[x] Set up first person WASD + mouselook controls. Hold space to add vertical thrust like a jetpack. 
[x] Remove the "Atmospheric flight scaffold" text. Remove "CURSOR / LEVELS.IO JAM". Remove "WebGL ready". Remove "Click to enter"; the game should work without having to click any buttons first. These are all things I didn't ask for, and your instructions are not to add speculative features. Please update your instructions to prevent this kind of error in the future.
[x] The screen is black. Is the default lighting (and potentially exposure?) set up correctly? Find a three-atmosphere example and start from there for known-good parameters.
[x] The player's initial position should be 1 meter above the top of the cube
[x] The cube and the plane below the water should have collision
[x] When I link to a texture source like ShareTextures, I am not telling you to download and use the preview image. It is a page with a link to a PBR texture pack zip, which you should download, extract, and load as a three.js standard PBR material. Go fix the two current materials. Check if the textures have an implied world scale, assume 1mx1m if not implied otherwise, then tile the meshes appropriately
