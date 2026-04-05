export const PLAYER_RADIUS = 0.25
export const PLAYER_HEIGHT = 1.75
export const PLAYER_EYE_HEIGHT = 1.5
export const GROUND_Y = 0
export const GROUND_SIZE = 200
export const WALL_COUNT = 10
export const WALL_HEIGHT = 2
export const WALL_LENGTH = 4
export const WALL_WIDTH = 0.5
export const SCONCE_RADIUS = 0.25
export const TORCH_BILLBOARD_SIZE = 0.5
export const TORCH_BASE_CANDELA = 1500
export const WALL_FACE_OFFSET = (WALL_WIDTH / 2) + SCONCE_RADIUS
export const PLAYER_SPAWN_POSITION = Object.freeze({
  x: 0,
  y: GROUND_Y + 1,
  z: 0
})

const WALL_LAYOUT_SEED = 20260404
const WALL_PADDING = 0.75
const MAX_PLACEMENT_ATTEMPTS = 1000

function createRandom(seed) {
  let state = seed >>> 0

  return () => {
    state = ((state * 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function computeWallBounds(wall) {
  const halfLength = wall.axis === 'x' ? WALL_LENGTH / 2 : WALL_WIDTH / 2
  const halfWidth = wall.axis === 'x' ? WALL_WIDTH / 2 : WALL_LENGTH / 2

  return {
    minX: wall.position.x - halfLength,
    maxX: wall.position.x + halfLength,
    minY: GROUND_Y,
    maxY: GROUND_Y + WALL_HEIGHT,
    minZ: wall.position.z - halfWidth,
    maxZ: wall.position.z + halfWidth
  }
}

function overlapsExisting(bounds, walls) {
  return walls.some((wall) => {
    const other = wall.bounds

    return !(
      bounds.maxX + WALL_PADDING < other.minX ||
      bounds.minX - WALL_PADDING > other.maxX ||
      bounds.maxZ + WALL_PADDING < other.minZ ||
      bounds.minZ - WALL_PADDING > other.maxZ
    )
  })
}

function tooCloseToSpawn(bounds) {
  const spawnPadding = 3

  return !(
    bounds.maxX + spawnPadding < PLAYER_SPAWN_POSITION.x ||
    bounds.minX - spawnPadding > PLAYER_SPAWN_POSITION.x ||
    bounds.maxZ + spawnPadding < PLAYER_SPAWN_POSITION.z ||
    bounds.minZ - spawnPadding > PLAYER_SPAWN_POSITION.z
  )
}

function createWall(index, random) {
  const axis = random() > 0.5 ? 'x' : 'z'
  const side = random() > 0.5 ? 1 : -1
  const yaw = axis === 'x' ? 0 : Math.PI / 2
  const position = {
    x: (random() * 20) - 10,
    y: GROUND_Y + (WALL_HEIGHT / 2),
    z: (random() * 20) - 10
  }
  const bounds = computeWallBounds({ axis, position })
  const sconceOffset =
    (axis === 'x')
      ? { x: 0, y: 0.1, z: side * WALL_FACE_OFFSET }
      : { x: side * WALL_FACE_OFFSET, y: 0.1, z: 0 }
  const sconcePosition = {
    x: position.x + sconceOffset.x,
    y: GROUND_Y + 1.1 + sconceOffset.y,
    z: position.z + sconceOffset.z
  }
  const torchPosition = {
    x: sconcePosition.x,
    y: sconcePosition.y + SCONCE_RADIUS + 0.08,
    z: sconcePosition.z
  }

  return {
    axis,
    bounds,
    id: `wall-${index}`,
    index,
    position,
    sconceDirection: side,
    sconcePosition,
    torchPosition,
    yaw
  }
}

function generateWalls() {
  const random = createRandom(WALL_LAYOUT_SEED)
  const walls = []
  let attempts = 0

  while (walls.length < WALL_COUNT && attempts < MAX_PLACEMENT_ATTEMPTS) {
    attempts += 1
    const wall = createWall(walls.length, random)

    if (tooCloseToSpawn(wall.bounds) || overlapsExisting(wall.bounds, walls)) {
      continue
    }

    walls.push(wall)
  }

  if (walls.length !== WALL_COUNT) {
    throw new Error('Unable to generate the requested number of walls')
  }

  return walls
}

export const WALL_LAYOUT = Object.freeze(generateWalls())

export function getWallBounds() {
  return WALL_LAYOUT.map((wall) => ({
    ...wall.bounds,
    id: wall.id
  }))
}

export function getWallAttachmentLocalLayout(wall) {
  const sconceLocalY = wall.sconcePosition.y - wall.position.y
  const torchLocalY = wall.torchPosition.y - wall.position.y

  return {
    sconcePosition: {
      x: 0,
      y: sconceLocalY,
      z: wall.sconceDirection * WALL_FACE_OFFSET
    },
    torchPosition: {
      x: 0,
      y: torchLocalY,
      z: wall.sconceDirection * WALL_FACE_OFFSET
    }
  }
}
