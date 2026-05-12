import { useState, useEffect } from 'react'
import api from '../api'
import { useAuth } from '../App'
import { formStyles as s } from './formStyles'

export default function Profile() {
  const { user, updateUser } = useAuth()
  const [form, setForm] = useState({ email: '', balance: '' })
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    api.get('/profile').then(({ data }) => {
      setForm({ email: data.email || '', balance: data.balance })
      updateUser({ balance: data.balance })
    })
  }, [])

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setMsg(''); setErr('')
    try {
      const payload = { email: form.email }
      // [A01] Mass assignment — balance field accepted from client
      if (form.balance !== '') payload.balance = parseFloat(form.balance)
      const { data } = await api.put('/profile', payload)
      updateUser({ email: data.email, balance: data.balance })
      setMsg('Profile updated!')
    } catch (ex) {
      setErr(ex.response?.data?.detail || 'Update failed')
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h2 style={s.title}>👤 Profile</h2>
        <p style={s.subtitle}>Logged in as <b>{user?.username}</b></p>

        <div style={s.hint}>
          <b style={{ color: '#f6ad55' }}>⚠️ Mass Assignment [A01]:</b><br />
          The server accepts a <code>balance</code> field from the client.
          Set any balance value here — the server updates it without restriction.
        </div>

        <form onSubmit={submit} style={s.form}>
          <label style={s.label}>Email</label>
          <input name="email" value={form.email} onChange={handle} style={s.input} />

          <label style={s.label}>Balance (mass-assignment vuln)</label>
          <input
            name="balance"
            type="number"
            value={form.balance}
            onChange={handle}
            style={{ ...s.input, borderColor: '#744210' }}
          />

          {msg && <div style={s.success}>{msg}</div>}
          {err && <div style={s.error}>{err}</div>}

          <button type="submit" style={s.btn}>Update Profile</button>
        </form>
      </div>
    </div>
  )
}
