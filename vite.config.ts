import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/WanderNotes/', // 👈 這裡一定要有，且名稱要跟你的 GitHub 儲存庫名稱完全一樣
});
