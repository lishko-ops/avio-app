import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base must match the GitHub repo name so assets resolve correctly
// when served from https://<username>.github.io/avio-app/
export default defineConfig({
  plugins: [react()],
  base: '/avio-app/',
});
