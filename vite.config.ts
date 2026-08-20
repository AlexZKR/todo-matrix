import { defineConfig } from 'vite'

// base: './' keeps asset URLs relative, so the built app can be served
// from any sub-path (e.g. behind a reverse proxy on a home server).
export default defineConfig({
  base: './',
})
