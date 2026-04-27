import type { MazeLayout } from './sceneLayout.js'
import type { CardinalDirection, MazeCell, TurnState } from './turnRules.js'

export type GlobalTurnState = {
  activeLevelId: string
  checkpoint: {
    cell: MazeCell
    direction: CardinalDirection
    levelId: string
  }
  dead: boolean
  escaped: boolean
  levelStates: Record<string, TurnState>
  player: {
    cell: MazeCell
    direction: CardinalDirection
    hasSword: boolean
    hasTrophy: boolean
    levelId: string
  }
  turn: number
}

export declare function activateGlobalTurnStateLevel(
  state: GlobalTurnState,
  layout: MazeLayout
): GlobalTurnState
export declare function cloneTurnStateForGlobal(state: TurnState): TurnState
export declare function createInitialGlobalTurnState(
  activeLayout: MazeLayout,
  additionalLayouts?: MazeLayout[]
): GlobalTurnState
export declare function ensureGlobalTurnStateLevel(
  state: GlobalTurnState,
  layout: MazeLayout
): GlobalTurnState
export declare function ensureGlobalTurnStateLevels(
  state: GlobalTurnState,
  layouts: MazeLayout[]
): GlobalTurnState
export declare function findIngressCellForGlobalTransition(
  targetMaze: MazeLayout['maze'],
  sourceLevelId: string
): MazeCell
export declare function getGlobalTurnStateForLevel(
  state: GlobalTurnState,
  levelId: string,
  maze: MazeLayout['maze']
): TurnState
export declare function replaceGlobalTurnStateForLevel(
  state: GlobalTurnState,
  levelId: string,
  turnState: TurnState
): GlobalTurnState
export declare function resetGlobalTurnStateLevel(
  state: GlobalTurnState,
  layout: MazeLayout
): GlobalTurnState
export declare function transitionGlobalTurnState(options: {
  sourceLevelId: string
  sourcePreviousState?: TurnState
  sourceState: TurnState
  state: GlobalTurnState
  targetLayout: MazeLayout
}): GlobalTurnState
