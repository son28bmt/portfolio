import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  }
})
