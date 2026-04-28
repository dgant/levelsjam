const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const { execFileSync, spawn } = require('node:child_process')

const rootDir = path.resolve(__dirname, '..')
const logsDir = path.join(rootDir, 'logs')
const logPath = path.join(logsDir, 'vite-dev-server.log')
const statePath = path.join(rootDir, '.vite-dev-server.json')
const port = Number(process.env.LEVELSJAM_DEV_PORT ?? '5173')
const host = '127.0.0.1'
const url = `http://${host}:${port}/`
const viteBin = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js')
const command = process.argv[2] ?? 'status'

function readState() {
  if (!fs.existsSync(statePath)) {
    return null
  }

  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'))
  } catch {
    removeState()
    return null
  }
}

function writeState(state) {
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`)
}

function removeState() {
  if (fs.existsSync(statePath)) {
    fs.unlinkSync(statePath)
  }
}

function isProcessRunning(pid) {
  if (typeof pid !== 'number' || !Number.isFinite(pid)) {
    return false
  }

  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function getWindowsPortOwner() {
  if (process.platform !== 'win32') {
    return null
  }

  try {
    const script = [
      `$connection = Get-NetTCPConnection -LocalAddress ${host} -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1`,
      'if (-not $connection) { exit 0 }',
      '$ownerProcessId = $connection.OwningProcess',
      '$processInfo = Get-CimInstance Win32_Process -Filter "ProcessId=$ownerProcessId"',
      '[Console]::WriteLine(($processInfo.ProcessId.ToString() + "`t" + $processInfo.CommandLine))'
    ].join('; ')
    const output = execFileSync(
      'powershell.exe',
      ['-NoProfile', '-Command', script],
      { encoding: 'utf8', windowsHide: true }
    ).trim()

    if (!output) {
      return null
    }

    const [pidText, ...commandParts] = output.split('\t')
    const pid = Number(pidText)

    return Number.isFinite(pid)
      ? { commandLine: commandParts.join('\t'), pid }
      : null
  } catch {
    return null
  }
}

async function assertNoUnmanagedServer() {
  const owner = getWindowsPortOwner()

  if (owner) {
    throw new Error(
      [
        `Port ${port} is already owned by an unmanaged process.`,
        `pid: ${owner.pid}`,
        `command: ${owner.commandLine}`,
        'Stop that process before starting the managed headless dev server.'
      ].join('\n')
    )
  }

  const responding = await requestServer()
    .then(() => true)
    .catch(() => false)

  if (responding) {
    throw new Error(
      `${url} is already serving a page, but ${path.basename(statePath)} does not track a managed server. Stop the unmanaged server before continuing.`
    )
  }
}

function requestServer() {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      response.resume()
      response.on('end', () => {
        if ((response.statusCode ?? 500) < 500) {
          resolve()
          return
        }

        reject(new Error(`Unexpected status code ${response.statusCode}`))
      })
    })

    request.on('error', reject)
  })
}

async function waitForServer(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      await requestServer()
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }

  throw new Error(`Timed out waiting for ${url}`)
}

function cleanStaleState() {
  const state = readState()

  if (!state) {
    return null
  }

  if (isProcessRunning(state.pid)) {
    return state
  }

  removeState()
  return null
}

async function startServer() {
  const existingState = cleanStaleState()

  if (existingState) {
    await waitForServer()
    console.log(`Vite dev server already running at ${existingState.url} (pid ${existingState.pid})`)
    return
  }

  await assertNoUnmanagedServer()

  fs.mkdirSync(logsDir, { recursive: true })
  fs.appendFileSync(
    logPath,
    `\n[${new Date().toISOString()}] starting headless vite on ${url}\n`
  )

  const outputFd = fs.openSync(logPath, 'a')
  const child = spawn(
    process.execPath,
    [
      viteBin,
      '--host',
      host,
      '--port',
      String(port),
      '--strictPort',
      '--clearScreen',
      'false'
    ],
    {
      cwd: rootDir,
      detached: true,
      stdio: ['ignore', outputFd, outputFd],
      windowsHide: true
    }
  )

  fs.closeSync(outputFd)
  child.unref()

  const state = {
    pid: child.pid,
    url,
    host,
    port,
    logPath: path.relative(rootDir, logPath),
    startedAt: new Date().toISOString()
  }

  writeState(state)
  await waitForServer()
  if (!isProcessRunning(child.pid)) {
    removeState()
    throw new Error(`Vite process exited before ${url} became a verified managed server. See ${logPath}.`)
  }
  console.log(`Started headless Vite dev server at ${url} (pid ${child.pid})`)
  console.log(`Log: ${state.logPath}`)
}

async function stopServer() {
  const state = cleanStaleState()

  if (!state) {
    const owner = getWindowsPortOwner()

    if (owner) {
      console.log(`Vite dev server is not running, but port ${port} is occupied by an unmanaged process.`)
      console.log(`pid: ${owner.pid}`)
      console.log(`command: ${owner.commandLine}`)
      return
    }

    console.log('Vite dev server is not running')
    return
  }

  process.kill(state.pid)

  const deadline = Date.now() + 10_000
  while (Date.now() < deadline && isProcessRunning(state.pid)) {
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  removeState()
  console.log(`Stopped Vite dev server at ${state.url} (pid ${state.pid})`)
}

async function printStatus() {
  const state = cleanStaleState()

  if (!state) {
    console.log('Vite dev server is not running')
    return
  }

  const ready = await requestServer()
    .then(() => true)
    .catch(() => false)

  console.log(
    `Vite dev server ${ready ? 'running' : 'starting'} at ${state.url} (pid ${state.pid})`
  )
  console.log(`Log: ${state.logPath}`)
}

async function main() {
  if (command === 'start') {
    await startServer()
    return
  }

  if (command === 'stop') {
    await stopServer()
    return
  }

  if (command === 'status') {
    await printStatus()
    return
  }

  throw new Error(`Unknown command: ${command}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
