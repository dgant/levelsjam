import { bakeMazeLightmap, computeMazeCellVisibility } from './maze.js'

const CARDINAL_SIDES = ['north', 'east', 'south', 'west']
const DELTAS = {
  east: { x: 1, y: 0 },
  north: { x: 0, y: -1 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 }
}

const AUTHORED_LEVEL_IDS = Object.freeze({
  Entrance: 'entrance',
  'Hallway 1-1': 'hallway-1-1',
  'Hallway 1-2': 'hallway-1-2',
  'Hallway 1-3': 'hallway-1-3',
  'Hallway 1-4': 'hallway-1-4',
  'Hallway 1-5': 'hallway-1-5',
  'Chamber 1': 'chamber-1',
  'Chamber 2': 'chamber-2',
  'Throne Room': 'throne-room'
})

const AUTHORED_LEVEL_NAMES = Object.freeze(
  Object.fromEntries(
    Object.entries(AUTHORED_LEVEL_IDS).map(([name, id]) => [id, name])
  )
)

export const STORY_MAZE_PARENT_LEVEL_IDS = Object.freeze({
  'challenge-028': 'chamber-1',
  'challenge-031': 'chamber-1',
  'challenge-059': 'chamber-1',
  'challenge-036': 'chamber-1',
  'werewolf-tutorial': 'chamber-2',
  'challenge-098': 'chamber-2',
  'challenge-095': 'chamber-2',
  'challenge-043': 'chamber-2',
  'challenge-040': 'chamber-2',
  'challenge-100': 'chamber-2'
})

const CHAMBER_1_MAZES = ['challenge-028', 'challenge-031', 'challenge-059', 'challenge-036']
const CHAMBER_2_MAZES = [
  'werewolf-tutorial',
  'challenge-098',
  'challenge-095',
  'challenge-043',
  'challenge-040',
  'challenge-100'
]

const RUNTIME_LEVEL_GRAPH = Object.freeze({
  entrance: ['hallway-1-1'],
  'hallway-1-1': ['hallway-1-2'],
  'hallway-1-2': ['hallway-1-3'],
  'hallway-1-3': ['hallway-1-4'],
  'hallway-1-4': ['hallway-1-5'],
  'hallway-1-5': ['chamber-1'],
  'chamber-1': [...CHAMBER_1_MAZES, 'chamber-2'],
  'challenge-028': [],
  'challenge-031': [],
  'challenge-059': [],
  'challenge-036': [],
  'chamber-2': [...CHAMBER_2_MAZES, 'throne-room'],
  'werewolf-tutorial': [],
  'challenge-098': [],
  'challenge-095': [],
  'challenge-043': [],
  'challenge-040': [],
  'challenge-100': [],
  'throne-room': []
})

const RUNTIME_LEVEL_ADJACENCY = Object.freeze({
  entrance: ['hallway-1-1'],
  'hallway-1-1': ['entrance', 'hallway-1-2'],
  'hallway-1-2': ['hallway-1-1', 'hallway-1-3'],
  'hallway-1-3': ['hallway-1-2', 'hallway-1-4'],
  'hallway-1-4': ['hallway-1-3', 'hallway-1-5'],
  'hallway-1-5': ['hallway-1-4', 'chamber-1'],
  'chamber-1': ['hallway-1-5', ...CHAMBER_1_MAZES, 'chamber-2'],
  'challenge-028': ['chamber-1'],
  'challenge-031': ['chamber-1'],
  'challenge-059': ['chamber-1'],
  'challenge-036': ['chamber-1'],
  'chamber-2': ['chamber-1', ...CHAMBER_2_MAZES, 'throne-room'],
  'werewolf-tutorial': ['chamber-2'],
  'challenge-098': ['chamber-2'],
  'challenge-095': ['chamber-2'],
  'challenge-043': ['chamber-2'],
  'challenge-040': ['chamber-2'],
  'challenge-100': ['chamber-2'],
  'throne-room': ['chamber-2']
})

