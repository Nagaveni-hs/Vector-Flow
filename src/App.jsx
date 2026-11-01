import { Routes, Route, Link } from 'react-router-dom'
import Home from './pages/Home.jsx'

export default function App() {
  return (
    <div>
      <header style={{ padding: '1rem', borderBottom: '1px solid #ddd' }}>
        <Link to="/" style={{ fontWeight: 'bold', textDecoration: 'none', color: 'inherit' }}>
          Vector Flow
        </Link>{' '}
        <span style={{ color: '#666' }}>— VVCE, CSE (AI &amp; ML)</span>
      </header>
      <main style={{ padding: '1rem', maxWidth: '900px', margin: '0 auto' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="*" element={<p>Page not found. Go back <Link to="/">home</Link>.</p>} />
        </Routes>
      </main>
    </div>
  )
}
