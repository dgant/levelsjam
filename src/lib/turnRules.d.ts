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
  monsters: TurnMonster[]
  player: {
    cell: MazeCell
    direction: CardinalDirection
  }
  turn: number
}

export declare const DIRECTIONS: CardinalDirection[]
export declare const OPPOSITE_DIRECTIONS: Record<CardinalDirection, CardinalDirection>
export declare function applyTurnAction(maze: unknown, state: TurnState, action: TurnAction): {
  killed: boolean
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
export declare function createInitialTurnState(maze: unknown): TurnState
export declare function getNeighbor(cell: MazeCell, direction: CardinalDirection): MazeCell
export declare function resetTurnStateToCheckpoint(state: TurnState): TurnState
export declare function rotateDirection(
  direction: CardinalDirection,
  turn: 'left' | 'right' | 'back'
): CardinalDirection
