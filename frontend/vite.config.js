import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// VulnShop is a loopback-only training lab. Both the dev server and the
// upstream /api proxy use 127.0.0.1 (IPv4) so:
//   1. Burp Suite — which resolves "localhost" to 127.0.0.1 for upstream
//      hops — can reach Vite. Node 17+ flips localhost to ::1 (IPv6-only)
//      by default, which silently breaks Burp's proxying.
//   2. The dev server is unreachable from any other host on the network.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
