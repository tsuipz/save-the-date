import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// `base` must match the GitHub Pages repo name so built asset URLs resolve
// at https://<user>.github.io/save-the-date/.
export default defineConfig({
  base: '/save-the-date/',
  plugins: [react(), tailwindcss()],
})
