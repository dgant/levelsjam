export type CardinalDirection = 'north' | 'east' | 'south' | 'west'
export type TurnAction =
  | 'move-forward'
  | 'move-backward'
  | 'rotate-left'
  | 'rotate-right'

export type MazeCell = { x: number; y: number }

export type TurnMonster = {
  awake: boolean
  cell: MazeCell
  direction: CardinalDirection
  hand: 'left' | 'right' | null
  id: string
  lastMoveDirection: CardinalDirection | null
  lastPath: CardinalDirection[]
  lastSeenDirection: CardinalDirection | null
  movedPreviousTurn: boolean
  type: 'minotaur' | 'spider' | 'werewolf'
}

export type TurnState = {
  checkpoint: {
    cell: MazeCell
    direction: CardinalDirection
  }
  dead: boolean
  escaped: boolean
  monsters: TurnMonster[]
  player: {
    cell: MazeCell
    direction: CardinalDirection
    hasSword: boolean
    hasTrophy: boolean
  }
  swordState: 'ground' | 'held' | 'consumed'
  trophyState: 'ground' | 'held' | 'consumed'
  turn: number
}

export declare const DIRECTIONS: CardinalDirection[]
export declare const OPPOSITE_DIRECTIONS: Record<CardinalDirection, CardinalDirection>
export declare function applyTurnAction(
  maze: unknown,
  state: TurnState,
  action: TurnAction
): {
  blocked: boolean
  escaped: boolean
  killed: boolean
  levelTransition: {
    direction: CardinalDirection
    exit: {
      cell: MazeCell
      side: CardinalDirection
      targetLevelId?: string
    }
    targetLevelId: string
  } | null
  pickedUpSword: boolean
  pickedUpTrophy: boolean
  playerEffect: 'death' | 'escape' | 'sword-strike' | null
  previous: TurnState
  state: TurnState
}
export declare function canMove(
  maze: unknown,
  openEdges: Set<string>,
  cell: MazeCell,
  direction: CardinalDirection
): boolean
export declare function canSeeCell(
  maze: unknown,
  openEdges: Set<string>,
  from: MazeCell,
  to: MazeCell
): boolean
export declare function cellKey(cell: MazeCell): string
export declare function chooseSpiderDirection(
  maze: unknown,
  openEdges: Set<string>,
  monster: TurnMonster
): CardinalDirection | null
export declare function createBaseOpenEdgeSet(maze: unknown): Set<string>
export declare function createInitialTurnState(maze: unknown): TurnState
export declare function createMonsterMoveEdgeSet(maze: unknown): Set<string>
export declare function createPlayerMoveEdgeSet(maze: unknown, state: TurnState): Set<string>
export declare function getNeighbor(cell: MazeCell, direction: CardinalDirection): MazeCell
export declare function getExitForMove(
  maze: unknown,
  cell: MazeCell,
  direction: CardinalDirection
): {
  cell: MazeCell
  side: CardinalDirection
  targetLevelId?: string
} | null
export declare function getOpenGateIds(maze: unknown, state: TurnState): string[]
export declare function getVisibleCells(maze: unknown, state: TurnState): Set<string>
export declare function normalizeEdge(from: MazeCell, to: MazeCell): string
export declare function resetTurnStateToCheckpoint(maze: unknown, state: TurnState): TurnState
export declare function rotateDirection(
  direction: CardinalDirection,
  turn: 'left' | 'right' | 'back'
): CardinalDirection
export declare function shortestPathDirections(
  maze: unknown,
  openEdges: Set<string>,
  from: MazeCell,
  to: MazeCell
): CardinalDirection[]
