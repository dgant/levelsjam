class PlaywrightProgressReporter {
  constructor() {
    this.runningTests = new Map()
    this.interval = null
  }

  onBegin(config, suite) {
    console.log(`[playwright-progress] starting ${suite.allTests().length} tests`)
    this.interval = setInterval(() => {
      if (this.runningTests.size === 0) {
        console.log('[playwright-progress] no tests currently running')
        return
      }

      const now = Date.now()
      for (const [testId, test] of this.runningTests) {
        const elapsedSeconds = ((now - test.startedAt) / 1000).toFixed(1)
        console.log(`[playwright-progress] running ${elapsedSeconds}s: ${test.titlePath}`)
      }
    }, 15_000)
    this.interval.unref?.()
  }

  onTestBegin(test) {
    const titlePath = test.titlePath().filter(Boolean).join(' > ')
    this.runningTests.set(test.id, {
      startedAt: Date.now(),
      titlePath
    })
    console.log(`[playwright-progress] begin: ${titlePath}`)
  }

  onTestEnd(test, result) {
    const running = this.runningTests.get(test.id)
    const elapsedSeconds = running
      ? ((Date.now() - running.startedAt) / 1000).toFixed(1)
      : 'unknown'
    const titlePath = running?.titlePath ?? test.titlePath().filter(Boolean).join(' > ')

    this.runningTests.delete(test.id)
    console.log(`[playwright-progress] ${result.status} after ${elapsedSeconds}s: ${titlePath}`)
  }

  onEnd(result) {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    console.log(`[playwright-progress] finished: ${result.status}`)
  }
}

module.exports = PlaywrightProgressReporter
