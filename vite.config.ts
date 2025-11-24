import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Use '.' as current directory instead of process.cwd() to avoid TS type error
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    // This allows process.env.API_KEY to work in the browser code
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY || '')
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    }
  };
});