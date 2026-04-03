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

export const LOWER_GROUND_Y = -2.5
export const PLAYER_HEIGHT = 1
export const PLAYER_SPAWN_POSITION = Object.freeze({
  x: CUBE_CENTER.x,
  y: CUBE_BOUNDS.maxY + PLAYER_HEIGHT,
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

export function resolvePlayerCollision(
  previousPosition,
  desiredPosition,
  options = {}
) {
  const floorY = options.floorY ?? LOWER_GROUND_Y
  const cubeBounds = options.cubeBounds ?? CUBE_BOUNDS
  const position = cloneVector(desiredPosition)
  const collisions = { cube: false, floor: false }

  if (position.y < floorY + PLAYER_HEIGHT) {
    position.y = floorY + PLAYER_HEIGHT
    collisions.floor = true
  }

  const insideCube =
    position.x > cubeBounds.minX &&
    position.x < cubeBounds.maxX &&
    position.y > cubeBounds.minY &&
    position.y < cubeBounds.maxY &&
    position.z > cubeBounds.minZ &&
    position.z < cubeBounds.maxZ

  if (!insideCube) {
    return { position, collisions }
  }

  const candidates = []
  if (previousPosition.x <= cubeBounds.minX && position.x > cubeBounds.minX) {
    candidates.push({ axis: 'x', value: cubeBounds.minX, distance: position.x - cubeBounds.minX })
  }
  if (previousPosition.x >= cubeBounds.maxX && position.x < cubeBounds.maxX) {
    candidates.push({ axis: 'x', value: cubeBounds.maxX, distance: cubeBounds.maxX - position.x })
  }
  if (previousPosition.y <= cubeBounds.minY && position.y > cubeBounds.minY) {
    candidates.push({ axis: 'y', value: cubeBounds.minY, distance: position.y - cubeBounds.minY })
  }
  if (previousPosition.y >= cubeBounds.maxY && position.y < cubeBounds.maxY) {
    candidates.push({
      axis: 'y',
      value: cubeBounds.maxY + PLAYER_HEIGHT,
      distance: cubeBounds.maxY - position.y
    })
  }
  if (previousPosition.z <= cubeBounds.minZ && position.z > cubeBounds.minZ) {
    candidates.push({ axis: 'z', value: cubeBounds.minZ, distance: position.z - cubeBounds.minZ })
  }
  if (previousPosition.z >= cubeBounds.maxZ && position.z < cubeBounds.maxZ) {
    candidates.push({ axis: 'z', value: cubeBounds.maxZ, distance: cubeBounds.maxZ - position.z })
  }

  const face = (candidates.length > 0 ? candidates : [chooseNearestFace(position, cubeBounds)]).reduce(
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

  return { position, collisions }
}
