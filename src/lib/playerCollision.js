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

function chooseNearestFace(position, bounds) {
  const faces = [
    { axis: 'x', value: bounds.minX, distance: position.x - bounds.minX },
    { axis: 'x', value: bounds.maxX, distance: bounds.maxX - position.x },
    { axis: 'y', value: bounds.minY, distance: position.y - bounds.minY },
    { axis: 'y', value: bounds.maxY, distance: bounds.maxY - position.y },
    { axis: 'z', value: bounds.minZ, distance: position.z - bounds.minZ },
    { axis: 'z', value: bounds.maxZ, distance: bounds.maxZ - position.z }
  ]

  return faces.reduce((best, face) => {
    if (!best || face.distance < best.distance) {
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

  const candidates = []

  if (
    previousPosition.x <= bounds.minX - radius &&
    position.x > bounds.minX - radius
  ) {
    candidates.push({
      axis: 'x',
      value: bounds.minX - radius,
      distance: position.x - (bounds.minX - radius)
    })
  }

  if (
    previousPosition.x >= bounds.maxX + radius &&
    position.x < bounds.maxX + radius
  ) {
    candidates.push({
      axis: 'x',
      value: bounds.maxX + radius,
      distance: bounds.maxX + radius - position.x
    })
  }

  if (
    previousPosition.z <= bounds.minZ - radius &&
    position.z > bounds.minZ - radius
  ) {
    candidates.push({
      axis: 'z',
      value: bounds.minZ - radius,
      distance: position.z - (bounds.minZ - radius)
    })
  }

  if (
    previousPosition.z >= bounds.maxZ + radius &&
    position.z < bounds.maxZ + radius
  ) {
    candidates.push({
      axis: 'z',
      value: bounds.maxZ + radius,
      distance: bounds.maxZ + radius - position.z
    })
  }

  const face = (
    candidates.length > 0
      ? candidates
      : [
          chooseNearestFace(position, {
            minX: bounds.minX - radius,
            maxX: bounds.maxX + radius,
            minY: bounds.minY,
            maxY: bounds.maxY,
            minZ: bounds.minZ - radius,
            maxZ: bounds.maxZ + radius
          })
        ]
  ).reduce((best, candidate) => {
    if (!best || candidate.distance < best.distance) {
      return candidate
    }

    return best
  }, null)

  if (face) {
    position[face.axis] = face.value
    grounded = grounded || face.axis === 'y' && face.value === bounds.maxY
    collided = true
    if (face.axis === 'x') {
      normals.push({
        x: face.value < bounds.minX ? -1 : 1,
        y: 0,
        z: 0
      })
    } else if (face.axis === 'y') {
      normals.push({
        x: 0,
        y: face.value === bounds.maxY ? 1 : -1,
        z: 0
      })
    } else if (face.axis === 'z') {
      normals.push({
        x: 0,
        y: 0,
        z: face.value < bounds.minZ ? -1 : 1
      })
    }
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
  const collisions = { floor: false, wallNormals: [], walls: [] }
  let grounded = false

  if (position.y < floorY) {
    position.y = floorY
    collisions.floor = true
    grounded = true
  }

  for (const bounds of wallBounds) {
    const resolution = resolveAgainstBox(
      previousPosition,
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
    grounded = grounded || resolution.grounded
    collisions.walls.push(bounds.id ?? 'wall')
    collisions.wallNormals.push(...resolution.normals)
  }

  if (!grounded && Math.abs(position.y - floorY) < 1e-6) {
    grounded = true
  }

  return { collisions, grounded, position }
}
