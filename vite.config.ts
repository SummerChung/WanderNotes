import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/WanderNotes/', // 👈 這裡的名稱必須跟你的 GitHub 儲存庫名稱「完全一模一樣」
});
