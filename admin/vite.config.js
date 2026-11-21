import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@layout-post-renderer': path.resolve(__dirname, '../shared/layout-post-renderer'),
      dompurify: path.resolve(__dirname, 'node_modules/dompurify'),
    },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    fs: { allow: [path.resolve(__dirname, '..')] },
    port: 5174,
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:5000', changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          tiptap: [
            '@tiptap/react', '@tiptap/starter-kit', '@tiptap/extension-image',
            '@tiptap/extension-link', '@tiptap/extension-table',
            '@tiptap/extension-table-row', '@tiptap/extension-table-header',
            '@tiptap/extension-table-cell', '@tiptap/extension-underline',
            '@tiptap/extension-youtube',
          ],
          dompurify: ['dompurify'],
        },
      },
    },
  }
})