const STORY_MAZE_SPECS = Object.freeze({
  'challenge-028': { height: 5, opening: { cell: { x: 0, y: 0 }, side: 'north' }, width: 3 },
  'challenge-031': { height: 6, opening: { cell: { x: 0, y: 1 }, side: 'west' }, width: 3 },
  'challenge-059': { height: 5, opening: { cell: { x: 0, y: 2 }, side: 'west' }, width: 3 },
  'challenge-036': { height: 7, opening: { cell: { x: 2, y: 1 }, side: 'east' }, width: 3 },
  'werewolf-tutorial': { height: 3, opening: { cell: { x: 1, y: 0 }, side: 'north' }, width: 8 },
  'challenge-098': { height: 4, opening: { cell: { x: 5, y: 0 }, side: 'north' }, width: 6 },
  'challenge-095': { height: 7, opening: { cell: { x: 1, y: 0 }, side: 'north' }, width: 6 },
  'challenge-043': { height: 6, opening: { cell: { x: 2, y: 0 }, side: 'north' }, width: 3 },
  'challenge-040': { height: 5, opening: { cell: { x: 2, y: 2 }, side: 'east' }, width: 3 },
  'challenge-100': { height: 6, opening: { cell: { x: 4, y: 2 }, side: 'east' }, width: 5 }
})

const authoredLevelMazeCache = new Map()

function sideAfterRotation(side, rotationY) {
  const quarterTurns = ((Math.round(rotationY / (Math.PI / 2)) % 4) + 4) % 4
  const index = CARDINAL_SIDES.indexOf(side)

  return CARDINAL_SIDES[(index - quarterTurns + CARDINAL_SIDES.length) % CARDINAL_SIDES.length]
}

function rotationForWorldSide(localSide, worldSide) {
  const localIndex = CARDINAL_SIDES.indexOf(localSide)
  const worldIndex = CARDINAL_SIDES.indexOf(worldSide)
  const quarterTurns = (localIndex - worldIndex + CARDINAL_SIDES.length) % CARDINAL_SIDES.length

  return quarterTurns * (Math.PI / 2)
}

function getNeighbor(cell, side) {
  const delta = DELTAS[side]

  return { x: cell.x + delta.x, y: cell.y + delta.y }
}

function getLevelTransitions(maze) {
  return [
    ...(Array.isArray(maze.levelExits) ? maze.levelExits : []),
    ...(Array.isArray(maze.levelConnections) ? maze.levelConnections : [])
  ]
}

function localCellCenter(width, height, cell) {
  return {
    x: -width + 1 + (cell.x * 2),
    z: -height + 1 + (cell.y * 2)
  }
}

function localCellToWorldCell(maze, transform, cell) {
  const point = localCellCenter(maze.width, maze.height, cell)
  const cos = Math.cos(transform.rotationY)
  const sin = Math.sin(transform.rotationY)

  return {
    x: Math.round((transform.x + (point.x * cos) + (point.z * sin)) / 2),
    y: Math.round((transform.z - (point.x * sin) + (point.z * cos)) / 2)
  }
}

function transformForLocalCellAtWorldCell(width, height, localCell, worldCell, rotationY = 0) {
  const point = localCellCenter(width, height, localCell)
  const cos = Math.cos(rotationY)
  const sin = Math.sin(rotationY)

  return {
    rotationY,
    x: (worldCell.x * 2) - ((point.x * cos) + (point.z * sin)),
    z: (worldCell.y * 2) - ((-point.x * sin) + (point.z * cos))
  }
}

function transformForMazeConnection(spec, chamberMaze, chamberTransform, exit) {
  const openingWorldSide = {
    east: 'west',
    north: 'south',
    south: 'north',
    west: 'east'
  }[exit.side]
  const rotationY = rotationForWorldSide(spec.opening.side, openingWorldSide)
  const chamberExitCell = localCellToWorldCell(chamberMaze, chamberTransform, exit.cell)
  const mazeOpeningWorldCell = getNeighbor(chamberExitCell, exit.side)

  return transformForLocalCellAtWorldCell(
    spec.width,
    spec.height,
    spec.opening.cell,
    mazeOpeningWorldCell,
    rotationY
  )
}

function createChamberTransform(chamberMaze, entryWorldCell) {
  return transformForLocalCellAtWorldCell(
    chamberMaze.width,
    chamberMaze.height,
    chamberMaze.playerStart.cell,
    entryWorldCell,
    0
  )
}

