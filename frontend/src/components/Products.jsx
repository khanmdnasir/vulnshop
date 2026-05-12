import { useState, useEffect } from 'react'
import api from '../api'
import { useAuth } from '../App'

export default function Products() {
  const { cart, addToCart, removeFromCart, clearCart, user, updateUser } = useAuth()
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [orderMsg, setOrderMsg] = useState('')
  const [orderErr, setOrderErr] = useState('')

  const fetchProducts = async (q = '') => {
    setLoading(true)
    try {
      const { data } = await api.get('/products', { params: q ? { search: q } : {} })
      setProducts(data)
    } catch {
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProducts() }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    fetchProducts(search)
  }

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0)

  const checkout = async () => {
    setOrderMsg('')
    setOrderErr('')
    if (!cart.length) return

    const results = []
    for (const item of cart) {
      try {
        // NOTE: price is sent from the client — this is the Payment Bypass vulnerability
        const { data } = await api.post('/orders', {
          product_id: item.id,
          quantity: item.qty,
          price: item.price,   // <-- server trusts this value
        })
        results.push(`✅ Order #${data.order_id}: ${item.name} x${item.qty} — $${data.total_price.toFixed(2)}`)
      } catch (err) {
        results.push(`❌ ${item.name}: ${err.response?.data?.detail || 'Failed'}`)
      }
    }

    // Refresh balance
    try {
      const { data: profile } = await api.get('/profile')
      updateUser({ balance: profile.balance })
    } catch {}

    clearCart()
    setOrderMsg(results.join('\n'))
  }

  return (
    <div>
      <h2 style={styles.pageTitle}>🛍️ Products</h2>

      {/* Search — SQL injection entry point */}
      <form onSubmit={handleSearch} style={styles.searchRow}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products… (try SQL injection here)"
          style={styles.searchInput}
        />
        <button type="submit" style={styles.searchBtn}>Search</button>
        <button type="button" onClick={() => { setSearch(''); fetchProducts('') }} style={styles.clearBtn}>Clear</button>
      </form>

      <div style={styles.layout}>
        {/* Product grid */}
        <div style={styles.grid}>
          {loading && <p style={styles.dim}>Loading…</p>}
          {!loading && products.length === 0 && <p style={styles.dim}>No products found.</p>}
          {products.map((p) => (
            <div key={p.id} style={styles.card}>
              <div style={styles.cardEmoji}>{productEmoji(p.name)}</div>
              <h3 style={styles.productName}>{p.name}</h3>
              <p style={styles.desc}>{p.description}</p>
              <div style={styles.cardBottom}>
                <span style={styles.price}>${p.price.toFixed(2)}</span>
                <button onClick={() => addToCart(p)} style={styles.addBtn}>Add to Cart</button>
              </div>
              <div style={styles.stock}>Stock: {p.stock} &nbsp;|&nbsp; ID: {p.id}</div>
            </div>
          ))}
        </div>

        {/* Cart */}
        <div style={styles.cartPanel}>
          <h3 style={styles.cartTitle}>🛒 Cart</h3>
          {cart.length === 0 ? (
            <p style={styles.dim}>Cart is empty</p>
          ) : (
            <>
              {cart.map((item) => (
                <div key={item.id} style={styles.cartItem}>
                  <span style={styles.cartName}>{item.name}</span>
                  <span style={styles.cartQty}>x{item.qty}</span>
                  <span style={styles.cartPrice}>${(item.price * item.qty).toFixed(2)}</span>
                  <button onClick={() => removeFromCart(item.id)} style={styles.removeBtn}>✕</button>
                </div>
              ))}
              <div style={styles.cartTotal}>
                Total: <b>${cartTotal.toFixed(2)}</b>
              </div>
              <button onClick={checkout} style={styles.checkoutBtn}>
                Checkout
              </button>
              <button onClick={clearCart} style={styles.clearCartBtn}>Clear</button>
            </>
          )}
          {orderMsg && (
            <pre style={styles.orderMsg}>{orderMsg}</pre>
          )}
          {orderErr && <div style={styles.orderErr}>{orderErr}</div>}
        </div>
      </div>
    </div>
  )
}

