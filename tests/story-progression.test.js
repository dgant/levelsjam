import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import { createAuthoredRuntimeMaze } from '../src/lib/levels.js'
import {
  activateGlobalTurnStateLevel,
  applyGlobalTurnActionForLevel,
  createInitialGlobalTurnState,
  ensureGlobalTurnStateLevel
} from '../src/lib/globalTurnRules.js'

const storyWalkthrough = JSON.parse(fs.readFileSync('src/lib/storyWalkthrough.json', 'utf8'))

async function authoredLayout(id) {
  return {
    maze: await createAuthoredRuntimeMaze(id)
  }
}

function lightKey(light) {
  return `${light.cell.x},${light.cell.y}:${light.side}`
}

function expectedAdjacentDoorLightKeys(exit) {
  if (exit.side === 'west' || exit.side === 'east') {
    return [
      `${exit.cell.x},${exit.cell.y - 1}:${exit.side}`,
      `${exit.cell.x},${exit.cell.y + 1}:${exit.side}`
    ]
  }

  return [
    `${exit.cell.x - 1},${exit.cell.y}:${exit.side}`,
    `${exit.cell.x + 1},${exit.cell.y}:${exit.side}`
  ]
}

test('authored story solutions progress incrementally from Entrance through Hallway 1-5', async () => {
  const progression = [
    'entrance',
    'hallway-1-1',
    'hallway-1-2',
    'hallway-1-3',
    'hallway-1-4',
    'hallway-1-5'
  ]
  const layouts = new Map()

  for (const id of progression) {
    layouts.set(id, await authoredLayout(id))
  }

  let globalState = createInitialGlobalTurnState(layouts.get(progression[0]))
  const activeLevelIds = [globalState.activeLevelId]

  for (let index = 0; index < progression.length - 1; index += 1) {
    const currentId = progression[index]
    const expectedNextId = progression[index + 1]
    const currentLayout = layouts.get(currentId)
    const nextLayout = layouts.get(expectedNextId)

    assert.ok(
      Array.isArray(currentLayout.maze.solution?.actions) &&
        currentLayout.maze.solution.actions.length > 0,
      `${currentId} should have a stored solution`
    )

    globalState = ensureGlobalTurnStateLevel(globalState, currentLayout)
    globalState = ensureGlobalTurnStateLevel(globalState, nextLayout)

    let transition = null

    for (const action of currentLayout.maze.solution.actions) {
      const result = applyGlobalTurnActionForLevel(
        globalState,
        currentId,
        currentLayout.maze,
        action
      )

      assert.equal(result.outcome.blocked, false, `${currentId} solution action blocked: ${action}`)
      assert.equal(result.outcome.killed, false, `${currentId} solution action killed the player: ${action}`)
      assert.equal(result.outcome.escaped, false, `${currentId} should use level transitions, not maze escape`)

      transition = result.outcome.levelTransition
      globalState = result.state

      if (transition) {
        break
      }
    }

    assert.deepEqual(
      transition,
      { targetLevelId: expectedNextId },
      `${currentId} stored solution should transition to ${expectedNextId}`
    )

    globalState = activateGlobalTurnStateLevel(globalState, nextLayout)
    assert.equal(globalState.activeLevelId, expectedNextId)
    activeLevelIds.push(globalState.activeLevelId)
  }

  assert.deepEqual(activeLevelIds, progression)
})

test('chamber door torch lights are adjacent to doors and never on doorway edges', async () => {
  for (const chamberId of ['chamber-1', 'chamber-2']) {
    const layout = await authoredLayout(chamberId)
    const lightKeys = new Set(layout.maze.lights.map(lightKey))

    for (const exit of layout.maze.levelExits) {
      const doorKey = lightKey(exit)

      assert.equal(
        lightKeys.has(doorKey),
        false,
        `${chamberId} should not place a torch on doorway edge ${doorKey}`
      )

      assert.deepEqual(
        expectedAdjacentDoorLightKeys(exit).filter((key) => lightKeys.has(key)),
        expectedAdjacentDoorLightKeys(exit),
        `${chamberId} should place torch lights adjacent to ${doorKey}`
      )
    }
  }
})

test('story walkthrough chamber altar steps match authored chamber exits', async () => {
  for (const step of storyWalkthrough.altarSteps) {
    const chamber = await createAuthoredRuntimeMaze(step.chamberId)
    const exit = chamber.levelExits.find((candidate) => candidate.targetLevelId === step.mazeId)

    assert.ok(exit, `${step.chamberId} should have an exit to ${step.mazeId}`)
    assert.deepEqual(
      { direction: exit.side, exitCell: exit.cell },
      { direction: step.direction, exitCell: step.exitCell },
      `${step.mazeId} walkthrough step should match authored chamber exit`
    )
  }
})
