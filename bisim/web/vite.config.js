import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // נתיב יחסי: האתר עובד מכל תיקייה
  base: './',
  plugins: [react(), tailwindcss()],
  server: { fs: { allow: ['..'] } },
});
