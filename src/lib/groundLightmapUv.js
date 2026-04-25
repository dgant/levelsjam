export function mapGroundWorldToLightmapLocalUv(groundBounds, worldX, worldZ) {
  return {
    u: (worldX - groundBounds.minX) / groundBounds.width,
    v: (worldZ - groundBounds.minZ) / groundBounds.depth
  }
}
