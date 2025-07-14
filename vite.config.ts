import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    'import.meta.env.VITE_DB_HOST': JSON.stringify(process.env.VITE_DB_HOST || 'localhost'),
    'import.meta.env.VITE_DB_PORT': JSON.stringify(process.env.VITE_DB_PORT || '5432'),
    'import.meta.env.VITE_DB_NAME': JSON.stringify(process.env.VITE_DB_NAME || 'budget_manager'),
    'import.meta.env.VITE_DB_USER': JSON.stringify(process.env.VITE_DB_USER || 'budget_user'),
    'import.meta.env.VITE_DB_PASSWORD': JSON.stringify(process.env.VITE_DB_PASSWORD || ''),
    'import.meta.env.VITE_APP_PASSWORD': JSON.stringify(process.env.VITE_APP_PASSWORD || ''),
  },
});
