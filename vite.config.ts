import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to load firebase config from JSON if it exists
let firebaseConfig = {};
try {
  const configPath = path.resolve(__dirname, './firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
} catch (e) {
  console.warn('Could not load firebase-applet-config.json', e);
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  // Merge firebase config into environment variables
  const mergedEnv = {
    ...env,
    VITE_FIREBASE_API_KEY: env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
    VITE_FIREBASE_AUTH_DOMAIN: env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
    VITE_FIREBASE_PROJECT_ID: env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
    VITE_FIREBASE_STORAGE_BUCKET: env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
    VITE_FIREBASE_MESSAGING_SENDER_ID: env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
    VITE_FIREBASE_APP_ID: env.VITE_FIREBASE_APP_ID || firebaseConfig.appId,
    VITE_FIREBASE_MEASUREMENT_ID: env.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfig.measurementId,
    VITE_FIREBASE_FIRESTORE_DATABASE_ID: env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || firebaseConfig.firestoreDatabaseId,
    GEMINI_API_KEY: env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY,
  };

  return {
    base: './',
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(mergedEnv.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
// Vite Configuration for WanderNotes
