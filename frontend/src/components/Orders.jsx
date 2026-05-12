import { useState, useEffect } from 'react'
import api from '../api'

export default function Orders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  // IDOR probe: manually fetch any order by ID
  const [probeId, setProbeId] = useState('')
  const [probeResult, setProbeResult] = useState(null)
  const [probeErr, setProbeErr] = useState('')

  useEffect(() => {
    api.get('/orders')
      .then(({ data }) => setOrders(data))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false))
  }, [])

  const fetchOrder = async (e) => {
    e.preventDefault()
    setProbeResult(null)
    setProbeErr('')
    try {
      const { data } = await api.get(`/orders/${probeId}`)
      setProbeResult(data)
    } catch (err) {
      setProbeErr(err.response?.data?.detail || 'Not found')
    }
  }

  return (
    <div>
      <h2 style={styles.pageTitle}>📦 My Orders</h2>

      {loading && <p style={styles.dim}>Loading…</p>}
      {!loading && orders.length === 0 && (
        <p style={styles.dim}>No orders yet. Go buy something!</p>
      )}

      <div style={styles.grid}>
        {orders.map((o) => (
          <div key={o.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.orderId}>Order #{o.id}</span>
              <span style={statusColor(o.status)}>{o.status.toUpperCase()}</span>
            </div>
            <div style={styles.detail}>Product ID: <b>{o.product_id}</b></div>
            <div style={styles.detail}>Quantity: <b>{o.quantity}</b></div>
            <div style={styles.detail}>Total: <b style={{ color: '#68d391' }}>${Number(o.total_price).toFixed(2)}</b></div>
            <div style={styles.date}>{o.created_at?.slice(0, 19).replace('T', ' ')}</div>
          </div>
        ))}
      </div>

      {/* IDOR Demo Panel */}
      <div style={styles.idorPanel}>
        <h3 style={styles.idorTitle}>
          🔍 Fetch Order by ID <span style={styles.vulnTag}>[A01: IDOR Practice]</span>
        </h3>
        <p style={styles.idorDesc}>
          The server does <b>not</b> verify that the order belongs to you.
          Try any order ID (1, 2, 3…) to view other users' orders.
        </p>
        <form onSubmit={fetchOrder} style={styles.idorRow}>
          <input
            type="number"
            value={probeId}
            onChange={(e) => setProbeId(e.target.value)}
            placeholder="Order ID (e.g. 1, 2, 3)"
            style={styles.idorInput}
            min="1"
          />
          <button type="submit" style={styles.idorBtn}>Fetch</button>
        </form>
        {probeResult && (
          <pre style={styles.result}>{JSON.stringify(probeResult, null, 2)}</pre>
        )}
        {probeErr && <div style={styles.err}>{probeErr}</div>}
      </div>
    </div>
  )
}

function statusColor(s) {
  const colors = { completed: '#68d391', pending: '#f6ad55', failed: '#fc8181' }
  return { color: colors[s] || '#a0aec0', fontWeight: 700, fontSize: '12px' }
}

const styles = {
  pageTitle: { fontSize: '22px', fontWeight: 700, marginBottom: '20px' },
  dim: { color: '#4a5568' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '16px',
    marginBottom: '40px',
  },
  card: {
    background: '#1a1d2e', border: '1px solid #2d3748',
    borderRadius: '12px', padding: '20px', display: 'flex',
    flexDirection: 'column', gap: '8px',
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '4px' },
  orderId: { fontWeight: 700, color: '#63b3ed' },
  detail: { fontSize: '14px', color: '#a0aec0' },
  date: { fontSize: '12px', color: '#4a5568', marginTop: '4px' },
  idorPanel: {
    background: '#1a1d2e', border: '2px solid #744210',
    borderRadius: '12px', padding: '24px', marginTop: '32px',
  },
  idorTitle: { fontSize: '16px', fontWeight: 700, marginBottom: '10px' },
  vulnTag: {
    background: '#744210', color: '#f6ad55',
    fontSize: '12px', padding: '2px 8px', borderRadius: '4px', marginLeft: '8px',
  },
  idorDesc: { fontSize: '13px', color: '#a0aec0', marginBottom: '16px', lineHeight: '1.5' },
  idorRow: { display: 'flex', gap: '10px', marginBottom: '16px' },
  idorInput: {
    flex: 1, background: '#0f1117', border: '1px solid #4a5568',
    borderRadius: '8px', padding: '10px 14px', color: '#e2e8f0', fontSize: '14px',
  },
  idorBtn: {
    background: '#d69e2e', color: '#000', border: 'none',
    borderRadius: '8px', padding: '10px 20px', fontWeight: 700, cursor: 'pointer',
  },
  result: {
    background: '#0f1117', border: '1px solid #2d3748',
    borderRadius: '8px', padding: '14px', color: '#68d391',
    fontSize: '13px', whiteSpace: 'pre-wrap', overflowX: 'auto',
  },
  err: {
    background: '#742a2a', border: '1px solid #e53e3e',
    borderRadius: '8px', padding: '10px', color: '#fc8181', fontSize: '13px',
  },
}
