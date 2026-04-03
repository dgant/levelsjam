# Updates

- Do not add speculative HUD text, branding captions, or click-to-enter gates unless the user explicitly asks for them. The default interaction model for this game should start immediately on page load.
- When the scene renders black, anchor atmosphere changes to a documented known-good `@takram/three-atmosphere` lighting example instead of inventing new exposure or lighting settings from scratch.
- When a source page like ShareTextures is provided for a material, use the linked downloadable asset pack rather than the page's preview image unless the user explicitly asks for the preview itself.
- When the user asks for the official three.js `Water`, document that requirement explicitly rather than approximating it with a generic translucent plane.
- When tuning movement, keep the documented speed, acceleration, deceleration, gravity, and jetpack targets in the spec so the controller and tests stay aligned.
- When a key is assigned to a requested tooling or debug control, reserve that key from generic gameplay relock handling instead of letting it fall through to pointer-lock logic.
