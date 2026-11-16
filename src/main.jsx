import React from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App.jsx'
import { start } from './engine.js'

// If a screen crashes, show a friendly message instead of a blank page.
class Boundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null } }
  static getDerivedStateFromError(err) { return { err } }
  componentDidCatch(err, info) { console.error('[golazo] screen crashed', err, info) }
  render() {
    if (!this.state.err) return this.props.children
    return <div style={{ padding: 40, color: '#dce9f5', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h2>Something went wrong on this screen.</h2><p>Your tickets are safe. Reload the page to continue.</p>
      <button onClick={() => location.reload()}>Reload</button></div>
  }
}

createRoot(document.getElementById('root')).render(<Boundary><App /></Boundary>)
start()

// installable app: register the service worker only when served over http(s), not from a file
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').then(r => r.update()).catch(() => {}))
}