function createRuntimeTransforms() {
  const transforms = {}
  const authoredLineIds = [
    'entrance',
    'hallway-1-1',
    'hallway-1-2',
    'hallway-1-3',
    'hallway-1-4',
    'hallway-1-5'
  ]
  const authoredLineMazes = Object.fromEntries(
    authoredLineIds.map((id) => [id, createAuthoredMazeDefinition(id)])
  )

  transforms.entrance = transformForLocalCellAtWorldCell(
    authoredLineMazes.entrance.width,
    authoredLineMazes.entrance.height,
    authoredLineMazes.entrance.playerStart.cell,
    { x: 0, y: 0 },
    0
  )

  for (let index = 1; index < authoredLineIds.length; index += 1) {
    const previousId = authoredLineIds[index - 1]
    const currentId = authoredLineIds[index]
    const previousMaze = authoredLineMazes[previousId]
    const currentMaze = authoredLineMazes[currentId]
    const previousExit = getLevelTransitions(previousMaze).find((exit) => exit.targetLevelId === currentId)
    const entryWorldCell = getNeighbor(
      localCellToWorldCell(previousMaze, transforms[previousId], previousExit.cell),
      previousExit.side
    )

    transforms[currentId] = transformForLocalCellAtWorldCell(
      currentMaze.width,
      currentMaze.height,
      currentMaze.playerStart.cell,
      entryWorldCell,
      0
    )
  }

  const hallway5 = authoredLineMazes['hallway-1-5']
  const hallway5Exit = hallway5.levelExits.find((exit) => exit.targetLevelId === 'chamber-1')
  const chamber1Entry = localCellToWorldCell(
    hallway5,
    transforms['hallway-1-5'],
    getNeighbor(hallway5Exit.cell, hallway5Exit.side)
  )
  const chamber1 = createChamberMazeDefinition(
    'chamber-1',
    'hallway-1-5',
    'chamber-2',
    CHAMBER_1_MAZES,
    4
  )

  transforms['chamber-1'] = createChamberTransform(chamber1, chamber1Entry)
  for (const exit of chamber1.levelExits.filter((candidate) => STORY_MAZE_SPECS[candidate.targetLevelId])) {
    transforms[exit.targetLevelId] = transformForMazeConnection(
      STORY_MAZE_SPECS[exit.targetLevelId],
      chamber1,
      transforms['chamber-1'],
      exit
    )
  }

  const chamber2Entry = localCellToWorldCell(chamber1, transforms['chamber-1'], { x: 2, y: -1 })
  const chamber2 = createChamberMazeDefinition(
    'chamber-2',
    'chamber-1',
    'throne-room',
    CHAMBER_2_MAZES,
    6
  )

  transforms['chamber-2'] = createChamberTransform(chamber2, chamber2Entry)
  for (const exit of chamber2.levelExits.filter((candidate) => STORY_MAZE_SPECS[candidate.targetLevelId])) {
    transforms[exit.targetLevelId] = transformForMazeConnection(
      STORY_MAZE_SPECS[exit.targetLevelId],
      chamber2,
      transforms['chamber-2'],
      exit
    )
  }

  const throneEntry = localCellToWorldCell(chamber2, transforms['chamber-2'], { x: 2, y: -1 })

  transforms['throne-room'] = transformForLocalCellAtWorldCell(5, 8, { x: 2, y: 7 }, throneEntry, 0)
  return Object.freeze(transforms)
}

const RUNTIME_LEVEL_WORLD_TRANSFORMS = createRuntimeTransforms()

export function parseLevelSpec(markdown) {
  const levels = []
  let currentLevel = null

  for (const rawLine of String(markdown ?? '').split(/\r?\n/)) {
    const headingMatch = rawLine.match(/^\s*\+\s+(.+?)\s*$/)

    if (headingMatch) {
      currentLevel = {
        description: '',
        name: headingMatch[1].trim()
      }
      levels.push(currentLevel)
      continue
    }

    if (!currentLevel) {
      continue
    }

    const line = rawLine.trim()

    if (!line) {
      continue
    }

    currentLevel.description = currentLevel.description
      ? `${currentLevel.description}\n${line}`
      : line
  }

  return levels
}

function cloneCell(cell) {
  return { x: cell.x, y: cell.y }
}

function rectangularCells(width, height) {
  const cells = []

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      cells.push({ x, y })
    }
  }

  return cells
}

function openEdgesForCells(cells) {
  const cellKeys = new Set(cells.map((cell) => `${cell.x},${cell.y}`))
  const edges = []

  for (const cell of cells) {
    for (const delta of [
      { x: 1, y: 0 },
      { x: 0, y: 1 }
    ]) {
      const to = { x: cell.x + delta.x, y: cell.y + delta.y }

      if (cellKeys.has(`${to.x},${to.y}`)) {
        edges.push({ from: { ...cell }, to })
      }
    }
  }

  return edges
}

