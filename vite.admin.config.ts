import { defineConfig } from 'vite';

export default defineConfig({
  root: 'admin',
  base: '/',
  build: {outDir: '../dist-admin', emptyOutDir: true, target: 'es2022'},
});
