import { defineConfig } from 'vite';
import { execFileSync } from 'node:child_process';

function localBackend() {
  const cli = 'node_modules/.bin/icp';
  const options = {encoding:'utf8' as const,stdio:'pipe' as const};
  const network = JSON.parse(execFileSync(cli,['network','status','--json'],options));
  const ids=['records','rooms'].flatMap(name=>{try{return [`PUBLIC_CANISTER_ID:${name}=${execFileSync(cli,['canister','status',name,'--id-only'],options).trim()}`];}catch{return [];}});
  return {headers:{'Set-Cookie':`ic_env=${encodeURIComponent(`${ids.join('&')}&ic_root_key=${network.root_key}`)}; Path=/; SameSite=Lax`},proxy:{'/api':{target:network.api_url,changeOrigin:true}}};
}

export default defineConfig(({command}) => ({
  ...(command === 'serve' && process.env.ICP_LOCAL_BACKEND === '1' ? {server:localBackend()} : {}),
  base: './',
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('playcanvas')) return 'renderer';
          if (id.includes('@dimforge/rapier3d-compat')) return 'physics';
        },
      },
    },
  },
}));