function openRoomEdges(width, height) {
  return openEdgesForCells(rectangularCells(width, height))
}

function createAuthoredRoomMaze({
  altars = [],
  cells,
  exitRequiresTrophy = false,
  gates = [],
  height,
  id,
  levelConnections = [],
  levelExits,
  lights = [],
  monsters = [],
  opening,
  openEdges = null,
  playerStart,
  solution = null,
  sword = null,
  trophy = null,
  width
}) {
  return {
    altars,
    cells,
    exitRequiresTrophy,
    gates,
    height,
    id,
    indoor: id !== 'entrance',
    isAuthoredLevel: true,
    levelConnections,
    levelExits,
    levelName: AUTHORED_LEVEL_NAMES[id],
    lights,
    monsters,
    openEdges: openEdges ?? openEdgesForCells(cells),
    opening,
    playerStart,
    ...(solution ? { solution } : {}),
    sword,
    trophy,
    width
  }
}

function chamberSideSlots(count) {
  if (count === 4) {
    return [
      { altar: { x: 1, y: 2 }, exit: { x: 0, y: 2 }, side: 'west' },
      { altar: { x: 1, y: 17 }, exit: { x: 0, y: 17 }, side: 'west' },
      { altar: { x: 3, y: 2 }, exit: { x: 4, y: 2 }, side: 'east' },
      { altar: { x: 3, y: 17 }, exit: { x: 4, y: 17 }, side: 'east' }
    ]
  }

  return [
    { altar: { x: 1, y: 2 }, exit: { x: 0, y: 2 }, side: 'west' },
    { altar: { x: 1, y: 14 }, exit: { x: 0, y: 14 }, side: 'west' },
    { altar: { x: 1, y: 26 }, exit: { x: 0, y: 26 }, side: 'west' },
    { altar: { x: 3, y: 2 }, exit: { x: 4, y: 2 }, side: 'east' },
    { altar: { x: 3, y: 14 }, exit: { x: 4, y: 14 }, side: 'east' },
    { altar: { x: 3, y: 26 }, exit: { x: 4, y: 26 }, side: 'east' }
  ]
}

function createChamberMazeDefinition(id, previousLevelId, nextLevelId, mazeIds, requiredAltarCount) {
  const height = mazeIds.length === 4 ? 24 : 36
  const cells = rectangularCells(5, height)
  const slots = chamberSideSlots(mazeIds.length)
  const altars = mazeIds.map((mazeId, index) => ({
    cell: slots[index].altar,
    id: `${id}-altar-${mazeId}`,
    targetLevelId: mazeId
  }))

  return {
    altars,
    cells,
    exitRequiresTrophy: false,
    gates: [],
    height,
    id,
    isAuthoredLevel: true,
    levelConnections: [
      { cell: { x: 2, y: height - 1 }, side: 'south', targetLevelId: previousLevelId }
    ],
    levelExits: [
      {
        cell: { x: 2, y: 0 },
        requiredAltarIds: altars.slice(0, requiredAltarCount).map((altar) => altar.id),
        side: 'north',
        targetLevelId: nextLevelId
      },
      ...mazeIds.map((mazeId, index) => ({
        cell: slots[index].exit,
        side: slots[index].side,
        targetLevelId: mazeId
      }))
    ],
    levelName: AUTHORED_LEVEL_NAMES[id],
    lights: slots.flatMap((slot) => [
      { cell: slot.exit, side: slot.side },
      { cell: slot.altar, side: slot.side === 'west' ? 'east' : 'west' }
    ]),
    monsters: [],
    openEdges: openEdgesForCells(cells),
    opening: {
      cell: { x: 2, y: height - 1 },
      side: 'south'
    },
    playerStart: {
      cell: { x: 2, y: height - 1 },
      direction: 'north'
    },
    roomBounds: { height, width: 5 },
    sword: null,
    trophy: null,
    width: 5
  }
}

