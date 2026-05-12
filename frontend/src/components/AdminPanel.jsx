import { useState, useEffect } from 'react'
import api from '../api'

export default function AdminPanel() {
  const [users, setUsers] = useState([])
  const [orders, setOrders] = useState([])
  const [debugConfig, setDebugConfig] = useState(null)
  const [debugUsers, setDebugUsers] = useState(null)
  const [tab, setTab] = useState('users')
  const [msg, setMsg] = useState('')

  useEffect(() => { fetchUsers(); fetchOrders() }, [])

  const fetchUsers = () =>
    api.get('/admin/users').then(({ data }) => setUsers(data))

  const fetchOrders = () =>
    api.get('/admin/orders').then(({ data }) => setOrders(data))

  const deleteUser = async (id) => {
    if (!window.confirm(`Delete user ${id}?`)) return
    try {
      await api.delete(`/admin/users/${id}`)
      setMsg(`User ${id} deleted.`)
      fetchUsers()
    } catch (e) {
      setMsg(e.response?.data?.detail || 'Failed')
    }
  }

  const fetchDebugConfig = async () => {
    const { data } = await api.get('/debug/config')
    setDebugConfig(data)
    setTab('debug')
  }

  const fetchDebugUsers = async () => {
    const { data } = await api.get('/debug/users')
    setDebugUsers(data)
    setTab('debugUsers')
  }

  return (
    <div>
      <h2 style={styles.pageTitle}>🔧 Admin Panel</h2>

      <div style={styles.vulnNote}>
        <b>⚠️ Vulnerability Notes:</b>
        <ul style={styles.vulnList}>
          <li><b>[A01] Broken Access Control:</b> Admin access granted based solely on JWT claim <code>is_admin</code>. Forge the token with the weak secret <code>"secret"</code> to gain admin access as any user.</li>
          <li><b>[A05] Misconfig:</b> <code>/api/debug/config</code> and <code>/api/debug/users</code> require zero authentication — hit them directly from browser or curl.</li>
        </ul>
      </div>

      {/* Tab bar */}
      <div style={styles.tabs}>
        {['users', 'orders', 'debug', 'debugUsers'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{ ...styles.tab, ...(tab === t ? styles.activeTab : {}) }}
          >
            {{ users: '👥 Users', orders: '📦 Orders', debug: '⚙️ Debug Config', debugUsers: '🔑 Debug Users' }[t]}
          </button>
        ))}
        <button onClick={fetchDebugConfig} style={styles.warnBtn}>Load /debug/config</button>
        <button onClick={fetchDebugUsers} style={styles.warnBtn}>Load /debug/users</button>
      </div>

      {msg && <div style={styles.msg}>{msg}</div>}

      {/* Users tab */}
      {tab === 'users' && (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['ID', 'Username', 'Email', 'Password (plaintext!)', 'Admin', 'Balance', 'Actions'].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={styles.tr}>
                  <td style={styles.td}>{u.id}</td>
                  <td style={styles.td}>{u.username}</td>
                  <td style={styles.td}>{u.email}</td>
                  <td style={{ ...styles.td, color: '#fc8181', fontFamily: 'monospace' }}>{u.password}</td>
                  <td style={styles.td}>{u.is_admin ? '✅ Yes' : '❌ No'}</td>
                  <td style={{ ...styles.td, color: '#68d391' }}>${Number(u.balance).toFixed(2)}</td>
                  <td style={styles.td}>
                    <button onClick={() => deleteUser(u.id)} style={styles.delBtn}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Orders tab */}
      {tab === 'orders' && (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Order ID', 'User ID', 'Product ID', 'Qty', 'Total', 'Status', 'Created'].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} style={styles.tr}>
                  <td style={styles.td}>#{o.id}</td>
                  <td style={styles.td}>{o.user_id}</td>
                  <td style={styles.td}>{o.product_id}</td>
                  <td style={styles.td}>{o.quantity}</td>
                  <td style={{ ...styles.td, color: '#68d391' }}>${Number(o.total_price).toFixed(2)}</td>
                  <td style={styles.td}>{o.status}</td>
                  <td style={styles.td}>{o.created_at?.slice(0, 19)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Debug Config tab */}
      {tab === 'debug' && debugConfig && (
        <div style={styles.jsonPanel}>
          <h3 style={{ color: '#f6ad55', marginBottom: '12px' }}>
            /api/debug/config — No auth required! Exposes secret key & passwords.
          </h3>
          <pre style={styles.json}>{JSON.stringify(debugConfig, null, 2)}</pre>
        </div>
      )}

      {/* Debug Users tab */}
      {tab === 'debugUsers' && debugUsers && (
        <div style={styles.jsonPanel}>
          <h3 style={{ color: '#f6ad55', marginBottom: '12px' }}>
            /api/debug/users — No auth required! Returns all users with plaintext passwords.
          </h3>
          <pre style={styles.json}>{JSON.stringify(debugUsers, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}

const styles = {
  pageTitle: { fontSize: '22px', fontWeight: 700, marginBottom: '16px' },
  vulnNote: {
    background: '#1a1d2e', border: '2px solid #744210', borderRadius: '10px',
    padding: '16px 20px', marginBottom: '24px', fontSize: '13px', color: '#a0aec0',
  },
  vulnList: { paddingLeft: '20px', marginTop: '8px', lineHeight: '1.8' },
  tabs: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' },
  tab: {
    background: '#2d3748', color: '#a0aec0', border: '1px solid #4a5568',
    borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontSize: '13px',
  },
  activeTab: { background: '#3182ce', color: '#fff', borderColor: '#3182ce' },
  warnBtn: {
    background: '#744210', color: '#f6ad55', border: '1px solid #d69e2e',
    borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontSize: '13px',
  },
  msg: {
    background: '#1c4532', border: '1px solid #38a169', borderRadius: '8px',
    padding: '10px 14px', color: '#68d391', marginBottom: '16px', fontSize: '13px',
  },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    background: '#2d3748', padding: '12px 16px', textAlign: 'left',
    fontSize: '12px', color: '#a0aec0', fontWeight: 600, letterSpacing: '0.05em',
  },
  tr: { borderBottom: '1px solid #2d3748' },
  td: { padding: '12px 16px', fontSize: '13px', color: '#e2e8f0' },
  delBtn: {
    background: '#742a2a', color: '#fc8181', border: '1px solid #e53e3e',
    borderRadius: '6px', padding: '4px 12px', cursor: 'pointer', fontSize: '12px',
  },
  jsonPanel: {
    background: '#1a1d2e', border: '2px solid #744210',
    borderRadius: '12px', padding: '20px',
  },
  json: {
    background: '#0f1117', borderRadius: '8px', padding: '16px',
    color: '#68d391', fontSize: '13px', whiteSpace: 'pre-wrap', overflowX: 'auto',
  },
}
