import axios from 'axios'

// API base URL resolution:
//   - In dev (npm run dev), VITE_API_URL is unset → use the relative '/api' path
//     and let Vite's dev-server proxy forward to http://127.0.0.1:8000.
//   - In production (Vercel build), set VITE_API_URL to the deployed Railway
//     backend, e.g. https://vulnshop-backend.up.railway.app — the SPA then
//     calls <base>/api/* directly.
const RAW_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
const baseURL  = RAW_BASE ? `${RAW_BASE}/api` : '/api'

const api = axios.create({ baseURL })

// Attach stored JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default api
