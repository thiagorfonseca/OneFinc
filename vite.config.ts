import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const FALLBACK_SUPABASE_URL = 'https://kevzqjffwbcjxvoebfll.supabase.co';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || FALLBACK_SUPABASE_URL;

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/ai/clinic-assistant': {
          target: supabaseUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/ai\/clinic-assistant/, '/functions/v1/clinic-assistant'),
        },
      },
    },
  };
})
