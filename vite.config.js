// Конфигурация Vite: корень в src/, сборка в dist/ и SPA-fallback.
// После сборки index.html копируется в 404.html, чтобы прямой переход
// по вложенному маршруту работал на статическом хостинге.
import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  root: resolve(import.meta.dirname, 'src'),
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  plugins: [
    {
      // Копируем готовую SPA-страницу в 404.html.
      name: 'spa-fallback',
      closeBundle() {
        const dist = resolve(import.meta.dirname, 'dist')
        const index = resolve(dist, 'index.html')
        if (existsSync(index)) {
          copyFileSync(index, resolve(dist, '404.html'))
        }
      }
    }
  ],
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
