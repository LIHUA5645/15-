// 版权声明：肖沐樑  QQ：3387432690
// 完成时间：2026，09，18
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// base 设为相对路径，便于 Electron 直接加载 dist/index.html 与静态部署
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: true, port: 5173 },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
  },
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  // Electron 主进程不进构建
  optimizeDeps: { exclude: ['electron'] },
});
