
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Không định nghĩa API_KEY ở đây nữa để ẩn hoàn toàn khỏi client-side
    'process.env': process.env
  }
});
