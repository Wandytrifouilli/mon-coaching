import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// En dev, sert les fonctions de api/ (déployées sur Vercel en prod) pour que la connexion et l'IA marchent en local.
// Identifiants serveur : FIREBASE_SERVICE_ACCOUNT, ou les émulateurs (FIRESTORE_EMULATOR_HOST + FIREBASE_AUTH_EMULATOR_HOST).
function apiDevServer() {
  return {
    name: 'api-dev-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const name = req.url?.match(/^\/api\/([a-z-]+)(?:\?|$)/)?.[1]
        if (!name) return next()
        try {
          const mod = await server.ssrLoadModule(`/api/${name}.js`)
          let raw = ''
          for await (const chunk of req) raw += chunk
          try { req.body = raw ? JSON.parse(raw) : {} } catch { req.body = {} }
          res.status = code => { res.statusCode = code; return res }
          res.json = obj => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); return res }
          await mod.default(req, res)
        } catch (e) {
          next(e)
        }
      })
    },
  }
}

// `vite --mode emulators` : app + fonctions api/ branchées sur les émulateurs Firebase locaux (aucune donnée réelle)
function useEmulators() {
  delete process.env.FIREBASE_SERVICE_ACCOUNT
  Object.assign(process.env, {
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
    GCLOUD_PROJECT: 'demo-wandy',
  })
  return { 'import.meta.env.VITE_FIREBASE_EMULATORS': JSON.stringify('1') }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), apiDevServer()],
  define: mode === 'emulators' ? useEmulators() : {},
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        coach: resolve(__dirname, 'coach.html'),
      },
    },
  },
}))