function createThroneRoomDefinition() {
  return {
    altars: [{ cell: { x: 2, y: 0 }, id: 'throne-altar' }],
    exitRequiresTrophy: false,
    gates: [],
    height: 8,
    id: 'throne-room',
    indoor: true,
    isAuthoredLevel: true,
    levelConnections: [
      { cell: { x: 2, y: 7 }, side: 'south', targetLevelId: 'chamber-2' }
    ],
    levelExits: [],
    levelName: AUTHORED_LEVEL_NAMES['throne-room'],
    lights: [
      { cell: { x: 0, y: 0 }, side: 'west' },
      { cell: { x: 4, y: 0 }, side: 'east' },
      { cell: { x: 0, y: 4 }, side: 'west' },
      { cell: { x: 4, y: 4 }, side: 'east' }
    ],
    monsters: [
      { cell: { x: 1, y: 2 }, type: 'minotaur' },
      { cell: { x: 3, y: 2 }, type: 'minotaur' }
    ],
    openEdges: openRoomEdges(5, 8),
    opening: {
      cell: { x: 2, y: 7 },
      side: 'south'
    },
    playerStart: {
      cell: { x: 2, y: 7 },
      direction: 'north'
    },
    solution: {
      actions: ['move-forward', 'move-forward', 'move-forward', 'move-forward', 'move-forward', 'move-forward']
    },
    sword: null,
    trophy: { cell: { x: 2, y: 1 } },
    width: 5
  }
}