function productEmoji(name) {
  const map = { Laptop: '💻', Smartphone: '📱', Headphones: '🎧', Keyboard: '⌨️', Mouse: '🖱️' }
  return map[name] || '📦'
}

const styles = {
  pageTitle: { fontSize: '22px', fontWeight: 700, marginBottom: '20px' },
  searchRow: { display: 'flex', gap: '10px', marginBottom: '24px' },
  searchInput: {
    flex: 1, background: '#1a1d2e', border: '1px solid #2d3748',
    borderRadius: '8px', padding: '10px 14px', color: '#e2e8f0', fontSize: '14px',
  },
  searchBtn: {
    background: '#3182ce', color: '#fff', border: 'none', borderRadius: '8px',
    padding: '10px 20px', fontWeight: 600, cursor: 'pointer',
  },
  clearBtn: {
    background: '#4a5568', color: '#fff', border: 'none', borderRadius: '8px',
    padding: '10px 16px', cursor: 'pointer',
  },
  layout: { display: 'flex', gap: '24px', alignItems: 'flex-start' },
  grid: {
    flex: 1, display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px',
  },
  card: {
    background: '#1a1d2e', border: '1px solid #2d3748', borderRadius: '12px',
    padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px',
  },
  cardEmoji: { fontSize: '36px' },
  productName: { fontSize: '16px', fontWeight: 700, color: '#e2e8f0' },
  desc: { fontSize: '13px', color: '#718096', flexGrow: 1 },
  cardBottom: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  price: { fontSize: '18px', fontWeight: 700, color: '#68d391' },
  addBtn: {
    background: '#2b6cb0', color: '#fff', border: 'none',
    borderRadius: '6px', padding: '6px 14px', fontSize: '13px', cursor: 'pointer',
  },
  stock: { fontSize: '11px', color: '#4a5568' },
  cartPanel: {
    width: '280px', background: '#1a1d2e', border: '1px solid #2d3748',
    borderRadius: '12px', padding: '20px', position: 'sticky', top: '80px',
  },
  cartTitle: { fontSize: '16px', fontWeight: 700, marginBottom: '16px' },
  cartItem: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '8px 0', borderBottom: '1px solid #2d3748',
  },
  cartName: { flex: 1, fontSize: '13px', color: '#e2e8f0' },
  cartQty: { fontSize: '12px', color: '#718096' },
  cartPrice: { fontSize: '13px', color: '#68d391', fontWeight: 600 },
  removeBtn: {
    background: 'none', border: 'none', color: '#e53e3e',
    cursor: 'pointer', fontSize: '14px', padding: '2px 4px',
  },
  cartTotal: {
    padding: '12px 0', fontSize: '15px', color: '#e2e8f0',
    borderBottom: '1px solid #2d3748', marginBottom: '12px',
  },
  checkoutBtn: {
    width: '100%', background: '#38a169', color: '#fff', border: 'none',
    borderRadius: '8px', padding: '12px', fontWeight: 700, cursor: 'pointer',
    marginBottom: '8px',
  },
  clearCartBtn: {
    width: '100%', background: '#4a5568', color: '#fff', border: 'none',
    borderRadius: '8px', padding: '8px', cursor: 'pointer',
  },
  orderMsg: {
    marginTop: '14px', background: '#1c4532', border: '1px solid #38a169',
    borderRadius: '8px', padding: '10px', fontSize: '12px',
    color: '#68d391', whiteSpace: 'pre-wrap',
  },
  orderErr: {
    marginTop: '10px', background: '#742a2a', border: '1px solid #e53e3e',
    borderRadius: '8px', padding: '10px', fontSize: '12px', color: '#fc8181',
  },
  dim: { color: '#4a5568', fontSize: '14px' },
}
