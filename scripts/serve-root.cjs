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
    response.writeHead(200, {
      'Content-Length': stats.size,
      'Content-Type': contentTypes.get(extension) ?? 'application/octet-stream'
    })

    fs.createReadStream(filePath).pipe(response)
  })
})

server.listen(port, '127.0.0.1')
