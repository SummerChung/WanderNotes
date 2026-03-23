import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/WanderNotes/', // 👈 這裡一定要加上你的儲存庫名稱，前後都要有斜線
});
