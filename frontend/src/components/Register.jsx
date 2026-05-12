import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api'
import { formStyles as s } from './formStyles'

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '', email: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/register', form)
      navigate('/login')
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h2 style={s.title}>📝 Create Account</h2>
        <p style={s.subtitle}>Join VulnShop today</p>

        <form onSubmit={submit} style={s.form}>
          <label style={s.label}>Username</label>
          <input name="username" value={form.username} onChange={handle} style={s.input} placeholder="Choose a username" required />

          <label style={s.label}>Email</label>
          <input name="email" type="email" value={form.email} onChange={handle} style={s.input} placeholder="you@example.com" required />

          <label style={s.label}>Password</label>
          <input name="password" type="password" value={form.password} onChange={handle} style={s.input} placeholder="Choose a password" required />

          {error && <div style={s.error}>{error}</div>}

          <button type="submit" disabled={loading} style={s.btn}>
            {loading ? 'Creating…' : 'Create Account'}
          </button>
        </form>

        <p style={s.footer}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
