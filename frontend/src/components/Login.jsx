import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../App'
import { formStyles as s } from './formStyles'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', form)
      login(data.user, data.token)
      navigate('/products')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h2 style={s.title}>🔐 Sign In</h2>
        <p style={s.subtitle}>Welcome back to VulnShop</p>

        <div style={s.hint}>
          <b>Demo accounts:</b><br />
          <code>admin / admin123</code> &nbsp;|&nbsp;
          <code>alice / alice123</code> &nbsp;|&nbsp;
          <code>bob / bob123</code>
        </div>

        <form onSubmit={submit} style={s.form}>
          <label style={s.label}>Username</label>
          <input
            name="username"
            value={form.username}
            onChange={handle}
            style={s.input}
            placeholder="Enter username"
            required
          />

          <label style={s.label}>Password</label>
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={handle}
            style={s.input}
            placeholder="Enter password"
            required
          />

          {error && <div style={s.error}>{error}</div>}

          <button type="submit" disabled={loading} style={s.btn}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={s.footer}>
          No account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  )
}
