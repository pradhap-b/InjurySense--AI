import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const clientRoot = dirname(fileURLToPath(import.meta.url))

function createStandaloneHtml() {
  return {
    name: 'injurysense-standalone-html',
    apply: 'build',
    closeBundle() {
      const outputDir = resolve(clientRoot, 'dist')
      let html = readFileSync(resolve(outputDir, 'index.html'), 'utf8')
      html = html.replace(/<script\b([^>]*?)src="([^"]+)"([^>]*)><\/script>/g, (tag, before, src, after) => {
        const scriptPath = resolve(outputDir, src.replace(/^\.\//, '').replace(/^\//, ''))
        const script = readFileSync(scriptPath, 'utf8').replace(/<\/script/gi, '<\\/script')
        return `<script${before}${after}>${script}</script>`
      })
      html = html.replace(/<link\b([^>]*?)href="([^"]+\.css)"([^>]*)>/g, (tag, before, href, after) => {
        const cssPath = resolve(outputDir, href.replace(/^\.\//, '').replace(/^\//, ''))
        return `<style${before}${after}>${readFileSync(cssPath, 'utf8')}</style>`
      })
      writeFileSync(resolve(clientRoot, '../../index.html'), html)
    }
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), createStandaloneHtml()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: { '/api': 'http://localhost:5000' },
    watch: { ignored: ['**/public/wasm/**'] }
  },
  build: {
    assetsInlineLimit: Infinity,
    rollupOptions: { output: { inlineDynamicImports: true } }
  },
})
