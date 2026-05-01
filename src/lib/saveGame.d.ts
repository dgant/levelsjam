import type { GlobalTurnState } from './globalTurnRules.js'

export const GAME_SAVE_STORAGE_KEY: string
export const GAME_SAVE_VERSION: number

export type GameSave = {
  enteredLevelIds: string[]
  lastLevelId: string
  litAltars: string[]
  openedPassageways: string[]
  savedAt: string | null
  version: number
}

export function createGameSave(
  globalTurnState: GlobalTurnState | null | undefined,
  options?: {
    activatedAltarIds?: Iterable<string>
    enteredLevelIds?: Iterable<string>
    lastLevelId?: string | null
    litAltars?: Iterable<string>
    openedPassageways?: Iterable<string>
  }
): GameSave | null

export function parseGameSave(value: unknown): GameSave | null
export function readGameSave(storage?: Storage | null): GameSave | null
export function writeGameSave(storage: Storage | null | undefined, save: unknown): boolean
export function clearGameSave(storage?: Storage | null): boolean