function createAuthoredMazeDefinition(id) {
  if (id === 'entrance') {
    return createAuthoredRoomMaze({
      cells: rectangularCells(3, 3),
      height: 3,
      id,
      levelExits: [
        { cell: { x: 1, y: 0 }, side: 'north', targetLevelId: 'hallway-1-1' }
      ],
      lights: [
        { cell: { x: 0, y: 0 }, side: 'north' },
        { cell: { x: 2, y: 0 }, side: 'north' }
      ],
      opening: { cell: { x: 1, y: 2 }, side: 'south' },
      playerStart: { cell: { x: 1, y: 2 }, direction: 'north' },
      solution: { actions: ['move-forward', 'move-forward', 'move-forward'] },
      width: 3
    })
  }
  if (id === 'hallway-1-1') {
    return createAuthoredRoomMaze({
      cells: [
        { x: 3, y: 0 },
        ...Array.from({ length: 8 }, (_, x) => ({ x, y: 1 })),
        { x: 0, y: 2 }
      ],
      height: 3,
      id,
      levelConnections: [
        { cell: { x: 0, y: 2 }, side: 'south', targetLevelId: 'entrance' }
      ],
      levelExits: [
        { cell: { x: 3, y: 0 }, side: 'north', targetLevelId: 'hallway-1-2' }
      ],
      lights: [
        { cell: { x: 3, y: 0 }, side: 'west' },
        { cell: { x: 7, y: 1 }, side: 'east' }
      ],
      monsters: [{ cell: { x: 7, y: 1 }, type: 'minotaur' }],
      opening: { cell: { x: 0, y: 2 }, side: 'south' },
      playerStart: { cell: { x: 0, y: 2 }, direction: 'north' },
      solution: { actions: ['move-forward', 'move-forward', 'move-forward', 'move-forward', 'rotate-left', 'move-forward'] },
      width: 8
    })
  }
  if (id === 'hallway-1-2') {
    return createAuthoredRoomMaze({
      cells: [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 0, y: 2 },
        { x: 1, y: 2 },
        { x: 2, y: 2 },
        { x: 0, y: 3 },
        { x: 1, y: 3 },
        { x: 0, y: 4 }
      ],
      height: 5,
      id,
      levelConnections: [
        { cell: { x: 0, y: 4 }, side: 'south', targetLevelId: 'hallway-1-1' }
      ],
      levelExits: [
        { cell: { x: 0, y: 0 }, side: 'north', targetLevelId: 'hallway-1-3' }
      ],
      lights: [
        { cell: { x: 0, y: 0 }, side: 'west' },
        { cell: { x: 0, y: 0 }, side: 'east' },
        { cell: { x: 2, y: 2 }, side: 'east' }
      ],
      monsters: [{ cell: { x: 0, y: 0 }, type: 'minotaur' }],
      opening: { cell: { x: 0, y: 4 }, side: 'south' },
      openEdges: [
        { from: { x: 0, y: 0 }, to: { x: 0, y: 1 } },
        { from: { x: 0, y: 1 }, to: { x: 0, y: 2 } },
        { from: { x: 1, y: 1 }, to: { x: 2, y: 1 } },
        { from: { x: 1, y: 1 }, to: { x: 1, y: 2 } },
        { from: { x: 2, y: 1 }, to: { x: 2, y: 2 } },
        { from: { x: 0, y: 2 }, to: { x: 1, y: 2 } },
        { from: { x: 1, y: 2 }, to: { x: 2, y: 2 } },
        { from: { x: 1, y: 2 }, to: { x: 1, y: 3 } },
        { from: { x: 0, y: 3 }, to: { x: 1, y: 3 } },
        { from: { x: 0, y: 3 }, to: { x: 0, y: 4 } }
      ],
      playerStart: { cell: { x: 0, y: 4 }, direction: 'north' },
      solution: { actions: ['move-forward', 'rotate-left', 'move-backward', 'rotate-left', 'move-backward', 'rotate-left', 'move-backward', 'move-forward', 'rotate-left', 'move-forward', 'rotate-left', 'move-backward', 'move-forward', 'rotate-left', 'move-forward', 'move-backward', 'rotate-left', 'move-forward', 'rotate-left', 'move-backward', 'rotate-left', 'move-forward', 'move-forward', 'rotate-left', 'move-backward', 'move-backward', 'move-backward'] },
      width: 3
    })
  }
  if (id === 'hallway-1-3') {
    return createAuthoredRoomMaze({
      cells: [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: 2 },
        { x: 1, y: 2 },
        { x: 2, y: 2 },
        { x: 3, y: 2 },
        { x: 0, y: 3 },
        { x: 1, y: 3 },
        { x: 2, y: 3 },
        { x: 3, y: 3 },
        { x: 0, y: 4 },
        { x: 1, y: 4 },
        { x: 0, y: 5 }
      ],
      gates: [{ from: { x: 1, y: 3 }, id: `${id}:gate`, to: { x: 2, y: 3 } }],
      height: 6,
      id,
      levelConnections: [
        { cell: { x: 0, y: 5 }, side: 'south', targetLevelId: 'hallway-1-2' }
      ],
      levelExits: [
        { cell: { x: 0, y: 0 }, side: 'north', targetLevelId: 'hallway-1-4' }
      ],
      lights: [
        { cell: { x: 0, y: 0 }, side: 'west' },
        { cell: { x: 0, y: 0 }, side: 'east' },
        { cell: { x: 3, y: 3 }, side: 'east' }
      ],
      monsters: [{ cell: { x: 0, y: 0 }, type: 'minotaur' }],
      opening: { cell: { x: 0, y: 5 }, side: 'south' },
      openEdges: [
        { from: { x: 0, y: 0 }, to: { x: 0, y: 1 } },
        { from: { x: 0, y: 1 }, to: { x: 0, y: 2 } },
        { from: { x: 1, y: 2 }, to: { x: 2, y: 2 } },
        { from: { x: 2, y: 2 }, to: { x: 3, y: 2 } },
        { from: { x: 0, y: 2 }, to: { x: 0, y: 3 } },
        { from: { x: 1, y: 2 }, to: { x: 1, y: 3 } },
        { from: { x: 3, y: 2 }, to: { x: 3, y: 3 } },
        { from: { x: 0, y: 3 }, to: { x: 1, y: 3 } },
        { from: { x: 2, y: 3 }, to: { x: 3, y: 3 } },
        { from: { x: 1, y: 3 }, to: { x: 1, y: 4 } },
        { from: { x: 0, y: 4 }, to: { x: 1, y: 4 } },
        { from: { x: 0, y: 4 }, to: { x: 0, y: 5 } }
      ],
      playerStart: { cell: { x: 0, y: 5 }, direction: 'north' },
      solution: { actions: ['move-forward', 'rotate-left', 'move-backward', 'rotate-left', 'move-backward', 'rotate-left', 'move-backward', 'move-forward', 'move-forward', 'move-backward', 'rotate-left', 'move-forward', 'rotate-left', 'move-backward', 'move-backward', 'rotate-left', 'move-forward', 'rotate-left', 'move-backward', 'move-backward', 'move-backward', 'rotate-left', 'move-forward', 'move-forward', 'move-forward', 'move-forward'] },
      width: 4
    })
  }
  if (id === 'hallway-1-4') {
    return createAuthoredRoomMaze({
      cells: [
        { x: 4, y: 0 },
        ...Array.from({ length: 5 }, (_, x) => ({ x, y: 1 })),
        { x: 4, y: 2 },
        { x: 5, y: 2 },
        { x: 5, y: 3 },
        { x: 5, y: 4 }
      ],
      height: 5,
      id,
      levelConnections: [
        { cell: { x: 5, y: 4 }, side: 'south', targetLevelId: 'hallway-1-3' }
      ],
      levelExits: [
        { cell: { x: 4, y: 0 }, side: 'north', targetLevelId: 'hallway-1-5' }
      ],
      lights: [
        { cell: { x: 0, y: 1 }, side: 'west' },
        { cell: { x: 4, y: 1 }, side: 'east' }
      ],
      monsters: [{ cell: { x: 4, y: 0 }, type: 'minotaur' }],
      opening: { cell: { x: 5, y: 4 }, side: 'south' },
      openEdges: [
        { from: { x: 4, y: 0 }, to: { x: 4, y: 1 } },
        { from: { x: 0, y: 1 }, to: { x: 1, y: 1 } },
        { from: { x: 1, y: 1 }, to: { x: 2, y: 1 } },
        { from: { x: 2, y: 1 }, to: { x: 3, y: 1 } },
        { from: { x: 3, y: 1 }, to: { x: 4, y: 1 } },
        { from: { x: 4, y: 1 }, to: { x: 4, y: 2 } },
        { from: { x: 4, y: 2 }, to: { x: 5, y: 2 } },
        { from: { x: 5, y: 2 }, to: { x: 5, y: 3 } },
        { from: { x: 5, y: 3 }, to: { x: 5, y: 4 } }
      ],
      playerStart: { cell: { x: 5, y: 4 }, direction: 'north' },
      solution: { actions: ['move-forward', 'move-forward', 'rotate-left', 'move-forward', 'rotate-left', 'move-backward', 'move-backward', 'move-backward'] },
      sword: { cell: { x: 5, y: 3 } },
      trophy: null,
      width: 6
    })
  }
  if (id === 'hallway-1-5') {
    return createAuthoredRoomMaze({
      altars: [{ cell: { x: 0, y: 1 }, id: 'hallway-1-5-altar' }],
      cells: rectangularCells(3, 3),
      height: 3,
      id,
      levelConnections: [
        { cell: { x: 0, y: 2 }, side: 'south', targetLevelId: 'hallway-1-4' }
      ],
      levelExits: [
        { cell: { x: 0, y: 0 }, side: 'north', targetLevelId: 'chamber-1' }
      ],
      lights: [
        { cell: { x: 1, y: 0 }, side: 'north' },
        { cell: { x: 2, y: 1 }, side: 'east' }
      ],
      opening: { cell: { x: 0, y: 2 }, side: 'south' },
      playerStart: { cell: { x: 0, y: 2 }, direction: 'north' },
      solution: { actions: ['rotate-right', 'move-forward', 'move-forward', 'move-forward', 'rotate-left', 'move-forward', 'move-forward'] },
      trophy: { cell: { x: 2, y: 1 } },
      width: 3
    })
  }
  if (id === 'chamber-1') {
    return createChamberMazeDefinition(id, 'hallway-1-5', 'chamber-2', CHAMBER_1_MAZES, 4)
  }
  if (id === 'chamber-2') {
    return createChamberMazeDefinition(id, 'chamber-1', 'throne-room', CHAMBER_2_MAZES, 6)
  }
  if (id === 'throne-room') {
    return createThroneRoomDefinition()
  }

  return null
}

