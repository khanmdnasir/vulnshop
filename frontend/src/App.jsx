import { useState, useEffect, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom'
import Login from './components/Login'
import Register from './components/Register'
import Products from './components/Products'
import Orders from './components/Orders'
import AdminPanel from './components/AdminPanel'
import Profile from './components/Profile'

// ---- Auth context ----
export const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}

function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <nav style={styles.nav}>
      <Link to="/products" style={styles.brand}>🛒 VulnShop</Link>
      <div style={styles.navLinks}>
        {user ? (
          <>
            <Link to="/products" style={styles.navLink}>Products</Link>
            <Link to="/orders" style={styles.navLink}>My Orders</Link>
            <Link to="/profile" style={styles.navLink}>Profile</Link>
            {user.is_admin && (
              <Link to="/admin" style={{ ...styles.navLink, color: '#f6ad55' }}>Admin</Link>
            )}
            <span style={styles.balance}>💰 ${Number(user.balance).toFixed(2)}</span>
            <span style={styles.username}>👤 {user.username}</span>
            <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login" style={styles.navLink}>Login</Link>
            <Link to="/register" style={styles.navLink}>Register</Link>
          </>
        )}
      </div>
    </nav>
  )
}

function ProtectedRoute({ children, adminOnly = false }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && !user.is_admin) return <Navigate to="/products" replace />
  return children
}

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user'))
    } catch {
      return null
    }
  })
  const [cart, setCart] = useState([])

  const login = (userData, token) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    setCart([])
  }

  const updateUser = (updated) => {
    const merged = { ...user, ...updated }
    localStorage.setItem('user', JSON.stringify(merged))
    setUser(merged)
  }

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id)
      if (existing) {
        return prev.map((i) =>
          i.id === product.id ? { ...i, qty: i.qty + 1 } : i
        )
      }
      return [...prev, { ...product, qty: 1 }]
    })
  }

  const removeFromCart = (id) => setCart((prev) => prev.filter((i) => i.id !== id))
  const clearCart = () => setCart([])

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, cart, addToCart, removeFromCart, clearCart }}>
      <BrowserRouter>
        <Navbar />
        <div style={styles.main}>
          <Routes>
            <Route path="/" element={<Navigate to={user ? '/products' : '/login'} replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute adminOnly><AdminPanel /></ProtectedRoute>} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}

const styles = {
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    height: '60px',
    background: '#1a1d2e',
    borderBottom: '1px solid #2d3748',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  brand: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#63b3ed',
    textDecoration: 'none',
  },
  navLinks: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  navLink: {
    color: '#a0aec0',
    textDecoration: 'none',
    fontSize: '14px',
    transition: 'color 0.2s',
  },
  balance: {
    color: '#68d391',
    fontSize: '14px',
    fontWeight: 600,
  },
  username: {
    color: '#a0aec0',
    fontSize: '14px',
  },
  logoutBtn: {
    background: '#e53e3e',
    color: '#fff',
    border: 'none',
    padding: '6px 14px',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  main: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '32px 16px',
  },
}
