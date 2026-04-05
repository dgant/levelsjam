import path from 'node:path'
import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function readGitMetadata() {
  try {
    const revision = execSync('git rev-parse --short=12 HEAD', {
      cwd: __dirname,
      encoding: 'utf8'
    }).trim()
    const revisionTimestamp = execSync('git log -1 --format=%cI HEAD', {
      cwd: __dirname,
      encoding: 'utf8'
    }).trim()

    return {
      revision,
      revisionTimestamp
    }
  } catch {
    return {
      revision: 'unknown',
      revisionTimestamp: 'unknown'
    }
  }
}

const gitMetadata = readGitMetadata()

export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    __GIT_REVISION__: JSON.stringify(gitMetadata.revision),
    __GIT_REVISION_TIMESTAMP__: JSON.stringify(gitMetadata.revisionTimestamp)
  },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/main.tsx'),
      output: {
        entryFileNames: 'assets/app.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'assets/app.css'
          }
          return 'assets/[name][extname]'
        }
      }
    }
  }
})
