import {
  GROUND_Y,
  PLAYER_EYE_HEIGHT,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  PLAYER_SPAWN_POSITION,
  getWallBounds
} from './sceneLayout.js'

function cloneVector(position) {
  return { x: position.x, y: position.y, z: position.z }
}

function isWithinExpandedTopBounds(position, bounds, radius) {
  return (
    position.x > bounds.minX - radius &&
    position.x < bounds.maxX + radius &&
    position.z > bounds.minZ - radius &&
    position.z < bounds.maxZ + radius
  )
}

function chooseHorizontalFace(previousPosition, position, bounds, radius) {
  const expandedBounds = {
    minX: bounds.minX - radius,
    maxX: bounds.maxX + radius,
    minZ: bounds.minZ - radius,
    maxZ: bounds.maxZ + radius
  }
  const faces = [
    {
      axis: 'x',
      depth: position.x - expandedBounds.minX,
      normal: { x: -1, y: 0, z: 0 },
      crossedFromOutside: previousPosition.x <= expandedBounds.minX
    },
    {
      axis: 'x',
      depth: expandedBounds.maxX - position.x,
      normal: { x: 1, y: 0, z: 0 },
      crossedFromOutside: previousPosition.x >= expandedBounds.maxX
    },
    {
      axis: 'z',
      depth: position.z - expandedBounds.minZ,
      normal: { x: 0, y: 0, z: -1 },
      crossedFromOutside: previousPosition.z <= expandedBounds.minZ
    },
    {
      axis: 'z',
      depth: expandedBounds.maxZ - position.z,
      normal: { x: 0, y: 0, z: 1 },
      crossedFromOutside: previousPosition.z >= expandedBounds.maxZ
    }
  ]
  const validFaces = faces.filter((face) => face.depth >= 0)
  const crossedFaces = validFaces.filter((face) => face.crossedFromOutside)
  const candidates = crossedFaces.length > 0 ? crossedFaces : validFaces

  return candidates.reduce((best, face) => {
    if (!best || face.depth < best.depth) {
      return face
    }

    return best
  }, null)
}

function resolveAgainstBox(previousPosition, desiredPosition, bounds, radius, height) {
  const position = cloneVector(desiredPosition)
  let grounded = false
  let collided = false
  const normals = []

  if (
    previousPosition.y >= bounds.maxY &&
    position.y < bounds.maxY &&
    isWithinExpandedTopBounds(position, bounds, radius)
  ) {
    position.y = bounds.maxY
    grounded = true
    collided = true
    normals.push({ x: 0, y: 1, z: 0 })
  }

  const capsuleTop = position.y + height
  const insideBox =
    position.x > bounds.minX - radius &&
    position.x < bounds.maxX + radius &&
    position.y < bounds.maxY &&
    capsuleTop > bounds.minY &&
    position.z > bounds.minZ - radius &&
    position.z < bounds.maxZ + radius

  if (!insideBox) {
    if (
      !grounded &&
      Math.abs(position.y - bounds.maxY) < 1e-6 &&
      isWithinExpandedTopBounds(position, bounds, radius)
    ) {
      grounded = true
    }

    return { collided, grounded, normals, position }
  }

  const face = chooseHorizontalFace(previousPosition, position, bounds, radius)

  if (face) {
    position.x += face.normal.x * face.depth
    position.z += face.normal.z * face.depth
    collided = true
    normals.push(face.normal)
  }

  return { collided, grounded, normals, position }
}

export function getPlayerSpawnPosition() {
  return cloneVector(PLAYER_SPAWN_POSITION)
}

export function getCameraPosition(playerPosition) {
  return {
    x: playerPosition.x,
    y: playerPosition.y + PLAYER_EYE_HEIGHT,
    z: playerPosition.z
  }
}

export function resolvePlayerCollision(
  previousPosition,
  desiredPosition,
  options = {}
) {
  const floorY = options.floorY ?? GROUND_Y
  const radius = options.radius ?? PLAYER_RADIUS
  const height = options.height ?? PLAYER_HEIGHT
  const wallBounds = options.wallBounds ?? getWallBounds()
  const position = cloneVector(desiredPosition)
  const currentPreviousPosition = cloneVector(previousPosition)
  const collisions = { floor: false, wallNormals: [], walls: [] }
  let grounded = false

  if (position.y < floorY) {
    position.y = floorY
    collisions.floor = true
    grounded = true
  }

  for (const bounds of wallBounds) {
    const resolution = resolveAgainstBox(
      currentPreviousPosition,
      position,
      bounds,
      radius,
      height
    )

    if (!resolution.collided) {
      continue
    }

    position.x = resolution.position.x
    position.y = resolution.position.y
    position.z = resolution.position.z
    currentPreviousPosition.x = position.x
    currentPreviousPosition.y = position.y
    currentPreviousPosition.z = position.z
    grounded = grounded || resolution.grounded
    collisions.walls.push(bounds.id ?? 'wall')
    collisions.wallNormals.push(...resolution.normals)
  }

  if (!grounded && Math.abs(position.y - floorY) < 1e-6) {
    grounded = true
  }

  return { collisions, grounded, position }
}
