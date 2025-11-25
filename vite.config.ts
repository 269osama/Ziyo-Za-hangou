import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');

  // CRITICAL: Vercel exposes variables in process.env during build.
  // We check process.env first, then the loaded .env file.
  // We look for both API_KEY and VITE_API_KEY.
  const apiKey = 
    process.env.API_KEY || 
    process.env.VITE_API_KEY || 
    env.API_KEY || 
    env.VITE_API_KEY || 
    '';

  return {
    plugins: [react()],
    define: {
      // Inject the key into the code at build time
      'process.env.API_KEY': JSON.stringify(apiKey),
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    }
  };
});