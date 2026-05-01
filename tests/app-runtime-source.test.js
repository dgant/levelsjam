import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readAppSource() {
  return fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')
}

test('challenge playtest levels use isolated runtime state and are not restored by default', () => {
  const appSource = readAppSource()

  assert.match(
    appSource,
    /function isChallengeRuntimeLevelId\(id: string \| null \| undefined\)/,
    'challenge runtime level detection should be explicit'
  )
  assert.match(
    appSource,
    /if \(isChallengeRuntimeLevelId\(layout\.maze\.id\)\) \{\s*return \[layout\]\s*\}/,
    'challenge level instantiation should isolate the active rules world to the selected challenge'
  )
  assert.match(
    appSource,
    /options\.reset \|\|\s*isChallengeRuntimeLevelId\(mazeId\) \|\|\s*isChallengeRuntimeLevelId\(current\?\.activeLevelId\)/,
    'switching into or out of a challenge should reset the rules world instead of activating an overlapping cached layout'
  )
  assert.match(
    appSource,
    /return isChallengeRuntimeLevelId\(lastLevelId\) \? null : lastLevelId/,
    'saved challenge IDs should not become the default startup level'
  )
  assert.match(
    appSource,
    /if \(isChallengeRuntimeLevelId\(globalTurnState\.activeLevelId\)\) \{\s*return\s*\}/,
    'challenge playtests should not overwrite the story save slot'
  )
})
