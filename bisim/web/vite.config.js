import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // נתיב יחסי: האתר יושב תחת /points/ ב-GitHub Pages
  base: './',
  plugins: [react(), tailwindcss()],
  server: { fs: { allow: ['..'] } },
});
