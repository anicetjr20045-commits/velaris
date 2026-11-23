import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import authWhatsappHandler from './api/auth-whatsapp.ts'
import chariowCheckoutHandler from './api/chariow-checkout.ts'
import chariowWebhookHandler from './api/chariow-webhook.ts'
import chariowVerifyHandler from './api/chariow-verify.ts'
import checkExpirationsHandler from './api/check-expirations.ts'

function apiDevHandlersPlugin(): Plugin {
  return {
    name: 'api-dev-handlers',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        let handler: any = null;
        if (url.startsWith('/api/auth-whatsapp')) handler = authWhatsappHandler;
        else if (url.startsWith('/api/chariow-checkout')) handler = chariowCheckoutHandler;
        else if (url.startsWith('/api/chariow-webhook')) handler = chariowWebhookHandler;
        else if (url.startsWith('/api/chariow-verify')) handler = chariowVerifyHandler;
        else if (url.startsWith('/api/check-expirations')) handler = checkExpirationsHandler;

        if (handler) {
          let bodyStr = ''
          req.on('data', (chunk) => {
            bodyStr += chunk
          })
          req.on('end', async () => {
            try {
              ;(req as any).body = bodyStr ? JSON.parse(bodyStr) : {}
            } catch {
              ;(req as any).body = {}
            }
            const fakeRes = {
              statusCode: 200,
              setHeader(k: string, v: string) {
                res.setHeader(k, v)
              },
              status(code: number) {
                this.statusCode = code
                return this
              },
              json(data: any) {
                res.statusCode = this.statusCode
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify(data))
              },
              end() {
                res.statusCode = this.statusCode
                res.end()
              },
            }
            await handler(req, fakeRes)
          })
        } else {
          next()
        }
      })
    },
  }
}

export default defineConfig({
  base: process.env.VERCEL ? '/' : './',
  plugins: [
    react(),
    tailwindcss(),
    apiDevHandlersPlugin(),
  ],
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
    proxy: {
      '/api/local-llm': {
        target: 'http://127.0.0.1:4041',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/local-llm/, '/v1'),
      },
    },
  },
})
