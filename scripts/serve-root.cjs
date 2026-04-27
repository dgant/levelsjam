const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = process.cwd()
const port = Number(process.argv[2] ?? '4173')

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.bin', 'application/octet-stream'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp']
])

function resolvePath(requestUrl) {
  const pathname = new URL(requestUrl, `http://127.0.0.1:${port}`).pathname
  const relativePath = decodeURIComponent(pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''))
  return path.join(rootDir, relativePath)
}

const server = http.createServer((request, response) => {
  const filePath = resolvePath(request.url ?? '/')

  if (!filePath.startsWith(rootDir)) {
    response.writeHead(403).end('Forbidden')
    return
  }

  fs.stat(filePath, (error, stats) => {
    if (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Not found')
      return
    }

    const extension = path.extname(filePath)
    const stream = fs.createReadStream(filePath)

    stream.on('error', (streamError) => {
      console.error('[serve-root] failed to stream asset', filePath, streamError)
      if (!response.headersSent) {
        response.writeHead(500)
      }
      response.end()
    })
    response.on('error', (responseError) => {
      console.error('[serve-root] response error', filePath, responseError)
      stream.destroy()
    })

    response.writeHead(200, {
      'Content-Length': stats.size,
      'Content-Type': contentTypes.get(extension) ?? 'application/octet-stream'
    })

    stream.pipe(response)
  })
})

server.on('clientError', (error, socket) => {
  console.error('[serve-root] client error', error)
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
})

process.on('uncaughtException', (error) => {
  console.error('[serve-root] uncaught exception', error)
})

process.on('unhandledRejection', (error) => {
  console.error('[serve-root] unhandled rejection', error)
})

server.listen(port, '127.0.0.1')
