const fs = require('node:fs')
const path = require('node:path')

const DEFAULT_LOG_DIRECTORY = path.join(process.cwd(), 'logs')

function createRunTimestamp(date = new Date()) {
  return date.toISOString()
    .replace(/\.\d{3}Z$/, 'Z')
    .replace(/[:]/g, '')
    .replace(/[T]/g, '-')
}

function formatDurationMs(durationMs) {
  if (!Number.isFinite(durationMs)) {
    return null
  }

  return `${(durationMs / 1000).toFixed(3)}s`
}

function createEmptyReport({ kind, now = new Date(), runId = createRunTimestamp(now) }) {
  const startedAt = now.toISOString()

  return {
    kind,
    levels: {},
    progress: [],
    quality: {},
    runId,
    schemaVersion: 1,
    startedAt,
    status: 'running',
    stepTotals: {},
    steps: [],
    totalDurationMs: null,
    workCounts: {}
  }
}

function assertReportShape(report) {
  if (!report || typeof report !== 'object') {
    throw new Error('Bake timing report must be an object')
  }
  if (report.schemaVersion !== 1) {
    throw new Error(`Unsupported bake timing schema version: ${report.schemaVersion}`)
  }
  if (!Array.isArray(report.steps)) {
    throw new Error('Bake timing report must include a steps array')
  }
  if (!report.levels || typeof report.levels !== 'object') {
    throw new Error('Bake timing report must include a levels object')
  }
  return report
}

function readBakeTimingReport(filePath) {
  return assertReportShape(JSON.parse(fs.readFileSync(filePath, 'utf8')))
}

class BakeTimingRecorder {
  constructor({
    filePath = null,
    kind = 'bake',
    logDirectory = DEFAULT_LOG_DIRECTORY,
    now = new Date(),
    runId = null
  } = {}) {
    this.startedAtMs = Date.parse(now.toISOString())

    if (filePath && fs.existsSync(filePath)) {
      this.filePath = filePath
      this.report = readBakeTimingReport(filePath)
      this.startedAtMs = Date.parse(this.report.startedAt)
      return
    }

    const report = createEmptyReport({
      kind,
      now,
      runId: runId ?? createRunTimestamp(now)
    })

    this.filePath = filePath ?? path.join(
      logDirectory,
      `bake-timing-${report.runId}.json`
    )
    this.report = report
    this.flush()
  }

  static open(filePath, options = {}) {
    return new BakeTimingRecorder({ ...options, filePath })
  }

  reload() {
    if (this.filePath && fs.existsSync(this.filePath)) {
      this.report = readBakeTimingReport(this.filePath)
    }
  }

  flush() {
    const directory = path.dirname(this.filePath)

    fs.mkdirSync(directory, { recursive: true })
    fs.writeFileSync(this.filePath, `${JSON.stringify(this.report, null, 2)}\n`)
  }

  mergeWorkCounts(workCounts = {}) {
    for (const [key, value] of Object.entries(workCounts)) {
      if (!Number.isFinite(value)) {
        continue
      }

      this.report.workCounts[key] =
        (this.report.workCounts[key] ?? 0) + value
    }

    this.flush()
  }

  setQuality(category, value) {
    this.report.quality[category] = value
    this.flush()
  }

  recordProgress(message, data = {}) {
    this.report.progress.push({
      at: new Date().toISOString(),
      data,
      message
    })
    this.flush()
  }

  beginStep(name, data = {}) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const step = {
      ...data,
      durationHuman: null,
      durationMs: null,
      id,
      name,
      startedAt: new Date().toISOString(),
      status: 'running'
    }

    this.report.steps.push(step)
    if (data.levelId) {
      this.ensureLevel(data.levelId).steps.push(id)
    }
    this.flush()
    return id
  }

  endStep(id, status = 'completed', data = {}) {
    const step = this.report.steps.find((entry) => entry.id === id)

    if (!step) {
      return
    }

    const finishedAt = new Date().toISOString()
    const durationMs = Date.parse(finishedAt) - Date.parse(step.startedAt)

    Object.assign(step, data, {
      durationHuman: formatDurationMs(durationMs),
      durationMs,
      finishedAt,
      status
    })

    const total = this.report.stepTotals[step.name] ?? {
      count: 0,
      durationHuman: '0.000s',
      durationMs: 0
    }

    total.count += 1
    total.durationMs += durationMs
    total.durationHuman = formatDurationMs(total.durationMs)
    this.report.stepTotals[step.name] = total

    if (step.levelId) {
      const level = this.ensureLevel(step.levelId)
      const countsTowardLevelDuration =
        step.countsTowardLevelDuration === true ||
        ['lightmap', 'reflection-level'].includes(step.name)

      if (countsTowardLevelDuration) {
        level.durationMs = (level.durationMs ?? 0) + durationMs
        level.durationHuman = formatDurationMs(level.durationMs)
      }
      if (data.workCounts) {
        level.workCounts = {
          ...(level.workCounts ?? {}),
          ...data.workCounts
        }
      }
      if (data.quality) {
        level.quality = {
          ...(level.quality ?? {}),
          ...data.quality
        }
      }
    }

    this.flush()
  }

  ensureLevel(levelId) {
    this.report.levels[levelId] ??= {
      durationHuman: null,
      durationMs: 0,
      quality: {},
      steps: [],
      workCounts: {}
    }

    return this.report.levels[levelId]
  }

  finish(status = 'completed', data = {}) {
    const finishedAt = new Date().toISOString()
    const totalDurationMs = Date.parse(finishedAt) - this.startedAtMs

    Object.assign(this.report, data, {
      finishedAt,
      status,
      totalDurationHuman: formatDurationMs(totalDurationMs),
      totalDurationMs
    })
    this.flush()
  }
}

module.exports = {
  BakeTimingRecorder,
  createRunTimestamp,
  readBakeTimingReport
}
