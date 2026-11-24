import { createReadStream, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, extname, join } from 'node:path'
import type { Plugin } from 'vite'

const require = createRequire(import.meta.url)
const vendorPath = 'eye-tracking'
const mimeTypes: Record<string, string> = {
  '.js': 'text/javascript',
  '.wasm': 'application/wasm',
}

export default function eyeTrackingAssets(): Plugin {
  const script = require.resolve('webgazer')
  const modelPath = join(dirname(script), 'mediapipe', 'face_mesh')
  const assets = new Map([[vendorPath + '/webgazer.js', script]])
  for (const file of readdirSync(modelPath)) {
    if (file.startsWith('face_mesh') && file !== 'face_mesh.js') {
      assets.set(`${vendorPath}/face_mesh/${file}`, join(modelPath, file))
    }
  }

  return {
    name: 'focureader-eye-tracking-assets',
    configureServer(server) {
      const base = new URL(server.config.base, 'http://vite.local').pathname
      server.middlewares.use((request, response, next) => {
        const pathname = request.url?.split('?')[0] ?? ''
        const file = pathname.startsWith(base) && assets.get(pathname.slice(base.length))
        if (!file || (request.method !== 'GET' && request.method !== 'HEAD')) return next()
        response.setHeader('Content-Type', mimeTypes[extname(file)] ?? 'application/octet-stream')
        if (request.method === 'HEAD') return response.end()
        const stream = createReadStream(file)
        stream.on('error', next)
        stream.pipe(response)
      })
    },
    generateBundle() {
      for (const [fileName, file] of assets) {
        this.emitFile({ type: 'asset', fileName, source: readFileSync(file) })
      }
    },
  }
}
