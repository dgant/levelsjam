export const CUBE_CENTER = Object.freeze({ x: 0, y: 5, z: 0 })
export const CUBE_SIZE = 10
export const CUBE_HALF_SIZE = CUBE_SIZE / 2
export const CUBE_BOUNDS = Object.freeze({
  minX: -CUBE_HALF_SIZE,
  maxX: CUBE_HALF_SIZE,
  minY: 0,
  maxY: CUBE_SIZE,
  minZ: -CUBE_HALF_SIZE,
  maxZ: CUBE_HALF_SIZE
})

export const LOWER_GROUND_Y = 8
export const PLAYER_RADIUS = 0.25
export const PLAYER_HEIGHT = 1.75
export const PLAYER_EYE_HEIGHT = 1.5
export const PLAYER_SPAWN_POSITION = Object.freeze({
  x: CUBE_CENTER.x,
  y: CUBE_BOUNDS.maxY + 1,
  z: 4
})

function cloneVector(position) {
  return { x: position.x, y: position.y, z: position.z }
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

function isWithinExpandedTopBounds(position, bounds, radius) {
  return (
    position.x > bounds.minX - radius &&
    position.x < bounds.maxX + radius &&
    position.z > bounds.minZ - radius &&
    position.z < bounds.maxZ + radius
  )
}

export function resolvePlayerCollision(
  previousPosition,
  desiredPosition,
  options = {}
) {
  const floorY = options.floorY ?? LOWER_GROUND_Y
  const cubeBounds = options.cubeBounds ?? CUBE_BOUNDS
  const radius = options.radius ?? PLAYER_RADIUS
  const height = options.height ?? PLAYER_HEIGHT
  const position = cloneVector(desiredPosition)
  const collisions = { cube: false, floor: false }
  let grounded = false

  if (position.y < floorY) {
    position.y = floorY
    collisions.floor = true
    grounded = true
  }

  if (
    previousPosition.y >= cubeBounds.maxY &&
    position.y < cubeBounds.maxY &&
    isWithinExpandedTopBounds(position, cubeBounds, radius)
  ) {
    position.y = cubeBounds.maxY
    collisions.cube = true
    grounded = true
  }

  const capsuleTop = position.y + height
  const insideCube =
    position.x > cubeBounds.minX - radius &&
    position.x < cubeBounds.maxX + radius &&
    position.y < cubeBounds.maxY &&
    capsuleTop > cubeBounds.minY &&
    position.z > cubeBounds.minZ - radius &&
    position.z < cubeBounds.maxZ + radius

  if (!insideCube) {
    if (!grounded && Math.abs(position.y - floorY) < 1e-6) {
      grounded = true
    }

    if (
      !grounded &&
      Math.abs(position.y - cubeBounds.maxY) < 1e-6 &&
      isWithinExpandedTopBounds(position, cubeBounds, radius)
    ) {
      grounded = true
    }

    return { position, collisions, grounded }
  }

  const candidates = []
  if (
    previousPosition.x <= cubeBounds.minX - radius &&
    position.x > cubeBounds.minX - radius
  ) {
    candidates.push({
      axis: 'x',
      value: cubeBounds.minX - radius,
      distance: position.x - (cubeBounds.minX - radius)
    })
  }
  if (
    previousPosition.x >= cubeBounds.maxX + radius &&
    position.x < cubeBounds.maxX + radius
  ) {
    candidates.push({
      axis: 'x',
      value: cubeBounds.maxX + radius,
      distance: cubeBounds.maxX + radius - position.x
    })
  }
  if (
    previousPosition.z <= cubeBounds.minZ - radius &&
    position.z > cubeBounds.minZ - radius
  ) {
    candidates.push({
      axis: 'z',
      value: cubeBounds.minZ - radius,
      distance: position.z - (cubeBounds.minZ - radius)
    })
  }
  if (
    previousPosition.z >= cubeBounds.maxZ + radius &&
    position.z < cubeBounds.maxZ + radius
  ) {
    candidates.push({
      axis: 'z',
      value: cubeBounds.maxZ + radius,
      distance: cubeBounds.maxZ + radius - position.z
    })
  }

  const face = (
    candidates.length > 0
      ? candidates
      : [
          chooseNearestFace(position, {
            minX: cubeBounds.minX - radius,
            maxX: cubeBounds.maxX + radius,
            minY: cubeBounds.minY,
            maxY: cubeBounds.maxY,
            minZ: cubeBounds.minZ - radius,
            maxZ: cubeBounds.maxZ + radius
          })
        ]
  ).reduce(
    (best, candidate) => {
      if (!best || candidate.distance < best.distance) {
        return candidate
      }

      return best
    },
    null
  )

  if (face) {
    position[face.axis] = face.value
    collisions.cube = true
  }

  return { position, collisions, grounded }
}
