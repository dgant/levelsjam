import type { MazeLayout } from './sceneLayout.js'
import type { CardinalDirection, MazeCell, TurnAction, TurnState } from './turnRules.js'

export type GlobalTurnState = {
  activeLevelId: string
  checkpoint: {
    cell: MazeCell
    direction: CardinalDirection
    levelId: string
  }
  dead: boolean
  escaped: boolean
  levelLayouts: Record<string, MazeLayout>
  player: {
    cell: MazeCell
    direction: CardinalDirection
    hasSword: boolean
    hasTrophy: boolean
    levelId: string
  }
  turn: number
  worldTurnState: TurnState
}

export declare function activateGlobalTurnStateLevel(
  state: GlobalTurnState,
  layout: MazeLayout
): GlobalTurnState
export declare function applyGlobalTurnActionForLevel(
  state: GlobalTurnState,
  levelId: string,
  maze: MazeLayout['maze'],
  action: TurnAction
): {
  outcome: {
    blocked: boolean
    escaped: boolean
    killed: boolean
    levelTransition: { targetLevelId: string } | null
    pickedUpSword: boolean
    pickedUpTrophy: boolean
    playerEffect: 'death' | 'escape' | 'sword-strike' | null
    previous: TurnState
    state: TurnState
  }
  state: GlobalTurnState
}
export declare function cloneTurnStateForGlobal(state: TurnState): TurnState
export declare function createChallengeGlobalTurnState(
  activeLayout: MazeLayout,
  additionalLayouts?: MazeLayout[]
): GlobalTurnState
export declare function createEnteredGlobalTurnState(
  activeLayout: MazeLayout,
  additionalLayouts?: MazeLayout[]
): GlobalTurnState
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
  sourceLayout?: MazeLayout
  sourcePreviousState?: TurnState
  sourceState: TurnState
  state: GlobalTurnState
  targetLayout: MazeLayout
}): GlobalTurnState
