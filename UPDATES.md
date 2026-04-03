# Updates

- Do not add speculative HUD text, branding captions, or click-to-enter gates unless the user explicitly asks for them. The default interaction model for this game should start immediately on page load.
- When the scene renders black, anchor atmosphere changes to a documented known-good `@takram/three-atmosphere` lighting example instead of inventing new exposure or lighting settings from scratch.
- When a source page like ShareTextures is provided for a material, use the linked downloadable asset pack rather than the page's preview image unless the user explicitly asks for the preview itself.
