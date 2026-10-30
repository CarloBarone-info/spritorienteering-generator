import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves project sites under /<repository>/, not the domain root.
// Keep local npm run dev at / while using the correct base for Pages builds.
const base = process.env.GITHUB_PAGES === 'true' ? '/spritorienteering-generator/' : '/'

export default defineConfig({
  base,
  plugins: [react()],
})
