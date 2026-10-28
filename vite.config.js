import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  root: resolve(import.meta.dirname, 'src'),
  build: {
    outDir: '../dist'
  },
  server: {
    port: 8080
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Подавляем предупреждения из зависимостей (Bootstrap)
        quietDeps: true,
        // Явно указываем, какие типы предупреждений игнорировать
        silenceDeprecations: [
          'import',
          'global-builtin',
          'if-function',
          'color-functions'
        ]
      }
    }
  }
})