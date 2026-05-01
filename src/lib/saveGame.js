export const GAME_SAVE_STORAGE_KEY = 'levelsjam:save:v1'
export const GAME_SAVE_VERSION = 2

function normalizeStringArray(value) {
  if (!value) {
    return []
  }

  const entries = Array.isArray(value) || typeof value[Symbol.iterator] === 'function'
    ? Array.from(value)
    : []

  return Array.from(new Set(entries.filter((entry) => typeof entry === 'string'))).sort()
}

export function createGameSave(globalTurnState, options = {}) {
  const lastLevelId =
    options.lastLevelId ??
    globalTurnState?.activeLevelId ??
    globalTurnState?.player?.levelId ??
    null

  if (!lastLevelId) {
    return null
  }

  return {
    enteredLevelIds: normalizeStringArray(options.enteredLevelIds),
    lastLevelId,
    litAltars: normalizeStringArray(options.litAltars ?? options.activatedAltarIds),
    openedPassageways: normalizeStringArray(options.openedPassageways),
    savedAt: new Date().toISOString(),
    version: GAME_SAVE_VERSION
  }
}

export function parseGameSave(value) {
  if (!value || typeof value !== 'object') {
    return null
  }

  if (
    typeof value.lastLevelId !== 'string' ||
    (value.version !== GAME_SAVE_VERSION && value.version !== 1)
  ) {
    return null
  }

  const enteredLevelIds = normalizeStringArray(value.enteredLevelIds)

  return {
    enteredLevelIds: enteredLevelIds.length > 0
      ? enteredLevelIds
      : normalizeStringArray([value.lastLevelId]),
    lastLevelId: value.lastLevelId,
    litAltars: normalizeStringArray(value.litAltars),
    openedPassageways: normalizeStringArray(value.openedPassageways),
    savedAt: typeof value.savedAt === 'string' ? value.savedAt : null,
    version: GAME_SAVE_VERSION
  }
}

export function readGameSave(storage = globalThis.localStorage) {
  if (!storage) {
    return null
  }

  try {
    const raw = storage.getItem(GAME_SAVE_STORAGE_KEY)

    return parseGameSave(JSON.parse(raw))
  } catch {
    return null
  }
}

export function writeGameSave(storage = globalThis.localStorage, save) {
  const parsed = parseGameSave(save)

  if (!storage || !parsed) {
    return false
  }

  storage.setItem(GAME_SAVE_STORAGE_KEY, JSON.stringify(parsed))
  return true
}

export function clearGameSave(storage = globalThis.localStorage) {
  if (!storage) {
    return false
  }

  storage.removeItem(GAME_SAVE_STORAGE_KEY)
  return true
}
