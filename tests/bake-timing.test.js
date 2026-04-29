import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  BakeTimingRecorder,
  readBakeTimingReport
} = require('../scripts/bake-timing.cjs')

test('writes and parses timestamped bake timing reports', () => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'levelsjam-bake-timing-test-')
  )

  try {
    const recorder = new BakeTimingRecorder({
      kind: 'test-bake',
      logDirectory: temporaryDirectory,
      now: new Date('2026-04-29T12:00:00.000Z')
    })
    const stepId = recorder.beginStep('lightmap', {
      levelId: 'maze-test',
      quality: { faceSize: 32 },
      workCounts: { probeCount: 49 }
    })

    recorder.recordProgress('lightmap:gpu-job-start', {
      levelId: 'maze-test'
    })
    recorder.endStep(stepId, 'completed', {
      workCounts: { atlasPixels: 262144 }
    })
    recorder.finish('completed')

    assert.equal(
      path.basename(recorder.filePath),
      'bake-timing-2026-04-29-120000Z.json'
    )

    const report = readBakeTimingReport(recorder.filePath)

    assert.equal(report.kind, 'test-bake')
    assert.equal(report.status, 'completed')
    assert.equal(report.steps.length, 1)
    assert.equal(report.steps[0].name, 'lightmap')
    assert.equal(report.levels['maze-test'].steps.length, 1)
    assert.equal(report.stepTotals.lightmap.count, 1)
    assert.equal(report.stepTotals.lightmap.stepKind, 'leaf')
    assert.equal(report.stepTotals.lightmap.includesNestedWork, false)
    assert.equal(report.progress[0].message, 'lightmap:gpu-job-start')
    assert.ok(Number.isFinite(report.totalDurationMs))
  } finally {
    fs.rmSync(temporaryDirectory, {
      force: true,
      recursive: true
    })
  }
})

test('labels wrapper bake timing totals without marking leaf steps as mixed', () => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'levelsjam-bake-timing-test-')
  )

  try {
    const recorder = new BakeTimingRecorder({
      kind: 'test-bake',
      logDirectory: temporaryDirectory,
      now: new Date('2026-04-29T12:00:00.000Z')
    })
    const wrapperId = recorder.beginStep('ensure-maze-files', {
      stepKind: 'wrapper'
    })
    recorder.endStep(wrapperId)
    const leafId = recorder.beginStep('lightmap-gpu-job')
    recorder.endStep(leafId)
    recorder.finish('completed')

    const report = readBakeTimingReport(recorder.filePath)

    assert.equal(report.stepTotals['ensure-maze-files'].stepKind, 'wrapper')
    assert.equal(report.stepTotals['ensure-maze-files'].includesNestedWork, true)
    assert.equal(report.stepTotals['lightmap-gpu-job'].stepKind, 'leaf')
    assert.equal(report.stepTotals['lightmap-gpu-job'].includesNestedWork, false)
  } finally {
    fs.rmSync(temporaryDirectory, {
      force: true,
      recursive: true
    })
  }
})

test('rejects malformed bake timing reports', () => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'levelsjam-bake-timing-test-')
  )
  const reportPath = path.join(temporaryDirectory, 'bad.json')

  try {
    fs.writeFileSync(reportPath, JSON.stringify({ schemaVersion: 999 }))

    assert.throws(
      () => readBakeTimingReport(reportPath),
      /Unsupported bake timing schema version/
    )
  } finally {
    fs.rmSync(temporaryDirectory, {
      force: true,
      recursive: true
    })
  }
})