export function getDefaultRuntimeLevelId() {
  return AUTHORED_LEVEL_IDS.Entrance
}

export function getAuthoredRuntimeLevelId(levelName) {
  return AUTHORED_LEVEL_IDS[String(levelName ?? '').trim()] ?? null
}

export function isAuthoredRuntimeLevelId(id) {
  return Object.prototype.hasOwnProperty.call(AUTHORED_LEVEL_NAMES, id)
}

export function getAuthoredRuntimeLevelIds() {
  return Object.values(AUTHORED_LEVEL_IDS)
}

export function getStoryMazeParentLevelId(id) {
  return STORY_MAZE_PARENT_LEVEL_IDS[id] ?? null
}

export function getAdjacentRuntimeLevelIds(id) {
  return [...(RUNTIME_LEVEL_ADJACENCY[id] ?? [])]
}

export function getDirectedRuntimeLevelGraph() {
  return Object.fromEntries(
    Object.entries(RUNTIME_LEVEL_GRAPH).map(([id, targets]) => [id, [...targets]])
  )
}

export function getRuntimeLevelGraphRootId() {
  return AUTHORED_LEVEL_IDS.Entrance
}

export function isRuntimeMazeLevelId(id) {
  return /^maze-\d+$/i.test(String(id ?? '')) || /^challenge-\d+$/i.test(String(id ?? '')) || id === 'werewolf-tutorial'
}

