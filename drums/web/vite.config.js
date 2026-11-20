import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  // הבמה התלת־ממדית (three.js) היא קובץ נפרד שנטען אחרי הפתיחה
  build: { chunkSizeWarningLimit: 700 },
});