export function getLatestDirectedNonMazeLevelId(enteredLevelIds, options = {}) {
  const rootId = options.rootId ?? getRuntimeLevelGraphRootId()
  const entered = new Set(
    Array.isArray(enteredLevelIds)
      ? enteredLevelIds.filter((id) => typeof id === 'string')
      : []
  )

  if (entered.size === 0) {
    return rootId
  }

  const visited = new Set()
  const queue = [{ id: rootId, order: 0, depth: 0 }]
  let traversalOrder = 0
  let best = entered.has(rootId) ? { depth: 0, id: rootId, order: 0 } : null

  while (queue.length > 0) {
    const current = queue.shift()

    if (!current || visited.has(current.id)) {
      continue
    }

    visited.add(current.id)
    if (entered.has(current.id) && !isRuntimeMazeLevelId(current.id)) {
      if (!best || current.depth > best.depth || (current.depth === best.depth && current.order > best.order)) {
        best = { depth: current.depth, id: current.id, order: current.order }
      }
    }

    for (const targetId of RUNTIME_LEVEL_GRAPH[current.id] ?? []) {
      traversalOrder += 1
      queue.push({ depth: current.depth + 1, id: targetId, order: traversalOrder })
    }
  }

  return best?.id ?? rootId
}

export function getRuntimeLevelWorldTransform(id) {
  const transform = RUNTIME_LEVEL_WORLD_TRANSFORMS[id]

  return transform
    ? { ...transform }
    : { x: 0, z: 0, rotationY: 0 }
}

export async function createAuthoredRuntimeMaze(id, options = {}) {
  if (!isAuthoredRuntimeLevelId(id)) {
    return null
  }

  const bakeLightmap = options.bakeLightmap === true
  const cached = authoredLevelMazeCache.get(id)

  if (bakeLightmap && cached) {
    return {
      ...cached,
      levelConnections: (cached.levelConnections ?? []).map((connection) => ({
        ...connection,
        cell: cloneCell(connection.cell)
      })),
      levelExits: cached.levelExits.map((exit) => ({
        ...exit,
        cell: cloneCell(exit.cell)
      }))
    }
  }

  const maze = createAuthoredMazeDefinition(id)

  if (!maze) {
    return null
  }

  maze.visibility = computeMazeCellVisibility(maze)
  if (bakeLightmap) {
    maze.lightmap = await bakeMazeLightmap(maze)
    authoredLevelMazeCache.set(id, maze)
  }

  return {
    ...maze,
    levelConnections: (maze.levelConnections ?? []).map((connection) => ({
      ...connection,
      cell: cloneCell(connection.cell)
    })),
    levelExits: maze.levelExits.map((exit) => ({
      ...exit,
      cell: cloneCell(exit.cell)
    }))
  }
}

export function resolveRuntimeMazeIdForLevel(levelName, levelIndex, mazeIds, fallbackMazeId = null) {
  const authoredLevelId = getAuthoredRuntimeLevelId(levelName)

  if (authoredLevelId) {
    return authoredLevelId
  }

  const availableMazeIds = Array.isArray(mazeIds)
    ? mazeIds.filter((id) => typeof id === 'string' && id.length > 0 && !isAuthoredRuntimeLevelId(id))
    : []

  if (availableMazeIds.length === 0) {
    return fallbackMazeId
  }

  const numberedMazeMatch = String(levelName ?? '').match(/^Maze\s+(\d+)$/i)

  if (numberedMazeMatch) {
    const mazeNumber = Number(numberedMazeMatch[1])
    const numberedMazeId = availableMazeIds[mazeNumber - 1]

    if (numberedMazeId) {
      return numberedMazeId
    }
  }

  return availableMazeIds[levelIndex] ?? fallbackMazeId ?? availableMazeIds[0]
}
